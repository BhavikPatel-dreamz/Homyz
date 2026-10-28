from fastapi import APIRouter, Depends, status
from core.security import verify_api_key
from models.search import SearchRequest, SearchResponse
from services.search_service import SearchService, get_search_service

router = APIRouter(tags=["Search & Ranking"], dependencies=[Depends(verify_api_key)])


@router.post(
    "/search",
    response_model=SearchResponse,
    status_code=status.HTTP_200_OK,
    summary="Semantic and filtered property search",
)
async def search_listings(
    payload: SearchRequest,
    search_service: SearchService = Depends(get_search_service),
) -> SearchResponse:
    """Executes semantic vector search with geo-radius, price filtering, and user behavior personalization."""
    return await search_service.search(payload)
