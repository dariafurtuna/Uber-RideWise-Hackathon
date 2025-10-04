import os
import requests
from dotenv import load_dotenv
from .utils import clamp, linear_scale

load_dotenv()
API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")
MOCK_TRAFFIC = os.getenv("MOCK_TRAFFIC", "false").lower() == "true"

BASE_URL = "https://maps.googleapis.com/maps/api/distancematrix/json"


def score_traffic(pickup_lat, pickup_lon, drop_lat, drop_lon) -> tuple[float, str]:
    """
    Uses Google Maps Distance Matrix to score traffic based on congestion ratio:
      ratio = duration_in_traffic / base_duration
    Returns (score 0..100, reason string).
    Falls back to neutral 70 if API not configured or errors occur.
    Set MOCK_TRAFFIC=true in .env to force a stable demo response.
    """
    if MOCK_TRAFFIC:
        # Stable mock for demos
        base_dur = 20.0
        traffic_dur = 28.0
        ratio = traffic_dur / base_dur
        score = linear_scale(ratio, 1.0, 1.5, 95, 40)
        return clamp(score, 0, 100), f"[MOCK] Traffic {traffic_dur:.1f}m vs {base_dur:.1f}m free-flow (x{ratio:.2f})"

    if not API_KEY:
        return 70.0, "No API key configured (neutral score)"

    try:
        params = {
            "origins": f"{pickup_lat},{pickup_lon}",
            "destinations": f"{drop_lat},{drop_lon}",
            "departure_time": "now",
            "mode": "driving",
            "traffic_model": "best_guess",
            "region": "nl",  # bias to Netherlands
            "key": API_KEY,
        }
        resp = requests.get(BASE_URL, params=params, timeout=5)
        data = resp.json()

        # Status checks
        if data.get("status") != "OK":
            return 70.0, f"Traffic API status {data.get('status')}"
        rows = data.get("rows") or []
        if not rows or not rows[0].get("elements"):
            return 70.0, "Traffic API returned no elements"
        element = rows[0]["elements"][0]
        if element.get("status") != "OK":
            return 70.0, f"Traffic element status {element.get('status')}"

        base_dur = element["duration"]["value"] / 60.0
        # Some responses may omit duration_in_traffic — fall back to duration
        dit = element.get("duration_in_traffic", element.get("duration"))
        traffic_dur = dit["value"] / 60.0

        ratio = traffic_dur / base_dur if base_dur > 0 else 1.0

        # Map congestion ratio to score
        if ratio <= 1.0:
            score = 95.0
        elif ratio <= 1.2:
            score = linear_scale(ratio, 1.0, 1.2, 95, 70)
        elif ratio <= 1.5:
            score = linear_scale(ratio, 1.2, 1.5, 70, 40)
        else:
            score = 40.0

        reason = f"Traffic {traffic_dur:.1f}m vs {base_dur:.1f}m free-flow (x{ratio:.2f})"
        return clamp(score, 0, 100), reason

    except Exception as e:
        return 70.0, f"Traffic API error: {e}"
