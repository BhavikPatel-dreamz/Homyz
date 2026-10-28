from unittest.mock import AsyncMock, patch
import pytest
from httpx import ASGITransport, AsyncClient
from core.config import get_settings
from main import app
from models.listings import ListingSyncRequest
from services.listing_service import build_listing_search_text

settings = get_settings()

MOCK_SYNC_PAYLOAD = {
    "listing_id": "prop_test_001",
    "title": "Cozy Mountain Cabin",
    "description": "Secluded wooden cabin with panoramic ridge views and high-speed fiber wifi.",
    "price": 15000,
    "city": "Aspen",
    "country": "USA",
    "latitude": 39.1911,
    "longitude": -106.8175,
    "guests": 4,
    "bedrooms": 2,
    "beds": 2,
    "bathrooms": 1.5,
    "property_type": "Cabin",
    "listing_type": "Entire place",
    "amenities": ["Fast Wifi", "Fireplace", "Mountain View"],
    "is_guest_favorite": True,
    "is_new_listing": False,
    "house_rules": {
        "check_in_method": "SMART_LOCK",
        "check_in_start": "15:00",
        "check_in_end": "22:00",
        "check_out_time": "11:00",
        "parking_available": True,
        "parking_type": "FREE",
        "cancellation_policy": "FLEXIBLE",
        "pets_allowed": True,
        "smoking_allowed": False,
    },
}


def test_build_listing_search_text() -> None:
    req = ListingSyncRequest(**MOCK_SYNC_PAYLOAD)
    text = build_listing_search_text(req)
    assert "Cozy Mountain Cabin" in text
    assert "Aspen, USA" in text
    assert "Fast Wifi" in text
    # Verify description and house rules are excluded from embedding to prevent vector dilution
    assert req.description not in text
    assert "FLEXIBLE" not in text


@pytest.mark.asyncio
async def test_sync_listing_unauthorized() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/listings/sync", json=MOCK_SYNC_PAYLOAD)
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_sync_listing_success() -> None:
    transport = ASGITransport(app=app)
    mock_vector = [0.01] * 1536

    with patch(
        "services.embedding_service.EmbeddingService.get_embedding",
        new=AsyncMock(return_value=mock_vector),
    ), patch(
        "services.qdrant_service.QdrantService.upsert_listing",
        new=AsyncMock(return_value=None),
    ):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/listings/sync",
                headers={"X-API-Key": settings.API_KEY_SECRET},
                json=MOCK_SYNC_PAYLOAD,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
            assert data["listing_id"] == "prop_test_001"
            assert data["indexed"] is True


@pytest.mark.asyncio
async def test_delete_listing_unauthorized() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.delete("/api/v1/listings/prop_test_001")
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_delete_listing_success() -> None:
    transport = ASGITransport(app=app)
    with patch(
        "services.qdrant_service.QdrantService.delete_listing",
        new=AsyncMock(return_value=True),
    ):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.delete(
                "/api/v1/listings/prop_test_001",
                headers={"X-API-Key": settings.API_KEY_SECRET},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "deleted"
            assert data["listing_id"] == "prop_test_001"
            assert data["deleted"] is True


@pytest.mark.asyncio
async def test_embedding_service_truncation_and_unicode() -> None:
    from services.embedding_service import EmbeddingService

    mock_client = AsyncMock()
    mock_client.aembed_query = AsyncMock(return_value=[0.1] * 1536)

    service = EmbeddingService()
    service._embeddings = mock_client

    # Very long text with Arabic unicode
    long_arabic_text = "شقة فندقية فاخرة في الرياض " * 2000  # ~54,000 characters
    result = await service.get_embedding(long_arabic_text)

    assert len(result) == 1536
    # Verify the argument sent to OpenAI was truncated to <= 25000 chars
    called_text = mock_client.aembed_query.call_args[0][0]
    assert len(called_text) <= 25000
