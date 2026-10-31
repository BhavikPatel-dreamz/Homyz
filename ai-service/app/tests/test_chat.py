import json
from collections.abc import AsyncGenerator
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from httpx import ASGITransport, AsyncClient
from langchain_core.messages import AIMessageChunk

from core.config import get_settings
from core.constants import API_KEY_HEADER_NAME
from main import app
from models.chat import ChatMessage, ChatRequest
from services.chat_service import ChatService, get_chat_service
from services.qdrant_service import QdrantService

settings = get_settings()
TEST_API_KEY = settings.API_KEY_SECRET
AUTH_HEADERS = {
    API_KEY_HEADER_NAME: TEST_API_KEY,
    "Content-Type": "application/json",
}

SAMPLE_LISTING_PAYLOAD: dict[str, Any] = {
    "listing_id": "list_villa_901",
    "title": "Sunset Modern Villa with Heated Pool",
    "property_type": "Villa",
    "listing_type": "Entire place",
    "city": "Miami",
    "country": "USA",
    "price": 35000,
    "guests": 6,
    "bedrooms": 3,
    "beds": 4,
    "bathrooms": 2.5,
    "amenities": ["Fast Wifi", "Heated Pool", "Dedicated Workspace", "Free Parking"],
    "house_rules": {
        "cancellation_policy": "MODERATE",
        "check_in_method": "KEYPAD_SMART_LOCK",
        "check_in_start": "15:00",
        "check_in_end": "22:00",
        "check_out_time": "11:00",
        "parking_available": True,
        "parking_type": "DRIVEWAY",
        "parking_instructions": "Park in private driveway space 1 and 2.",
        "wifi_network": "SunsetVilla_5G",
        "wifi_password": "oceanview_secret",
        "quiet_hours": True,
        "quiet_hours_start": "22:00",
        "quiet_hours_end": "08:00",
        "pets_allowed": False,
        "smoking_allowed": False,
        "additional_rules": "No glassware around the pool area.",
    },
}


async def _mock_astream_generator(tokens: list[str]) -> AsyncGenerator[AIMessageChunk, None]:
    """Helper generator simulating LangChain LLM astream."""
    for tok in tokens:
        yield AIMessageChunk(content=tok)


# ─────────────────────────────────────────────────────────────────────────────
# Authentication & Validation Tests
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_chat_unauthorized() -> None:
    """Rejects chat requests without valid X-API-Key with 401 Unauthorized."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/chat",
            json={"message": "Hi, what time is check-in?"},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_chat_empty_message_validation() -> None:
    """Rejects empty or whitespace-only messages with 422 Unprocessable Content."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/chat",
            headers=AUTH_HEADERS,
            json={"message": "   "},
        )
        assert response.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# Service Unit Tests
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_chat_service_platform_faq_mode() -> None:
    """Verifies streaming in Platform FAQ mode (when listing_id is omitted)."""
    mock_qdrant = AsyncMock(spec=QdrantService)
    service = ChatService(qdrant_service=mock_qdrant)

    expected_tokens = ["Homyz ", "offers ", "flexible ", "cancellations."]
    mock_llm = MagicMock()
    mock_llm.astream = MagicMock(return_value=_mock_astream_generator(expected_tokens))

    with patch.object(ChatService, "llm", new_callable=MagicMock) as prop:
        prop.__get__ = MagicMock(return_value=mock_llm)

        request = ChatRequest(message="What is the cancellation policy on Homyz?")
        chunks = []
        async for chunk in service.stream_chat(request):
            chunks.append(chunk)

        # Qdrant should NOT be called when listing_id is None
        mock_qdrant.get_listing_by_id.assert_not_called()

        # Parse SSE data events
        data_lines = [c.strip() for c in chunks if c.startswith("data: ")]
        assert len(data_lines) == 5  # 4 token chunks + 1 done chunk

        # First tokens
        token_1 = json.loads(data_lines[0].replace("data: ", ""))
        assert token_1["token"] == "Homyz "

        # Final event
        done_event = json.loads(data_lines[-1].replace("data: ", ""))
        assert done_event["done"] is True
        assert len(done_event["suggested_quick_replies"]) > 0


@pytest.mark.asyncio
async def test_chat_service_property_mode_rag() -> None:
    """Verifies property mode fetches metadata from Qdrant and injects into prompt."""
    mock_qdrant = AsyncMock(spec=QdrantService)
    mock_qdrant.get_listing_by_id.return_value = SAMPLE_LISTING_PAYLOAD
    service = ChatService(qdrant_service=mock_qdrant)

    expected_tokens = ["Check-in ", "starts ", "at ", "3:00 PM."]
    mock_llm = MagicMock()
    mock_llm.astream = MagicMock(return_value=_mock_astream_generator(expected_tokens))

    with patch.object(ChatService, "llm", new_callable=MagicMock) as prop:
        prop.__get__ = MagicMock(return_value=mock_llm)

        request = ChatRequest(
            listing_id="list_villa_901",
            message="What is the wifi password and parking situation?",
        )
        chunks = []
        async for chunk in service.stream_chat(request):
            chunks.append(chunk)

        mock_qdrant.get_listing_by_id.assert_called_once_with("list_villa_901")

        # Verify LLM received prompt with strictly PUBLIC details (Zero-Knowledge Security)
        call_args = mock_llm.astream.call_args[0][0]
        system_msg = call_args[0].content
        assert "Wi-Fi: Available on premises" in system_msg
        assert "MODERATE" in system_msg
        assert "Check-in Hours: After 15:00, before 22:00" in system_msg
        assert "Check-out: Before 11:00" in system_msg

        # Strict security assertions: zero private arrival guide info leaks to public LLM
        assert "oceanview_secret" not in system_msg  # Private Wi-Fi password
        assert "SunsetVilla_5G" not in system_msg    # Private Wi-Fi network SSID
        assert "KEYPAD_SMART_LOCK" not in system_msg # Private check-in method/code
        assert "private driveway space 1 and 2" not in system_msg  # Private parking bay instructions


