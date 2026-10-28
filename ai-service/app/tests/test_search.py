from unittest.mock import AsyncMock, patch
import pytest
from httpx import ASGITransport, AsyncClient
from qdrant_client import models
from core.config import get_settings
from main import app
from models.search import SearchResultItem
from services.search_service import SearchService

settings = get_settings()


def test_fair_discovery_boost_slotting() -> None:
    search_service = SearchService(
        qdrant_service=AsyncMock(),
        embedding_service=AsyncMock(),
    )

    # 10 search results where result at index 5 is a new listing
    items = [
        SearchResultItem(listing_id=f"item_{i}", relevance_score=0.9 - i * 0.05, price=10000)
        for i in range(10)
    ]
    new_indices = [5]  # item_5 is new

    search_service._apply_fair_discovery_boost(items, new_indices)

    # Should be promoted into slot 4 (index 3)
    assert items[3].listing_id == "item_5"
    assert items[3].is_new_listing_boost is True


def test_fair_discovery_boost_skips_irrelevant_listing() -> None:
    search_service = SearchService(
        qdrant_service=AsyncMock(),
        embedding_service=AsyncMock(),
    )

    # item_5 has low relevance score (0.25 < 0.50 threshold)
    items = [
        SearchResultItem(listing_id=f"item_{i}", relevance_score=0.9 - i * 0.05, price=10000)
        for i in range(10)
    ]
    items[5].relevance_score = 0.25  # Irrelevant new listing
    new_indices = [5]

    search_service._apply_fair_discovery_boost(items, new_indices)

    # Should NOT be promoted because relevance is below threshold
    assert items[3].listing_id == "item_3"
    assert items[5].listing_id == "item_5"
    assert items[5].is_new_listing_boost is False


@pytest.mark.asyncio
async def test_search_listings_with_geo_and_filters() -> None:
    transport = ASGITransport(app=app)
    mock_vector = [0.05] * 1536

    mock_scored_points = [
        models.ScoredPoint(
            id="c8b93998-3f5f-53c0-a7d1-e6c888e23ba5",
            version=1,
            score=0.942,
            payload={
                "listing_id": "prop_test_001",
                "price": 15000,
                "is_new_listing": False,
            },
        )
    ]

    with patch(
        "services.embedding_service.EmbeddingService.get_embedding",
        new=AsyncMock(return_value=mock_vector),
    ), patch(
        "services.qdrant_service.QdrantService.count_listings",
        new=AsyncMock(return_value=1),
    ), patch(
        "services.qdrant_service.QdrantService.query_listings",
        new=AsyncMock(return_value=mock_scored_points),
    ):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            search_query = {
                "query": "quiet cabin in the mountains",
                "latitude": 39.1911,
                "longitude": -106.8175,
                "radius_km": 20.0,
                "min_price": 10000,
                "max_price": 25000,
                "guests": 2,
                "page": 1,
                "page_size": 20,
            }
            response = await client.post(
                "/api/v1/search",
                headers={"X-API-Key": settings.API_KEY_SECRET},
                json=search_query,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["total_matches"] == 1
            assert len(data["results"]) == 1
            assert data["results"][0]["listing_id"] == "prop_test_001"
            assert data["results"][0]["relevance_score"] == 0.942
            assert data["results"][0]["price"] == 15000


@pytest.mark.asyncio
async def test_search_personalization_boost() -> None:
    transport = ASGITransport(app=app)

    mock_scored_points = [
        models.ScoredPoint(
            id="c8b93998-3f5f-53c0-a7d1-e6c888e23ba5",
            version=1,
            score=0.985,
            payload={
                "listing_id": "prop_recommended_002",
                "price": 18000,
                "is_new_listing": False,
            },
        )
    ]

    with patch(
        "services.qdrant_service.QdrantService.count_listings",
        new=AsyncMock(return_value=1),
    ), patch(
        "services.qdrant_service.QdrantService.query_listings",
        new=AsyncMock(return_value=mock_scored_points),
    ):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            search_query = {
                "positive_listing_ids": ["prop_test_001"],
                "page": 1,
                "page_size": 10,
            }
            response = await client.post(
                "/api/v1/search",
                headers={"X-API-Key": settings.API_KEY_SECRET},
                json=search_query,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["results"][0]["is_personalized_boost"] is True
            assert data["results"][0]["listing_id"] == "prop_recommended_002"


@pytest.mark.asyncio
async def test_search_invalid_price_range() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        search_query = {
            "min_price": 50000,
            "max_price": 10000,  # min > max
        }
        response = await client.post(
            "/api/v1/search",
            headers={"X-API-Key": settings.API_KEY_SECRET},
            json=search_query,
        )
        assert response.status_code == 422
        data = response.json()
        assert "min_price cannot be greater than max_price" in data["detail"]
