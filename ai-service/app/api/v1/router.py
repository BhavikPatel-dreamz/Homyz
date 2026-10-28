from fastapi import APIRouter
from api.v1.listings import router as listings_router

api_v1_router = APIRouter()

# Module 1 Section A: Listing Management & Sync
api_v1_router.include_router(listings_router, prefix="/listings")
