import asyncio
import base64
import io
import unicodedata
from dataclasses import dataclass, field
from typing import Any, Optional

import cv2
import httpx
import imagehash
import numpy as np
from PIL import Image

from core.config import Settings, get_settings
from core.constants import (
    BLUR_LAPLACIAN_THRESHOLD,
    BRIGHTNESS_MAX,
    BRIGHTNESS_MIN,
    BRIGHTNESS_PITCH_BLACK,
    DUPLICATE_HAMMING_THRESHOLD,
    MAX_IMAGE_FILE_SIZE_BYTES,
    MIN_IMAGE_DIMENSION,
    PHOTO_CONCURRENCY_LIMIT,
    PHOTO_DOWNLOAD_TIMEOUT_SECONDS,
    VALID_ROOM_TYPES,
)
from core.exceptions import AIProviderError, BadRequestError
from models.photos import (
    PhotoAIAnalysis,
    PhotoAnalysisRequest,
    PhotoAnalysisResponse,
    PhotoFlags,
    PhotoItemResult,
    PhotoScores,
)
from utils.logger import get_logger

logger = get_logger(__name__)

# Security guard against decompression bombs (max 50 megapixels)
Image.MAX_IMAGE_PIXELS = 50_000_000


@dataclass
class LocalCheckResult:
    """Internal container for local deterministic pre-check findings."""

    url: str
    is_valid: bool = True
    error_message: Optional[str] = None
    image_bytes: Optional[bytes] = None
    phash: Optional[imagehash.ImageHash] = None
    width: int = 0
    height: int = 0
    laplacian_variance: float = 0.0
    mean_brightness: float = 0.0
    is_blurry: bool = False
    is_pitch_black: bool = False
    is_too_dark: bool = False
    is_overexposed: bool = False
    is_duplicate: bool = False
    duplicate_of: Optional[str] = None
    feedback_tips: list[str] = field(default_factory=list)


def _compute_local_image_metrics(url: str, raw_bytes: bytes) -> LocalCheckResult:
    """Synchronous CPU-bound image decoding, blur analysis, and brightness checks.

    Executed in a worker thread via asyncio.to_thread() to avoid blocking the event loop.
    """
    result = LocalCheckResult(url=url, image_bytes=raw_bytes)

    # 1. Decode image via Pillow
    try:
        with Image.open(io.BytesIO(raw_bytes)) as pil_img:
            # Force decode to catch corrupted image streams early
            pil_img.verify()
        # Re-open after verify (verify closes / invalidates underlying stream)
        with Image.open(io.BytesIO(raw_bytes)) as pil_img:
            pil_img_rgb = pil_img.convert("RGB")
            result.width, result.height = pil_img_rgb.size
            result.phash = imagehash.phash(pil_img_rgb)

            # Convert to grayscale numpy matrix for OpenCV
            gray_matrix = np.array(pil_img_rgb.convert("L"), dtype=np.uint8)
    except Exception as exc:
        logger.warning("Failed to decode image from URL %s: %s", url, exc)
        result.is_valid = False
        result.error_message = f"Invalid or unreadable image file: {exc}"
        result.feedback_tips.append("Invalid or unreadable image file. Please re-upload in standard JPG or PNG format.")
        return result

    # 2. Minimum dimension validation
    if result.width < MIN_IMAGE_DIMENSION or result.height < MIN_IMAGE_DIMENSION:
        result.feedback_tips.append(
            f"Image resolution ({result.width}x{result.height}) is below {MIN_IMAGE_DIMENSION}x{MIN_IMAGE_DIMENSION}. "
            "Upload higher resolution photos for crisp display."
        )

    # 3. Brightness & Exposure check
    result.mean_brightness = float(np.mean(gray_matrix))
    if result.mean_brightness < BRIGHTNESS_PITCH_BLACK:
        result.is_pitch_black = True
        result.feedback_tips.append(
            "Photo is pitch black or severely underexposed. Ensure room lights are on or photograph during daytime."
        )
    elif result.mean_brightness < BRIGHTNESS_MIN:
        result.is_too_dark = True
        result.feedback_tips.append("Lighting is dim. Consider retaking with natural daylight or turning on all room lights.")
    elif result.mean_brightness > BRIGHTNESS_MAX:
        result.is_overexposed = True
        result.feedback_tips.append("Image is overexposed or washed out by harsh flash.")

    # 4. Blur check via Laplacian variance
    try:
        result.laplacian_variance = float(cv2.Laplacian(gray_matrix, cv2.CV_64F).var())
        if result.laplacian_variance < BLUR_LAPLACIAN_THRESHOLD:
            result.is_blurry = True
            result.feedback_tips.append("Image appears blurry or out of focus. Consider retaking with a steady camera.")
    except Exception as exc:
        logger.warning("Laplacian blur calculation failed for %s: %s", url, exc)
        result.is_blurry = False

    return result


