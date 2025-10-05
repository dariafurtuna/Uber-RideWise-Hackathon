
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
from pathlib import Path
from typing import Literal
from fastapi import Query
from zoneinfo import ZoneInfo
import h3
import math
from datetime import date, datetime
from .routes.ride_rating import router as ride_rating_router
from .routes.flow import router as flow_router
# NEW: import the live overlay helper (no circular ref)

# --- Unified daily summary endpoint ---


# Resolve DB path relative to the repo root (parent of this 'backend' folder)
REPO_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = REPO_ROOT / "db" / "uber_hackathon_v2.db"
app = FastAPI(title="Smart Earner API")

# Mount routers
app.include_router(ride_rating_router)
app.include_router(flow_router)

# CORS for Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
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
    return rows

@app.get("/earners/{earner_id}/today_summary")
def today_summary(earner_id: str):
    """
    Combined daily summary: earnings, rides completed, and average rating.
    """
    today_str = date.today().isoformat()
    result = q("""
        SELECT 
            COALESCE(SUM(total_net_earnings), 0) AS today_earnings,
            COALESCE(SUM(trips_count + orders_count), 0) AS rides_completed,
            ROUND(AVG(avg_rating), 2) AS avg_rating
        FROM earnings_daily
        WHERE earner_id = ? AND date = ?;
    """, (earner_id, today_str))
    if result:
        return result[0]
    return {"today_earnings": 0, "rides_completed": 0, "avg_rating": 0.0}

# Resolve DB path relative to the repo root (parent of this 'backend' folder)
REPO_ROOT = Path(__file__).resolve().parents[1]
DB_PATH = REPO_ROOT / "db" / "uber_hackathon_v2.db"


# CORS for Vite
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



H3_RES = 8
EU_AMS = ZoneInfo("Europe/Amsterdam")

def _cell_center(h):
    lat, lng = h3.cell_to_latlng(h)
    return lat, lng

def _km_between(lat1, lon1, lat2, lon2):
    R = 6371.0
    from math import radians, sin, cos, asin, sqrt
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon / 2) ** 2
    return 2 * R * asin(min(1, sqrt(a)))

def _ring_k_for_radius_km(radius_km):
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
    ts = datetime.fromisoformat(when)
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=EU_AMS)
    ts_local = ts.astimezone(EU_AMS)
    dow = ts_local.weekday()
    hour = ts_local.hour
    dow_db = (dow + 1) % 7

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
        v0 = _val(conn, h, dow_db, (hour - 1) % 24, weight)
        v1 = _val(conn, h, dow_db, hour, weight)
        v2 = _val(conn, h, dow_db, (hour + 1) % 24, weight)
        base = 0.25 * v0 + 0.5 * v1 + 0.25 * v2
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
    mx = max(values) if values else 1.0
    norm_vals = [(0.0 if mx == 0 else v / mx) for v in values]
    conn.close()

    if mode == "heat":
        points = []
        for h, v in zip(cells, norm_vals):
            clat, clng = _cell_center(h)
            points.append([clat, clng, v])
        return {
            "center": [lat, lng],
            "when_local": ts_local.isoformat(),
            "radius_km": radius_km,
            "weight": weight,
            "count": len(points),
            "points": points,
        }

    grid_cells = []
    for h, v in zip(cells, norm_vals):
        boundary = h3.cell_to_boundary(h)
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

