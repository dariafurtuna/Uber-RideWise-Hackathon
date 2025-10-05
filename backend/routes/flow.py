from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from random import uniform, randint
from datetime import datetime, date
import time
import sqlite3
from ..rating.models import RideCandidate
from ..rating.service import rate_ride

router = APIRouter(prefix="/flow", tags=["flow"])
_OFFERS = {}
_DRIVER_STATS = {}  # Track accepted rides per driver (earnings, rides, avg rating)
NL_AMS_LAT, NL_AMS_LON = 52.3702, 4.8952

class DecisionIn(BaseModel):
    offer_id: str
    decision: str  # "accept" or "decline"

@router.post("/drivers/{driver_id}/decision")
def driver_decision(driver_id: str, body: DecisionIn):
    """
    Driver accepts or declines an offer.
    Tracks accepted rides in _DRIVER_STATS for real-time aggregation.
    """
    offer = _OFFERS.get(body.offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail="offer_not_found")
    if offer["driver_id"] != driver_id:
        raise HTTPException(status_code=403, detail="wrong_driver")
    if offer["status"] != "pending":
        return {"offer_id": body.offer_id, "status": offer["status"]}
    decision = body.decision.lower().strip()
    if decision not in ("accept", "decline"):
        raise HTTPException(status_code=400, detail="invalid_decision")
    offer["status"] = "accepted" if decision == "accept" else "declined"

    # Track accepted rides for real-time stats
    if decision == "accept":
        est_earning = round(uniform(8, 20), 2)  # simulate €8–€20 per ride
        rider_rating = offer["candidate"]["rider_rating"]
        stats = _DRIVER_STATS.setdefault(driver_id, {
            "today_rides": 0,
            "today_earnings": 0.0,
            "ratings_sum": 0.0,
        })
        stats["today_rides"] += 1
        stats["today_earnings"] += est_earning
        stats["ratings_sum"] += rider_rating

    return {"offer_id": body.offer_id, "status": offer["status"]}
# ...existing code...


__all__ = ["router", "_DRIVER_STATS"]


class CompleteIn(BaseModel):
    offer_id: str
    net_eur: float | None = None
    duration_mins: float | None = None

def jitter(base, deg=0.02):
    return base + uniform(-deg, deg)

@router.get("/drivers/{driver_id}/next")
def next_offer(driver_id: str, debug: bool = Query(False)):
    """
    Simulate a new incoming ride for a given driver.
    The backend randomly generates pickup/dropoff, duration, etc.
    """
    pickup_lat = jitter(NL_AMS_LAT, 0.02)
    pickup_lon = jitter(NL_AMS_LON, 0.02)
    drop_lat = jitter(NL_AMS_LAT, 0.04)
    drop_lon = jitter(NL_AMS_LON, 0.05)
    est_distance_km = round(uniform(2, 10), 1)
    est_duration_mins = randint(8, 35)
    rider_rating = round(uniform(4.4, 4.98), 2)
    rider_id = f"r{randint(1000, 9999)}"

    candidate = RideCandidate(
        rider_id=rider_id,
        rider_rating=rider_rating,
        driver_id=driver_id,
        city_id=1,
        request_time=datetime.utcnow().isoformat() + "Z",
        product=None,
        driver_lat=NL_AMS_LAT,
        driver_lon=NL_AMS_LON,
        pickup_lat=pickup_lat,
        pickup_lon=pickup_lon,
        drop_lat=drop_lat,
        drop_lon=drop_lon,
        est_distance_km=est_distance_km,
        est_duration_mins=est_duration_mins,
    )

    rating = rate_ride(candidate, debug=debug)

    offer_id = f"offer_{randint(100000,999999)}"
    offer = {
        "offer_id": offer_id,
        "driver_id": driver_id,
        "created_at": time.time(),
        "ttl_seconds": 25,
        "status": "pending",
        "candidate": candidate.model_dump(),
        "rating": rating.model_dump(),
        "actuals": None,
    }
    _OFFERS[offer_id] = offer
    return offer

def _db():
    return sqlite3.connect("db/uber_hackathon_v2.db")

@router.post("/drivers/{driver_id}/complete")
def driver_complete(driver_id: str, body: CompleteIn):
    """
    Mark an accepted offer as completed and bump today's live aggregates in DB.
    """
    day = date.today().isoformat()
    conn = _db()
    try:
        conn.execute("""
            INSERT INTO live_aggregates (day, earner_id, earn_eur, minutes, rides)
            VALUES (?, ?, ?, ?, 1)
            ON CONFLICT(day, earner_id) DO UPDATE SET
                earn_eur = earn_eur + excluded.earn_eur,
                minutes  = minutes  + excluded.minutes,
                rides    = rides    + 1;
        """, (day, driver_id, float(body.net_eur or 0), float(body.duration_mins or 0)))
        conn.commit()
    finally:
        conn.close()
    return {"ok": True, "offer_id": getattr(body, 'offer_id', None), "status": "completed"}

@router.get("/drivers/{driver_id}/today_live")
def today_live(driver_id: str):
    """
    Read today's live aggregates from DB (persistent).
    """
    day = date.today().isoformat()
    conn = _db()
    try:
        row = conn.execute("""
            SELECT earn_eur, minutes, rides
            FROM live_aggregates
            WHERE day = ? AND earner_id = ?;
        """, (day, driver_id)).fetchone()
    finally:
        conn.close()
    if not row:
        return {"earn_eur": 0.0, "minutes": 0.0, "rides": 0}
    return {
        "earn_eur": float(row[0] or 0.0),
        "minutes": float(row[1] or 0.0),
        "rides": int(row[2] or 0),
    }
