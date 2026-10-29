from fastapi import APIRouter
from api.v1.chat import router as chat_router
from api.v1.listings import router as listings_router
from api.v1.photos import router as photos_router
from api.v1.reviews import router as reviews_router
from api.v1.risk import router as risk_router
from api.v1.search import router as search_router

api_v1_router = APIRouter()

# Module 1 Section A: Listing Management & Sync
api_v1_router.include_router(listings_router, prefix="/listings")

# Module 1 Section B: Search & Discovery
api_v1_router.include_router(search_router)

# Module 2: Photo Categorization & Quality Scoring
api_v1_router.include_router(photos_router, prefix="/photos")

# Module 3: Review Filtering & Summarization
api_v1_router.include_router(reviews_router, prefix="/reviews")

# Module 4: Guest Support Chatbot
api_v1_router.include_router(chat_router, prefix="/chat")

# Module 5: Fake Listing & Scam Detection
api_v1_router.include_router(risk_router, prefix="/risk")
