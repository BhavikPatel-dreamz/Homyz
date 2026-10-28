# Local Setup & Development Guide

This guide walks you through setting up and running the **Homyz AI Engine**.

---

## 1. Database Strategy: Cloud Development $\rightarrow$ Local Deployment

To make local development as simple and fast as possible without needing Docker on your machine:

* **During Development (Current Phase)**:
  * We use **Qdrant Cloud (Free Tier)** at [cloud.qdrant.io](https://cloud.qdrant.io).
  * It provides a free 1GB cluster in the cloud with zero local setup, zero memory overhead, and a built-in web dashboard.
* **During Deployment (Production Phase)**:
  * We will shift to a **Local / Self-Hosted Qdrant container** running on the host/VPS.
* **Zero Code Changes**:
  * The Python application uses `qdrant-client`, which connects to both cloud and local instances identically. 
  * Switching between Qdrant Cloud and Local Qdrant only requires changing two environment variables in `app/.env` (`QDRANT_URL` and `QDRANT_API_KEY`).

---

## 2. Prerequisites
* **Python 3.10+**
* **1 OpenAI API Key** (`sk-...`)
* **1 Qdrant Cloud Free Account** (for development)

---

## 3. Step-by-Step Setup

### Step 1: Navigate to the AI Service Directory
> [!IMPORTANT]
> Always navigate into the `ai-service/` directory first before running any Python or setup commands. Never run Python virtualenv or pip commands in the root of the main `Homyz` Next.js repository.

```bash
cd ai-service
```

---

### Step 2: Set Up Qdrant Cloud (Development)
1. Go to [cloud.qdrant.io](https://cloud.qdrant.io) and sign up for a free account.
2. Create a **Free Tier Cluster** (select any region close to you).
3. Under **Data Access Controls**, create an **API Key**.
4. Copy your:
   * **Cluster URL** (e.g., `https://xxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx.us-east4-0.gcp.cloud.qdrant.io:6333`)
   * **API Key** (e.g., `eyJhbGciOi...`)

---

### Step 3: Set Up Python Virtual Environment (`app/.venv`)
Everything related to application code, dependencies, and runtime lives strictly inside the `app/` directory:

```bash
# 1. Navigate to the app directory inside ai-service
cd app

# 2. Create the hidden virtual environment inside app/
python3 -m venv .venv

# 3. Activate on Linux/macOS
source .venv/bin/activate

# 4. Install application dependencies
pip install -r requirements.txt
```

---

### Step 4: Configure Environment Variables
Copy the template to create your local `.env` file inside `app/`:

```bash
# Still inside ai-service/app/
cp .example.env .env
```

Open `app/.env` and paste your Qdrant Cloud credentials and OpenAI key:

```env
# Application Settings
ENVIRONMENT=development
DEBUG=True
PORT=8000
API_KEY_SECRET=dev-secret-internal-key-123

# Vector DB: Current Phase (Qdrant Cloud Free Tier)
QDRANT_URL=https://your-cluster-id.us-east4-0.gcp.cloud.qdrant.io:6333
QDRANT_API_KEY=your-qdrant-cloud-api-key

# Vector DB: Future Production Deployment (Local / Self-Hosted)
# QDRANT_URL=http://localhost:6333
# QDRANT_API_KEY=

# OpenAI Settings
OPENAI_API_KEY=sk-your-real-openai-api-key-here
```

---

### Step 5: Run the FastAPI Development Server
From inside `ai-service/app`:

```bash
uvicorn main:app --reload --port 8000
```

---

## 4. Verifying the Setup

| Service | URL | Expected Response |
| :--- | :--- | :--- |
| **API Health Check** | `http://localhost:8000/healthz` | `{"status": "healthy", "qdrant": "connected", "mode": "cloud"}` |
| **Interactive API Docs** | `http://localhost:8000/docs` | Swagger UI listing all endpoints |
| **Qdrant Cloud Dashboard** | `https://cloud.qdrant.io` | Visual collection manager, vectors, and usage |

---

## 5. Future Shift to Local Qdrant (Deployment Reference)
When moving to production or shifting to a self-hosted local Qdrant instance:
1. Run local Qdrant via Docker:
   ```bash
   docker run -d -p 6333:6333 -v ./qdrant_storage:/qdrant/storage qdrant/qdrant
   ```
2. Update `app/.env`:
   ```env
   QDRANT_URL=http://localhost:6333
   QDRANT_API_KEY=
   ```
3. That is all. Zero Python code needs to be modified.
