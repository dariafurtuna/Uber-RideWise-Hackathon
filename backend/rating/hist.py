# backend/rating/hist.py (append this function)
from typing import Optional
import sqlite3
from pathlib import Path
from .utils import percentile

REPO_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = REPO_ROOT / "db" / "uber_hackathon_v2.db"

def _q(sql: str, params: tuple = ()):
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(sql, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]

def _table_has_columns(table: str, cols: list) -> bool:
    try:
        pragma = _q(f"PRAGMA table_info({table});")
        names = {c["name"] for c in pragma}
        return all(c in names for c in cols)
    except Exception:
        return False

def rating_anchors_for_city(city_id: int) -> dict:
    """
    Returns P25/P50/P75 of rider ratings (1..5) for the city.
    Tries `riders.rating` then `customers.rating` then `riders.avg_rating`/`customers.avg_rating`.
    Fallbacks to generic anchors if not available.
    """
    candidates = [
        ("riders",    "rating"),
        ("customers", "rating"),
        ("riders",    "avg_rating"),
        ("customers", "avg_rating"),
    ]

    ratings = []
    for table, col in candidates:
        if _table_has_columns(table, [col, "city_id"]):
            rows = _q(f"SELECT {col} AS r FROM {table} WHERE {col} IS NOT NULL AND city_id = ?", (city_id,))
            ratings = [float(x["r"]) for x in rows if x["r"] is not None]
            if ratings:
                break

    # If still empty, try without city filter
    if not ratings:
        for table, col in candidates:
            if _table_has_columns(table, [col]):
                rows = _q(f"SELECT {col} AS r FROM {table} WHERE {col} IS NOT NULL LIMIT 1000")
                ratings = [float(x["r"]) for x in rows if x["r"] is not None]
                if ratings:
                    break

    if not ratings:
        # conservative defaults for ride-share ratings distribution
        return {"p25": 4.60, "p50": 4.80, "p75": 4.92}

    ratings.sort()
    return {
        "p25": percentile(ratings, 25),
        "p50": percentile(ratings, 50),
        "p75": percentile(ratings, 75),
    }

def duration_anchors_for_city(city_id: int, sample_limit: int = 1000) -> dict:
    """
    Returns P25/P50/P75 of trip durations (minutes) for the given city.
    If no data, return sensible defaults.
    """
    rows = _q(
        """
        SELECT duration_mins
        FROM rides_trips
        WHERE duration_mins IS NOT NULL
          AND duration_mins > 0
          AND city_id = ?
        LIMIT ?
        """,
        (city_id, sample_limit),
    )
    vals = [float(r["duration_mins"]) for r in rows]
    vals.sort()

    if not vals:
        # Defaults chosen for NL trip durations
        return {"p25": 10.0, "p50": 20.0, "p75": 40.0}

    return {
        "p25": percentile(vals, 25),
        "p50": percentile(vals, 50),
        "p75": percentile(vals, 75),
    }

def profitability_anchors_for_city(city_id: int, sample_limit: int = 1000) -> dict:
    """
    Returns P25/P50/P75 of net earnings per minute (€/min) for the city.
    """
    rows = _q(
        """
        SELECT net_earnings, duration_mins
        FROM rides_trips
        WHERE net_earnings IS NOT NULL
          AND duration_mins > 0
          AND city_id = ?
        LIMIT ?
        """,
        (city_id, sample_limit),
    )
    vals = [float(r["net_earnings"]) / float(r["duration_mins"]) for r in rows]
    vals.sort()

    if not vals:
        # fallback defaults for NL market
        return {"p25": 0.25, "p50": 0.35, "p75": 0.45}

    return {
        "p25": percentile(vals, 25),
        "p50": percentile(vals, 50),
        "p75": percentile(vals, 75),
    }


