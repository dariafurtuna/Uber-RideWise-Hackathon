from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
from pathlib import Path
from datetime import datetime

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


@app.get("/forecast/{city_id}/today")
def forecast_today(city_id: int):
    dow = int(datetime.utcnow().strftime("%w"))

    # Look up city name from earners table (or create a cities table if you have one)
    city = q("SELECT DISTINCT home_city_id FROM earners WHERE home_city_id = ?", (city_id,))
    city_name = f"City {city_id}"  # fallback
    if city:
        city_name = f"City {city_id}"  # replace with real name mapping if available

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

    return {
        "city_id": city_id,
        "city_name": city_name,
        "dow": dow,
        "forecast": hourly
    }
