# backend/rating/scoring.py
from typing import Tuple
from .utils import haversine_km, linear_scale, clamp
from typing import Optional

def score_pickup(driver_lat, driver_lon, pickup_lat, pickup_lon) -> Tuple[float, str]:
    """
    Piecewise mapping (agreed):
      0–0.5 km  -> ~100..95
      0.5–2 km  -> 95..70 (linear)
      2–5 km    -> 70..40 (linear)
      >5 km     -> 25 (min clamp)
    """
    d = haversine_km(driver_lat, driver_lon, pickup_lat, pickup_lon)

    if d <= 0.5:
        score = linear_scale(d, 0.0, 0.5, 100, 95)
    elif d <= 2.0:
        score = linear_scale(d, 0.5, 2.0, 95, 70)
    elif d <= 5.0:
        score = linear_scale(d, 2.0, 5.0, 70, 40)
    else:
        score = 25.0

    reason = f"{d:.1f} km away"
    return clamp(score, 0, 100), reason

    
def score_customer(rider_rating: Optional[float],
                   rating_anchors: dict) -> Tuple[float, str]:
    """
    Normalize rider 1..5 stars against city distribution anchors:
      - P25 -> ~55
      - P50 -> ~70
      - P75 -> ~90
    Unknown rating => neutral 70.
    """
    if rider_rating is None:
        return 70.0, "No rider rating"

    p25 = rating_anchors.get("p25") or 4.6
    p50 = rating_anchors.get("p50") or 4.8
    p75 = rating_anchors.get("p75") or 4.92

    # piecewise: below P25, between P25-P50, P50-P75, above P75
    if rider_rating <= p25:
        # map [min..P25] -> [35..55]
        score = 35.0 + ( (rider_rating - 1.0) / max(1e-6, (p25 - 1.0)) ) * (55.0 - 35.0)
    elif rider_rating <= p50:
        score = 55.0 + ( (rider_rating - p25) / max(1e-6, (p50 - p25)) ) * (70.0 - 55.0)
    elif rider_rating <= p75:
        score = 70.0 + ( (rider_rating - p50) / max(1e-6, (p75 - p50)) ) * (90.0 - 70.0)
    else:
        # map [P75..5.0] -> [90..100]
        score = 90.0 + ( (rider_rating - p75) / max(1e-6, (5.0 - p75)) ) * (100.0 - 90.0)

    score = max(0.0, min(100.0, score))
    reason = f"Rider {rider_rating:.2f}★ vs city P50 {p50:.2f}★"
    return score, reason