from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.v1.router import api_v1_router
from core.config import get_settings
from core.constants import API_V1_PREFIX
from core.exceptions import (
    AIProviderError,
    AppException,
    AuthenticationError,
    BadRequestError,
    InternalServerError,
    NotFoundError,
)
from services.qdrant_service import get_qdrant_service
from utils.logger import get_logger, setup_logging

settings = get_settings()

# 1. Initialize logging at module import
setup_logging(settings.LOG_LEVEL)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Manages application startup and shutdown lifecycle events."""
    # 2. Re-verify and ensure worker processes inherit logging configuration
    setup_logging(settings.LOG_LEVEL)
    logger.info(
        "Starting %s [env=%s, log_level=%s]",
        settings.PROJECT_NAME,
        settings.ENVIRONMENT,
        settings.LOG_LEVEL,
    )
    yield
    # Shutdown: clean up connections
    logger.info("Shutting down %s...", settings.PROJECT_NAME)
    qdrant_service = get_qdrant_service()
    await qdrant_service.close()


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="High-performance microservice providing AI intelligence for the Homyz accommodation marketplace.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Internal service, allow callers or configure via env
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Global Exception Handlers
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Interceptors domain exceptions and returns structured JSON responses."""
    logger.warning("Domain exception [%s]: %s", exc.code, exc.detail)
    status_code = status.HTTP_400_BAD_REQUEST
    if isinstance(exc, AuthenticationError):
        status_code = status.HTTP_401_UNAUTHORIZED
    elif isinstance(exc, NotFoundError):
        status_code = status.HTTP_404_NOT_FOUND
    elif isinstance(exc, AIProviderError):
        status_code = status.HTTP_502_BAD_GATEWAY
    elif isinstance(exc, InternalServerError):
        status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    elif isinstance(exc, BadRequestError):
        status_code = status.HTTP_400_BAD_REQUEST

    return JSONResponse(
        status_code=status_code,
        content={"code": exc.code, "detail": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Formats Pydantic validation errors to match standard error schema."""
    error_messages = [
        f"{'.'.join(str(loc) for loc in err['loc'])}: {err['msg']}"
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY if not hasattr(status, "HTTP_422_UNPROCESSABLE_CONTENT") else status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "code": "UNPROCESSABLE_ENTITY",
            "detail": "; ".join(error_messages),
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catches unhandled exceptions and returns a generic 500 error."""
    logger.error("Unhandled server exception: %s", exc, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "code": "INTERNAL_SERVER_ERROR",
            "detail": "An unexpected error occurred.",
        },
    )


# Health Check Endpoint
@app.get("/healthz", tags=["System"])
async def health_check() -> dict[str, str]:
    """Verifies service health and Qdrant vector database connectivity."""
    qdrant_service = get_qdrant_service()
    qdrant_info = await qdrant_service.check_connection()

    service_status = "healthy" if qdrant_info["status"] == "connected" else "degraded"
    return {
        "status": service_status,
        "qdrant": qdrant_info["status"],
        "mode": qdrant_info["mode"],
    }


# Include Versioned API Routes
app.include_router(api_v1_router, prefix=API_V1_PREFIX)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.PORT,
        reload=settings.DEBUG,
    )

