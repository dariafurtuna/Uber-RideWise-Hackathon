from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel
from random import uniform, randint
from datetime import datetime
import time

from ..rating.models import RideCandidate
from ..rating.service import rate_ride

router = APIRouter(prefix="/flow", tags=["flow"])

# Amsterdam center as reference
NL_AMS_LAT, NL_AMS_LON = 52.3702, 4.8952

# In-memory offers {offer_id: offer_dict}
_OFFERS: dict[str, dict] = {}

def jitter(base, deg=0.02):
    return base + uniform(-deg, deg)

def _is_expired(offer: dict) -> bool:
    return (time.time() - offer["created_at"]) > offer["ttl_seconds"]

class DecisionIn(BaseModel):
    offer_id: str
    decision: str  # "accept" or "decline"

@router.get("/drivers/{driver_id}/next")
def next_offer(driver_id: str, debug: bool = Query(False)):
    """
    Simulate a new incoming ride for a given driver.
    The backend randomly generates pickup/dropoff, duration, etc.
    """
    # --- Randomize ride details ---
    pickup_lat = jitter(NL_AMS_LAT, 0.02)
    pickup_lon = jitter(NL_AMS_LON, 0.02)
    drop_lat = jitter(NL_AMS_LAT, 0.04)
    drop_lon = jitter(NL_AMS_LON, 0.05)
    est_distance_km = round(uniform(2, 10), 1)
    est_duration_mins = randint(8, 35)
    rider_rating = round(uniform(4.4, 4.98), 2)
    rider_id = f"r{randint(1000, 9999)}"

    # --- Create candidate ---
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

    # --- Rate the ride ---
    rating = rate_ride(candidate, debug=debug)

    # --- Build & store the offer ---
    offer_id = f"offer_{randint(100000,999999)}"
    offer = {
        "offer_id": offer_id,
        "driver_id": driver_id,
        "created_at": time.time(),
        "ttl_seconds": 25,
        "status": "pending",  # pending | accepted | declined | expired
        "candidate": candidate.model_dump(),
        "rating": rating.model_dump(),
    }
    _OFFERS[offer_id] = offer

    return offer

@router.post("/drivers/{driver_id}/decision")
def driver_decision(driver_id: str, body: DecisionIn):
    """
    Driver accepts or declines an offer.
    """
    offer = _OFFERS.get(body.offer_id)
    if not offer:
        raise HTTPException(status_code=404, detail="offer_not_found")

    if offer["driver_id"] != driver_id:
        raise HTTPException(status_code=403, detail="wrong_driver")

    if offer["status"] != "pending":
        return {"offer_id": body.offer_id, "status": offer["status"]}

    if _is_expired(offer):
        offer["status"] = "expired"
        return {"offer_id": body.offer_id, "status": "expired"}

    decision = body.decision.lower().strip()
    if decision not in ("accept", "decline"):
        raise HTTPException(status_code=400, detail="invalid_decision")

    offer["status"] = "accepted" if decision == "accept" else "declined"
    return {"offer_id": body.offer_id, "status": offer["status"]}
