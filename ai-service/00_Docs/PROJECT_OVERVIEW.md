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
    * **Vision / LLM**: Google **`gemini-3.5-flash-lite`** (multimodal vision, categorization, tips).
    * **Vector Size**: Qdrant collection is configured with `VECTOR_SIZE = 768`.
  * **Production Phase (Post-Approval)**: Once the client approves the preview and provides their paid OpenAI API key, the engine transitions to **OpenAI**:
    * **Embeddings**: OpenAI **`text-embedding-3-small`** (**1536 dimensions**).
    * **Vision / LLM**: OpenAI **`gpt-4o-mini`**.
    * **Vector Size**: `VECTOR_SIZE = 1536` (Qdrant collection is re-synced).
  * **Unified Architecture**: LangChain provides identical interfaces (`GoogleGenerativeAIEmbeddings` $\leftrightarrow$ `OpenAIEmbeddings`, `ChatGoogleGenerativeAI` $\leftrightarrow$ `ChatOpenAI`), ensuring a clean transition with zero rewrite of business logic. See [PROVIDER_MIGRATION_GUIDE.md](file:///home/ubuntu/AHEMAD/Homyz/ai-service/00_Docs/PROVIDER_MIGRATION_GUIDE.md) for code diffs, configuration instructions, and the 768-dimension parity configuration.

| Capability | Demo Model (Google Free Tier) | Production Model (OpenAI) |
| :--- | :--- | :--- |
| **Embeddings (Search & Sync)** | `text-embedding-004` (**768 dim**) | `text-embedding-3-small` (**1536 dim**) |
| **Vision (Photo Categorization)** | `gemini-3.5-flash-lite` | `gpt-4o-mini` |
| **Moderation & Extraction** | `gemini-3.5-flash-lite` | `omni-moderation-latest` + `gpt-4o-mini` |
| **Guest Chatbot (RAG)** | `gemini-3.5-flash-lite` | `gpt-4o-mini` |
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
│                1536 (Prod)    │ │   • gemini-3.5-flash         │
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
* **AI Vision Analysis (Google Gemini 3.5 Flash for Demo / `gpt-4o-mini` for Prod)**:
  * **Room Categorization**: Automatically categorizes photos into `Living Room`, `Bedroom`, `Bathroom`, `Kitchen`, `Balcony/Patio`, `Dining Room`, `Exterior/Entrance`, `Amenities/Pool`.
  * **Quality & Lighting Scores**: Evaluates lighting (1–10) and composition (1–10).
  * **Smart Cover Photo**: Automatically nominates the single highest-scoring, well-lit living room or exterior photo as the recommended cover image.

### 2.3 Module 3: Review Filtering & Summarization
* **Automated Moderation Gate**: Multi-layer safety gate detecting toxicity, hate speech, harassment, physical security disclosures (door keypad codes, lockboxes), off-platform solicitation (phone, WhatsApp, external payment, social handles), and review extortion / retaliation. Pre-screens empty comments and contact regex patterns ($0 AI cost); gracefully handles upstream AI safety blocks.
* **Aspect-Based Sentiment Extraction**: Once a listing has reviews (1 to 50 reviews, max 1,000 characters per review), AI extracts **1.0–5.0** scores across the standard 6 Airbnb dimensions (matching the Homyz Next.js 5-star rating schema):
  1. Cleanliness
  2. Accuracy of Description
  3. Check-in Experience (`checkIn`)
  4. Host Communication
  5. Location & Neighborhood
  6. Value for Money
* **Adaptive Narrative Summary**: Generates a balanced narrative summary (concise for sparse reviews; 3-sentence synthesis for standard batches) highlighting grounded highlights and constructive considerations without hallucinating unmentioned amenities.

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

## 4. OpenAI API Cost vs. Traffic Volume Breakdown

The OpenAI API consumption runs at **~$6.50 to $14.50 / month total** (including a 20%–50% token buffer for realistic production wiggle room) based on the following traffic benchmarks:

| Metric / Action | Monthly Volume Covered | Model Used | Calculation Formula & Math (Padded with Wiggle Room) | Monthly Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Search Queries** | 100,000 searches / month | `text-embedding-3-small` | `100,000 × 15 tokens = 1.5M tokens × ($0.02 / 1M)` | ~$0.03 |
| **Listing Syncs (Embeddings)** | 1,000 new listings / month | `text-embedding-3-small` | `1,000 × 65 tokens = 65k tokens × ($0.02 / 1M)` | ~$0.01 |
| **Photo Vision Analysis** | 20,000 photos / month (1,000 listings × 20) | `gpt-4o-mini` (Vision) | `20,000 × [(3,000 in × $0.15/1M) + (100 out × $0.60/1M)] = 20k × $0.00051`<br>*(Optimized with `detail: "low"`: 300 in / 100 out = **$2.10/mo**)* | ~$10.20 *(Ceiling)*<br>*(~$2.10 Low)* |
| **Review Abuse Moderation** | 2,000 reviews / month | `omni-moderation-latest` + Regex | `2,000 reviews × $0.00 (OpenAI Free Tier Moderation Endpoint)` | $0.00 (Free) |
| **Review Aspect Summaries** | 2,000 summaries / month | `gpt-4o-mini` | `2,000 × [(1,000 in × $0.15/1M) + (200 out × $0.60/1M)] = 2k × $0.00027` | ~$0.54 |
| **Guest Support Chat** | 5,000 sessions / month (~15,000 messages) | `gpt-4o-mini` (SSE) | `15,000 × [(1,000 in × $0.15/1M) + (150 out × $0.60/1M)] = 15k × $0.00024` | ~$3.60 |
| **Listing Scam & Honeypot Audits** | 1,000 listing scans / month | `gpt-4o-mini` + Spatial Radius | `1,000 × [(800 in × $0.15/1M) + (100 out × $0.60/1M)] = 1k × $0.00018` | ~$0.18 |
| **TOTAL OPENAI API COST** | **Covers ~50,000 to 100,000 visitors** | **All 5 Core AI Modules** | **Optimized Vision:** $0.03 + $0.01 + $2.10 + $0.00 + $0.54 + $3.60 + $0.18 = **$6.46**<br>**High-Detail Ceiling:** $0.03 + $0.01 + $10.20 + $0.00 + $0.54 + $3.60 + $0.18 = **$14.56** | **~$6.50 / month** *(Optimized)*<br>**~$14.50 / month** *(Ceiling)* |

> [!NOTE]
> * **Production Pricing & Deployment Analysis**: See [`PRICING_AND_DEPLOYMENT_ANALYSIS.md`](./PRICING_AND_DEPLOYMENT_ANALYSIS.md) for the complete token measurement audit, traveler vs. host funnel model, and self-hosted VPS deployment economics.
> * **Detailed Workload & Bypass Guide**: See [`AI_WORKLOAD_DISTRIBUTION.md`](./AI_WORKLOAD_DISTRIBUTION.md) for the complete engineering breakdown of what runs locally in Python vs. what gets dispatched to AI, including all $0 short-circuit conditions.
> * **Demo vs Production**: During the current preview phase on **Google Gemini Free Tier**, the AI provider cost is **$0.00 / month**.
> * **Photo Vision Pricing**: Padded with up to 3,000 input tokens for multi-tile high-detail ceiling, and 300 tokens for low-detail mode. Local OpenCV pre-checks run at $0 cost and filter out blurry, duplicate, and corrupt photos before calling the vision model.
> * **ROI Context**: For an accommodation platform charging standard 10–14% marketplace fees, a single typical $450 booking earns $45–$60, which fully covers **3 to 4 months** of the entire OpenAI bill.
