from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator

from core.constants import (
    MAX_BATCH_TOTAL_CHARACTERS,
    MAX_REVIEW_COMMENT_LENGTH,
    MAX_REVIEWS_PER_BATCH,
)


class ReviewModerationRequest(BaseModel):
    """Payload for submitting a review to the moderation gate."""

    review_id: str = Field(..., min_length=1, description="Unique identifier of the review")
    listing_id: str = Field(..., min_length=1, description="Unique identifier of the listing")
    comment: str = Field(
        default="",
        max_length=MAX_REVIEW_COMMENT_LENGTH,
        description="Raw review comment text (allowed to be empty for star-only reviews; max 1,000 chars)",
    )
    direction: Literal["GUEST_TO_PROPERTY", "HOST_TO_GUEST"] = Field(
        default="GUEST_TO_PROPERTY",
        description="Direction of review (matches Prisma ReviewDirection enum)",
    )


class ReviewToxicityCategories(BaseModel):
    """Granular violation and safety categories."""

    harassment: bool = Field(default=False, description="Personal attacks or bullying")
    hate_speech: bool = Field(default=False, description="Discriminatory or hateful language")
    profanity: bool = Field(default=False, description="Severe obscenity or vulgar language")
    sexual: bool = Field(default=False, description="Sexually explicit content or solicitation")
    violence: bool = Field(default=False, description="Threats of physical harm or violence")
    security_violation: bool = Field(
        default=False,
        description="Disclosure of door keypad codes, lockbox codes, private keys, or alarm passwords",
    )


class ReviewModerationResponse(BaseModel):
    """Audit verdict returned by the review moderation gate."""

    review_id: str
    is_flagged: bool = Field(..., description="True if review violates platform policies")
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="Confidence of verdict (0.0 to 1.0)")
    rejection_reason: Optional[str] = Field(default=None, description="Primary violation category if flagged")
    moderation_notes: Optional[str] = Field(default=None, description="Detailed explanation of the issue")
    toxicity_categories: ReviewToxicityCategories
    contains_contact_info: bool = Field(default=False, description="True if external contact/payment detected")
    is_extortion: bool = Field(default=False, description="True if blackmail or extortion detected")


class ReviewModerationLLMOutput(BaseModel):
    """Internal structured schema parsed from LangChain JsonOutputParser for moderation."""

    is_flagged: bool = Field(description="True if the text violates safety, security, or contact policies")
    confidence_score: float = Field(ge=0.0, le=1.0, description="Confidence of determination")
    rejection_reason: Optional[str] = Field(default=None, description="Short summary of violation reason")
    moderation_notes: Optional[str] = Field(default=None, description="Specific details explaining the flag")
    harassment: bool = Field(default=False)
    hate_speech: bool = Field(default=False)
    profanity: bool = Field(default=False)
    sexual: bool = Field(default=False)
    violence: bool = Field(default=False)
    security_violation: bool = Field(default=False)
    contains_contact_info: bool = Field(default=False)
    is_extortion: bool = Field(default=False)


class ReviewSummarizeRequest(BaseModel):
    """Payload for summarizing a collection of listing reviews."""

    listing_id: str = Field(..., min_length=1, description="Identifier of the listing")
    reviews: list[str] = Field(
        ...,
        min_length=1,
        max_length=MAX_REVIEWS_PER_BATCH,
        description="List of raw review texts (1 to 50 reviews, max 1,000 characters each)",
    )
    language: str = Field(default="en", description="Target language code for the summary (e.g., 'en')")

    @field_validator("reviews")
    @classmethod
    def validate_reviews(cls, v: list[str]) -> list[str]:
        cleaned = [r.strip() for r in v if r.strip()]
        if not cleaned:
            raise ValueError("At least one non-empty review is required")
        for idx, rev in enumerate(cleaned):
            if len(rev) > MAX_REVIEW_COMMENT_LENGTH:
                raise ValueError(
                    f"Review at index {idx} exceeds {MAX_REVIEW_COMMENT_LENGTH} character limit ({len(rev)} chars)"
                )
        total_len = sum(len(r) for r in cleaned)
        if total_len > MAX_BATCH_TOTAL_CHARACTERS:
            raise ValueError(
                f"Total characters across all reviews exceeds {MAX_BATCH_TOTAL_CHARACTERS} limit ({total_len} chars)"
            )
        return cleaned


class ReviewAspectRatings(BaseModel):
    """Extracted sentiment ratings across the 6 standard dimensions (1.0 to 5.0, matching Homyz Next.js schema)."""

    cleanliness: float = Field(..., ge=1.0, le=5.0, description="Hygiene, linens, bathrooms (1.0 - 5.0)")
    accuracy: float = Field(..., ge=1.0, le=5.0, description="Listing photos and description fidelity (1.0 - 5.0)")
    check_in: float = Field(
        ...,
        ge=1.0,
        le=5.0,
        alias="checkIn",
        description="Ease of entry, key access, instructions (1.0 - 5.0)",
    )
    communication: float = Field(..., ge=1.0, le=5.0, description="Host responsiveness and helpfulness (1.0 - 5.0)")
    location: float = Field(..., ge=1.0, le=5.0, description="Transit, safety, area amenities (1.0 - 5.0)")
    value: float = Field(..., ge=1.0, le=5.0, description="Experience and quality relative to price (1.0 - 5.0)")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class ReviewSummarizeResponse(BaseModel):
    """Synthesized intelligence across all listing reviews."""

    listing_id: str
    total_reviews_analyzed: int
    aspect_ratings: ReviewAspectRatings
    summary: str = Field(..., description="Objective narrative synthesis of guest sentiment")
    highlights: list[str] = Field(default_factory=list, description="Standout positive features")
    considerations: list[str] = Field(default_factory=list, description="Constructive caveats or empty if none")

    model_config = ConfigDict(populate_by_name=True, serialize_by_alias=True)


class ReviewSummarizeLLMOutput(BaseModel):
    """Internal structured schema parsed from LangChain JsonOutputParser for summarization."""

    cleanliness: float = Field(..., ge=1.0, le=5.0)
    accuracy: float = Field(..., ge=1.0, le=5.0)
    check_in: float = Field(..., ge=1.0, le=5.0)
    communication: float = Field(..., ge=1.0, le=5.0)
    location: float = Field(..., ge=1.0, le=5.0)
    value: float = Field(..., ge=1.0, le=5.0)
    summary: str = Field(...)
    highlights: list[str] = Field(default_factory=list)
    considerations: list[str] = Field(default_factory=list)
