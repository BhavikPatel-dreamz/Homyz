import io
import pytest
from unittest.mock import AsyncMock, patch
from httpx import ASGITransport, AsyncClient
import numpy as np
from PIL import Image, ImageDraw

from main import app
from core.constants import API_KEY_HEADER_NAME, BLUR_LAPLACIAN_THRESHOLD
from models.photos import PhotoAIAnalysis, PhotoAnalysisRequest
from services.photo_service import PhotoService, _compute_local_image_metrics


def _create_synthetic_image(
    width: int = 500,
    height: int = 500,
    color: tuple[int, int, int] = (128, 128, 128),
    pattern: str = "solid",
) -> bytes:
    """Generates synthetic JPEG bytes for testing without external CDN dependencies."""
    img = Image.new("RGB", (width, height), color=color)
    draw = ImageDraw.Draw(img)

    if pattern == "sharp":
        # Draw high-contrast checkerboard to generate high Laplacian variance
        for x in range(0, width, 20):
            for y in range(0, height, 20):
                if (x + y) % 40 == 0:
                    draw.rectangle([x, y, x + 20, y + 20], fill=(255, 255, 255))
                else:
                    draw.rectangle([x, y, x + 20, y + 20], fill=(0, 0, 0))
    elif pattern == "sharp_lines":
        # High-contrast diagonal lines distinct in pHash from checkerboard
        for i in range(0, width, 15):
            draw.line([(i, 0), (width - i, height)], fill=(255, 255, 255), width=4)
            draw.line([(0, i), (width, height - i)], fill=(0, 0, 0), width=4)
    elif pattern == "blurry":
        # Completely uniform flat color has 0 variance (blurry)
        pass

    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_photo_analyze_unauthorized() -> None:
    """Rejects requests without valid X-API-Key."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/photos/analyze",
            json={"listing_id": "listing_123", "photos": ["https://test.com/photo1.jpg"]},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_photo_analyze_empty_photos_validation() -> None:
    """Rejects empty photos array with 422 Unprocessable Content."""
    transport = ASGITransport(app=app)
    headers = {API_KEY_HEADER_NAME: "dev-secret-internal-key-123"}
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/photos/analyze",
            json={"listing_id": "listing_123", "photos": []},
            headers=headers,
        )
        assert response.status_code == 422


def test_local_check_blur_detection() -> None:
    """Validates that high-contrast image is sharp and flat image is flagged blurry."""
    sharp_bytes = _create_synthetic_image(pattern="sharp")
    blurry_bytes = _create_synthetic_image(pattern="blurry")

    sharp_res = _compute_local_image_metrics("https://test.com/sharp.jpg", sharp_bytes)
    assert sharp_res.is_blurry is False
    assert sharp_res.laplacian_variance >= BLUR_LAPLACIAN_THRESHOLD

    blurry_res = _compute_local_image_metrics("https://test.com/blurry.jpg", blurry_bytes)
    assert blurry_res.is_blurry is True
    assert blurry_res.laplacian_variance < BLUR_LAPLACIAN_THRESHOLD
    assert any("blurry" in tip.lower() for tip in blurry_res.feedback_tips)


def test_local_check_pitch_black_and_underexposed() -> None:
    """Validates that pitch black images are flagged and skip-eligible."""
    black_bytes = _create_synthetic_image(color=(0, 0, 0), pattern="blurry")
    res = _compute_local_image_metrics("https://test.com/black.jpg", black_bytes)

    assert res.is_pitch_black is True
    assert res.mean_brightness < 15.0
    assert any("pitch black" in tip.lower() for tip in res.feedback_tips)


@pytest.mark.asyncio
async def test_duplicate_photo_short_circuits_llm() -> None:
    """Validates that near-identical duplicate photos skip LLM and get duplicate flags."""
    service = PhotoService()
    img_bytes = _create_synthetic_image(pattern="sharp")

    # Mock downloads to return identical images for photo1 and photo2
    mock_downloads = [
        ("https://test.com/photo1.jpg", img_bytes, None),
        ("https://test.com/photo2.jpg", img_bytes, None),
    ]

    mock_ai_output = PhotoAIAnalysis(
        room_type="Living Room",
        is_relevant_property_photo=True,
        lighting_score=8,
        composition_score=8,
        feedback_tips=["Open window blinds to capture natural daylight."],
    )

    with patch.object(service, "_download_single_image", side_effect=lambda c, u, s: (
        ("https://test.com/photo1.jpg", img_bytes, None) if "photo1" in u
        else ("https://test.com/photo2.jpg", img_bytes, None)
    )), patch.object(service, "_evaluate_vision", return_value=mock_ai_output) as mock_eval:
        response = await service.analyze_photos(
            PhotoAnalysisRequest(
                listing_id="prop_001",
                photos=["https://test.com/photo1.jpg", "https://test.com/photo2.jpg"],
            )
        )

        assert response.processed_count == 2
        p1 = response.photos[0]
        p2 = response.photos[1]

        # Photo 1 passed and called LLM
        assert p1.flags.is_duplicate is False
        assert p1.room_type == "Living Room"

        # Photo 2 was caught locally as duplicate of photo 1
        assert p2.flags.is_duplicate is True
        assert p2.flags.duplicate_of == "https://test.com/photo1.jpg"
        assert p2.room_type is None
        assert p2.scores is None
        assert any("duplicate" in tip.lower() for tip in p2.feedback_tips)

        # Vision LLM was called only once (for photo 1), saving $0 on photo 2
        assert mock_eval.call_count == 1


@pytest.mark.asyncio
async def test_anti_bathroom_smart_cover_hierarchy() -> None:
    """Validates that a Living Room is selected as cover over a higher-scoring Bathroom."""
    service = PhotoService()
    bathroom_bytes = _create_synthetic_image(pattern="sharp")
    living_room_bytes = _create_synthetic_image(pattern="sharp_lines")

    photos_input = [
        "https://test.com/bathroom.jpg",
        "https://test.com/living_room.jpg",
    ]

    with patch.object(service, "_download_single_image", side_effect=lambda c, u, s: (
        (u, bathroom_bytes, None) if "bathroom" in u else (u, living_room_bytes, None)
    )):
        with patch.object(service, "_evaluate_vision") as mock_vision:
            # First photo evaluates to Bathroom 9.5 aesthetic, second to Living Room 8.0 aesthetic
            mock_vision.side_effect = [
                PhotoAIAnalysis(
                    room_type="Bathroom",
                    is_relevant_property_photo=True,
                    lighting_score=10,
                    composition_score=9,
                    feedback_tips=[],
                ),
                PhotoAIAnalysis(
                    room_type="Living Room",
                    is_relevant_property_photo=True,
                    lighting_score=8,
                    composition_score=8,
                    feedback_tips=[],
                ),
            ]

            response = await service.analyze_photos(
                PhotoAnalysisRequest(listing_id="prop_123", photos=photos_input)
            )

            # Living Room must be chosen as cover photo despite lower score, because of anti-bathroom rule
            assert response.recommended_cover_photo == "https://test.com/living_room.jpg"
            assert response.photos[1].is_recommended_cover is True
            assert response.photos[0].is_recommended_cover is False


@pytest.mark.asyncio
async def test_non_property_document_detection() -> None:
    """Validates that non-property photos (newspapers, documents, memes) are flagged and disqualified."""
    service = PhotoService()
    img_bytes = _create_synthetic_image(pattern="sharp")

    mock_doc_analysis = PhotoAIAnalysis(
        room_type="Other",
        is_relevant_property_photo=False,  # Newspaper / document detected by Vision
        lighting_score=5,
        composition_score=4,
        feedback_tips=[],
    )

    with patch.object(service, "_download_single_image", side_effect=lambda c, u, s: (u, img_bytes, None)):
        with patch.object(service, "_evaluate_vision", return_value=mock_doc_analysis):
            response = await service.analyze_photos(
                PhotoAnalysisRequest(listing_id="prop_doc", photos=["https://test.com/newspaper.jpg"])
            )

            result = response.photos[0]
            assert result.flags.is_non_property is True
            assert result.flags.poor_quality is True
            assert result.room_type is None
            assert result.scores is None
            assert result.is_recommended_cover is False
            assert response.recommended_cover_photo is None
            assert "Other" not in response.room_assignments
            assert any("accommodation" in tip.lower() for tip in result.feedback_tips)


@pytest.mark.asyncio
async def test_end_to_end_photo_analyze_endpoint() -> None:
    """Full HTTP integration test through FastAPI route."""
    transport = ASGITransport(app=app)
    headers = {API_KEY_HEADER_NAME: "dev-secret-internal-key-123"}
    img_bytes = _create_synthetic_image(pattern="sharp")

    mock_analysis = PhotoAIAnalysis(
        room_type="Bedroom",
        is_relevant_property_photo=True,
        lighting_score=9,
        composition_score=9,
        feedback_tips=["Open window blinds to capture natural daylight."],
    )

    with patch("services.photo_service.PhotoService._download_single_image", side_effect=lambda c, u, s: (u, img_bytes, None)), \
         patch("services.photo_service.PhotoService._evaluate_vision", return_value=mock_analysis):
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.post(
                "/api/v1/photos/analyze",
                json={
                    "listing_id": "listing_real_test",
                    "photos": ["https://storage.homyz.com/photo1.jpg"],
                },
                headers=headers,
            )

            assert response.status_code == 200
            data = response.json()
            assert data["listing_id"] == "listing_real_test"
            assert data["processed_count"] == 1
            assert data["recommended_cover_photo"] == "https://storage.homyz.com/photo1.jpg"
            assert "Bedroom" in data["room_assignments"]
            assert data["photos"][0]["room_type"] == "Bedroom"
            assert data["photos"][0]["scores"]["lighting"] == 9
            assert data["photos"][0]["flags"]["is_blurry"] is False
            assert "Open window blinds to capture natural daylight." in data["photos"][0]["feedback_tips"]


def test_local_check_low_resolution_warning() -> None:
    """Validates that images with dimensions below 400x400 receive resolution feedback tips."""
    small_bytes = _create_synthetic_image(width=250, height=250, pattern="sharp")
    res = _compute_local_image_metrics("https://test.com/small.jpg", small_bytes)
    assert any("400x400" in tip for tip in res.feedback_tips)


@pytest.mark.asyncio
async def test_download_failure_isolation() -> None:
    """Validates that a 404 or CDN timeout on one photo does not fail the whole batch."""
    service = PhotoService()
    img_bytes = _create_synthetic_image(pattern="sharp")

    mock_analysis = PhotoAIAnalysis(
        room_type="Kitchen",
        is_relevant_property_photo=True,
        lighting_score=8,
        composition_score=8,
        feedback_tips=[],
    )

    with patch.object(service, "_download_single_image", side_effect=lambda c, u, s: (
        (u, None, "HTTP 404 Not Found") if "bad" in u else (u, img_bytes, None)
    )), patch.object(service, "_evaluate_vision", return_value=mock_analysis):
        response = await service.analyze_photos(
            PhotoAnalysisRequest(
                listing_id="prop_404_test",
                photos=["https://test.com/bad.jpg", "https://test.com/good.jpg"],
            )
        )

        assert response.processed_count == 2
        bad_p = response.photos[0]
        good_p = response.photos[1]

        assert bad_p.flags.poor_quality is True
        assert bad_p.room_type is None
        assert bad_p.scores is None
        assert any("404" in tip for tip in bad_p.feedback_tips)
        assert good_p.room_type == "Kitchen"
        assert good_p.scores is not None
        assert response.recommended_cover_photo == "https://test.com/good.jpg"


@pytest.mark.asyncio
async def test_no_cover_photo_when_all_fail_quality() -> None:
    """Validates that recommended_cover_photo is None when all photos fail quality standards (cover photo is not mandatory)."""
    service = PhotoService()

    # Create two distinct blurry images (low variance < 1.0, but distinct pHash distance > 30)
    img1 = Image.new("RGB", (500, 500), (120, 120, 120))
    ImageDraw.Draw(img1).rectangle([50, 50, 200, 200], fill=(125, 125, 125))
    buf1 = io.BytesIO()
    img1.save(buf1, format="JPEG")
    blurry_bytes_1 = buf1.getvalue()

    img2 = Image.new("RGB", (500, 500), (120, 120, 120))
    ImageDraw.Draw(img2).ellipse([300, 300, 450, 450], fill=(125, 125, 125))
    buf2 = io.BytesIO()
    img2.save(buf2, format="JPEG")
    blurry_bytes_2 = buf2.getvalue()

    mock_analysis_1 = PhotoAIAnalysis(
        room_type="Bedroom",
        is_relevant_property_photo=True,
        lighting_score=4,
        composition_score=4,
        feedback_tips=[],
    )
    mock_analysis_2 = PhotoAIAnalysis(
        room_type="Living Room",
        is_relevant_property_photo=True,
        lighting_score=5,
        composition_score=5,
        feedback_tips=[],
    )

    with patch.object(service, "_download_single_image", side_effect=lambda c, u, s: (
        (u, blurry_bytes_1, None) if "p1" in u else (u, blurry_bytes_2, None)
    )), patch.object(service, "_evaluate_vision", side_effect=[mock_analysis_1, mock_analysis_2]):
        response = await service.analyze_photos(
            PhotoAnalysisRequest(
                listing_id="prop_all_fail",
                photos=["https://test.com/p1.jpg", "https://test.com/p2.jpg"],
            )
        )

        # Both photos are blurry and poor quality; cover photo is not mandatory, so it is None
        assert response.recommended_cover_photo is None
        assert all(p.is_recommended_cover is False for p in response.photos)


@pytest.mark.asyncio
async def test_pitch_black_alone_returns_none_cover() -> None:
    """Validates that a single pitch-black photo is rejected from being cover photo."""
    service = PhotoService()
    black_bytes = _create_synthetic_image(color=(0, 0, 0), pattern="blurry")

    with patch.object(service, "_download_single_image", return_value=("https://test.com/black.jpg", black_bytes, None)):
        response = await service.analyze_photos(
            PhotoAnalysisRequest(listing_id="prop_black", photos=["https://test.com/black.jpg"])
        )
        assert response.recommended_cover_photo is None
        assert response.photos[0].is_recommended_cover is False
        assert response.photos[0].room_type is None
        assert response.photos[0].scores is None


@pytest.mark.asyncio
async def test_corrupt_alone_returns_none_cover() -> None:
    """Validates that a corrupt or 404 image URL is rejected from being cover photo."""
    service = PhotoService()

    with patch.object(service, "_download_single_image", return_value=("https://test.com/404.jpg", None, "HTTP 404")):
        response = await service.analyze_photos(
            PhotoAnalysisRequest(listing_id="prop_corrupt", photos=["https://test.com/404.jpg"])
        )
        assert response.recommended_cover_photo is None
        assert response.photos[0].is_recommended_cover is False
        assert response.photos[0].flags.is_non_property is True
        assert response.photos[0].room_type is None
        assert response.photos[0].scores is None


@pytest.mark.asyncio
async def test_bathroom_and_non_property_yield_none_cover() -> None:
    """Validates that when only bathroom and non-property photos exist, no cover photo is forced."""
    service = PhotoService()
    img_bytes_1 = _create_synthetic_image(pattern="sharp")
    img_bytes_2 = _create_synthetic_image(pattern="sharp_lines")

    mock_bathroom = PhotoAIAnalysis(
        room_type="Bathroom",
        is_relevant_property_photo=True,
        lighting_score=8,
        composition_score=8,
        feedback_tips=[],
    )
    mock_teddy = PhotoAIAnalysis(
        room_type="Other",
        is_relevant_property_photo=False,
        lighting_score=4,
        composition_score=4,
        feedback_tips=[],
    )

    with patch.object(service, "_download_single_image", side_effect=lambda c, u, s: (
        (u, img_bytes_1, None) if "bathroom" in u else (u, img_bytes_2, None)
    )), patch.object(service, "_evaluate_vision", side_effect=[mock_bathroom, mock_teddy]):
        response = await service.analyze_photos(
            PhotoAnalysisRequest(
                listing_id="prop_mix",
                photos=["https://test.com/bathroom.jpg", "https://test.com/teddy.jpg"],
            )
        )
        # Neither bathroom nor teddy bear qualifies as cover photo
        assert response.recommended_cover_photo is None
        assert response.photos[0].is_recommended_cover is False
        assert response.photos[1].is_recommended_cover is False
        assert response.photos[1].room_type is None
        assert response.photos[1].scores is None
        assert "Other" not in response.room_assignments


@pytest.mark.asyncio
async def test_bedroom_chosen_over_bathroom_for_cover() -> None:
    """Validates that a legitimate bedroom photo is preferred over a bathroom photo for cover."""
    service = PhotoService()
    img_bytes_1 = _create_synthetic_image(pattern="sharp")
    img_bytes_2 = _create_synthetic_image(pattern="sharp_lines")

    mock_bathroom = PhotoAIAnalysis(
        room_type="Bathroom",
        is_relevant_property_photo=True,
        lighting_score=8,
        composition_score=8,
        feedback_tips=[],
    )
    mock_bedroom = PhotoAIAnalysis(
        room_type="Bedroom",
        is_relevant_property_photo=True,
        lighting_score=8,
        composition_score=8,
        feedback_tips=[],
    )

    with patch.object(service, "_download_single_image", side_effect=lambda c, u, s: (
        (u, img_bytes_1, None) if "bathroom" in u else (u, img_bytes_2, None)
    )), patch.object(service, "_evaluate_vision", side_effect=[mock_bathroom, mock_bedroom]):
        response = await service.analyze_photos(
            PhotoAnalysisRequest(
                listing_id="prop_bed_bath",
                photos=["https://test.com/bathroom.jpg", "https://test.com/bedroom.jpg"],
            )
        )
        assert response.recommended_cover_photo == "https://test.com/bedroom.jpg"
        assert response.photos[0].is_recommended_cover is False
        assert response.photos[1].is_recommended_cover is True


def test_extreme_aspect_ratio_warning() -> None:
    """Validates warning tip generated for extreme panoramic or vertical strips."""
    panoramic_bytes = _create_synthetic_image(width=1200, height=400, pattern="sharp")
    res = _compute_local_image_metrics("https://test.com/pano.jpg", panoramic_bytes)
    assert any("Extreme aspect ratio" in tip for tip in res.feedback_tips)

