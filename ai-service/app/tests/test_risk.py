import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from langchain_core.messages import AIMessage

from core.config import get_settings
from core.constants import API_KEY_HEADER_NAME
from main import app
from models.listings import HouseRules
from models.risk import RiskAuditRequest
from services.risk_service import RiskService, get_risk_service

settings = get_settings()
TEST_API_KEY = settings.API_KEY_SECRET
AUTH_HEADERS = {
    API_KEY_HEADER_NAME: TEST_API_KEY,
    "Content-Type": "application/json",
}

SAMPLE_AUDIT_REQUEST = {
    "listing_id": "prop_test_paris_001",
    "title": "Charming Parisian Studio near Montmartre",
    "description": "Lovely sunlit studio with balcony, kitchenette, and fiber internet. Perfect for solo travelers.",
    "price": 12000,  # $120.00 in cents
    "guests": 2,
    "bedrooms": 1,
    "beds": 1,
    "bathrooms": 1.0,
    "city": "Paris",
    "country": "France",
    "latitude": 48.8867,
    "longitude": 2.3431,
    "property_type": "Apartment",
    "listing_type": "Entire place",
    "amenities": ["Fast Wifi", "Kitchen", "Balcony"],
    "house_rules": "No smoking, no parties.",
}


@pytest.fixture
def risk_service() -> RiskService:
    return RiskService()


