# Project Overview: Homyz AI Engine

## 1. Executive Summary
**Homyz AI Engine** is a high-performance, standalone Python FastAPI microservice designed to provide plug-and-play AI intelligence for the Homyz accommodation marketplace.

### Monorepo Architecture Context
The AI engine lives as an independent microservice in the `ai-service/` directory of the main `Homyz` platform repository (alongside other services like `media-server/`). All application code, virtual environments, dependencies, and execution live strictly encapsulated within `ai-service/app/`.

### Core Architectural Principle: Zero Database Disruption
The client platform's primary database (users, bookings, payments, properties), core backend, and web/mobile frontends are already built. The Homyz AI Engine operates as an independent service:
* The client backend sends requests with listing data, search queries, or photos over standard HTTPS REST endpoints (secured with an internal API key).
* The AI engine executes vector search, computer vision analysis, moderation, or conversational streaming, and returns structured JSON responses.
* The client platform receives the AI output and writes it directly to their existing database.
* **No traditional database (Postgres, MySQL, Mongo) is required inside this microservice.** Qdrant functions as the unified vector store and listing metadata cache.

### Vector Database & AI Provider Lifecycle
* **Vector Database**:
  * **Development Phase**: We use **Qdrant Cloud (Free Tier)** for zero-friction setup without needing local Docker or managing local memory.
  * **Production Deployment Phase**: We shift to **Local / Self-Hosted Qdrant** (e.g. Docker container on the production VPS) for full data ownership and cost control.
  * **Zero Code Changes**: The transition is managed entirely via environment variables (`QDRANT_URL` and `QDRANT_API_KEY`).
* **AI Model Provider (Demo vs. Production)**:
  * **Demo / Preview Phase (Current)**: To enable a full working preview for client approval before they purchase API keys, the entire AI engine runs on **Google Gemini Free Tier via `langchain-google-genai`** at **$0 cost**:
    * **Embeddings**: Google **`text-embedding-004`** (**768 dimensions**).
    * **Vision / LLM**: Google **`gemini-2.5-flash`** (multimodal vision, categorization, tips).
    * **Vector Size**: Qdrant collection is configured with `VECTOR_SIZE = 768`.
  * **Production Phase (Post-Approval)**: Once the client approves the preview and provides their paid OpenAI API key, the engine transitions to **OpenAI**:
    * **Embeddings**: OpenAI **`text-embedding-3-small`** (**1536 dimensions**).
    * **Vision / LLM**: OpenAI **`gpt-4o-mini`**.
    * **Vector Size**: `VECTOR_SIZE = 1536` (Qdrant collection is re-synced).
  * **Unified Architecture**: LangChain provides identical interfaces (`GoogleGenerativeAIEmbeddings` $\leftrightarrow$ `OpenAIEmbeddings`, `ChatGoogleGenerativeAI` $\leftrightarrow$ `ChatOpenAI`), ensuring a clean transition with zero rewrite of business logic.

| Capability | Demo Model (Google Free Tier) | Production Model (OpenAI) |
| :--- | :--- | :--- |
| **Embeddings (Search & Sync)** | `text-embedding-004` (**768 dim**) | `text-embedding-3-small` (**1536 dim**) |
| **Vision (Photo Categorization)** | `gemini-2.5-flash` | `gpt-4o-mini` |
| **Moderation & Extraction** | `gemini-2.5-flash` | `omni-moderation-latest` + `gpt-4o-mini` |
| **Guest Chatbot (RAG)** | `gemini-2.5-flash` | `gpt-4o-mini` |
| **Qdrant Vector Size** | `768` | `1536` |

---

## 2. The 5 Core AI Feature Modules

```
┌────────────────────────────────────────────────────────┐
│ Homyz AI Engine (FastAPI Microservice)                 │
│                                                        │
│  [Module 1]  Search & Ranking Engine                   │
│  [Module 2]  Photo Categorization & Quality Filter     │
│  [Module 3]  Review Moderation & Aspect Summarizer     │
│  [Module 4]  Streaming Guest Support Chatbot           │
│  [Module 5]  Fake Listing & Price Anomaly Auditor      │
└───────────────┬────────────────────────┬───────────────┘
                │                        │
                ▼                        ▼
┌───────────────────────────────┐ ┌──────────────────────────────┐
│ Qdrant Vector Database        │ │ AI Model Provider            │
│ - Listings & House Rules      │ │ - Demo (Google Free Tier):   │
│ - Vector Size: 768 (Demo)     │ │   • text-embedding-004       │
│                1536 (Prod)    │ │   • gemini-2.5-flash         │
│ - Fast HNSW In-Memory Index   │ │ - Prod (OpenAI Paid Key):    │
│                               │ │   • text-embedding-3-small   │
│                               │ │   • gpt-4o-mini              │
└───────────────────────────────┘ └──────────────────────────────┘
```

### 2.1 Module 1: Search & Ranking Engine
* **Semantic Vector Search**: Understands conversational intent (e.g., *"quiet cabin with mountain view and fast wifi"*) by comparing query vectors against listing vectors stored in Qdrant (using Google `text-embedding-004` 768-dim in Demo; OpenAI `text-embedding-3-small` 1536-dim in Prod).
* **Dual Search Modes**: Supports both specific location queries (geo-radius bounding) and global open searches ("Anywhere").
* **Multi-Factor Ranking**: Ranks candidate listings using a composite formula combining vector similarity, price competitiveness, host response rate, and listing completeness.
* **User Behavior Personalization**: Utilizes Qdrant's native `recommend` API. When the client platform passes `positive_listing_ids` (listings the guest previously clicked, booked, or favorited), search results dynamically adapt to prioritize listings with matching architectural styles and amenities.
* **Fair Discovery Boost**: Injects high-quality newly published listings into Page 1 result slots (e.g., positions 4 and 9) to ensure new hosts secure initial bookings.

