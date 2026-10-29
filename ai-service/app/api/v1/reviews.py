from fastapi import APIRouter, Depends, status

from core.security import verify_api_key
from models.reviews import (
    ReviewModerationRequest,
    ReviewModerationResponse,
    ReviewSummarizeRequest,
    ReviewSummarizeResponse,
)
from services.review_service import ReviewService, get_review_service

router = APIRouter(tags=["Reviews"], dependencies=[Depends(verify_api_key)])


@router.post(
    "/moderate",
    response_model=ReviewModerationResponse,
    status_code=status.HTTP_200_OK,
    summary="Audit review for toxicity, physical security disclosures, contact info, and extortion",
)
async def moderate_review(
    payload: ReviewModerationRequest,
    review_service: ReviewService = Depends(get_review_service),
) -> ReviewModerationResponse:
    """Real-time policy gate: scans review text for personal attacks, door codes, contact evasion, and extortion."""
    return await review_service.moderate_review(payload)


@router.post(
    "/summarize",
    response_model=ReviewSummarizeResponse,
    status_code=status.HTTP_200_OK,
    summary="Extract aspect ratings (1.0-5.0) and synthesize an objective narrative summary across listing reviews",
)
async def summarize_reviews(
    payload: ReviewSummarizeRequest,
    review_service: ReviewService = Depends(get_review_service),
) -> ReviewSummarizeResponse:
    """Batch review synthesis: deduplicates reviews, extracts 1.0-5.0 ratings on 6 Airbnb dimensions, and generates highlights."""
    return await review_service.summarize_reviews(payload)
