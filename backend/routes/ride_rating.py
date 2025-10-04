from fastapi import APIRouter, Query
from ..rating.models import RideCandidate, RideRating
from ..rating.service import rate_ride

router = APIRouter(prefix="/rides", tags=["rides"])

@router.post("/rate", response_model=RideRating)
def rate(candidate: RideCandidate, debug: bool = Query(False)):
    """
    Rate a single incoming ride request for the driver popup.
    Use ?debug=true to include anchors_used for calibration.
    """
    return rate_ride(candidate, debug=debug)
