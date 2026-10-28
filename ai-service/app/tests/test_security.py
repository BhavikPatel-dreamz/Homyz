import pytest
from fastapi import APIRouter, Depends
from httpx import ASGITransport, AsyncClient
from core.config import get_settings
from core.exceptions import BadRequestError
from core.security import verify_api_key
from main import app

api_mock_router = APIRouter(prefix="/mock")


@api_mock_router.get("/protected")
async def protected_endpoint(key: str = Depends(verify_api_key)) -> dict[str, str]:
    return {"status": "authorized"}


@api_mock_router.get("/error")
async def error_endpoint() -> dict[str, str]:
    raise BadRequestError("Custom bad request message")


app.include_router(api_mock_router)

settings = get_settings()


@pytest.mark.asyncio
async def test_missing_api_key() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/mock/protected")
        assert response.status_code == 401
        data = response.json()
        assert data["code"] == "UNAUTHORIZED"
        assert "Invalid or missing API key" in data["detail"]


@pytest.mark.asyncio
async def test_valid_api_key() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get(
            "/mock/protected",
            headers={"X-API-Key": settings.API_KEY_SECRET},
        )
        assert response.status_code == 200
        assert response.json() == {"status": "authorized"}


@pytest.mark.asyncio
async def test_domain_exception_handling() -> None:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/mock/error")
        assert response.status_code == 400
        data = response.json()
        assert data["code"] == "BAD_REQUEST"
        assert data["detail"] == "Custom bad request message"

