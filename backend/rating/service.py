# backend/rating/service.py
from .models import RideCandidate, RideRating, WEIGHTS
from .hist import rating_anchors_for_city
from .scoring import score_pickup, score_customer
from .utils import clamp

def rate_ride(candidate: RideCandidate) -> RideRating:
    # --- customer ---
    customer_anchors = rating_anchors_for_city(candidate.city_id)
    cust_score, cust_reason = score_customer(candidate.rider_rating, customer_anchors)

    # --- pickup ---
    pickup_score, pickup_reason = score_pickup(
        candidate.driver_lat, candidate.driver_lon,
        candidate.pickup_lat, candidate.pickup_lon
    )

    # --- minimal time stub (to be replaced by hist-based anchors) ---
    # simple mapping: <=15min great, 15-45 linear, >45 poor
    dur = float(candidate.est_duration_mins)
    if dur <= 15:
        time_score = 90.0
    elif dur <= 45:
        # map 15..45 -> 90..50
        time_score = 90.0 - (dur - 15) * (40.0 / 30.0)
    else:
        time_score = 40.0
    time_reason = f"Est. {dur:.0f} min (stub)"

    # --- minimal profitability stub (to be replaced by hist-based anchors) ---
    # assume €1.2/km base estimate → €/min normalization
    est_net = 1.2 * float(candidate.est_distance_km)
    npm = est_net / max(1e-6, dur)
    # map €/min: 0.2->40, 0.4->70, 0.6+ -> 90
    if npm <= 0.2:
        prof_score = 40.0
    elif npm <= 0.4:
        prof_score = 40.0 + (npm - 0.2) * (30.0 / 0.2)
    elif npm <= 0.6:
        prof_score = 70.0 + (npm - 0.4) * (20.0 / 0.2)
    else:
        prof_score = 90.0
    prof_reason = f"~€{est_net:.2f} est. (~€{npm:.2f}/min, stub)"

    # --- minimal traffic stub (neutral for now) ---
    traffic_score = 70.0
    traffic_reason = "Neutral (live traffic not wired yet)"

    breakdown = {
        "profitability": prof_score,
        "time": time_score,
        "pickup": pickup_score,
        "traffic": traffic_score,
        "customer": cust_score,
    }
    # weighted linear blend
    overall = sum(breakdown[k] * WEIGHTS[k] for k in WEIGHTS.keys())
    overall = round(clamp(overall, 0, 100), 1)

    reasons = {
        "profitability": prof_reason,
        "time": time_reason,
        "pickup": pickup_reason,
        "traffic": traffic_reason,
        "customer": cust_reason,
    }

    anchors_used = {
        "customer": customer_anchors,
        "notes": "time/profitability/traffic are stubbed for integration."
    }

    return RideRating(
        overall=overall,
        breakdown=breakdown,
        reasons=reasons,
        anchors_used=anchors_used
    )
