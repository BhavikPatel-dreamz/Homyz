from typing import Final

# API Constants
API_V1_PREFIX: Final[str] = "/api/v1"
API_KEY_HEADER_NAME: Final[str] = "X-API-Key"

# Search Constants
DEFAULT_PAGE_SIZE: Final[int] = 20
MAX_PAGE_SIZE: Final[int] = 100
DEFAULT_RADIUS_KM: Final[float] = 15.0

# Photo Analysis & Quality Constants
BLUR_LAPLACIAN_THRESHOLD: Final[float] = 100.0  # < 100.0 is blurry; >= 100.0 is sharp
BRIGHTNESS_PITCH_BLACK: Final[float] = 15.0  # < 15.0 is pitch black (short-circuits LLM)
BRIGHTNESS_MIN: Final[float] = 35.0  # < 35.0 is severely underexposed / dark
BRIGHTNESS_MAX: Final[float] = 220.0  # > 220.0 is severely overexposed / blown out
DUPLICATE_HAMMING_THRESHOLD: Final[int] = 5  # Hamming distance <= 5 flags duplicate (short-circuits LLM)
MIN_IMAGE_DIMENSION: Final[int] = 400  # Min acceptable width & height in px
MAX_IMAGE_FILE_SIZE_BYTES: Final[int] = 15 * 1024 * 1024  # 15 MB download limit
MAX_PHOTOS_PER_BATCH: Final[int] = 50  # Max photo URLs per analyze request
PHOTO_CONCURRENCY_LIMIT: Final[int] = 5  # Max parallel workers (asyncio.Semaphore)
PHOTO_DOWNLOAD_TIMEOUT_SECONDS: Final[float] = 8.0  # CDN download timeout

VALID_ROOM_TYPES: Final[tuple[str, ...]] = (
    "Living Room",
    "Bedroom",
    "Bathroom",
    "Kitchen",
    "Balcony/Patio",
    "Dining Room",
    "Exterior/Entrance",
    "Amenities/Pool",
    "Other",
)

# Aspect Rating Dimensions
ASPECT_DIMENSIONS: Final[tuple[str, ...]] = (
    "cleanliness",
    "accuracy",
    "check_in",
    "communication",
    "location",
    "value",
)

# Fraud / Risk Detection
PRICE_ANOMALY_PERCENTAGE_THRESHOLD: Final[float] = 0.50  # 50% below median
NEIGHBORHOOD_RADIUS_KM: Final[float] = 5.0
