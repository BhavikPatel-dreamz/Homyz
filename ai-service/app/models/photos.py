from typing import Optional
from pydantic import BaseModel, Field
from core.constants import MAX_PHOTOS_PER_BATCH


class PhotoAnalysisRequest(BaseModel):
    """Request payload for analyzing listing photos."""

    listing_id: str = Field(..., min_length=1, description="Identifier of the listing")
    photos: list[str] = Field(
        ...,
        min_length=1,
        max_length=MAX_PHOTOS_PER_BATCH,
        description="Array of HTTPS/HTTP image URLs to analyze",
    )


class PhotoScores(BaseModel):
    """Quality and aesthetic ratings for a single photo."""

    lighting: int = Field(..., ge=1, le=10, description="Lighting rating (1-10)")
    composition: int = Field(..., ge=1, le=10, description="Composition rating (1-10)")
    overall_aesthetic: float = Field(..., ge=1.0, le=10.0, description="Composite aesthetic score (1.0-10.0)")


class PhotoFlags(BaseModel):
    """Deterministic defect and quality flags for a photo."""

    is_blurry: bool = Field(default=False, description="True if Laplacian variance is below threshold")
    is_duplicate: bool = Field(default=False, description="True if near-identical duplicate exists in batch")
    duplicate_of: Optional[str] = Field(default=None, description="URL of the first original photo if duplicate")
    is_non_property: bool = Field(default=False, description="True if photo is document, meme, or non-property")
    poor_quality: bool = Field(default=False, description="True if photo has defects or low aesthetic rating")


class PhotoItemResult(BaseModel):
    """Analysis result for a single photo URL."""

    url: str = Field(..., description="Image URL")
    room_type: Optional[str] = Field(
        default=None,
        description="Categorized room or space type, or None if non-property or corrupt",
    )
    is_recommended_cover: bool = Field(default=False, description="True if selected as best cover photo")
    scores: Optional[PhotoScores] = Field(
        default=None,
        description="Quality and aesthetic ratings, or None if non-property, corrupt, or duplicate",
    )
    flags: PhotoFlags
    feedback_tips: list[str] = Field(default_factory=list, description="Actionable improvement tips for the host")


class PhotoAnalysisResponse(BaseModel):
    """Aggregated analysis response for all listing photos."""

    listing_id: str = Field(..., description="Listing identifier")
    processed_count: int = Field(..., description="Total number of photos processed")
    recommended_cover_photo: Optional[str] = Field(
        default=None,
        description="URL of the recommended primary cover photo",
    )
    room_assignments: dict[str, list[str]] = Field(
        default_factory=dict,
        description="Mapping of room categories to image URLs",
    )
    photos: list[PhotoItemResult] = Field(
        default_factory=list,
        description="Individual photo results in original order",
    )


class PhotoAIAnalysis(BaseModel):
    """Structured output schema returned by the multimodal Vision LLM."""

    room_type: str = Field(
        ...,
        description=(
            "Categorized space: 'Living Room', 'Bedroom', 'Bathroom', 'Kitchen', "
            "'Balcony/Patio', 'Dining Room', 'Exterior/Entrance', 'Amenities/Pool', or 'Other'."
        ),
    )
    is_relevant_property_photo: bool = Field(
        ...,
        description=(
            "True if this photo portrays an accommodation property, room, or guest amenity. "
            "False if it portrays documents, newspapers, memes, receipts, chat screenshots, or selfies."
        ),
    )
    lighting_score: int = Field(
        ...,
        ge=1,
        le=10,
        description="Lighting score from 1 (pitch black or washed out) to 10 (balanced natural light).",
    )
    composition_score: int = Field(
        ...,
        ge=1,
        le=10,
        description="Composition score from 1 (crooked, cluttered) to 10 (well-staged, straight angles).",
    )
    feedback_tips: list[str] = Field(
        default_factory=list,
        description=(
            "1-2 concise, actionable tips for the host to improve this photo. "
            "Return empty array if the photo is already high quality."
        ),
    )
