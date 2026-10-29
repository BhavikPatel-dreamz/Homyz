# Local Setup & Development Guide

This guide walks you through setting up and running the **Homyz AI Engine** (`homyz-ai-backend`).

---

## 1. Architecture Strategy: Cloud Development $\rightarrow$ Local Deployment

To make local development as simple and fast as possible without requiring local Docker containers:

* **Development Phase (Current)**:
  * **Vector Database**: **Qdrant Cloud Free Tier** at [cloud.qdrant.io](https://cloud.qdrant.io). Free 1GB managed cluster with zero memory overhead, no local setup, and a built-in web dashboard.
  * **AI Provider**: **Google Gemini Free Tier** (`gemini-3.5-flash-lite` for multimodal vision, `models/gemini-embedding-001` with configurable 768/1536-dim for vector embeddings) via Google AI Studio at [aistudio.google.com](https://aistudio.google.com). Free $0 API tier.
* **Production Deployment Phase (Post-Approval)**:
  * **Vector Database**: Shifting to a **Local / Self-Hosted Qdrant container** running directly on the VPS/host.
  * **AI Provider**: Transitions to **OpenAI** (`gpt-4o-mini`, `text-embedding-3-small` configured at 768-dim) once the client provides their paid OpenAI API key. See [PROVIDER_MIGRATION_GUIDE.md](file:///home/ubuntu/AHEMAD/Homyz/ai-service/00_Docs/PROVIDER_MIGRATION_GUIDE.md) for code diffs and configuration instructions.
* **Zero Disruption Transition**:
  * Switching Qdrant from Cloud to Local only requires changing `QDRANT_URL` and `QDRANT_API_KEY` in `app/.env`.
  * Switching AI providers is fully documented with code snippets in [PROVIDER_MIGRATION_GUIDE.md](file:///home/ubuntu/AHEMAD/Homyz/ai-service/00_Docs/PROVIDER_MIGRATION_GUIDE.md).

---

## 2. Prerequisites

* **Python 3.11+** *(Important: Python 3.10 is deprecated by `google.api_core` and produces runtime deprecation warnings).*
* **1 Google AI Studio API Key** (Free at [aistudio.google.com](https://aistudio.google.com)).
* **1 Qdrant Cloud Free Tier Cluster** (Free at [cloud.qdrant.io](https://cloud.qdrant.io)).
* *(Linux headless only)* System graphics libraries for OpenCV:
  ```bash
  sudo apt-get update && sudo apt-get install -y libgl1 libglib2.0-0
  ```

---

## 3. Step-by-Step Setup

### Step 1: Navigate to the AI Service Directory
> [!IMPORTANT]
> Always navigate into the `ai-service/` directory first before running Python, virtualenv, or pip commands. Never run Python commands in the root Next.js repository.

```bash
cd /path/to/Homyz/ai-service
```

---

### Step 2: Set Up Qdrant Cloud (Development)
1. Go to [cloud.qdrant.io](https://cloud.qdrant.io) and sign up for a free account.
2. Click **Create Cluster** and select the **Free Tier** (choose any cloud region close to you).
3. Under **Data Access Controls**, click **Create API Key**.
4. Copy your:
   * **Cluster URL** (e.g., `https://xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.us-east4-0.gcp.cloud.qdrant.io:6333`)
   * **API Key** (e.g., `eyJhbGciOi...`)

---

### Step 3: Get a Free Google Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com).
2. Sign in with your Google account.
3. Click **Get API Key** $\rightarrow$ **Create API Key**.
4. Copy the generated key string (`AIzaSy...`).

---

### Step 4: Set Up the Python 3.11 Virtual Environment (`app/.venv`)
All application code, virtual environments, and dependencies live strictly inside the `app/` directory:

```bash
# 1. Navigate to the app directory inside ai-service
cd app

# 2. Create the virtual environment using Python 3.11
python3.11 -m venv .venv
# (or 'python3 -m venv .venv' if your default python3 is 3.11+)

# 3. Activate the virtual environment
source .venv/bin/activate

# 4. Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

---

### Step 5: Configure Environment Variables
Copy the template to create your local `.env` file inside `app/`:

```bash
# Still inside ai-service/app/
cp .example.env .env
```

Open `app/.env` and fill in your Qdrant credentials and Google Gemini API key:

```env
# Application Settings
PROJECT_NAME="homyz-ai-engine"
ENVIRONMENT=development
DEBUG=True
PORT=8000
LOG_LEVEL=INFO
API_KEY_SECRET=dev-secret-internal-key-123

# Vector DB: Current Phase (Qdrant Cloud Free Tier)
QDRANT_URL=https://your-cluster-id.us-east4-0.gcp.cloud.qdrant.io:6333
QDRANT_API_KEY=your-qdrant-cloud-api-key
QDRANT_COLLECTION_LISTINGS=listings
VECTOR_SIZE=768

# Vector DB: Future Production Deployment (Local / Self-Hosted)
# QDRANT_URL=http://localhost:6333
# QDRANT_API_KEY=

# Google Gemini Settings & Models (Free Tier)
GOOGLE_API_KEY=AIzaSyYourRealKeyHere
GEMINI_MODEL=gemini-3.5-flash-lite
GEMINI_EMBEDDING_MODEL=models/gemini-embedding-001
```

---

### Step 6: Run the Test Suite
Ensure all unit and integration tests pass before starting the server:

```bash
# From inside ai-service/app/ with .venv activated:
pytest app/tests
# Or directly using the venv binary from ai-service/:
# app/.venv/bin/pytest app/tests
```
Expected output: **34 passed in ~3s**.

---

### Step 7: Start the FastAPI Development Server
From inside `ai-service/app/`:

```bash
python main.py
```

The application will start with hot-reloading at `http://localhost:8000`.

---

## 4. Verifying the Setup

| Service / Tool | URL | Expected Response / Purpose |
| :--- | :--- | :--- |
| **API Health Check** | `http://localhost:8000/healthz` | `{"status": "healthy", "qdrant": "connected", "mode": "cloud"}` |
| **Interactive OpenAPI Docs** | `http://localhost:8000/docs` | Swagger UI listing all endpoints and testing payloads |
| **Alternative API Docs** | `http://localhost:8000/redoc` | ReDoc formatted API documentation |
| **Qdrant Cloud Dashboard** | `https://cloud.qdrant.io` | Visual collection manager, vectors, and cluster health |

### Quick Smoke Test (Photo Categorization API)
In a separate terminal, test the photo analysis endpoint:

```bash
curl -X POST "http://localhost:8000/api/v1/photos/analyze" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dev-secret-internal-key-123" \
  -d '{
    "listing_id": "test_listing_1",
    "photos": [
      "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800"
    ]
  }'
```

---

## 5. Future Shift to Local Qdrant (Production Deployment Reference)

When moving to production or shifting to self-hosted local Qdrant:

1. **Run Local Qdrant via Docker**:
   ```bash
   docker run -d \
     --name homyz-qdrant \
     -p 6333:6333 \
     -v $(pwd)/qdrant_storage:/qdrant/storage \
     qdrant/qdrant
   ```

2. **Update `app/.env`**:
   ```env
   QDRANT_URL=http://localhost:6333
   QDRANT_API_KEY=
   ```

3. Restart the FastAPI service. Zero code changes required.
