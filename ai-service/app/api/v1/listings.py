from fastapi import APIRouter, Depends, status
from core.security import verify_api_key
from models.listings import (
    ListingDeleteResponse,
    ListingSyncRequest,
    ListingSyncResponse,
)
from services.listing_service import ListingService, get_listing_service

router = APIRouter(tags=["Listings & Management"], dependencies=[Depends(verify_api_key)])


@router.post(
    "/sync",
    response_model=ListingSyncResponse,
    status_code=status.HTTP_200_OK,
    summary="Sync and index listing in vector space",
)
async def sync_listing(
    payload: ListingSyncRequest,
    listing_service: ListingService = Depends(get_listing_service),
) -> ListingSyncResponse:
    """Ingests listing details, computes high-signal embeddings, and registers the property in Qdrant."""
    return await listing_service.sync_listing(payload)


@router.delete(
    "/{listing_id}",
    response_model=ListingDeleteResponse,
    status_code=status.HTTP_200_OK,
    summary="Delete listing from vector index",
)
async def delete_listing(
    listing_id: str,
    listing_service: ListingService = Depends(get_listing_service),
) -> ListingDeleteResponse:
    """Unindexes and removes a listing from Qdrant vector database."""
    return await listing_service.delete_listing(listing_id)
