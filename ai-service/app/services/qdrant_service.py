from typing import Optional
from qdrant_client import AsyncQdrantClient
from core.config import Settings, get_settings


class QdrantService:
    """Manages communication with Qdrant vector database (Cloud or Local)."""

    def __init__(self, settings: Optional[Settings] = None) -> None:
        self.settings = settings or get_settings()
        self.client = AsyncQdrantClient(
            url=self.settings.QDRANT_URL,
            api_key=self.settings.QDRANT_API_KEY or None,
            timeout=5.0,
        )

    async def check_connection(self) -> dict[str, str]:
        """Pings Qdrant to verify database connectivity and instance mode."""
        is_cloud = "cloud.qdrant.io" in self.settings.QDRANT_URL.lower()
        mode = "cloud" if is_cloud else "local"

        try:
            await self.client.get_collections()
            return {
                "status": "connected",
                "mode": mode,
            }
        except Exception as exc:
            return {
                "status": "disconnected",
                "mode": mode,
                "error": str(exc),
            }

    async def close(self) -> None:
        """Closes the underlying client connection."""
        await self.client.close()


_qdrant_service_instance: Optional[QdrantService] = None


def get_qdrant_service() -> QdrantService:
    """Dependency provider for QdrantService singleton."""
    global _qdrant_service_instance
    if _qdrant_service_instance is None:
        _qdrant_service_instance = QdrantService()
    return _qdrant_service_instance
