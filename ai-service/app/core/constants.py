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

# Review Analysis & Moderation Constants
MAX_REVIEWS_PER_BATCH: Final[int] = 50
MAX_REVIEW_COMMENT_LENGTH: Final[int] = 1000
MAX_BATCH_TOTAL_CHARACTERS: Final[int] = 30_000

# Deterministic Safety & Policy Regex Patterns
REGEX_PHONE_NUMBER: Final[str] = (
    r"(?:(?:\+|00)\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b"
)
REGEX_CONTACT_KEYWORDS: Final[str] = (
    r"\b(?:whatsapp|wa\.me|t\.me|telegram|viber|signal|cashapp|venmo|zelle|paypal|wechat)\b"
)
REGEX_SOCIAL_HANDLES: Final[str] = (
    r"(?:instagram|insta|snapchat|snap|tiktok|facebook)\s*[:@-]?\s*@?[\w.-]{3,30}\b"
)
REGEX_EMAIL: Final[str] = (
    r"\b[A-Za-z0-9._%+-]+(?:\s*@\s*|\s*\[at\]\s*|\s*\(at\)\s*)[A-Za-z0-9.-]+(?:\s*\.\s*|\s*\[dot\]\s*|\s*\(dot\)\s*)[A-Za-z]{2,}\b"
)
REGEX_DOOR_CODE: Final[str] = (
    r"\b(?:(?:door|gate|lockbox|keypad|alarm|entry|lock)\s+(?:code|pin|combination|password|key)|"
    r"(?:code|pin|combination|password)\s+(?:for|to)\s+(?:the\s+)?(?:door|gate|lockbox|keypad|entry|lock|house|flat|apartment))\s*(?:is|was|:|=)?\s*\d{3,8}\b"
)

# Fraud / Risk Detection
PRICE_ANOMALY_PERCENTAGE_THRESHOLD: Final[float] = 0.50  # 50% below median
NEIGHBORHOOD_RADIUS_KM: Final[float] = 5.0
