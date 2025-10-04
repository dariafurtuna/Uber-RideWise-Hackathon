# scripts/synthesize_rides.py
import argparse
import math
import os
import random
import sqlite3
import uuid
from pathlib import Path
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

import numpy as np
import pandas as pd
import h3

REPO = Path(__file__).resolve().parents[1]
DB_PATH = REPO / "db" / "uber_hackathon_v2.db"
EXCEL_PATH = REPO / "data" / "uber_hackathon_v2_mock_data.xlsx"
OUT_CSV = REPO / "data" / "rides_trips_synth.csv"
H3_RES = 8

# Reasonable jitter in meters for pickup/drop (urban)
MIN_JITTER_M = 200
MAX_JITTER_M = 800

rng = np.random.default_rng(42)

def _deg_offset(lat, meters):
    # rough deg/meter for small local offsets
    dlat = meters / 111_320.0
    dlon = meters / (40075000.0 * math.cos(math.radians(lat)) / 360.0)
    return dlat, dlon

def _jitter_point(lat, lon):
    r = rng.uniform(MIN_JITTER_M, MAX_JITTER_M)
    theta = rng.uniform(0, 2*math.pi)
    dx = r * math.cos(theta)
    dy = r * math.sin(theta)
    dlat, dlon = _deg_offset(lat, r)  # use r for scale; split by theta below
    # More precise split:
    dlat = dy / 111_320.0
    dlon = dx / (40075000.0 * math.cos(math.radians(lat)) / 360.0)
    return lat + dlat, lon + dlon

def _short_uuid():
    return uuid.uuid4().hex[:12]

def _choose_timestamp_columns(df):
    # Prefer full timestamps (with hour)
    candidates = [
        "start_time", "end_time", "pickup_time", "requested_at",
        "created_at", "datetime", "date"
    ]
    cols = [c for c in candidates if c in df.columns]
    if not cols:
        raise RuntimeError("No timestamp-like column in source.")
    # Find the first that actually has non-null and non-midnight variety
    for c in cols:
        s = pd.to_datetime(df[c], errors="coerce")
        if s.notna().sum() == 0:
            continue
        if s.dt.hour.nunique() > 1:
            return c
    # fallback: first usable (even if hours=0 → we’ll inject hour from distro)
    return cols[0]

def _date_range_from(df, ts_col):
    s = pd.to_datetime(df[ts_col], errors="coerce")
    s = s.dropna()
    if s.empty:
        # fallback: present month
        now = pd.Timestamp.now()
        return now - relativedelta(months=2), now
    return s.min(), s.max()

def _hour_dow_mixes(df, ts_col):
    s = pd.to_datetime(df[ts_col], errors="coerce")
    # If ts_col lacks hour, derive hour from ‘hour’/‘start_hour’ if present
    if s.dt.hour.nunique() <= 1:
        if "hour" in df.columns:
            hours = df["hour"].fillna(0).astype(int).clip(0,23).values
        else:
            # fabricate from current distro of start_time’s day; assume evening bias
            hours = rng.integers(8, 23, size=len(df))
        dows = s.dt.dayofweek.fillna(0).astype(int).values  # 0=Mon..6=Sun (Python)
    else:
        hours = s.dt.hour.values
        dows = s.dt.dayofweek.values
    # pmf for hour & dow
    hour_counts = np.bincount(hours, minlength=24)
    dow_counts = np.bincount(dows, minlength=7)
    # avoid zeros
    hour_p = (hour_counts + 1e-3) / (hour_counts.sum() + 24e-3)
    dow_p = (dow_counts + 1e-3) / (dow_counts.sum() + 7e-3)
    return hour_p, dow_p

def _categorical_pmf(series):
    vc = series.value_counts(dropna=True)
    if vc.empty:
        return {None: 1.0}
    probs = (vc + 1) / (vc.sum() + len(vc))
    return probs.to_dict()

def _sample_from_pmf(pmf_dict, n):
    cats = list(pmf_dict.keys())
    probs = np.array(list(pmf_dict.values()), dtype=float)
    probs = probs / probs.sum()
    idx = rng.choice(len(cats), size=n, p=probs)
    return [cats[i] for i in idx]