class PhotoService:
    """Manages photo downloading, local quality pre-checks, Gemini Vision AI scoring, and cover photo selection."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self._vision_client: Any = None

    @property
    def vision_client(self) -> Any:
        """Lazily initializes the multimodal Gemini Vision chain with JsonOutputParser."""
        if self._vision_client is None:
            if not self.settings.GOOGLE_API_KEY:
                raise AIProviderError("GOOGLE_API_KEY is not configured")
            try:
                from langchain_google_genai import ChatGoogleGenerativeAI
                from langchain_core.output_parsers import JsonOutputParser

                llm = ChatGoogleGenerativeAI(
                    model=self.settings.GEMINI_MODEL,
                    google_api_key=self.settings.GOOGLE_API_KEY,
                    temperature=0.2,
                )
                parser = JsonOutputParser(pydantic_object=PhotoAIAnalysis)
                self._vision_client = llm | parser
            except ImportError as exc:
                raise AIProviderError(
                    "langchain-google-genai is not installed. Please run `pip install langchain-google-genai`."
                ) from exc
        return self._vision_client

    async def _download_single_image(
        self,
        client: httpx.AsyncClient,
        url: str,
        semaphore: asyncio.Semaphore,
    ) -> tuple[str, Optional[bytes], Optional[str]]:
        """Downloads an image URL with byte size limit and timeout under concurrency semaphore."""
        async with semaphore:
            try:
                response = await client.get(url, follow_redirects=True)
                if response.status_code != 200:
                    return url, None, f"HTTP {response.status_code} while fetching photo"

                content = response.content
                if len(content) > MAX_IMAGE_FILE_SIZE_BYTES:
                    return url, None, f"Image file size ({len(content)} bytes) exceeds 15MB limit"

                return url, content, None
            except Exception as exc:
                logger.warning("Download failed for photo URL %s: %s", url, exc)
                return url, None, str(exc)

    async def _evaluate_vision(
        self,
        raw_bytes: bytes,
        semaphore: asyncio.Semaphore,
    ) -> PhotoAIAnalysis:
        """Evaluates an individual image using Gemini with structured JSON output."""
        async with semaphore:
            from langchain_core.messages import HumanMessage
            from langchain_core.output_parsers import JsonOutputParser

            parser = JsonOutputParser(pydantic_object=PhotoAIAnalysis)
            format_instructions = parser.get_format_instructions()

            b64_data = base64.b64encode(raw_bytes).decode("utf-8")
            prompt_text = (
                "You are an expert accommodation photographer and quality auditor for a luxury marketplace. "
                "Analyze this single accommodation photo carefully:\n"
                "1. room_type: Categorize the space ('Living Room', 'Bedroom', 'Bathroom', 'Kitchen', "
                "'Balcony/Patio', 'Dining Room', 'Exterior/Entrance', 'Amenities/Pool', or 'Other').\n"
                "2. is_relevant_property_photo: Mark true if it portrays an actual accommodation room, building, "
                "or amenity. Mark false if it portrays a document, newspaper, chat screenshot, meme, receipt, or selfie.\n"
                "3. lighting_score (1-10): Rate lighting balance.\n"
                "4. composition_score (1-10): Rate camera angle and staging.\n"
                "5. feedback_tips: Provide 1-2 brief, actionable tips for the host to improve this photo. "
                "Return an empty list if the photo is already clean and well-lit.\n\n"
                f"{format_instructions}"
            )

            message = HumanMessage(
                content=[
                    {"type": "text", "text": prompt_text},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64_data}"},
                    },
                ]
            )

            raw_result = await self.vision_client.ainvoke([message])
            if isinstance(raw_result, PhotoAIAnalysis):
                return raw_result
            return PhotoAIAnalysis(**raw_result)

    def _select_smart_cover_photo(self, photos: list[PhotoItemResult]) -> Optional[str]:
        """Chooses the single best primary cover photo based on aesthetic hierarchy and anti-bathroom rules.

        Hierarchy:
        1. Preferred: Non-blurry, distinct, non-bathroom, non-poor Living Room / Exterior >= 7.0
        2. Secondary: Bedroom / Amenities >= 7.0
        3. Tertiary: Any non-bathroom with highest aesthetic score
        4. Fallback: Single highest scoring photo in batch
        """
        if not photos:
            return None

        # Filter strictly qualified candidates
        qualified = [
            p
            for p in photos
            if not p.flags.is_blurry
            and not p.flags.is_duplicate
            and not p.flags.is_non_property
            and not p.flags.poor_quality
            and p.room_type != "Bathroom"
        ]

        # Tier 1: Living Room or Exterior with aesthetic >= 7.0
        tier1 = [p for p in qualified if p.room_type in ("Living Room", "Exterior/Entrance") and p.scores.overall_aesthetic >= 7.0]
        if tier1:
            tier1.sort(key=lambda p: p.scores.overall_aesthetic, reverse=True)
            return tier1[0].url

        # Tier 2: Bedroom or Amenities with aesthetic >= 7.0
        tier2 = [p for p in qualified if p.room_type in ("Bedroom", "Amenities/Pool") and p.scores.overall_aesthetic >= 7.0]
        if tier2:
            tier2.sort(key=lambda p: p.scores.overall_aesthetic, reverse=True)
            return tier2[0].url

        # Tier 3: Any qualified non-bathroom photo with highest score
        if qualified:
            qualified.sort(key=lambda p: p.scores.overall_aesthetic, reverse=True)
            return qualified[0].url

        # Tier 4 Fallback: If all photos failed quality gates, find the best non-bathroom, non-property photo
        fallbacks = [p for p in photos if p.room_type != "Bathroom" and not p.flags.is_non_property and not p.flags.is_duplicate]
        if fallbacks:
            fallbacks.sort(key=lambda p: p.scores.overall_aesthetic, reverse=True)
            return fallbacks[0].url

        # Ultimate fallback: Highest overall aesthetic in the whole batch
        sorted_all = sorted(photos, key=lambda p: p.scores.overall_aesthetic, reverse=True)
        return sorted_all[0].url

    async def analyze_photos(self, request: PhotoAnalysisRequest) -> PhotoAnalysisResponse:
        """Executes full analysis pipeline: download, local pre-checks, Gemini Vision AI, and smart cover selection."""
        # 1. Deduplicate URLs upfront while preserving order
        unique_urls = list(dict.fromkeys(url.strip() for url in request.photos if url and url.strip()))
        if not unique_urls:
            raise BadRequestError("No valid photo URLs provided in request")

        download_sem = asyncio.Semaphore(PHOTO_CONCURRENCY_LIMIT)
        vision_sem = asyncio.Semaphore(PHOTO_CONCURRENCY_LIMIT)

        # 2. Concurrently download all images
        async with httpx.AsyncClient(timeout=PHOTO_DOWNLOAD_TIMEOUT_SECONDS) as http_client:
            download_tasks = [
                self._download_single_image(http_client, url, download_sem)
                for url in unique_urls
            ]
            download_results = await asyncio.gather(*download_tasks)

        # 3. Execute local pre-checks in worker threads
        local_tasks = []
        for url, raw_bytes, error_msg in download_results:
            if raw_bytes is None:
                # Immediate failed result
                failed_res = LocalCheckResult(
                    url=url,
                    is_valid=False,
                    error_message=error_msg or "Failed to download image",
                    feedback_tips=[f"Failed to access image URL: {error_msg}"],
                )
                local_tasks.append(asyncio.sleep(0, result=failed_res))
            else:
                local_tasks.append(asyncio.to_thread(_compute_local_image_metrics, url, raw_bytes))

        local_results: list[LocalCheckResult] = await asyncio.gather(*local_tasks)

        # 4. Detect duplicates across the batch using perceptual hash Hamming distance
        for i, current in enumerate(local_results):
            if not current.is_valid or current.phash is None:
                continue
            for previous in local_results[:i]:
                if not previous.is_valid or previous.phash is None or previous.is_duplicate:
                    continue
                try:
                    hamming_dist = abs(current.phash - previous.phash)
                    if hamming_dist <= DUPLICATE_HAMMING_THRESHOLD:
                        current.is_duplicate = True
                        current.duplicate_of = previous.url
                        current.feedback_tips.append("Duplicate photo detected. Keep only your best angle.")
                        break
                except Exception as exc:
                    logger.debug("pHash distance comparison failed: %s", exc)

        # 5. Vision AI Gate & Individual Evaluation
        photo_item_tasks = []
        for local in local_results:
            if not local.is_valid:
                # Corrupt or download failure: short-circuit LLM
                item = PhotoItemResult(
                    url=local.url,
                    room_type="Other",
                    is_recommended_cover=False,
                    scores=PhotoScores(lighting=1, composition=1, overall_aesthetic=1.0),
                    flags=PhotoFlags(poor_quality=True),
                    feedback_tips=local.feedback_tips,
                )
                photo_item_tasks.append(asyncio.sleep(0, result=item))
            elif local.is_duplicate:
                # Near-duplicate: short-circuit LLM ($0 AI Cost)
                item = PhotoItemResult(
                    url=local.url,
                    room_type="Other",
                    is_recommended_cover=False,
                    scores=PhotoScores(lighting=1, composition=1, overall_aesthetic=1.0),
                    flags=PhotoFlags(
                        is_blurry=local.is_blurry,
                        is_duplicate=True,
                        duplicate_of=local.duplicate_of,
                        poor_quality=True,
                    ),
                    feedback_tips=local.feedback_tips,
                )
                photo_item_tasks.append(asyncio.sleep(0, result=item))
            elif local.is_pitch_black:
                # Pitch black: short-circuit LLM ($0 AI Cost)
                item = PhotoItemResult(
                    url=local.url,
                    room_type="Other",
                    is_recommended_cover=False,
                    scores=PhotoScores(lighting=1, composition=1, overall_aesthetic=1.0),
                    flags=PhotoFlags(
                        is_blurry=local.is_blurry,
                        poor_quality=True,
                    ),
                    feedback_tips=local.feedback_tips,
                )
                photo_item_tasks.append(asyncio.sleep(0, result=item))
            else:
                # Eligible for multimodal vision analysis
                photo_item_tasks.append(self._process_eligible_photo(local, vision_sem))

        photo_results: list[PhotoItemResult] = await asyncio.gather(*photo_item_tasks)

        # 6. Select recommended smart cover photo
        best_cover_url = self._select_smart_cover_photo(photo_results)
        if best_cover_url:
            for p in photo_results:
                if p.url == best_cover_url:
                    p.is_recommended_cover = True
                    break

        # 7. Group room assignments
        room_assignments: dict[str, list[str]] = {}
        for p in photo_results:
            category = p.room_type if p.room_type in VALID_ROOM_TYPES else "Other"
            room_assignments.setdefault(category, []).append(p.url)

        return PhotoAnalysisResponse(
            listing_id=request.listing_id,
            processed_count=len(photo_results),
            recommended_cover_photo=best_cover_url,
            room_assignments=room_assignments,
            photos=photo_results,
        )

    async def _process_eligible_photo(
        self,
        local: LocalCheckResult,
        semaphore: asyncio.Semaphore,
    ) -> PhotoItemResult:
        """Calls Gemini Vision for eligible photos, calculates aesthetic score, and handles non-property flags."""
        assert local.image_bytes is not None

        try:
            ai_output = await self._evaluate_vision(local.image_bytes, semaphore)
        except Exception as exc:
            logger.error("Vision AI evaluation failed for %s: %r", local.url, exc, exc_info=True)
            # Heuristic fallback if LLM is unavailable or times out
            fallback_lighting = 3 if local.is_too_dark else 7
            fallback_comp = 6
            return PhotoItemResult(
                url=local.url,
                room_type="Other",
                scores=PhotoScores(
                    lighting=fallback_lighting,
                    composition=fallback_comp,
                    overall_aesthetic=round((fallback_lighting + fallback_comp) / 2.0, 1),
                ),
                flags=PhotoFlags(
                    is_blurry=local.is_blurry,
                    poor_quality=local.is_blurry or local.is_too_dark,
                ),
                feedback_tips=local.feedback_tips,
            )

        # Sanitize room type against known categories
        room_type = ai_output.room_type.strip()
        if room_type not in VALID_ROOM_TYPES:
            # Fallback or normalize room type
            matched = next((r for r in VALID_ROOM_TYPES if r.lower() == room_type.lower()), "Other")
            room_type = matched

        # Non-property detection
        is_non_property = not ai_output.is_relevant_property_photo
        if is_non_property:
            room_type = "Other"

        # Calculate composite aesthetic score (1.0 to 10.0)
        base_aesthetic = (ai_output.lighting_score * 0.5) + (ai_output.composition_score * 0.5)
        if local.is_blurry:
            base_aesthetic -= 2.5
        if local.is_too_dark:
            base_aesthetic -= 1.5
        if local.is_overexposed:
            base_aesthetic -= 1.0

        clamped_aesthetic = max(1.0, min(10.0, round(base_aesthetic, 1)))

        # Determine overall poor quality flag
        poor_quality = (
            is_non_property
            or local.is_blurry
            or local.is_pitch_black
            or clamped_aesthetic < 5.0
            or (local.width < MIN_IMAGE_DIMENSION or local.height < MIN_IMAGE_DIMENSION)
        )

        # Merge local tips and AI tips cleanly (unique, preserved order)
        all_tips: list[str] = []
        for tip in local.feedback_tips:
            clean = tip.strip()
            if clean and clean not in all_tips:
                all_tips.append(clean)

        if is_non_property:
            doc_tip = "Please upload genuine accommodation photos showing the property, rooms, or amenities."
            if doc_tip not in all_tips:
                all_tips.insert(0, doc_tip)
        else:
            for tip in ai_output.feedback_tips:
                clean = tip.strip()
                if clean and clean not in all_tips:
                    all_tips.append(clean)

        return PhotoItemResult(
            url=local.url,
            room_type=room_type,
            is_recommended_cover=False,
            scores=PhotoScores(
                lighting=ai_output.lighting_score,
                composition=ai_output.composition_score,
                overall_aesthetic=clamped_aesthetic,
            ),
            flags=PhotoFlags(
                is_blurry=local.is_blurry,
                is_duplicate=False,
                duplicate_of=None,
                is_non_property=is_non_property,
                poor_quality=poor_quality,
            ),
            feedback_tips=all_tips,
        )


_photo_service_instance: Optional[PhotoService] = None


def get_photo_service() -> PhotoService:
    """Dependency provider for PhotoService singleton."""
    global _photo_service_instance
    if _photo_service_instance is None:
        _photo_service_instance = PhotoService()
    return _photo_service_instance
