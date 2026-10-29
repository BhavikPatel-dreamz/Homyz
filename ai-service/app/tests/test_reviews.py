from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch
import pytest
from httpx import ASGITransport, AsyncClient

from core.constants import API_KEY_HEADER_NAME
from main import app
from models.reviews import (
    ReviewModerationRequest,
    ReviewModerationResponse,
    ReviewSummarizeRequest,
    ReviewSummarizeResponse,
)
from services.review_service import ReviewService, get_review_service

TEST_API_KEY = "dev-secret-internal-key-123"
AUTH_HEADERS = {API_KEY_HEADER_NAME: TEST_API_KEY}


@pytest.fixture
def review_service() -> ReviewService:
    return ReviewService()


# ─────────────────────────────────────────────────────────────────────────────
# Authentication Tests
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_reviews_unauthorized_moderate() -> None:
    """Rejects /reviews/moderate requests without valid X-API-Key."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/reviews/moderate",
            json={"review_id": "rev_1", "listing_id": "list_1", "comment": "Good stay"},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_reviews_unauthorized_summarize() -> None:
    """Rejects /reviews/summarize requests without valid X-API-Key."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/reviews/summarize",
            json={"listing_id": "list_1", "reviews": ["Good stay"]},
        )
        assert response.status_code == 401


# ─────────────────────────────────────────────────────────────────────────────
# Moderation Gate Tests
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_moderate_empty_comment_short_circuit(review_service: ReviewService) -> None:
    """Empty or whitespace-only comment safely short-circuits at $0 AI cost."""
    request = ReviewModerationRequest(
        review_id="rev_empty",
        listing_id="list_101",
        comment="   ",
    )
    result = await review_service.moderate_review(request)
    assert result.is_flagged is False
    assert result.confidence_score == 1.0
    assert result.rejection_reason is None
    assert result.contains_contact_info is False
    assert result.is_extortion is False
    assert result.toxicity_categories.security_violation is False


