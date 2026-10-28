import unicodedata
from typing import Optional
from langchain_openai import OpenAIEmbeddings
from core.config import Settings, get_settings
from core.exceptions import AIProviderError
from utils.logger import get_logger

logger = get_logger(__name__)

# Maximum safe character length for text-embedding-3-small (8191 tokens ≈ 30k chars)
MAX_EMBEDDING_CHARS = 25000


class EmbeddingService:
    """Generates vector embeddings using OpenAI text-embedding-3-small."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self._embeddings: Optional[OpenAIEmbeddings] = None

    @property
    def client(self) -> OpenAIEmbeddings:
        """Lazily initializes and caches the OpenAI embeddings client."""
        if self._embeddings is None:
            if not self.settings.OPENAI_API_KEY:
                raise AIProviderError("OPENAI_API_KEY is not configured")
            self._embeddings = OpenAIEmbeddings(
                model=self.settings.OPENAI_EMBEDDING_MODEL,
                openai_api_key=self.settings.OPENAI_API_KEY,
            )
        return self._embeddings

    async def get_embedding(self, text: str) -> list[float]:
        """Asynchronously computes 1536-dimensional embedding vector for input text."""
        # 1. Unicode normalization (handles multilingual, Arabic ligatures/diacritics, and accents)
        clean_text = unicodedata.normalize("NFKC", text.strip())

        # 2. Safe length truncation to prevent context window overflow errors
        if len(clean_text) > MAX_EMBEDDING_CHARS:
            logger.warning(
                "Truncating embedding input from %d to %d characters",
                len(clean_text),
                MAX_EMBEDDING_CHARS,
            )
            clean_text = clean_text[:MAX_EMBEDDING_CHARS]

        try:
            return await self.client.aembed_query(clean_text)
        except AIProviderError:
            raise
        except Exception as exc:
            logger.error("Failed to generate embedding: %s", exc)
            raise AIProviderError(f"Embedding generation failed: {exc}") from exc


_embedding_service_instance: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """Dependency provider for EmbeddingService singleton."""
    global _embedding_service_instance
    if _embedding_service_instance is None:
        _embedding_service_instance = EmbeddingService()
    return _embedding_service_instance
