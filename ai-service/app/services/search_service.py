from typing import Any, Optional
from qdrant_client import models
from models.search import (
    ListingSyncRequest,
    ListingSyncResponse,
    RiskAuditSummary,
    SearchRequest,
    SearchResponse,
    SearchResultItem,
)
from services.embedding_service import EmbeddingService, get_embedding_service
from services.qdrant_service import QdrantService, get_qdrant_service
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


class SearchService:
    """Orchestrates semantic search, listing ingestion, ranking, and personalization."""

    def __init__(
        self,
        qdrant_service: Optional[QdrantService] = None,
        embedding_service: Optional[EmbeddingService] = None,
    ) -> None:
        self.qdrant_service = qdrant_service or get_qdrant_service()
        self.embedding_service = embedding_service or get_embedding_service()

    async def sync_listing(self, request: ListingSyncRequest) -> ListingSyncResponse:
        """Embeds and indexes a listing in Qdrant with searchable payload fields."""
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
        }

        await self.qdrant_service.upsert_listing(
            listing_id=request.listing_id,
            vector=vector,
            payload=payload,
        )

        return ListingSyncResponse(
            status="success",
            listing_id=request.listing_id,
            indexed=True,
            risk_audit=RiskAuditSummary(),
        )

    async def search(self, request: SearchRequest) -> SearchResponse:
        """Executes dual-mode semantic search with personalization and fair discovery boost."""
        conditions: list[models.FieldCondition] = []

        # 1. Geo-Radius Bounding Filter (if coordinates are provided)
        if request.latitude is not None and request.longitude is not None:
            radius_km = request.radius_km or 15.0
            radius_meters = radius_km * 1000.0
            conditions.append(
                models.FieldCondition(
                    key="location",
                    geo_radius=models.GeoRadius(
                        center=models.GeoPoint(lat=request.latitude, lon=request.longitude),
                        radius=radius_meters,
                    ),
                )
            )

        # 2. Price Range Filter
        if request.min_price is not None or request.max_price is not None:
            conditions.append(
                models.FieldCondition(
                    key="price",
                    range=models.Range(
                        gte=request.min_price,
                        lte=request.max_price,
                    ),
                )
            )

        # 3. Capacity Filter
        if request.guests is not None:
            conditions.append(
                models.FieldCondition(
                    key="guests",
                    range=models.Range(gte=request.guests),
                )
            )

        # 4. City Filter
        if request.city:
            conditions.append(
                models.FieldCondition(
                    key="city",
                    match=models.MatchValue(value=request.city),
                )
            )

        query_filter = models.Filter(must=conditions) if conditions else None

        # 5. Semantic Vector Embedding (if natural language query provided)
        query_vector: Optional[list[float]] = None
        if request.query and request.query.strip():
            query_vector = await self.embedding_service.get_embedding(request.query)

        # 6. Pagination & Execution
        offset = (request.page - 1) * request.page_size
        total_matches = await self.qdrant_service.count_listings(query_filter=query_filter)

        is_personalized = bool(request.positive_listing_ids)
        scored_points = await self.qdrant_service.query_listings(
            query_vector=query_vector,
            positive_listing_ids=request.positive_listing_ids or None,
            negative_listing_ids=request.negative_listing_ids or None,
            query_filter=query_filter,
            limit=request.page_size,
            offset=offset,
        )

        results: list[SearchResultItem] = []
        new_listing_indices: list[int] = []
        for i, point in enumerate(scored_points):
            payload = point.payload or {}
            score = round(float(point.score), 3) if point.score is not None else 1.0
            is_new = bool(payload.get("is_new_listing", False))
            results.append(
                SearchResultItem(
                    listing_id=str(payload.get("listing_id", point.id)),
                    relevance_score=score,
                    price=int(payload.get("price", 0)),
                    is_personalized_boost=is_personalized,
                    is_new_listing_boost=False,
                )
            )
            if is_new:
                new_listing_indices.append(i)

        # 7. Fair Discovery Boost Slotting (Page 1 only)
        if request.page == 1 and results and new_listing_indices:
            self._apply_fair_discovery_boost(results, new_listing_indices)

        return SearchResponse(
            total_matches=total_matches,
            page=request.page,
            page_size=request.page_size,
            results=results,
        )

    def _apply_fair_discovery_boost(
        self, results: list[SearchResultItem], new_indices: list[int]
    ) -> None:
        """Promotes newly published listings into strategic slots on Page 1 (slots 4 and 9) if relevant."""
        boost_slots = [3, 8]  # 0-indexed: slot 4 and slot 9
        min_relevance_threshold = 0.50

        for slot in boost_slots:
            if slot >= len(results):
                continue

            # Find a new listing that is ranked below this slot and meets quality/relevance threshold
            candidate_idx: Optional[int] = None
            for idx in new_indices:
                if idx > slot:
                    if results[idx].relevance_score >= min_relevance_threshold:
                        candidate_idx = idx
                        break
                elif idx == slot:
                    results[slot].is_new_listing_boost = True
                    break

            if candidate_idx is not None:
                promoted = results.pop(candidate_idx)
                promoted.is_new_listing_boost = True
                results.insert(slot, promoted)
                # Update remaining indices
                new_indices.remove(candidate_idx)
                new_indices.append(slot)
                new_indices.sort()


_search_service_instance: Optional[SearchService] = None


def get_search_service() -> SearchService:
    """Dependency provider for SearchService singleton."""
    global _search_service_instance
    if _search_service_instance is None:
        _search_service_instance = SearchService()
    return _search_service_instance