def synthesize(df, target_total=30_000):
    # Learn distributions
    ts_col = _choose_timestamp_columns(df)
    tmin, tmax = _date_range_from(df, ts_col)
    hour_p, dow_p = _hour_dow_mixes(df, ts_col)

    pmf_city   = _categorical_pmf(df.get("city_id", pd.Series([1]*len(df))))
    pmf_prod   = _categorical_pmf(df.get("product", pd.Series(["UberX"]*len(df))))
    pmf_ev     = _categorical_pmf(df.get("is_ev", pd.Series(["FALSE"]*len(df))))
    pmf_pay    = _categorical_pmf(df.get("payment_type", pd.Series(["card"]*len(df))))
    pmf_vehicle= _categorical_pmf(df.get("vehicle_type", pd.Series(["car"]*len(df))))

    # Distance/time/earn distributions (lognormal-ish)
    dist_km = df.get("distance_km", pd.Series(rng.lognormal(mean=1.4, sigma=0.5, size=len(df))))
    dur_min = df.get("duration_min", pd.Series(dist_km*3.5 + rng.normal(0, 5, len(df))))
    earn    = df.get("net_earnings", pd.Series(dist_km*1.2 + 3 + rng.normal(0,2,len(df))))
    surge   = df.get("surge_multiplier", pd.Series(rng.choice([1.0,1.05,1.1,1.2,1.3], len(df), p=[0.6,0.15,0.12,0.08,0.05])))

    # City centroids from existing pickups
    centroids = {}
    if "city_id" in df.columns and "pickup_lat" in df.columns and "pickup_lon" in df.columns:
        for cid, g in df.groupby("city_id"):
            lat = g["pickup_lat"].astype(float).mean()
            lon = g["pickup_lon"].astype(float).mean()
            centroids[cid] = (lat, lon)
    # Fallback centroid (Rotterdam-ish) if anything missing
    if not centroids:
        centroids = {1: (51.9244, 4.4777)}

    base_n = len(df)
    need = max(0, target_total - base_n)
    if need == 0:
        print("[synth] Source already >= target; nothing to do.")
        return df.copy()

    # We’ll sample base rows with replacement, then jitter & override fields
    sample_idx = rng.integers(0, base_n, size=need)
    base_sample = df.iloc[sample_idx].copy()

    # Time generation
    # Sample DoW and hour independently using learned pmfs, then pick a date in [tmin, tmax] that matches DoW.
    dows = rng.choice(7, size=need, p=dow_p)
    hours = rng.choice(24, size=need, p=hour_p)
    # Random date in range
    days_span = max(1, (pd.Timestamp(tmax) - pd.Timestamp(tmin)).days)
    rand_days = rng.integers(0, days_span, size=need)
    dates = (pd.Timestamp(tmin).normalize() + pd.to_timedelta(rand_days, unit="D"))

    # Adjust dates to requested DoW
    def align_dow(d, dow):
        # pandas Monday=0..Sunday=6
        delta = (dow - d.dayofweek) % 7
        return d + pd.Timedelta(days=int(delta))

    aligned_dates = [align_dow(d, int(dw)) for d, dw in zip(dates, dows)]
    minutes = rng.integers(0, 60, size=need)
    seconds = rng.integers(0, 60, size=need)
    start_times = [
        pd.Timestamp(year=d.year, month=d.month, day=d.day, hour=int(h), minute=int(m), second=int(s))
        for d, h, m, s in zip(aligned_dates, hours, minutes, seconds)
    ]

    # City/product/payment samples
    cities   = _sample_from_pmf(pmf_city, need)
    products = _sample_from_pmf(pmf_prod, need)
    is_evs   = _sample_from_pmf(pmf_ev, need)
    pays     = _sample_from_pmf(pmf_pay, need)
    vehicles = _sample_from_pmf(pmf_vehicle, need)

    # Base numeric resamples/jitters
    dist = np.clip(rng.choice(dist_km.to_numpy(), size=need) * rng.lognormal(0, 0.15, need), 0.5, 50.0)
    durm = np.clip(rng.choice(dur_min.to_numpy(), size=need) * rng.lognormal(0, 0.15, need), 4, 120)
    surged = rng.choice(surge.to_numpy(), size=need)
    # Earnings: distance * 1.4e + time * 0.25e + base 2.5e, times surge, plus noise
    earn_base = 2.5 + dist*1.4 + (durm/60.0)*10*0.25
    earn_vals = np.clip(earn_base * surged * rng.lognormal(0, 0.12, need), 3.0, 120.0)
    tips = np.where(rng.random(need) < 0.22, rng.lognormal(mean=0.5, sigma=0.7, size=need), 0.0)
    uber_fee = np.clip(earn_vals * rng.uniform(0.18, 0.25, size=need), 0.5, None)
    net_earn = earn_vals - uber_fee + tips

    # ===== NEW: spread across MANY hexes using H3 disks/rings =====
    # seeds: real pickups if present, else city centroid for the chosen city
    if {"pickup_lat","pickup_lon"}.issubset(base_sample.columns):
        seed_lats = base_sample["pickup_lat"].astype(float).to_numpy()
        seed_lons = base_sample["pickup_lon"].astype(float).to_numpy()
    else:
        seed_lats = np.array([centroids.get(cid, (51.9244, 4.4777))[0] for cid in cities], dtype=float)
        seed_lons = np.array([centroids.get(cid, (51.9244, 4.4777))[1] for cid in cities], dtype=float)

    def random_hex_around(lat, lon, k_max=18):
        # res=8 → cell radius ~0.6–0.7 km; k=18 ≈ 10–12 km disk
        seed = h3.latlng_to_cell(float(lat), float(lon), H3_RES)
        k = int(rng.integers(3, k_max))       # avoid sticking to the seed cell
        disk = list(h3.grid_disk(seed, k))
        return rng.choice(disk)

    pickup_hex, pickups_lat, pickups_lon = [], [], []
    for plat0, plon0 in zip(seed_lats, seed_lons):
        hx = random_hex_around(plat0, plon0, k_max=18)
        latp, lonp = h3.cell_to_latlng(hx)
        pickup_hex.append(hx)
        pickups_lat.append(latp)
        pickups_lon.append(lonp)

    # Drop hex ~ distance_km away: pick a ring proportional to km (cap to keep in city)
    drop_hex, drops_lat, drops_lon = [], [], []
    for hx, d_km in zip(pickup_hex, dist):
        k = max(1, min(28, int(d_km / 0.6)))  # rings ~ km at res8
        ring = list(h3.grid_ring(hx, k)) if k > 0 else [hx]
        dh = rng.choice(ring) if ring else hx
        latd, lond = h3.cell_to_latlng(dh)
        drop_hex.append(dh)
        drops_lat.append(latd)
        drops_lon.append(lond)

    # End time from duration
    end_times = [t + timedelta(minutes=float(m)) for t, m in zip(start_times, durm)]

    # Build new dataframe with same columns as existing df where possible
    new = pd.DataFrame({
        "ride_id": [_short_uuid() for _ in range(need)],
        "driver_id": rng.choice(df["driver_id"].dropna().unique(), size=need) if "driver_id" in df else ["E10001"]*need,
        "rider_id":  rng.choice(df["rider_id"].dropna().unique(), size=need) if "rider_id"  in df else ["R20001"]*need,
        "city_id":   cities,
        "product":   products,
        "vehicle_type": vehicles if "vehicle_type" in df else "car",
        "is_ev":     is_evs,
        "start_time": [t.strftime("%Y-%m-%d %H:%M:%S") for t in start_times],
        "end_time":   [t.strftime("%Y-%m-%d %H:%M:%S") for t in end_times],
        "pickup_lat": pickups_lat,
        "pickup_lon": pickups_lon,
        "pickup_hex": pickup_hex,
        "drop_lat":   drops_lat,
        "drop_lon":   drops_lon,
        "drop_hex":   drop_hex,
        "distance_km": np.round(dist, 2),
        "duration_min": np.round(durm, 1),
        "surge_multiplier": np.round(surged, 2),
        "fare_amount": np.round(earn_vals, 2) if "fare_amount" in df.columns else np.round(earn_vals, 2),
        "uber_fee":   np.round(uber_fee, 2),
        "net_earnings": np.round(net_earn, 2),
        "tips": np.round(tips, 2),
        "payment_type": pays,
        "date": [t.strftime("%Y-%m-%d") for t in start_times],
    })

    # # Align columns to match original order as much as possible
    # cols = list(df.columns)
    # for c in new.columns:
    #     if c not in cols:
    #         cols.append(c)
    # new = new.reindex(columns=cols)

    # Combine with original
    out = pd.concat([df, new], ignore_index=True)
    return out, new

