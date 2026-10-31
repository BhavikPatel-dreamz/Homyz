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
- [x] Define Pydantic schemas for photo inputs and analysis output in `app/models/photos.py`
- [x] Implement local blur detection using OpenCV Laplacian variance in `app/services/photo_service.py`
- [x] Implement local duplicate photo detection using `imagehash.phash`
- [x] Implement AI Vision structured analysis (Gemini 3.5 Flash for demo via `langchain-google-genai`; switchable to `gpt-4o-mini` for prod)
- [x] Implement dual-layer blur detection (OpenCV Laplacian variance + AI vision inspection fallback) and low-detail payload optimization
- [x] Implement automatic Cover Photo recommendation logic
- [x] Create thin route controller in `app/api/v1/photos.py`
- [x] Write unit/integration tests with sample images in `app/tests/test_photos.py`

---

## Phase 3: Module 3 — Review Filtering & Summarization
- [x] Define Pydantic schemas for review moderation and summarization (1–5 scale, 1k char limits, `security_violation` flag) in `app/models/reviews.py`
- [x] Implement deterministic regex contact and door code pre-screening ($0 AI cost) & empty review comment bypass in `app/services/review_service.py`
- [x] Implement AI review moderation gate with upstream safety block interception and anti-censorship enforcement
- [x] Implement aspect-based rating extraction (1.0–5.0 scale) and adaptive summarization (sparse vs full synthesis)
- [x] Create thin route controllers in `app/api/v1/reviews.py` and register with `app/api/v1/router.py`
- [x] Write unit/integration tests covering all 10 edge cases in `app/tests/test_reviews.py`

---

## Phase 4: Module 4 — Guest Support Chatbot
- [x] Define Pydantic schemas for chat request/response in `app/models/chat.py`
- [x] Implement context-aware guest chatbot service in `app/services/chat_service.py`:
  - Pulls listing house rules and amenities directly from Qdrant by `listing_id` (if provided)
  - Answers platform FAQs directly (if `listing_id` is omitted)
  - Enforces safety guardrails (never makes unauthorized refund promises)
- [x] Implement Server-Sent Events (SSE) streaming endpoint (`POST /chat`) using FastAPI `StreamingResponse`
- [x] Create thin route controller in `app/api/v1/chat.py`
- [x] Write unit/integration tests for chat streaming in `app/tests/test_chat.py`

---

## Phase 5: Module 5 — Fake Listing & Scam Detection
- [x] Define Pydantic schemas for listing risk audit in `app/models/risk.py`
- [x] Implement price anomaly detector (queries Qdrant for 5km neighborhood median price; flags listings >50% below median)
- [x] Implement scam text pattern scanner via `gpt-4o-mini` (detects disguised contact info, wire transfer, crypto)
- [x] Implement AI price honeypot detection for extreme low-price luxury listing scams
- [x] Connect risk audit into listing sync service (runs automatically upon listing publish)
- [x] Implement hard quarantine in listing sync (unindex and remove fraud listings from Qdrant vector database)
- [x] Create standalone on-demand audit route in `app/api/v1/risk.py`
- [x] Write unit/integration tests with scam fixtures in `app/tests/test_risk.py`

---

## Phase 6: Hardening, Integration & Containerization
- [ ] Benchmark search latency under simulated load (verify <40ms response target)
- [ ] Create Dockerfile for the FastAPI microservice
- [ ] Update `docker-compose.yml` to run both Qdrant and the FastAPI app in one unified stack
- [ ] Document final endpoint contracts in `00_Docs/API_DOCUMENTATION.md` once client data schemas are connected
