# backend/routes/ride_rating.py
from fastapi import APIRouter
from ..rating.models import RideCandidate, RideRating
from ..rating.service import rate_ride

router = APIRouter(prefix="/rides", tags=["rides"])

@router.post("/rate", response_model=RideRating)
def rate(candidate: RideCandidate):
    return rate_ride(candidate)