# ─────────────────────────────────────────────────────────────────────────────
# 1. Authentication & Route Tests
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_audit_listing_unauthorized() -> None:
    """Rejects /risk/audit-listing requests missing valid X-API-Key."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/risk/audit-listing", json=SAMPLE_AUDIT_REQUEST)
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_audit_listing_clean_auto_approve() -> None:
    """Clean listing with fair pricing receives AUTO_APPROVE verdict."""
    transport = ASGITransport(app=app)
    # Neighborhood median is 13000 cents ($130), listing is 12000 cents ($120) -> Normal
    mock_prices = [11000, 12000, 13000, 14000, 15000]

    with patch(
        "services.qdrant_service.QdrantService.get_neighborhood_prices",
        new=AsyncMock(return_value=(mock_prices, "neighborhood_5km")),
    ):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/risk/audit-listing",
                headers=AUTH_HEADERS,
                json=SAMPLE_AUDIT_REQUEST,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["listing_id"] == "prop_test_paris_001"
            assert data["risk_score"] < 40
            assert data["verdict"] == "AUTO_APPROVE"
            assert data["is_flagged"] is False
            assert data["median_neighborhood_price"] == 13000
            assert data["neighborhood_listing_count"] == 5


# ─────────────────────────────────────────────────────────────────────────────
# 2. Spatial Price Anomaly Tests
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_audit_listing_price_honeypot(risk_service: RiskService) -> None:
    """Flags PRICE_HONEYPOT (+40 pts) when price is <50% of local median."""
    # Listing is $40/night (4000 cents), neighborhood median is $100/night (10000 cents) -> 60% below median
    req = RiskAuditRequest(
        listing_id="prop_honeypot_01",
        title="Spacious Luxury Flat",
        description="Beautiful spacious apartment in central district.",
        price=4000,
        guests=2,
        city="Paris",
        country="France",
        latitude=48.8867,
        longitude=2.3431,
    )

    mock_prices = [9500, 10000, 10500, 11000]
    with patch.object(
        risk_service.qdrant_service,
        "get_neighborhood_prices",
        new=AsyncMock(return_value=(mock_prices, "neighborhood_5km")),
    ):
        result = await risk_service.audit_listing(req)
        assert result.risk_score == 40
        assert result.verdict == "WARNING_LOW_CONFIDENCE"
        assert result.is_flagged is False
        assert any(s.signal_type == "PRICE_HONEYPOT" for s in result.signals)


@pytest.mark.asyncio
async def test_audit_listing_extreme_price_honeypot(risk_service: RiskService) -> None:
    """Flags EXTREME_PRICE_HONEYPOT (+60 pts) when price is <25% of local median."""
    # Listing is $20/night (2000 cents), median is $100/night (10000 cents) -> 80% below median
    req = RiskAuditRequest(
        listing_id="prop_extreme_honeypot",
        title="Luxury Penthouse Suite",
        description="Penthouse with private hot tub and terrace.",
        price=2000,
        guests=4,
        city="Paris",
        country="France",
        latitude=48.8867,
        longitude=2.3431,
    )

    mock_prices = [9000, 10000, 11000]
    with patch.object(
        risk_service.qdrant_service,
        "get_neighborhood_prices",
        new=AsyncMock(return_value=(mock_prices, "neighborhood_5km")),
    ):
        result = await risk_service.audit_listing(req)
        assert result.risk_score == 75
        assert result.verdict == "FLAG_FOR_MANUAL_AUDIT"
        assert result.is_flagged is True
        assert any(s.signal_type == "EXTREME_PRICE_HONEYPOT" for s in result.signals)


@pytest.mark.asyncio
async def test_audit_listing_suspicious_high_price(risk_service: RiskService) -> None:
    """Flags SUSPICIOUS_HIGH_PRICE (+20 pts) when price is >10x local median."""
    # Listing is $1,500/night (150000 cents), median is $100/night (10000 cents) -> 15x median
    req = RiskAuditRequest(
        listing_id="prop_high_price",
        title="Test Dummy Listing",
        description="Quick test listing for development purposes.",
        price=150000,
        guests=2,
        city="Paris",
        country="France",
        latitude=48.8867,
        longitude=2.3431,
    )

    mock_prices = [9000, 10000, 11000]
    with patch.object(
        risk_service.qdrant_service,
        "get_neighborhood_prices",
        new=AsyncMock(return_value=(mock_prices, "neighborhood_5km")),
    ):
        result = await risk_service.audit_listing(req)
        assert result.risk_score == 20
        assert result.verdict == "AUTO_APPROVE"  # 20 < 40
        assert result.is_flagged is False
        assert any(s.signal_type == "SUSPICIOUS_HIGH_PRICE" for s in result.signals)


# ─────────────────────────────────────────────────────────────────────────────
# 3. Deterministic Regex Pre-Screen Tests ($0 Cost)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_audit_listing_regex_whatsapp_contact(risk_service: RiskService) -> None:
    """Detects obfuscated WhatsApp and phone solicitation vectors."""
    samples = [
        "Special 30% discount if you message us on WhatsApp: +1 (555) 234-5678 before booking.",
        "Contact me directly wa.me/15552345678 for keys and payment.",
        "Do not book through app, write to w-h-a-t-s-a-p-p 555-123-4567.",
    ]

    for desc in samples:
        req = RiskAuditRequest(
            listing_id="prop_scam_contact",
            title="Cozy Apartment",
            description=desc,
            price=10000,
            guests=2,
            city="Paris",
            latitude=48.8867,
            longitude=2.3431,
        )
        with patch.object(
            risk_service.qdrant_service,
            "get_neighborhood_prices",
            new=AsyncMock(return_value=([9000, 10000, 11000], "neighborhood_5km")),
        ):
            result = await risk_service.audit_listing(req)
            assert any(s.signal_type == "OFF_PLATFORM_CONTACT" for s in result.signals)
            assert result.risk_score >= 40


@pytest.mark.asyncio
async def test_audit_listing_regex_payment_scam(risk_service: RiskService) -> None:
    """Detects off-platform payment solicitations (Wire, Western Union, Zelle, Crypto)."""
    samples = [
        "Please send direct wire transfer to our account to confirm reservation.",
        "We only accept Western Union or MoneyGram for security deposit.",
        "Pay booking balance with bitcoin or usdt cryptocurrency to receive smartlock pin.",
        "تحويل بنكي مباشر مطلوب لتأكيد الحجز",  # Arabic wire transfer
    ]

    for desc in samples:
        req = RiskAuditRequest(
            listing_id="prop_scam_payment",
            title="Downtown Suite",
            description=desc,
            price=10000,
            guests=2,
            city="Paris",
            latitude=48.8867,
            longitude=2.3431,
        )
        with patch.object(
            risk_service.qdrant_service,
            "get_neighborhood_prices",
            new=AsyncMock(return_value=([9000, 10000, 11000], "neighborhood_5km")),
        ):
            result = await risk_service.audit_listing(req)
            assert any(s.signal_type == "OFF_PLATFORM_PAYMENT" for s in result.signals)
            assert result.risk_score >= 75
            assert result.verdict == "FLAG_FOR_MANUAL_AUDIT"
            assert result.is_flagged is True


# ─────────────────────────────────────────────────────────────────────────────
# 4. Anti-Negation Heuristic Tests (Edge Case Defense)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_audit_listing_anti_negation_safe(risk_service: RiskService) -> None:
    """Does NOT flag legitimate host security warnings advising against off-platform payments."""
    safe_description = (
        "Welcome to our home! For your security and peace of mind, please keep all transactions "
        "inside Homyz. Do NOT send wire transfers or cash to anyone. All payments must be handled "
        "securely through Homyz platform."
    )
    req = RiskAuditRequest(
        listing_id="prop_safe_negation",
        title="Safe Host Apartment",
        description=safe_description,
        price=10000,
        guests=2,
        city="Paris",
        latitude=48.8867,
        longitude=2.3431,
    )

    with patch.object(
        risk_service.qdrant_service,
        "get_neighborhood_prices",
        new=AsyncMock(return_value=([9000, 10000, 11000], "neighborhood_5km")),
    ):
        result = await risk_service.audit_listing(req)
        # Should not flag OFF_PLATFORM_PAYMENT because it was negated
        assert not any(s.signal_type == "OFF_PLATFORM_PAYMENT" for s in result.signals)
        assert result.risk_score == 0
        assert result.verdict == "AUTO_APPROVE"
        assert result.is_flagged is False


# ─────────────────────────────────────────────────────────────────────────────
# 5. Compound Multi-Signal Blocking (FLAG_FOR_MANUAL_AUDIT)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_audit_listing_compound_scam_flags_manual_audit(risk_service: RiskService) -> None:
    """Compound risk signals (Extreme Honeypot + Wire Transfer) trigger FLAG_FOR_MANUAL_AUDIT."""
    # Price $20 vs $100 median = EXTREME_PRICE_HONEYPOT (+60 pts)
    # Text wire transfer = OFF_PLATFORM_PAYMENT (+50 pts)
    # Total = min(100, 110) = 100 pts -> FLAG_FOR_MANUAL_AUDIT
    req = RiskAuditRequest(
        listing_id="prop_compound_fraud",
        title="Luxury 5-Star Villa Ultra Cheap",
        description="Book now! Direct wire transfer required to hold the keys before someone else books.",
        price=2000,
        guests=6,
        city="Paris",
        latitude=48.8867,
        longitude=2.3431,
    )

    mock_prices = [9000, 10000, 11000]
    with patch.object(
        risk_service.qdrant_service,
        "get_neighborhood_prices",
        new=AsyncMock(return_value=(mock_prices, "neighborhood_5km")),
    ):
        result = await risk_service.audit_listing(req)
        assert result.risk_score == 100
        assert result.verdict == "FLAG_FOR_MANUAL_AUDIT"
        assert result.is_flagged is True
        assert "Quarantine listing" in result.recommendation


# ─────────────────────────────────────────────────────────────────────────────
# 6. House Rules Scam Detection (Prevent Scammers Hiding in Rules)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_audit_listing_scam_hidden_in_house_rules(risk_service: RiskService) -> None:
    """Detects off-platform payment hidden inside house_rules.additional_rules."""
    req = RiskAuditRequest(
        listing_id="prop_hidden_rules_scam",
        title="Modern Luxury Loft",
        description="A quiet and clean space located near the city center with all basic amenities.",
        price=10000,
        guests=2,
        city="Paris",
        latitude=48.8867,
        longitude=2.3431,
        house_rules=HouseRules(
            additional_rules="Before check-in, guest must transfer deposit via Western Union to receive key code."
        ),
    )

    with patch.object(
        risk_service.qdrant_service,
        "get_neighborhood_prices",
        new=AsyncMock(return_value=([9000, 10000, 11000], "neighborhood_5km")),
    ):
        result = await risk_service.audit_listing(req)
        assert any(s.signal_type == "OFF_PLATFORM_PAYMENT" for s in result.signals)
        assert result.risk_score >= 75
        assert result.verdict == "FLAG_FOR_MANUAL_AUDIT"
        assert result.is_flagged is True


# ─────────────────────────────────────────────────────────────────────────────
# 7. AI Contextual Scam Classifier Tests
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_audit_listing_ai_contextual_courier_scam(risk_service: RiskService) -> None:
    """AI identifies subtle courier key delivery story and adds risk signal."""
    courier_text = (
        "I am currently deployed abroad in missionary service in Africa. I cannot meet in person, "
        "so the keys will be sent via FedEx courier directly to you once deposit is transferred."
    )
    req = RiskAuditRequest(
        listing_id="prop_courier_scam",
        title="Quiet Central Flat",
        description=courier_text,
        price=10000,
        guests=2,
        city="Paris",
        latitude=48.8867,
        longitude=2.3431,
    )

    mock_scam_output = {
        "is_suspicious": True,
        "signals": [
            {
                "signal_type": "COURIER_OR_THIRD_PARTY_STORY",
                "severity": "CRITICAL",
                "score_impact": 75,
                "details": "Host claims to be deployed abroad and will ship keys via courier.",
            }
        ],
    }

    mock_client = AsyncMock()
    mock_client.ainvoke = AsyncMock(return_value=mock_scam_output)
    risk_service._scam_client = mock_client

    with patch.object(
        risk_service.qdrant_service,
        "get_neighborhood_prices",
        new=AsyncMock(return_value=([9000, 10000, 11000], "neighborhood_5km")),
    ):
        result = await risk_service.audit_listing(req)
        assert any(s.signal_type == "COURIER_OR_THIRD_PARTY_STORY" for s in result.signals)
        assert result.risk_score == 75
        assert result.verdict == "FLAG_FOR_MANUAL_AUDIT"
        assert result.is_flagged is True


# ─────────────────────────────────────────────────────────────────────────────
# 8. Cold Start & Insufficient Data Resilience
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_audit_listing_insufficient_local_data_cold_start(risk_service: RiskService) -> None:
    """Sparse / rural markets with <3 listings emit INSUFFICIENT_LOCAL_DATA (0 pts)."""
    req = RiskAuditRequest(
        listing_id="prop_rural_01",
        title="Mountain Refuge in Remote Valley",
        description="Rustic stone cabin in the high Alps with fireplace and pure mountain spring water.",
        price=8500,
        guests=2,
        city="Val d'Isère",
        latitude=45.4480,
        longitude=6.9802,
    )

    # Qdrant reports insufficient data (e.g. only 1 neighboring listing exists)
    with patch.object(
        risk_service.qdrant_service,
        "get_neighborhood_prices",
        new=AsyncMock(return_value=([9000], "insufficient_data")),
    ):
        result = await risk_service.audit_listing(req)
        # Verify signals array strictly contains real fraud violations (no pseudo-telemetry signals)
        assert result.signals == []
        assert result.risk_score == 0
        assert result.verdict == "AUTO_APPROVE"
        assert result.is_flagged is False
        assert result.median_neighborhood_price is None
        assert result.neighborhood_listing_count == 1


@pytest.mark.asyncio
async def test_audit_listing_critical_payment_short_circuits_ai(risk_service: RiskService) -> None:
    """Critical regex violations short-circuit and skip the AI contextual scan entirely."""
    req = RiskAuditRequest(
        listing_id="prop_short_circuit",
        title="Direct Wire Transfer Villa",
        description="Must send wire transfer to our account. Urgently reserve within 2 hours.",
        price=10000,
        guests=2,
        city="Paris",
        latitude=48.8867,
        longitude=2.3431,
    )
    mock_scam_client = AsyncMock()
    risk_service._scam_client = mock_scam_client

    with patch.object(
        risk_service.qdrant_service,
        "get_neighborhood_prices",
        new=AsyncMock(return_value=([9000, 10000, 11000], "neighborhood_5km")),
    ):
        result = await risk_service.audit_listing(req)
        assert result.risk_score >= 75
        assert result.is_flagged is True
        # Verify AI was NEVER called (short-circuited at Tier-0 regex)
        mock_scam_client.ainvoke.assert_not_called()


@pytest.mark.asyncio
async def test_audit_listing_qdrant_error_resilience(risk_service: RiskService) -> None:
    """Audit proceeds gracefully when Qdrant encounters network error or timeout."""
    req = RiskAuditRequest(
        listing_id="prop_resilient_01",
        title="Charming Flat",
        description="Cozy space in the heart of town.",
        price=9000,
        guests=2,
        city="Paris",
        latitude=48.8867,
        longitude=2.3431,
    )

    with patch.object(
        risk_service.qdrant_service,
        "get_neighborhood_prices",
        new=AsyncMock(return_value=([], "insufficient_data")),
    ):
        result = await risk_service.audit_listing(req)
        assert result.verdict == "AUTO_APPROVE"
        assert result.is_flagged is False


# ─────────────────────────────────────────────────────────────────────────────
# 9. Integration with Listing Sync (`POST /api/v1/listings/sync`)
# ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_sync_listing_returns_real_risk_audit() -> None:
    """Verifies that listing sync automatically attaches real risk audit assessment."""
    transport = ASGITransport(app=app)
    mock_vector = [0.01] * 1536

    sync_payload = {
        "listing_id": "prop_sync_with_risk",
        "title": "Sunlit Studio",
        "description": "Clean, lovely studio. Message w-h-a-t-s-a-p-p 555-123-4567 for discount.",
        "price": 10000,
        "city": "Paris",
        "country": "France",
        "latitude": 48.8867,
        "longitude": 2.3431,
        "guests": 2,
        "bedrooms": 1,
        "beds": 1,
        "bathrooms": 1.0,
        "property_type": "Apartment",
        "listing_type": "Entire place",
    }

    with patch(
        "services.embedding_service.EmbeddingService.get_embedding",
        new=AsyncMock(return_value=mock_vector),
    ), patch(
        "services.qdrant_service.QdrantService.upsert_listing",
        new=AsyncMock(return_value=None),
    ), patch(
        "services.qdrant_service.QdrantService.get_neighborhood_prices",
        new=AsyncMock(return_value=([9000, 10000, 11000], "neighborhood_5km")),
    ):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/listings/sync",
                headers=AUTH_HEADERS,
                json=sync_payload,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "success"
            assert "risk_audit" in data
            audit = data["risk_audit"]
            assert audit["risk_score"] >= 40
            assert audit["verdict"] == "WARNING_LOW_CONFIDENCE"
            assert any(s["signal_type"] == "OFF_PLATFORM_CONTACT" for s in audit["signals"])


@pytest.mark.asyncio
async def test_audit_listing_dynamic_recommendation_no_pricing_when_no_anomaly(
    risk_service: RiskService,
) -> None:
    """Verifies recommendations do not mention neighborhood benchmarks when there is no price anomaly."""
    req = RiskAuditRequest(
        listing_id="prop_test_04_obfuscated_contact",
        title="Modern Apartment in Downtown",
        description="To book, contact manager [at] directapartments [dot] com.",
        price=15000,
        guests=2,
        city="Dubai",
        country="UAE",
        latitude=25.2048,
        longitude=55.2708,
    )
    # Simulate cold-start with 0 neighborhood listings
    with patch.object(
        risk_service.qdrant_service,
        "get_neighborhood_prices",
        new=AsyncMock(return_value=([], "none")),
    ):
        result = await risk_service.audit_listing(req)
        assert result.risk_score == 40
        assert result.verdict == "WARNING_LOW_CONFIDENCE"
        assert result.median_neighborhood_price is None
        # Must recommend removing contact info
        assert "remove off-platform contact details" in result.recommendation
        # Must NEVER mention neighborhood or pricing
        assert "neighborhood" not in result.recommendation.lower()
        assert "pricing" not in result.recommendation.lower()


@pytest.mark.asyncio
async def test_sync_listing_quarantines_fraud_listing() -> None:
    """Flagged fraud listings are quarantined, unindexed, and never upserted into Qdrant."""
    transport = ASGITransport(app=app)
    scam_payload = {
        "listing_id": "prop_scam_quarantined_01",
        "title": "Ultra Luxury Villa",
        "description": "Send direct wire transfer to our account within 2 hours to confirm booking.",
        "price": 10000,
        "city": "Miami Beach",
        "country": "United States",
        "latitude": 25.7890,
        "longitude": -80.1280,
        "guests": 6,
        "bedrooms": 3,
        "beds": 3,
        "bathrooms": 2.0,
        "property_type": "Villa",
        "listing_type": "Entire place",
    }

    mock_upsert = AsyncMock()
    mock_delete = AsyncMock(return_value=True)

    with patch(
        "services.qdrant_service.QdrantService.upsert_listing",
        new=mock_upsert,
    ), patch(
        "services.qdrant_service.QdrantService.delete_listing",
        new=mock_delete,
    ), patch(
        "services.qdrant_service.QdrantService.get_neighborhood_prices",
        new=AsyncMock(return_value=([9000, 10000, 11000], "neighborhood_5km")),
    ):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/listings/sync",
                headers=AUTH_HEADERS,
                json=scam_payload,
            )
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "quarantined"
            assert data["listing_id"] == "prop_scam_quarantined_01"
            assert data["indexed"] is False
            assert data["risk_audit"]["is_flagged"] is True
            assert data["risk_audit"]["verdict"] == "FLAG_FOR_MANUAL_AUDIT"
            # Verify upsert was strictly avoided and delete was invoked for safety
            mock_upsert.assert_not_called()
            mock_delete.assert_called_once_with("prop_scam_quarantined_01")

