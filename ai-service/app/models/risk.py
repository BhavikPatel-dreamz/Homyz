from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class RiskSignal(BaseModel):
    """Individual indicator of risk detected during audit."""

    signal_type: Literal[
        "PRICE_HONEYPOT",
        "EXTREME_PRICE_HONEYPOT",
        "SUSPICIOUS_HIGH_PRICE",
        "OFF_PLATFORM_PAYMENT",
        "OFF_PLATFORM_CONTACT",
        "URGENCY_TACTIC",
        "COURIER_OR_THIRD_PARTY_STORY",
        "CONTRADICTORY_CLAIMS",
        "INSUFFICIENT_LOCAL_DATA",
    ] = Field(..., description="Categorical classification of the risk signal")
    severity: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"] = Field(..., description="Severity level")
    score_impact: int = Field(..., ge=0, le=100, description="Points added to total risk score")
    details: str = Field(..., description="Human-readable explanation of why this signal was raised")


class RiskAuditRequest(BaseModel):
    """Payload for auditing a listing for fraud, price honeypots, and scam patterns.
    
    Only fields that actively contribute to the risk score or fraud classification are included.
    Any extra metadata from the caller is automatically ignored.
    """

    model_config = ConfigDict(extra="ignore")

    listing_id: str = Field(..., description="Unique listing identifier")
    title: str = Field(..., min_length=1, max_length=500, description="Listing title")
    description: str = Field(..., min_length=1, max_length=15000, description="Full listing description text")
    price: int = Field(..., gt=0, description="Nightly price in minor units (cents)")
    city: str = Field(..., min_length=1, max_length=200, description="City name")
    country: str = Field(default="", max_length=200, description="Country name")
    latitude: float = Field(..., ge=-90.0, le=90.0, description="Latitude coordinate")
    longitude: float = Field(..., ge=-180.0, le=180.0, description="Longitude coordinate")
    guests: int = Field(default=1, ge=1, le=100, description="Maximum guest capacity")
    bedrooms: int = Field(default=1, ge=0, description="Number of bedrooms")
    beds: int = Field(default=1, ge=0, description="Number of beds")
    bathrooms: float = Field(default=1.0, ge=0.0, description="Number of bathrooms")
    property_type: str = Field(default="Apartment", description="Property category (e.g. Villa, Apartment)")
    listing_type: str = Field(default="Entire place", description="Listing space type (e.g. Entire place, Private room)")
    amenities: list[str] = Field(default_factory=list, description="List of amenities provided")
    house_rules: Any = Field(
        default=None,
        description="House rules or policy text scanned for hidden off-platform payment/contact terms",
    )


class RiskAuditResponse(BaseModel):
    """Consolidated risk assessment result returned to caller."""

    listing_id: str
    risk_score: int = Field(..., ge=0, le=100, description="Composite risk score from 0 (clean) to 100 (critical)")
    verdict: Literal["AUTO_APPROVE", "WARNING_LOW_CONFIDENCE", "FLAG_FOR_MANUAL_AUDIT"]
    is_flagged: bool = Field(..., description="True if listing should be quarantined or held for manual approval")
    signals: list[RiskSignal] = Field(default_factory=list, description="Array of detected risk signals")
    recommendation: str = Field(..., description="Actionable Trust & Safety recommendation")
    median_neighborhood_price: Optional[int] = Field(
        default=None,
        description="Calculated neighborhood median price in minor units (cents) if benchmark data was found",
    )
    neighborhood_listing_count: int = Field(
        default=0,
        description="Number of neighboring listings matched for price comparison",
    )
