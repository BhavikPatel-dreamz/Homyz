from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment variables."""

    # Application Settings
    PROJECT_NAME: str = "homyz-ai-engine"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"
    API_KEY_SECRET: str = "dev-secret-internal-key-123"

    # Vector DB (Qdrant Cloud or Local)
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION_LISTINGS: str = "listings"
    VECTOR_SIZE: int = 768

    # Google Gemini Settings & Models
    GOOGLE_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash"
    GEMINI_EMBEDDING_MODEL: str = "models/text-embedding-004"

    # Search Defaults
    DEFAULT_SEARCH_RADIUS_KM: float = 15.0

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    """Returns a cached instance of application settings."""
    return Settings()
