from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Literal
from fastapi import Query
from zoneinfo import ZoneInfo
import h3
import math

# Resolve DB path relative to the repo root (parent of this 'backend' folder)
REPO_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = REPO_ROOT / "db" / "uber_hackathon_v2.db"
app = FastAPI(title="Smart Earner API")

# Allow frontend dev server (Vite) to access the API in the browser
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",  # vite preview
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def q(sql, params=()):
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

H3_RES = 8
EU_AMS = ZoneInfo("Europe/Amsterdam")

def _cell_center(h):
    lat, lng = h3.cell_to_latlng(h)
    return lat, lng

def _km_between(lat1, lon1, lat2, lon2):
    # haversine
    R = 6371.0
    from math import radians, sin, cos, asin, sqrt
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * R * asin(min(1, sqrt(a)))

def _ring_k_for_radius_km(radius_km):
    """
    Convert geographic radius (km) to an H3 disk 'k' (rings) at res=8.
    Use a conservative circumradius (~0.65 km) and +1 safety ring.
    """
    HEX_CIRCUMRADIUS_KM_RES8 = 0.65
    return max(1, int(math.ceil(radius_km / HEX_CIRCUMRADIUS_KM_RES8)) + 1)

def _val(conn, h, dow, hour, weight):
    row = conn.execute(
        "SELECT cnt, earn, surge FROM agg_h3_dow_hr WHERE h3=? AND dow=? AND hour=?",
        (h, dow, hour),
    ).fetchone()
    if not row:
        return 0.0
    if weight == "count":
        return float(row[0] or 0)
    if weight == "earnings":
        return float(row[1] or 0)
    if weight == "surge":
        return float(row[2] or 0)
    return 0.0

@app.get("/heatmap/predict")
def predict_heatmap(
    lat: float = Query(...),
    lng: float = Query(...),
    when: str = Query(..., description="ISO time, e.g. 2025-10-04T17:00:00+02:00"),
    radius_km: float = Query(3.0, ge=0.3, le=20.0),
    weight: Literal["count", "earnings", "surge"] = "count",
    mode: Literal["heat", "grid"] = "grid",
):
    # Parse time and get local DOW/HOUR
    ts = datetime.fromisoformat(when)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=EU_AMS)
    ts_local = ts.astimezone(EU_AMS)
    dow = ts_local.weekday()  # 0=Mon .. 6=Sun
    hour = ts_local.hour
    dow_db = (dow + 1) % 7

    # Candidate cells by H3 rings, then strict km filter by centers
    c = h3.latlng_to_cell(lat, lng, H3_RES)
    k = _ring_k_for_radius_km(radius_km)
    candidate = h3.grid_disk(c, k)

    cells = []
    for h in candidate:
        clat, clng = _cell_center(h)
        if _km_between(lat, lng, clat, clng) <= radius_km + 1e-6:
            cells.append(h)

    conn = sqlite3.connect(DB_PATH)
    values = []

    for h in cells:
        # temporal smoothing ±1hr
        v0 = _val(conn, h, dow_db, (hour - 1) % 24, weight)
        v1 = _val(conn, h, dow_db, hour, weight)
        v2 = _val(conn, h, dow_db, (hour + 1) % 24, weight)
        base = 0.25 * v0 + 0.5 * v1 + 0.25 * v2

        # spatial smoothing: average immediate neighbors (small boost)
        neigh_vals = []
        for nh in h3.grid_disk(h, 1):
            if nh == h:
                continue
            nv1 = _val(conn, nh, dow_db, hour, weight)
            if nv1 > 0:
                neigh_vals.append(nv1)
        if neigh_vals:
            base = 0.8 * base + 0.2 * (sum(neigh_vals) / len(neigh_vals))

        values.append(base)

    # Normalize to 0..1 for visual ramps
    mx = max(values) if values else 1.0
    norm_vals = [(0.0 if mx == 0 else v / mx) for v in values]

    conn.close()

    # Branch by mode
    if mode == "heat":
        # point heat layer (centers)
        points = []
        for h, v in zip(cells, norm_vals):
            clat, clng = _cell_center(h)
            points.append([clat, clng, v])  # [lat, lon, intensity]
        return {
            "center": [lat, lng],
            "when_local": ts_local.isoformat(),
            "radius_km": radius_km,
            "weight": weight,
            "count": len(points),
            "points": points,
        }

    # grid mode: polygons for choropleth
    grid_cells = []
    for h, v in zip(cells, norm_vals):
        boundary = h3.cell_to_boundary(h)  # list of (lat, lon)
        grid_cells.append({
            "h3": h,
            "value": v,
            "center": _cell_center(h),
            "boundary": [[latb, lngb] for (latb, lngb) in boundary],
        })

    return {
        "center": [lat, lng],
        "when_local": ts_local.isoformat(),
        "radius_km": radius_km,
        "weight": weight,
        "count": len(grid_cells),
        "cells": grid_cells,
    }

@app.get("/earners/top")
def top_earners(limit: int = 10):
    return q("""
        SELECT driver_id AS earner_id, SUM(net_earnings) AS net
        FROM rides_trips
        GROUP BY driver_id
        ORDER BY net DESC
        LIMIT ?;
    """, (limit,))

@app.get("/earners/{earner_id}/daily")
def earner_daily(earner_id: str, limit: int = 14):
    return q("""
        SELECT date, total_net_earnings, trips_count, orders_count
        FROM earnings_daily
        WHERE earner_id = ?
        ORDER BY date DESC
        LIMIT ?;
    """, (earner_id, limit))

@app.get("/incentives/{earner_id}")
def incentives(earner_id: str):
    return q("""
        SELECT week, program, target_jobs, completed_jobs, achieved, bonus_eur
        FROM incentives_weekly
        WHERE earner_id = ?
        ORDER BY week DESC;
    """, (earner_id,))