@pytest.mark.asyncio
async def test_moderate_comment_over_1k_chars() -> None:
    """Rejects review comments exceeding 1,000 characters with 422 Unprocessable Content."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        long_comment = "a" * 1001
        response = await client.post(
            "/api/v1/reviews/moderate",
            headers=AUTH_HEADERS,
            json={
                "review_id": "rev_long",
                "listing_id": "list_1",
                "comment": long_comment,
            },
        )
        assert response.status_code == 422


@pytest.mark.asyncio
async def test_moderate_regex_phone_detection(review_service: ReviewService) -> None:
    """Pre-screens obvious international and domestic phone numbers ($0 cost)."""
    samples = [
        "Call me directly at +1 (555) 019-2834 for direct deal",
        "Reach out on 555-123-4567 to book off-site",
    ]
    for sample in samples:
        request = ReviewModerationRequest(
            review_id="rev_phone",
            listing_id="list_101",
            comment=sample,
        )
        result = await review_service.moderate_review(request)
        assert result.is_flagged is True
        assert result.contains_contact_info is True
        assert "contact" in result.rejection_reason.lower()


@pytest.mark.asyncio
async def test_moderate_regex_keywords_and_handles(review_service: ReviewService) -> None:
    """Pre-screens WhatsApp, Telegram, Venmo, and social handles ($0 cost)."""
    samples = [
        "Let's chat on WhatsApp for a discount",
        "Send deposit via Venmo or Zelle to confirm",
        "Message me on Instagram: @direct_host_deals for 20% off",
    ]
    for sample in samples:
        request = ReviewModerationRequest(
            review_id="rev_contact",
            listing_id="list_101",
            comment=sample,
        )
        result = await review_service.moderate_review(request)
        assert result.is_flagged is True
        assert result.contains_contact_info is True


@pytest.mark.asyncio
async def test_moderate_regex_email_detection(review_service: ReviewService) -> None:
    """Pre-screens standard and obfuscated email addresses ($0 cost)."""
    samples = [
        "Email me at host@luxuryvillas.com",
        "Write to owner [at] gmail [dot] com for direct discount",
    ]
    for sample in samples:
        request = ReviewModerationRequest(
            review_id="rev_email",
            listing_id="list_101",
            comment=sample,
        )
        result = await review_service.moderate_review(request)
        assert result.is_flagged is True
        assert result.contains_contact_info is True


@pytest.mark.asyncio
async def test_moderate_regex_door_code_security_violation(review_service: ReviewService) -> None:
    """Pre-screens public disclosures of door keypad pins and lockbox combinations ($0 cost)."""
    samples = [
        "The front door code is 4921 for entry",
        "The lockbox combination is 1234 on the back porch",
        "Keypad pin for the apartment is 8899",
    ]
    for sample in samples:
        request = ReviewModerationRequest(
            review_id="rev_security",
            listing_id="list_101",
            comment=sample,
        )
        result = await review_service.moderate_review(request)
        assert result.is_flagged is True
        assert result.toxicity_categories.security_violation is True
        assert "security" in result.rejection_reason.lower()


@pytest.mark.asyncio
async def test_moderate_regex_no_false_positives(review_service: ReviewService) -> None:
    """Ensures legitimate numerical text (transit, room numbers, dates) does NOT trigger regex."""
    clean_sample = (
        "Bus 42 takes 15 minutes to reach downtown. The apartment is unit 5B in a building "
        "constructed in 2024. Total was $150 per night."
    )
    flagged, _, _, _, contact, _ = review_service._regex_pre_check(clean_sample)
    assert flagged is False
    assert contact is False


@pytest.mark.asyncio
async def test_moderate_anti_censorship_honest_negative(review_service: ReviewService) -> None:
    """Legitimate honest negative feedback about property defects must NEVER be censored."""
    mock_llm_response = {
        "is_flagged": False,
        "confidence_score": 0.95,
        "rejection_reason": None,
        "moderation_notes": "Valid honest guest review regarding property condition.",
        "harassment": False,
        "hate_speech": False,
        "profanity": False,
        "sexual": False,
        "violence": False,
        "security_violation": False,
        "contains_contact_info": False,
        "is_extortion": False,
    }

    with patch.object(
        ReviewService,
        "moderation_client",
        new_callable=MagicMock,
    ) as mock_client:
        mock_chain = AsyncMock()
        mock_chain.ainvoke.return_value = mock_llm_response
        mock_client.__get__ = MagicMock(return_value=mock_chain)

        request = ReviewModerationRequest(
            review_id="rev_negative",
            listing_id="list_101",
            comment="The AC was broken, room was dusty, and host took 6 hours to respond.",
        )
        result = await review_service.moderate_review(request)
        assert result.is_flagged is False
        assert result.rejection_reason is None


@pytest.mark.asyncio
async def test_moderate_extortion_detected(review_service: ReviewService) -> None:
    """Flags review extortion and blackmail."""
    mock_llm_response = {
        "is_flagged": True,
        "confidence_score": 0.99,
        "rejection_reason": "Review extortion / blackmail",
        "moderation_notes": "Guest explicitly threatened a 1-star review conditional on monetary refund.",
        "harassment": False,
        "hate_speech": False,
        "profanity": False,
        "sexual": False,
        "violence": False,
        "security_violation": False,
        "contains_contact_info": False,
        "is_extortion": True,
    }

    with patch.object(
        ReviewService,
        "moderation_client",
        new_callable=MagicMock,
    ) as mock_client:
        mock_chain = AsyncMock()
        mock_chain.ainvoke.return_value = mock_llm_response
        mock_client.__get__ = MagicMock(return_value=mock_chain)

        request = ReviewModerationRequest(
            review_id="rev_extort",
            listing_id="list_101",
            comment="Refund my full cleaning fee immediately or I will leave a 1-star review.",
        )
        result = await review_service.moderate_review(request)
        assert result.is_flagged is True
        assert result.is_extortion is True


@pytest.mark.asyncio
async def test_moderate_upstream_safety_block_graceful_handling(review_service: ReviewService) -> None:
    """Catches upstream Gemini SAFETY finish_reason / OpenAI content_filter gracefully."""
    with patch.object(
        ReviewService,
        "moderation_client",
        new_callable=MagicMock,
    ) as mock_client:
        mock_chain = AsyncMock()
        mock_chain.ainvoke.side_effect = Exception(
            "GoogleGenerativeAIError: Generation stopped due to HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT (FinishReason.SAFETY)"
        )
        mock_client.__get__ = MagicMock(return_value=mock_chain)

        request = ReviewModerationRequest(
            review_id="rev_violent",
            listing_id="list_101",
            comment="Violent threat text triggering upstream safety block",
        )
        result = await review_service.moderate_review(request)
        assert result.is_flagged is True
        assert result.confidence_score == 1.0
        assert "safety policy violation" in result.rejection_reason.lower()


# ─────────────────────────────────────────────────────────────────────────────
# Summarization & Aspect Extraction Tests
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_summarize_reviews_validation() -> None:
    """Verifies input validation: empty array rejection, item length limit, batch character limits."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. Empty reviews list
        resp = await client.post(
            "/api/v1/reviews/summarize",
            headers=AUTH_HEADERS,
            json={"listing_id": "list_1", "reviews": []},
        )
        assert resp.status_code == 422

        # 2. Review exceeding 1,000 characters
        resp = await client.post(
            "/api/v1/reviews/summarize",
            headers=AUTH_HEADERS,
            json={"listing_id": "list_1", "reviews": ["a" * 1001]},
        )
        assert resp.status_code == 422


