from fastapi import Depends, Security
from fastapi.security import APIKeyHeader
from core.config import Settings, get_settings
from core.constants import API_KEY_HEADER_NAME
from core.exceptions import AuthenticationError

api_key_header = APIKeyHeader(name=API_KEY_HEADER_NAME, auto_error=False)


async def verify_api_key(
    api_key: str | None = Security(api_key_header),
    settings: Settings = Depends(get_settings),
) -> str:
    """Verifies that the incoming request contains a valid internal X-API-Key header."""
    if not api_key or api_key != settings.API_KEY_SECRET:
        raise AuthenticationError(detail="Invalid or missing API key")
    return api_key
