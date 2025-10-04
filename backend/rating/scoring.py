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

def score_time(anchors: dict, est_duration_mins: float) -> Tuple[float, str]:
    """
    Compare estimated duration to historical anchors.
    Shorter trips usually better.
    """
    p25 = anchors.get("p25") or 10.0
    p75 = anchors.get("p75") or 40.0

    # map est_duration between p25 and p75 → score between 90 and 50
    score = 100 - linear_scale(est_duration_mins, p25, p75, 10, 90)
    score = clamp(score, 0, 100)

    reason = f"Est. {est_duration_mins:.0f} min vs P25 {p25:.0f} / P75 {p75:.0f}"
    return score, reason

# add surge_mult param (default 1.0) and mention it in reason
def score_profitability(anchors: dict,
                        est_distance_km: float,
                        est_duration_mins: float,
                        surge_mult: float = 1.0) -> tuple[float, str]:
    if est_duration_mins <= 0:
        return 50.0, "Invalid duration"

    # base €1.2/km * surge
    est_net = 1.2 * est_distance_km * max(0.0, surge_mult)
    npm = est_net / est_duration_mins

    p25 = anchors.get("p25") or 0.25
    p75 = anchors.get("p75") or 0.45

    score = linear_scale(npm, p25, p75, 40, 90)
    score = clamp(score, 0, 100)

    surge_note = f" x{surge_mult:.2f} surge" if surge_mult and surge_mult != 1.0 else ""
    reason = f"~€{est_net:.2f} est. (~€{npm:.2f}/min){surge_note} vs P25 {p25:.2f} / P75 {p75:.2f}"
    return score, reason