def load_source():
    if DB_PATH.exists():
        conn = sqlite3.connect(DB_PATH)
        try:
            df = pd.read_sql_query("SELECT * FROM rides_trips", conn)
            conn.close()
            print(f"[synth] Loaded rides_trips from DB: {len(df)} rows")
            return df
        except Exception as e:
            conn.close()
            print(f"[synth] Failed DB read, will try Excel: {e}")

    if EXCEL_PATH.exists():
        xls = pd.ExcelFile(EXCEL_PATH)
        df = pd.read_excel(xls, sheet_name="rides_trips")
        print(f"[synth] Loaded rides_trips from Excel: {len(df)} rows")
        return df

    raise FileNotFoundError("No DB or Excel source found.")

def write_db_append(df_new):
    conn = sqlite3.connect(DB_PATH)
    # Read the actual schema from SQLite
    schema_cols = [r[1] for r in conn.execute("PRAGMA table_info(rides_trips)")]

    # Keep only columns that exist in the DB; add missing ones as NA if needed
    to_write = df_new.reindex(columns=schema_cols)

    # Ensure datetimes are strings in ISO format
    for c in ("start_time", "end_time"):
        if c in to_write.columns:
            to_write[c] = pd.to_datetime(to_write[c], errors="coerce").dt.strftime("%Y-%m-%d %H:%M:%S")

    # Write
    to_write.to_sql("rides_trips", conn, if_exists="append", index=False)
    conn.commit()

    # Show new count for sanity
    new_count = conn.execute("SELECT COUNT(*) FROM rides_trips").fetchone()[0]
    conn.close()
    print(f"[synth] Appended {len(to_write)} rows into DB rides_trips (now {new_count})")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target", type=int, default=30000, help="Total rows desired in rides_trips")
    ap.add_argument("--write-db", action="store_true", help="Append synthesized rows into SQLite DB")
    ap.add_argument("--csv", type=str, default=str(OUT_CSV), help="Where to write the synthesized CSV (full set)")
    args = ap.parse_args()

    df = load_source()
    out, new = synthesize(df, target_total=args.target)

    # Save full combined to CSV for auditing
    Path(args.csv).parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(args.csv, index=False)
    print(f"[synth] Wrote combined CSV: {args.csv} (rows={len(out)})")

    if args.write_db and DB_PATH.exists():
        write_db_append(new)

    print("[synth] Done.")

if __name__ == "__main__":
    main()
