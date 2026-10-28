from typing import Final

# API Constants
API_V1_PREFIX: Final[str] = "/api/v1"
API_KEY_HEADER_NAME: Final[str] = "X-API-Key"

# Search Constants
DEFAULT_PAGE_SIZE: Final[int] = 20
MAX_PAGE_SIZE: Final[int] = 100
DEFAULT_RADIUS_KM: Final[float] = 15.0

# Photo Analysis Constants
VALID_ROOM_TYPES: Final[tuple[str, ...]] = (
    "Living Room",
    "Bedroom",
    "Bathroom",
    "Kitchen",
    "Balcony/Patio",
    "Dining Room",
    "Exterior/Entrance",
    "Amenities/Pool",
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