@pytest.mark.asyncio
async def test_summarize_sparse_reviews(review_service: ReviewService) -> None:
    """Verifies ultra-sparse mode (1 review) produces concise summary without hallucinations."""
    mock_llm_response = {
        "cleanliness": 4.8,
        "accuracy": 4.9,
        "check_in": 5.0,
        "communication": 4.7,
        "location": 4.5,
        "value": 4.6,
        "summary": "Guest appreciated the exceptionally comfortable bed and fast keypad check-in.",
        "highlights": ["Comfortable bedding", "Fast keypad check-in"],
        "considerations": [],
    }

    with patch.object(
        ReviewService,
        "summarize_client",
        new_callable=MagicMock,
    ) as mock_client:
        mock_chain = AsyncMock()
        mock_chain.ainvoke.return_value = mock_llm_response
        mock_client.__get__ = MagicMock(return_value=mock_chain)

        request = ReviewSummarizeRequest(
            listing_id="list_sparse",
            reviews=["The bed was very comfortable and keypad check-in was fast."],
        )
        result = await review_service.summarize_reviews(request)

        assert result.listing_id == "list_sparse"
        assert result.total_reviews_analyzed == 1
        assert 1.0 <= result.aspect_ratings.cleanliness <= 5.0
        assert 1.0 <= result.aspect_ratings.check_in <= 5.0
        assert len(result.highlights) == 2
        assert len(result.considerations) == 0


@pytest.mark.asyncio
async def test_summarize_batch_synthesis_and_alias(review_service: ReviewService) -> None:
    """Verifies standard batch synthesis (3+ reviews), 1.0-5.0 scale, and camelCase alias serialization."""
    mock_llm_response = {
        "cleanliness": 4.9,
        "accuracy": 4.7,
        "check_in": 5.0,
        "communication": 4.9,
        "location": 4.4,
        "value": 4.6,
        "summary": (
            "Guests consistently praise the pristine cleanliness and seamless self check-in. "
            "The host communicates promptly and warmly. Some guests noted moderate street noise."
        ),
        "highlights": ["Spotless cleanliness", "Seamless self check-in", "Prompt host replies"],
        "considerations": ["Moderate street noise on weekends"],
    }

    with patch.object(
        ReviewService,
        "summarize_client",
        new_callable=MagicMock,
    ) as mock_client:
        mock_chain = AsyncMock()
        mock_chain.ainvoke.return_value = mock_llm_response
        mock_client.__get__ = MagicMock(return_value=mock_chain)

        request = ReviewSummarizeRequest(
            listing_id="list_full",
            reviews=[
                "Pristine cleanliness throughout the apartment!",
                "Seamless self check-in and the host was very communicative.",
                "Great stay overall, though there was some weekend street noise.",
                # Duplicate that should be normalized & deduplicated
                "pristine cleanliness throughout the apartment!   ",
            ],
        )
        result = await review_service.summarize_reviews(request)

        # 4 reviews were submitted, but 1 was a duplicate -> exactly 3 analyzed
        assert result.total_reviews_analyzed == 3

        # Serialization test: both check_in and checkIn alias work seamlessly
        dump_by_alias = result.model_dump(by_alias=True)
        assert "checkIn" in dump_by_alias["aspect_ratings"]
        assert dump_by_alias["aspect_ratings"]["checkIn"] == 5.0

        dump_by_name = result.model_dump(by_alias=False)
        assert "check_in" in dump_by_name["aspect_ratings"]
        assert dump_by_name["aspect_ratings"]["check_in"] == 5.0


@pytest.mark.asyncio
async def test_api_v1_moderate_endpoint() -> None:
    """Integration test: calls POST /api/v1/reviews/moderate via FastAPI HTTP client."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/reviews/moderate",
            headers=AUTH_HEADERS,
            json={
                "review_id": "rev_api_test",
                "listing_id": "list_api_test",
                "comment": "Reach me on WhatsApp at +1-555-0199 for direct booking",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["review_id"] == "rev_api_test"
        assert data["is_flagged"] is True
        assert data["contains_contact_info"] is True


@pytest.mark.asyncio
async def test_api_v1_summarize_endpoint() -> None:
    """Integration test: calls POST /api/v1/reviews/summarize via FastAPI HTTP client."""
    mock_llm_response = {
        "cleanliness": 4.9,
        "accuracy": 4.8,
        "check_in": 5.0,
        "communication": 5.0,
        "location": 4.7,
        "value": 4.8,
        "summary": "Guests thoroughly enjoyed their stay, citing immaculate cleanliness and great location.",
        "highlights": ["Immaculate cleanliness", "Convenient location"],
        "considerations": [],
    }

    with patch.object(
        ReviewService,
        "summarize_client",
        new_callable=MagicMock,
    ) as mock_client:
        mock_chain = AsyncMock()
        mock_chain.ainvoke.return_value = mock_llm_response
        mock_client.__get__ = MagicMock(return_value=mock_chain)

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/reviews/summarize",
                headers=AUTH_HEADERS,
                json={
                    "listing_id": "list_api_test",
                    "reviews": ["Spotless apartment and wonderful location!"],
                },
            )
            assert response.status_code == 200
            data = response.json()
            assert data["listing_id"] == "list_api_test"
            assert data["total_reviews_analyzed"] == 1
            assert data["aspect_ratings"]["checkIn"] == 5.0
            assert len(data["highlights"]) == 2
