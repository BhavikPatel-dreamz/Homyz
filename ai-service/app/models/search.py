from typing import Optional
from pydantic import BaseModel, Field, model_validator
from models.listings import (
    HouseRules,
    ListingDeleteResponse,
    ListingSyncRequest,
    ListingSyncResponse,
    RiskAuditSummary,
)

__all__ = [
    "HouseRules",
    "RiskAuditSummary",
    "ListingSyncRequest",
    "ListingSyncResponse",
    "ListingDeleteResponse",
    "SearchRequest",
    "SearchResultItem",
    "SearchResponse",
]


class SearchRequest(BaseModel):
    """Payload for semantic and filtered accommodation search."""

    query: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    longitude: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    radius_km: Optional[float] = Field(default=15.0, gt=0, le=500.0)
    min_price: Optional[int] = Field(default=None, ge=0)
    max_price: Optional[int] = Field(default=None, ge=0)
    guests: Optional[int] = Field(default=None, ge=1)
    positive_listing_ids: list[str] = Field(default_factory=list)
    negative_listing_ids: list[str] = Field(default_factory=list)
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @model_validator(mode="after")
    def validate_price_range(self) -> "SearchRequest":
        if self.min_price is not None and self.max_price is not None:
            if self.min_price > self.max_price:
                raise ValueError("min_price cannot be greater than max_price")
        return self


class SearchResultItem(BaseModel):
    """Individual property result item in ranked order."""

    listing_id: str
    relevance_score: float
    price: int
    is_personalized_boost: bool = False
    is_new_listing_boost: bool = False


class SearchResponse(BaseModel):
    """Paginated search response with ranked properties."""

    total_matches: int
    page: int
    page_size: int
    results: list[SearchResultItem]
