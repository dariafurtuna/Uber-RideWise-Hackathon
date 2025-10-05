# Simple in-memory “today” aggregates used for demos.
# Keys are (earner_id, date_iso), values are dicts: {"earnings": float, "minutes": float}

from datetime import date

_RUNTIME = {}  # { (earner_id, "YYYY-MM-DD"): {"earnings": X, "minutes": Y} }

def _key(earner_id: str, d: str | None = None):
    return (earner_id, d or date.today().isoformat())

def add_completion(earner_id: str, net_earnings: float, minutes: float, d: str | None = None):
    k = _key(earner_id, d)
    bucket = _RuntimeBucket = _RUNTIME.get(k) or {"earnings": 0.0, "minutes": 0.0}
    bucket["earnings"] += float(net_earnings or 0)
    bucket["minutes"]  += float(minutes or 0)
    _RUNTIME[k] = bucket
    return bucket

def get_today(earner_id: str, d: str | None = None):
    return _RUNTIME.get(_key(earner_id, d), {"earnings": 0.0, "minutes": 0.0})