@app.get("/earners/{earner_id}/today")
def earner_today(earner_id: str):
    today_str = date.today().isoformat()
    # base (historic daily table)
    result = q("""
        SELECT COALESCE(SUM(total_net_earnings), 0) AS today_earnings
        FROM earnings_daily
        WHERE earner_id = ? AND date = ?;
    """, (earner_id, today_str))
    base = float(result[0]["today_earnings"] if result else 0.0)

    # live overlay (persistent table)
    conn = sqlite3.connect(str(DB_PATH))
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS live_aggregates (
                day TEXT NOT NULL,
                earner_id TEXT NOT NULL,
                earn_eur REAL NOT NULL DEFAULT 0,
                minutes REAL NOT NULL DEFAULT 0,
                rides INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (day, earner_id)
            );
        """)
        row = conn.execute("""
            SELECT COALESCE(earn_eur, 0) FROM live_aggregates
            WHERE day = ? AND earner_id = ?;
        """, (today_str, earner_id)).fetchone()
        live = float(row[0] if row and row[0] is not None else 0.0)
    finally:
        conn.close()

    return {"today_earnings": round(base + live, 2)}

@app.get("/earners/{earner_id}/today_time")
def earner_today_time(earner_id: str):
    today_str = date.today().isoformat()
    result = q("""
        SELECT COALESCE(SUM(rides_duration_mins + eats_duration_mins), 0) AS minutes
        FROM earnings_daily
        WHERE earner_id = ? AND date = ?;
    """, (earner_id, today_str))
    base_minutes = float(result[0]["minutes"] if result else 0.0)

    # live overlay (persistent)
    conn = sqlite3.connect(str(DB_PATH))
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS live_aggregates (
                day TEXT NOT NULL,
                earner_id TEXT NOT NULL,
                earn_eur REAL NOT NULL DEFAULT 0,
                minutes REAL NOT NULL DEFAULT 0,
                rides INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (day, earner_id)
            );
        """)
        row = conn.execute("""
            SELECT COALESCE(minutes, 0) FROM live_aggregates
            WHERE day = ? AND earner_id = ?;
        """, (today_str, earner_id)).fetchone()
        live_minutes = float(row[0] if row and row[0] is not None else 0.0)
    finally:
        conn.close()

    total_minutes = base_minutes + live_minutes
    hours = round(total_minutes / 60.0, 2)
    return {"today_time_hours": hours}

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

@app.get("/nudges/{earner_id}")
def get_nudges(earner_id: str):
    sessions = q(
        """
        SELECT start_time, end_time, duration
        FROM driver_sessions
        WHERE earner_id = ?
        ORDER BY start_time DESC
        LIMIT 1;
        """,
        (earner_id,)
    )
    if not sessions:
        return {"message": "No session data available."}
    session = sessions[0]
    nudges = []
    if session["duration"] and session["duration"] >= 120:
        nudges.append(
            "You’ve been driving for 2 hours. How about a 15-minute coffee break? Taking regular breaks keeps you alert and safe."
        )
    current_hour = datetime.now().hour
    if 12 <= current_hour <= 14:
        nudges.append("It’s lunchtime! Don’t forget to grab a healthy meal.")
    elif 20 <= current_hour <= 22:
        nudges.append("It’s getting late. Consider wrapping up soon if you feel tired.")
    return {"nudges": nudges}

@app.get("/forecast/{city_id}/{dow}")
def forecast_for_day(city_id: int, dow: int):
    city = q("SELECT city_name FROM cities WHERE city_id = ?", (city_id,))
    city_name = city[0]["city_name"] if city else f"City {city_id}"
    hourly = q("""
        SELECT hour, trips, eph
        FROM v_city_hour_forecast
        WHERE city_id = ? AND dow = ?
        ORDER BY hour
    """, (city_id, dow))
    if not hourly:
        surge = q("""
            SELECT hour, surge_multiplier
            FROM surge_by_hour
            WHERE city_id = ?
            ORDER BY hour
        """, (city_id,))
        hourly = [
            {"hour": r["hour"], "trips": None, "eph": round(20 * r["surge_multiplier"], 2)}
            for r in surge
        ]
    now = datetime.now(EU_AMS)
    current_hour = now.hour
    surge_row = q("""
        SELECT surge_multiplier
        FROM surge_by_hour
        WHERE city_id = ? AND hour = ?
    """, (city_id, current_hour))
    current_surge = surge_row[0]["surge_multiplier"] if surge_row else None
    return {
        "city_id": city_id,
        "city_name": city_name,
        "dow": dow,
        "forecast": hourly,
        "current_surge": current_surge
    }

    