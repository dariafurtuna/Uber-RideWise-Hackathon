from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
from pathlib import Path
from datetime import date
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

@app.get("/earners/{earner_id}/today")
def earner_today(earner_id: str):
    today_str = date.today().isoformat()
    result = q("""
        SELECT COALESCE(SUM(total_net_earnings), 0) AS today_earnings
        FROM earnings_daily
        WHERE earner_id = ? AND date = ?;
    """, (earner_id, today_str))
    return result[0] if result else {"today_earnings": 0}

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

    # Check for fatigue (e.g., driving for more than 2 hours continuously)
    if session["duration"] and session["duration"] >= 120:
        nudges.append(
            "You’ve been driving for 2 hours. How about a 15-minute coffee break? Taking regular breaks keeps you alert and safe."
        )

    # Add time-of-day-based wellness tips
    from datetime import datetime
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

    return {
        "city_id": city_id,
        "city_name": city_name,
        "dow": dow,
        "forecast": hourly
    }
