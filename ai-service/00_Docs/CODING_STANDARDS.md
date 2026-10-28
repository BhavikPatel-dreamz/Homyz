# Coding Standards & Architecture Patterns

This document defines the engineering standards, architecture patterns, and conventions for the `homyz-ai-backend` codebase. All code must strictly adhere to these guidelines.

---

## 1. Modular Architecture Principles

### 1.1 Single Responsibility Principle (SRP)
Every module, class, and function must have a single, clearly bounded responsibility:
* **Controllers (`app/api/v1/`)**: Pure HTTP layer. Responsible only for validating request bodies via Pydantic, delegating execution to the service layer, and returning the appropriate HTTP status code.
* **Service Layer (`app/services/`)**: The business logic and AI orchestration layer. All calls to Qdrant, OpenAI, OpenCV, and algorithms must reside here.
* **Data Models (`app/models/`)**: Pydantic V2 schemas defining inputs, query parameters, internal transfer objects, and response payloads.
* **Core Layer (`app/core/`)**: Cross-cutting infrastructure: environment configuration, custom exceptions, constants, and API key security.

### 1.2 Thin Route Handlers (Controller Rule)
Never write database queries, raw OpenAI calls, or business calculations inside route handler functions.
```python
# BAD: Logic inside route handler
@router.post("/search")
async def search(payload: SearchRequest):
    embeddings = openai.embeddings.create(...)
    results = qdrant.search(...)
    return results

# GOOD: Thin route handler delegating to service
@router.post("/search", response_model=SearchResponse)
async def search(
    payload: SearchRequest,
    search_service: SearchService = Depends(get_search_service)
) -> SearchResponse:
    return await search_service.execute_search(payload)
```

---

## 2. Python Coding & Typing Mandates

### 2.1 Strict Typing
Every function signature must include explicit Python type hints for all parameters and return types:
```python
# REQUIRED: Full typing
async def calculate_risk_score(
    listing_price: float,
    neighborhood_median: float,
    description_text: str
) -> tuple[int, list[str]]:
    ...
```

### 2.2 Naming Conventions
* **Files & Modules**: `snake_case.py` (e.g., `search_service.py`, `photo_analyzer.py`)
* **Classes**: `PascalCase` (e.g., `SearchService`, `ListingPayload`)
* **Functions & Methods**: `snake_case` (e.g., `analyze_photos()`, `sync_listing()`)
* **Constants & Enums**: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_SEARCH_RADIUS_KM = 15.0`)

---

## 3. Asynchronous Programming Guidelines
* All I/O-bound operations (Qdrant lookups, OpenAI HTTP requests, image downloading, file storage) must use `async` / `await`.
* CPU-bound operations (OpenCV blur detection, perceptual hashing on high-res images) should be run in a threadpool worker using `asyncio.to_thread()` to prevent blocking FastAPI's async event loop.
```python
import asyncio
import cv2

async def is_blurry_async(image_bytes: bytes) -> bool:
    # Run CPU-intensive image processing off the main event loop
    return await asyncio.to_thread(_compute_blur, image_bytes)
```

---

## 4. Error Handling & Unified Domain Exceptions

### 4.1 No Bare `except:`
Never catch raw exceptions blindly. Always catch specific exceptions or re-raise domain exceptions.

### 4.2 Unified Domain Exceptions (`app/core/exceptions.py`)
Services must never raise raw FastAPI `HTTPException`. Instead, raise domain exceptions derived from a base `AppException`:
```python
class AppException(Exception):
    def __init__(self, detail: str, code: str = "INTERNAL_ERROR"):
        self.detail = detail
        self.code = code
        super().__init__(detail)

class NotFoundError(AppException):
    def __init__(self, detail: str = "Resource not found"):
        super().__init__(detail=detail, code="NOT_FOUND")

class BadRequestError(AppException):
    def __init__(self, detail: str = "Bad request"):
        super().__init__(detail=detail, code="BAD_REQUEST")

class AIProviderError(AppException):
    def __init__(self, detail: str = "Upstream AI provider error"):
        super().__init__(detail=detail, code="AI_PROVIDER_ERROR")
```

### 4.3 Global Exception Mapping (`app/main.py`)
A global exception handler in `main.py` intercepts `AppException` and maps it to structured JSON without leaking internal stack traces:
```python
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    status_code = 400
    if isinstance(exc, NotFoundError):
        status_code = 404
    elif isinstance(exc, AIProviderError):
        status_code = 502

    return JSONResponse(
        status_code=status_code,
        content={"code": exc.code, "detail": exc.detail}
    )
```

---

## 5. Secrets & Configuration Rules
1. Manage all environment variables strictly inside `app/core/config.py` using Pydantic `BaseSettings`.
2. Never hardcode credentials, URLs, or API keys in code.
3. Keep `app/.example.env` continuously synchronized with all variables defined in `app/core/config.py`.
4. Never commit `app/.env` to version control.
