import uuid
from typing import Any, Optional
from qdrant_client import AsyncQdrantClient, models
from core.config import Settings, get_settings
from core.exceptions import AIProviderError
from utils.logger import get_logger

logger = get_logger(__name__)


def listing_id_to_point_id(listing_id: str) -> str:
    """Deterministically transforms an arbitrary listing string ID into a valid Qdrant UUID."""
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, listing_id))


class QdrantService:
    """Manages communication with Qdrant vector database (Cloud or Local)."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self.client = AsyncQdrantClient(
            url=self.settings.QDRANT_URL,
            api_key=self.settings.QDRANT_API_KEY or None,
            timeout=5.0,
            check_compatibility=False,
        )
        self._initialized: bool = False

    async def check_connection(self) -> dict[str, str]:
        """Pings Qdrant to verify database connectivity and instance mode."""
        is_cloud = "cloud.qdrant.io" in self.settings.QDRANT_URL.lower()
        mode = "cloud" if is_cloud else "local"

        try:
            await self.client.get_collections()
            logger.info("Qdrant connection verified successfully (mode=%s)", mode)
            return {
                "status": "connected",
                "mode": mode,
            }
        except Exception as exc:
            logger.warning("Failed to connect to Qdrant (%s mode): %s", mode, exc)
            return {
                "status": "disconnected",
                "mode": mode,
                "error": str(exc),
            }

    async def ensure_collection_exists(self) -> None:
        """Verifies or creates the listings collection and configures payload indexes."""
        if self._initialized:
            return

        collection_name = self.settings.QDRANT_COLLECTION_LISTINGS
        try:
            exists = await self.client.collection_exists(collection_name)
            if not exists:
                logger.info(
                    "Creating Qdrant collection '%s' (dim=%d, Cosine)",
                    collection_name,
                    self.settings.VECTOR_SIZE,
                )
                await self.client.create_collection(
                    collection_name=collection_name,
                    vectors_config=models.VectorParams(
                        size=self.settings.VECTOR_SIZE,
                        distance=models.Distance.COSINE,
                    ),
                )

                # Configure payload indexes for efficient filtering
                index_fields = [
                    ("location", models.PayloadSchemaType.GEO),
                    ("price", models.PayloadSchemaType.INTEGER),
                    ("guests", models.PayloadSchemaType.INTEGER),
                    ("city", models.PayloadSchemaType.KEYWORD),
                    ("is_new_listing", models.PayloadSchemaType.KEYWORD),
                    ("listing_id", models.PayloadSchemaType.KEYWORD),
                ]
                for field_name, schema_type in index_fields:
                    try:
                        await self.client.create_payload_index(
                            collection_name=collection_name,
                            field_name=field_name,
                            field_schema=schema_type,
                        )
                    except Exception as idx_exc:
                        logger.warning(
                            "Failed to create index on '%s': %s", field_name, idx_exc
                        )

            self._initialized = True
        except Exception as exc:
            logger.error("Failed to ensure Qdrant collection '%s': %s", collection_name, exc)
            raise AIProviderError(f"Qdrant collection setup failed: {exc}") from exc

    async def upsert_listing(
        self, listing_id: str, vector: list[float], payload: dict[str, Any]
    ) -> None:
        """Upserts a listing vector and its associated metadata into Qdrant."""
        await self.ensure_collection_exists()
        point_id = listing_id_to_point_id(listing_id)
        collection_name = self.settings.QDRANT_COLLECTION_LISTINGS

        try:
            await self.client.upsert(
                collection_name=collection_name,
                points=[
                    models.PointStruct(
                        id=point_id,
                        vector=vector,
                        payload=payload,
                    )
                ],
            )
            logger.info("Listing '%s' successfully indexed in Qdrant", listing_id)
        except Exception as exc:
            logger.error("Failed to upsert listing '%s' into Qdrant: %s", listing_id, exc)
            raise AIProviderError(f"Vector database upsert failed: {exc}") from exc

    async def query_listings(
        self,
        query_vector: Optional[list[float]] = None,
        positive_listing_ids: Optional[list[str]] = None,
        negative_listing_ids: Optional[list[str]] = None,
        query_filter: Optional[models.Filter] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[models.ScoredPoint]:
        """Queries listings via semantic vector search or recommendation matching."""
        await self.ensure_collection_exists()
        collection_name = self.settings.QDRANT_COLLECTION_LISTINGS

        # Determine query structure: recommend vs standard nearest
        query_arg: Any = None
        if positive_listing_ids:
            candidate_positive_ids = [
                listing_id_to_point_id(lid) for lid in positive_listing_ids
            ]
            # Verify which points actually exist in Qdrant to prevent 404 UnexpectedResponse
            try:
                existing_records = await self.client.retrieve(
                    collection_name=collection_name,
                    ids=candidate_positive_ids,
                    with_payload=False,
                    with_vectors=False,
                )
                valid_positive_point_ids = [str(r.id) for r in existing_records]
            except Exception as check_exc:
                logger.warning("Error verifying positive listing IDs in Qdrant: %s", check_exc)
                valid_positive_point_ids = []

            if valid_positive_point_ids:
                negative_point_ids = [
                    listing_id_to_point_id(lid) for lid in (negative_listing_ids or [])
                ]
                query_arg = models.RecommendQuery(
                    recommend=models.RecommendInput(
                        positive=valid_positive_point_ids,
                        negative=negative_point_ids,
                    )
                )
            elif query_vector:
                logger.info(
                    "None of the positive_listing_ids exist in Qdrant. Falling back to semantic query vector."
                )
                query_arg = query_vector
        elif query_vector:
            query_arg = query_vector

        try:
            response = await self.client.query_points(
                collection_name=collection_name,
                query=query_arg,
                query_filter=query_filter,
                limit=limit,
                offset=offset,
                with_payload=True,
                with_vectors=False,
            )
            return response.points
        except Exception as exc:
            logger.error("Failed to query Qdrant points: %s", exc)
            raise AIProviderError(f"Search query execution failed: {exc}") from exc

    async def count_listings(self, query_filter: Optional[models.Filter] = None) -> int:
        """Returns the total number of listings matching the provided filter conditions."""
        await self.ensure_collection_exists()
        collection_name = self.settings.QDRANT_COLLECTION_LISTINGS

        try:
            count_result = await self.client.count(
                collection_name=collection_name,
                count_filter=query_filter,
                exact=True,
            )
            return count_result.count
        except Exception as exc:
            logger.error("Failed to count Qdrant points: %s", exc)
            raise AIProviderError(f"Count query failed: {exc}") from exc

    async def get_listing_by_id(self, listing_id: str) -> Optional[dict[str, Any]]:
        """Retrieves a single listing payload by its listing ID."""
        await self.ensure_collection_exists()
        collection_name = self.settings.QDRANT_COLLECTION_LISTINGS
        point_id = listing_id_to_point_id(listing_id)

        try:
            records = await self.client.retrieve(
                collection_name=collection_name,
                ids=[point_id],
                with_payload=True,
                with_vectors=False,
            )
            if records and records[0].payload:
                return records[0].payload
            return None
        except Exception as exc:
            logger.error("Failed to retrieve listing '%s': %s", listing_id, exc)
            raise AIProviderError(f"Failed to retrieve listing: {exc}") from exc

    async def delete_listing(self, listing_id: str) -> bool:
        """Removes a listing point from the Qdrant vector collection."""
        await self.ensure_collection_exists()
        point_id = listing_id_to_point_id(listing_id)
        collection_name = self.settings.QDRANT_COLLECTION_LISTINGS

        try:
            await self.client.delete(
                collection_name=collection_name,
                points_selector=models.PointIdsList(points=[point_id]),
            )
            logger.info("Listing '%s' successfully deleted from Qdrant", listing_id)
            return True
        except Exception as exc:
            logger.error("Failed to delete listing '%s' from Qdrant: %s", listing_id, exc)
            raise AIProviderError(f"Vector deletion failed: {exc}") from exc

    async def get_neighborhood_prices(
        self,
        latitude: float,
        longitude: float,
        capacity: int,
        city: str,
        radius_km: float = 5.0,
        exclude_listing_id: Optional[str] = None,
    ) -> tuple[list[int], str]:
        """Queries Qdrant for active listing prices within a spatial radius and capacity bracket.

        Returns:
            Tuple of (list_of_prices_in_cents, benchmark_level)
            benchmark_level is 'neighborhood_5km', 'city', or 'insufficient_data'.
        """
        try:
            await self.ensure_collection_exists()
            collection_name = self.settings.QDRANT_COLLECTION_LISTINGS

            must_not_conditions: list[models.Condition] = []
            if exclude_listing_id:
                exclude_point_id = listing_id_to_point_id(exclude_listing_id)
                must_not_conditions.append(
                    models.HasIdCondition(has_id=[exclude_point_id])
                )

            # 1. First attempt: 5km radius with matching capacity (±2 guests)
            geo_filter = models.Filter(
                must=[
                    models.FieldCondition(
                        key="location",
                        geo_radius=models.GeoRadius(
                            center=models.GeoPoint(lat=latitude, lon=longitude),
                            radius=radius_km * 1000.0,
                        ),
                    ),
                    models.FieldCondition(
                        key="guests",
                        range=models.Range(
                            gte=max(1, capacity - 2),
                            lte=capacity + 2,
                        ),
                    ),
                ],
                must_not=must_not_conditions if must_not_conditions else None,
            )

            records, _ = await self.client.scroll(
                collection_name=collection_name,
                scroll_filter=geo_filter,
                limit=50,
                with_payload=["price"],
                with_vectors=False,
            )
            local_prices = [
                int(r.payload["price"])
                for r in records
                if r.payload and "price" in r.payload and isinstance(r.payload["price"], (int, float))
            ]

            if len(local_prices) >= 3:
                return local_prices, "neighborhood_5km"

            # 2. Fallback attempt: City-wide benchmark with matching capacity
            if city:
                city_filter = models.Filter(
                    must=[
                        models.FieldCondition(
                            key="city",
                            match=models.MatchValue(value=city),
                        ),
                        models.FieldCondition(
                            key="guests",
                            range=models.Range(
                                gte=max(1, capacity - 2),
                                lte=capacity + 2,
                            ),
                        ),
                    ],
                    must_not=must_not_conditions if must_not_conditions else None,
                )
                city_records, _ = await self.client.scroll(
                    collection_name=collection_name,
                    scroll_filter=city_filter,
                    limit=50,
                    with_payload=["price"],
                    with_vectors=False,
                )
                city_prices = [
                    int(r.payload["price"])
                    for r in city_records
                    if r.payload and "price" in r.payload and isinstance(r.payload["price"], (int, float))
                ]
                if len(city_prices) >= 3:
                    return city_prices, "city"

            return local_prices, "insufficient_data"

        except Exception as exc:
            logger.warning("Spatial neighborhood price query encountered an error: %s", exc)
            return [], "insufficient_data"

    async def close(self) -> None:
        """Closes the underlying client connection."""
        await self.client.close()


_qdrant_service_instance: Optional[QdrantService] = None


def get_qdrant_service() -> QdrantService:
    """Dependency provider for QdrantService singleton."""
    global _qdrant_service_instance
    if _qdrant_service_instance is None:
        _qdrant_service_instance = QdrantService()
    return _qdrant_service_instance