@pytest.mark.asyncio
async def test_chat_service_listing_not_found_fallback() -> None:
    """When listing_id is not found in Qdrant, falls back cleanly without crashing."""
    mock_qdrant = AsyncMock(spec=QdrantService)
    mock_qdrant.get_listing_by_id.return_value = None
    service = ChatService(qdrant_service=mock_qdrant)

    expected_tokens = ["I ", "can ", "help ", "with ", "platform ", "policies."]
    mock_llm = MagicMock()
    mock_llm.astream = MagicMock(return_value=_mock_astream_generator(expected_tokens))

    with patch.object(ChatService, "llm", new_callable=MagicMock) as prop:
        prop.__get__ = MagicMock(return_value=mock_llm)

        request = ChatRequest(
            listing_id="non_existent_id",
            message="Can I cancel my trip?",
        )
        chunks = []
        async for chunk in service.stream_chat(request):
            chunks.append(chunk)

        mock_qdrant.get_listing_by_id.assert_called_once_with("non_existent_id")
        data_lines = [c.strip() for c in chunks if c.startswith("data: ")]
        assert len(data_lines) == 7  # 6 tokens + done


@pytest.mark.asyncio
async def test_chat_service_sliding_window_history() -> None:
    """Ensures conversation history is pruned to the last 5 messages."""
    mock_qdrant = AsyncMock(spec=QdrantService)
    service = ChatService(qdrant_service=mock_qdrant)

    # Create 16 conversation history turns
    history = [
        ChatMessage(role="user" if i % 2 == 0 else "assistant", content=f"Message {i}")
        for i in range(16)
    ]

    mock_llm = MagicMock()
    mock_llm.astream = MagicMock(return_value=_mock_astream_generator(["OK"]))

    with patch.object(ChatService, "llm", new_callable=MagicMock) as prop:
        prop.__get__ = MagicMock(return_value=mock_llm)

        request = ChatRequest(
            message="New question",
            conversation_history=history,
        )
        async for _ in service.stream_chat(request):
            pass

        # Inspect messages passed to LLM
        call_messages = mock_llm.astream.call_args[0][0]
        # Should be: 1 SystemMessage + 5 Pruned History Messages + 1 Current User Message = 7 total
        assert len(call_messages) == 7
        # First history message should be Message 11 (16 - 5 = index 11)
        assert call_messages[1].content == "Message 11"
        assert call_messages[-1].content == "New question"


@pytest.mark.asyncio
async def test_chat_service_stream_error_fallback() -> None:
    """When LLM stream encounters an error, emits fallback token and terminates cleanly."""
    mock_qdrant = AsyncMock(spec=QdrantService)
    service = ChatService(qdrant_service=mock_qdrant)

    async def _failing_stream(messages: Any) -> AsyncGenerator[Any, None]:
        yield AIMessageChunk(content="Initial token. ")
        raise RuntimeError("Simulated connection reset")

    mock_llm = MagicMock()
    mock_llm.astream = MagicMock(side_effect=_failing_stream)

    with patch.object(ChatService, "llm", new_callable=MagicMock) as prop:
        prop.__get__ = MagicMock(return_value=mock_llm)

        request = ChatRequest(message="Tell me about this place")
        chunks = []
        async for chunk in service.stream_chat(request):
            chunks.append(chunk)

        data_lines = [c.strip() for c in chunks if c.startswith("data: ")]
        # Initial token + Error fallback token + Done event
        assert len(data_lines) == 3

        fallback_event = json.loads(data_lines[1].replace("data: ", ""))
        assert "unable to complete this response" in fallback_event["token"]
        assert "/profile/tab/support" in fallback_event["token"]

        done_event = json.loads(data_lines[2].replace("data: ", ""))
        assert done_event["done"] is True


# ─────────────────────────────────────────────────────────────────────────────
# Integration HTTP Route Test
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_api_v1_chat_stream_endpoint() -> None:
    """Integration test: calls POST /api/v1/chat and verifies Server-Sent Events stream."""
    mock_tokens = ["Yes, ", "parking ", "is ", "free."]

    with patch.object(ChatService, "llm", new_callable=MagicMock) as prop:
        mock_llm = MagicMock()
        mock_llm.astream = MagicMock(return_value=_mock_astream_generator(mock_tokens))
        prop.__get__ = MagicMock(return_value=mock_llm)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/chat",
                headers=AUTH_HEADERS,
                json={"message": "Can I park my vehicle?"},
            )
            assert response.status_code == 200
            assert "text/event-stream" in response.headers["content-type"]

            content = response.text
            assert "data: " in content
            assert '"token": "Yes, "' in content
            assert '"done": true' in content
