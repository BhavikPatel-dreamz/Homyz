from typing import Any, Optional
from models.listings import (
    ListingDeleteResponse,
    ListingSyncRequest,
    ListingSyncResponse,
    RiskAuditSummary,
)
from models.risk import RiskAuditRequest
from services.embedding_service import EmbeddingService, get_embedding_service
from services.qdrant_service import QdrantService, get_qdrant_service
from services.risk_service import RiskService, get_risk_service
from utils.logger import get_logger

logger = get_logger(__name__)


def build_listing_search_text(req: ListingSyncRequest) -> str:
    """Combines high-signal search metadata into a concise vector document for embedding.

    Excludes long descriptions and private house rules to eliminate semantic noise and
    maximize search relevance. The full description and house rules are preserved in
    Qdrant payload for retrieval and chatbot queries.
    """
    clean_amenities = list(dict.fromkeys(a.strip() for a in req.amenities if a and a.strip()))
    amenities_str = ", ".join(clean_amenities) if clean_amenities else "None listed"

    return (
        f"{req.title}. "
        f"{req.property_type} ({req.listing_type}) in {req.city}, {req.country}. "
        f"Amenities: {amenities_str}."
    )


class ListingService:
    """Manages listing vector ingestion, synchronization, and deletion."""

    def __init__(
        self,
        qdrant_service: Optional[QdrantService] = None,
        embedding_service: Optional[EmbeddingService] = None,
        risk_service: Optional[RiskService] = None,
    ) -> None:
        self.qdrant_service = qdrant_service or get_qdrant_service()
        self.embedding_service = embedding_service or get_embedding_service()
        self.risk_service = risk_service or get_risk_service()

    async def sync_listing(self, request: ListingSyncRequest) -> ListingSyncResponse:
        """Embeds and indexes a listing in Qdrant with searchable payload fields and risk audit."""
        # 1. Automatic inline fraud & scam audit
        risk_req = RiskAuditRequest(**request.model_dump())
        audit_res = await self.risk_service.audit_listing(risk_req)
        risk_summary = RiskAuditSummary(
            risk_score=audit_res.risk_score,
            verdict=audit_res.verdict,
            is_flagged=audit_res.is_flagged,
            signals=[s.model_dump() for s in audit_res.signals],
        )

        # 2. Embedding generation
        search_text = build_listing_search_text(request)
        vector = await self.embedding_service.get_embedding(search_text)

        payload: dict[str, Any] = {
            "listing_id": request.listing_id,
            "title": request.title,
            "description": request.description,
            "price": request.price,
            "city": request.city,
            "country": request.country,
            "location": {"lat": request.latitude, "lon": request.longitude},
            "guests": request.guests,
            "bedrooms": request.bedrooms,
            "beds": request.beds,
            "bathrooms": request.bathrooms,
            "property_type": request.property_type,
            "listing_type": request.listing_type,
            "amenities": request.amenities,
            "is_guest_favorite": request.is_guest_favorite,
            "is_new_listing": request.is_new_listing,
            "house_rules": request.house_rules.model_dump() if request.house_rules else {},
            "risk_audit": risk_summary.model_dump(),
        }

        # 3. Vector database upsert
        await self.qdrant_service.upsert_listing(
            listing_id=request.listing_id,
            vector=vector,
            payload=payload,
        )

        return ListingSyncResponse(
            status="success",
            listing_id=request.listing_id,
            indexed=True,
            risk_audit=risk_summary,
        )

    async def delete_listing(self, listing_id: str) -> ListingDeleteResponse:
        """Deletes a listing from Qdrant vector storage."""
        await self.qdrant_service.delete_listing(listing_id)
        return ListingDeleteResponse(
            status="deleted",
            listing_id=listing_id,
            deleted=True,
        )


_listing_service_instance: Optional[ListingService] = None


def get_listing_service() -> ListingService:
    """Dependency provider for ListingService singleton."""
    global _listing_service_instance
    if _listing_service_instance is None:
        _listing_service_instance = ListingService()
    return _listing_service_instance
