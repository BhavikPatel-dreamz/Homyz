# Project Task Tracker: Homyz AI Engine

> **Instructions:** Mark tasks as completed (`[x]`) immediately upon finishing. Never jump ahead to future tasks without completing the current phase.

---

## Phase 0: Project Setup & Environment Scaffolding
- [x] Initialize application directory layout (`app/api/v1`, `app/core`, `app/services`, `app/models`, `app/utils`, `app/tests`)
- [x] Create `app/requirements.txt` with core dependencies (FastAPI, Uvicorn, LangChain, Qdrant Client, OpenCV, imagehash, Pydantic)
- [x] Create `app/.example.env` configured for Qdrant Cloud (Dev) and Local Qdrant (Deployment)
- [x] Setup `app/core/config.py` using Pydantic `BaseSettings`
- [x] Setup `app/core/security.py` for internal `X-API-Key` authentication
- [x] Setup unified domain exceptions and global handler in `app/core/exceptions.py`
- [x] Setup base `app/main.py` with CORS, security middleware, and `/healthz` endpoint
- [x] Verify Qdrant Cloud connection from the health check endpoint
- [ ] Provide `docker-compose.yml` for future local/self-hosted deployment (Skipped per user preference)

---

## Phase 1: Module 1 — Search & Ranking Engine
- [x] Define Pydantic request/response schemas for listing sync and search in `app/models/search.py`
- [x] Implement Qdrant collection setup (`listings`) with geo, price, and capacity payload indexes in `app/services/qdrant_service.py`
- [x] Implement listing sync service (`sync_listing`) using OpenAI embeddings in `app/services/search_service.py`
- [x] Implement two-mode search service (geo-radius filtered search + open global search)
- [x] Implement user behavior personalization (`positive_listing_ids` from clicked/booked listings) using Qdrant's `recommend` API
- [x] Implement "New Listing" boost slotting logic
- [x] Create thin route controllers in `app/api/v1/search.py`
- [x] Write unit/integration tests for search and sync in `app/tests/test_search.py`

---

## Phase 2: Module 2 — Photo Categorization & Quality Scoring
- [ ] Define Pydantic schemas for photo inputs and analysis output in `app/models/photos.py`
- [ ] Implement local blur detection using OpenCV Laplacian variance in `app/services/photo_service.py`
- [ ] Implement local duplicate photo detection using `imagehash.phash`
- [ ] Implement OpenAI `gpt-4o-mini` Vision structured analysis (room classification, lighting, composition)
- [ ] Implement automatic Cover Photo recommendation logic
- [ ] Create thin route controller in `app/api/v1/photos.py`
- [ ] Write unit/integration tests with sample images in `app/tests/test_photos.py`

---

## Phase 3: Module 3 — Review Filtering & Summarization
- [ ] Define Pydantic schemas for review moderation and summarization in `app/models/reviews.py`
- [ ] Implement free toxicity/abuse moderation gate via OpenAI `omni-moderation-latest`
- [ ] Implement policy check for off-platform contact info (WhatsApp/phone/email) and extortion via `gpt-4o-mini`
- [ ] Implement aspect-based rating extraction (Cleanliness, Host, Location, etc.) and 3-sentence summary generator
- [ ] Create thin route controllers in `app/api/v1/reviews.py`
- [ ] Write unit/integration tests in `app/tests/test_reviews.py`

---

## Phase 4: Module 4 — Guest Support Chatbot
- [ ] Define Pydantic schemas for chat request/response in `app/models/chat.py`
- [ ] Implement context-aware guest chatbot service in `app/services/chat_service.py`:
  - Pulls listing house rules and amenities directly from Qdrant by `listing_id` (if provided)
  - Answers platform FAQs directly (if `listing_id` is omitted)
  - Enforces safety guardrails (never makes unauthorized refund promises)
- [ ] Implement Server-Sent Events (SSE) streaming endpoint (`POST /chat`) using FastAPI `StreamingResponse`
- [ ] Create thin route controller in `app/api/v1/chat.py`
- [ ] Write unit/integration tests for chat streaming in `app/tests/test_chat.py`

---

## Phase 5: Module 5 — Fake Listing & Scam Detection
- [ ] Define Pydantic schemas for listing risk audit in `app/models/risk.py`
- [ ] Implement price anomaly detector (queries Qdrant for 5km neighborhood median price; flags listings >50% below median)
- [ ] Implement scam text pattern scanner via `gpt-4o-mini` (detects disguised contact info, wire transfer, crypto)
- [ ] Connect risk audit into listing sync service (runs automatically upon listing publish)
- [ ] Create standalone on-demand audit route in `app/api/v1/risk.py`
- [ ] Write unit/integration tests with scam fixtures in `app/tests/test_risk.py`

---

## Phase 6: Hardening, Integration & Containerization
- [ ] Benchmark search latency under simulated load (verify <40ms response target)
- [ ] Create Dockerfile for the FastAPI microservice
- [ ] Update `docker-compose.yml` to run both Qdrant and the FastAPI app in one unified stack
- [ ] Document final endpoint contracts in `00_Docs/API_DOCUMENTATION.md` once client data schemas are connected