### 2.2 Module 2: Photo Categorization & Quality Scoring
* **Microservice Philosophy**: The engine returns objective metadata flags and quality scores; the client's frontend decides how to display or enforce them.
* **Local Pre-Checks ($0 Cost, <5ms)**:
  * **Blur Detection**: Fast Fourier / Laplacian variance (`cv2.Laplacian`) detects motion-blurred or out-of-focus images.
  * **Duplicate Detection**: Perceptual hashing (`imagehash.phash`) detects duplicate or cropped photos within a batch.
* **AI Vision Analysis (Google Gemini 2.5 Flash for Demo / `gpt-4o-mini` for Prod)**:
  * **Room Categorization**: Automatically categorizes photos into `Living Room`, `Bedroom`, `Bathroom`, `Kitchen`, `Balcony/Patio`, `Dining Room`, `Exterior/Entrance`, `Amenities/Pool`.
  * **Quality & Lighting Scores**: Evaluates lighting (1–10) and composition (1–10).
  * **Smart Cover Photo**: Automatically nominates the single highest-scoring, well-lit living room or exterior photo as the recommended cover image.

### 2.3 Module 3: Review Filtering & Summarization
* **Automated Moderation Gate**: Uses OpenAI `omni-moderation-latest` (100% Free) to detect toxicity, hate speech, harassment, and profanity, plus `gpt-4o-mini` to detect off-platform solicitation (phone numbers, WhatsApp) and extortion.
* **Aspect-Based Sentiment Extraction**: Once a listing has reviews, AI extracts 1–10 scores across the standard 6 Airbnb dimensions:
  1. Cleanliness
  2. Accuracy of Description
  3. Check-in Experience
  4. Host Communication
  5. Location & Neighborhood
  6. Value for Money
* **Concise 3-Sentence Summary**: Generates a balanced summary highlighting top praises and caveats at the top of the listing page.

### 2.4 Module 4: Streaming Guest Support Chatbot
* **Unified Single Endpoint (`POST /chat`)**: Eliminates the need for separate help article sync or search endpoints.
* **Context-Aware RAG**:
  * If the caller provides a `listing_id`, the chatbot pulls the property's house rules, check-in instructions, parking, and wifi details directly from Qdrant to answer property-specific questions with 100% accuracy.
  * If `listing_id` is omitted, the chatbot answers general platform questions and policies directly.
* **Stateless History**: The caller passes `conversation_history` array in the request.
* **Streaming Delivery**: Emits responses via Server-Sent Events (SSE) for real-time typing effect (first token in <250ms).
* **Strict Safety Guardrails**: Prevents unauthorized refund promises or rule overrides.

### 2.5 Module 5: Fake Listing & Scam Detection
* **Price Honeypot Anomaly Detection**: Queries Qdrant for active listings in a 5km radius with similar capacity. Flags listings priced >50% below the neighborhood median as potential honeypots.
* **Scam Pattern Scanner**: Inspects titles and descriptions for obfuscated contact vectors (e.g., *"c-a-l-l me on w-h-a-t-s-a-p-p"*) and solicitations for off-platform payment (wire transfer, crypto).
* **Dual Execution**: Runs automatically on listing creation/sync (`POST /api/ai/listings/sync`) and provides a standalone endpoint (`POST /api/ai/risk/audit-listing`) for on-demand admin re-audits.

---

## 3. Technology Stack & Operational Footprint

| Component | Technology | Purpose |
| :--- | :--- | :--- |
| **Language & Runtime** | Python 3.10+ | Core microservice runtime |
| **Web Framework** | FastAPI + Uvicorn | Async ASGI REST API & SSE streaming |
| **AI Orchestration** | LangChain (`langchain-google-genai`, `langchain-openai`, `langchain-qdrant`) | Model interfaces, embeddings, and vector store operations |
| **Vector Database** | Qdrant (Rust-based) | In-memory HNSW vector search, payload filtering, recommend API |
| **Vision & Image Processing** | OpenCV (`cv2`), `imagehash`, Pillow | Instant local blur check & duplicate hash checks |
| **Data Validation** | Pydantic V2 (`BaseModel`, `Field`) | Strict request/response validation and structured LLM outputs |
| **Containerization** | Docker & Docker Compose | Local containerized Qdrant & production deployment |

---

## 4. Cost vs. Traffic Volume Breakdown

The architecture runs at **~$15 to $25 / month total** based on the following specific traffic benchmarks:

| Metric / Action | Monthly Volume Covered | Monthly Subtotal |
| :--- | :--- | :--- |
| **Search Queries** | 100,000 searches / month | ~$0.03 |
| **Listing Syncs** | 1,000 new listings / month | ~$0.01 |
| **Photo Vision Analysis** | 20,000 photos / month (1,000 listings × 20) | ~$2.50 |
| **Review Abuse Moderation** | 2,000 reviews / month | $0.00 (Free) |
| **Review Summaries** | 2,000 reviews / month | ~$0.10 |
| **Guest Support Chat** | 5,000 sessions / month (~15,000 messages) | ~$3.20 |
| **Listing Scam Audits** | 1,000 listing scans / month | ~$0.15 |
| **OpenAI API Subtotal** | **Covers ~50,000 to 100,000 active visitors** | **~$6.00 / month** |
| **Qdrant Vector DB** | Up to 100,000 listing vectors in RAM | $0 to $15 / month |
| **FastAPI Microservice Host** | 24/7 container on Render / Railway / AWS ECS | ~$5 to $10 / month |
| **TOTAL RUNNING COST** | **Active marketplace traffic** | **~$15 to $25 / month** |
