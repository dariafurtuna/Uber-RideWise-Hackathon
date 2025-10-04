from .models import RideCandidate, RideRating, WEIGHTS
from .traffic import score_traffic
from .hist import (
    rating_anchors_for_city,
    duration_anchors_for_city,
    profitability_anchors_for_city,
)
from .scoring import (
    score_pickup,
    score_customer,
    score_time,
    score_profitability,
)
from .utils import clamp


def rate_ride(candidate: RideCandidate, debug: bool = False) -> RideRating:
    # --- customer ---
    customer_anchors = rating_anchors_for_city(candidate.city_id)
    cust_score, cust_reason = score_customer(candidate.rider_rating, customer_anchors)

    # --- pickup ---
    pickup_score, pickup_reason = score_pickup(
        candidate.driver_lat,
        candidate.driver_lon,
        candidate.pickup_lat,
        candidate.pickup_lon,
    )

    # --- time (using historical anchors) ---
    dur_anchors = duration_anchors_for_city(candidate.city_id)
    time_score, time_reason = score_time(dur_anchors, candidate.est_duration_mins)

    # --- profitability (using historical anchors) ---
    prof_anchors = profitability_anchors_for_city(candidate.city_id)
    prof_score, prof_reason = score_profitability(
        prof_anchors,
        candidate.est_distance_km,
        candidate.est_duration_mins,
    )

    # --- traffic (live via Google Maps or MOCK) ---
    if candidate.drop_lat is not None and candidate.drop_lon is not None:
        traffic_score, traffic_reason = score_traffic(
            candidate.pickup_lat, candidate.pickup_lon,
            candidate.drop_lat, candidate.drop_lon
        )
    else:
        traffic_score, traffic_reason = 70.0, "No dropoff provided (neutral score)"

    # --- combine ---
    breakdown = {
        "profitability": prof_score,
        "time": time_score,
        "pickup": pickup_score,
        "traffic": traffic_score,
        "customer": cust_score,
    }
    overall = sum(breakdown[k] * WEIGHTS[k] for k in WEIGHTS.keys())
    overall = round(clamp(overall, 0, 100), 1)

    # Label + decision for the popup
    if overall >= 85:
        label, decision = "Excellent", "Accept"
    elif overall >= 70:
        label, decision = "Good", "Consider"
    elif overall >= 55:
        label, decision = "Fair", "Consider"
    else:
        label, decision = "Poor", "Skip"

    reasons = {
        "profitability": prof_reason,
        "time": time_reason,
        "pickup": pickup_reason,
        "traffic": traffic_reason,
        "customer": cust_reason,
    }

    anchors_used = {}
    if debug:
        anchors_used = {
            "customer": customer_anchors,
            "time": dur_anchors,
            "profitability": prof_anchors,
            "notes": "traffic uses Google Maps (or MOCK_TRAFFIC).",
        }

    return RideRating(
        overall=overall,
        breakdown=breakdown,
        reasons=reasons,
        label=label,
        decision=decision,
        anchors_used=anchors_used,
    )
