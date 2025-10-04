# backend/rating/models.py
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any

# Overall score = weighted linear combo
WEIGHTS = {
    "profitability": 0.40,
    "time":          0.20,
    "pickup":        0.20,  # was 0.25
    "traffic":       0.10,  # was 0.15
    "customer":      0.10,  # new
}

class RideCandidate(BaseModel):
    # NEW: rider identity + optional rating
    rider_id: Optional[str] = None
    rider_rating: Optional[float] = Field(default=None, ge=1.0, le=5.0)

    # context
    driver_id: Optional[str] = None
    city_id: int
    request_time: str
    product: Optional[str] = None

    # driver location
    driver_lat: float
    driver_lon: float

    # pickup
    pickup_lat: float
    pickup_lon: float
    pickup_hex_id9: Optional[str] = None

    # dropoff
    drop_lat: Optional[float] = None
    drop_lon: Optional[float] = None

    # estimates
    est_distance_km: float = Field(..., ge=0)
    est_duration_mins: float = Field(..., ge=0)

class RideRating(BaseModel):
    overall: float
    breakdown: Dict[str, float]
    reasons: Dict[str, str]
    anchors_used: Dict[str, Any]