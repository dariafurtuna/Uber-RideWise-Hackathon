import math
from datetime import datetime

def haversine_km(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dlmb/2)**2
    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))

def clamp(v, lo, hi):
    return max(lo, min(hi, v))

def linear_scale(x, lo, hi, out_lo=0.0, out_hi=100.0):
    if hi <= lo:
        return (out_lo + out_hi) / 2
    if x <= lo: return out_lo
    if x >= hi: return out_hi
    frac = (x - lo) / (hi - lo)
    return out_lo + frac * (out_hi - out_lo)

def percentile(sorted_vals, p: float):
    if not sorted_vals:
        return None
    if p <= 0: return sorted_vals[0]
    if p >= 100: return sorted_vals[-1]
    k = (len(sorted_vals) - 1) * (p / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c: return sorted_vals[int(k)]
    d0 = sorted_vals[f] * (c - k)
    d1 = sorted_vals[c] * (k - f)
    return d0 + d1

def hour_from_iso(s: str) -> str:
    """Returns 'HH' for grouping; tolerant to formats."""
    try:
        return datetime.fromisoformat(s.replace("Z","+00:00")).strftime("%H")
    except Exception:
        try:
            return datetime.strptime(s, "%Y-%m-%d %H:%M:%S").strftime("%H")
        except Exception:
            return datetime.utcnow().strftime("%H")

