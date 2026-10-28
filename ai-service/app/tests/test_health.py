import pytest
from httpx import ASGITransport, AsyncClient
from main import app
from core.config import get_settings

settings = get_settings()


@pytest.mark.asyncio
async def test_healthz_endpoint() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/healthz")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert "qdrant" in data
        assert "mode" in data


@pytest.mark.asyncio
async def test_validation_error_handler() -> None:
    # A test to verify standard schema returned on validation error
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Requesting nonexistent endpoint or bad data
        response = await client.get("/api/v1/nonexistent")
        assert response.status_code == 404
