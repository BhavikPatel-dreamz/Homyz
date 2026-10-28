from typing import Any, Optional
from pydantic import BaseModel, Field


class HouseRules(BaseModel):
    """Property rules and access metadata."""

    check_in_method: Optional[str] = None
    check_in_start: Optional[str] = None
    check_in_end: Optional[str] = None
    check_out_time: Optional[str] = None
    parking_available: bool = False
    parking_type: Optional[str] = None
    parking_instructions: Optional[str] = None
    wifi_network: Optional[str] = None
    wifi_password: Optional[str] = None
    cancellation_policy: Optional[str] = None
    quiet_hours: bool = False
    quiet_hours_start: Optional[str] = None
    quiet_hours_end: Optional[str] = None
    pets_allowed: bool = False
    smoking_allowed: bool = False
    additional_rules: Optional[str] = None


class RiskAuditSummary(BaseModel):
    """Summary of fraud and risk assessment."""

    risk_score: int = 0
    verdict: str = "AUTO_APPROVE"
    is_flagged: bool = False
    signals: list[dict[str, Any]] = Field(default_factory=list)


class ListingSyncRequest(BaseModel):
    """Payload sent by client platform to index listing details."""

    listing_id: str
    title: str
    description: str
    price: int = Field(..., gt=0, description="Price in minor units (cents)")
    city: str
    country: str
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    guests: int = Field(default=1, ge=1)
    bedrooms: int = Field(default=1, ge=0)
    beds: int = Field(default=1, ge=0)
    bathrooms: float = Field(default=1.0, ge=0.0)
    property_type: str
    listing_type: str
    amenities: list[str] = Field(default_factory=list)
    is_guest_favorite: bool = False
    is_new_listing: bool = False
    house_rules: Optional[HouseRules] = None


class ListingSyncResponse(BaseModel):
    """Response returned upon successful listing indexing."""

    status: str = "success"
    listing_id: str
    indexed: bool = True
    risk_audit: RiskAuditSummary = Field(default_factory=RiskAuditSummary)


class ListingDeleteResponse(BaseModel):
    """Response returned when a listing is unindexed and removed from vector store."""

    status: str = "deleted"
    listing_id: str
    deleted: bool = True
