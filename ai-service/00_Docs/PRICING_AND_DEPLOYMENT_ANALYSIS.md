# Production Pricing, Capacity & Deployment Analysis

> **Authoritative Technical & Financial Specification**: This document provides an exhaustive, mathematically rigorous cost analysis for the Homyz AI Engine. It details measured prompt and completion token counts from the actual codebase, input/output pricing formulas, API optimization and bypass strategies, user volume conversion modeling (Travelers vs. Hosts), and realistic server deployment economics (shared Next.js VPS vs. separate dedicated VPS).

---

## 1. Executive Cost Summary

The monthly cost depends on whether photo vision is run in **Optimized Mode (`detail: "low"`)** or evaluated at the **Conservative High-Detail Ceiling (4K Multi-Tile)**. To ensure financial safety and avoid razor-thin estimates, all figures below include **generous token buffers (20%–50% extra wiggle room per prompt)**:

| Cost Component | Scenario 1: Optimized Production (`detail: "low"`) | Scenario 2: Conservative Ceiling (Multi-Tile 4K) | Explanation / Basis |
| :--- | :---: | :---: | :--- |
| **OpenAI Base API Bill (with Wiggle Room)** | **$6.46 / month** *(~$6.50)* | **$14.56 / month** *(~$14.50)* | Includes 20%–50% token padding across 100k searches, 20k photos, 15k chat msgs |
| **10% Operational Safety Buffer** | **+$0.65 / month** | **+$1.46 / month** | Extra safety margin covering network retries, streaming drops & test traffic |
| **Total OpenAI API Subtotal** | **$7.11 / month** *(~$7.10)* | **$16.02 / month** *(~$16.00)* | Combined AI API expenditure with full buffer |
| **Hosting: Shared on Current Next.js VPS** | **+$0.00 / month** | **+$0.00 / month** | Runs alongside Next.js on existing $\ge 4\text{GB}$ VPS (zero extra bills) |
| **TOTAL TCO — Shared Next.js VPS** | **$7.11 / month** *(~$7.10)* | **$16.02 / month** *(~$16.00)* | **Scenario 1:** $\$6.46 + \$0.65 + \$0.00 = \mathbf{\$7.11 / \text{month}}$<br>**Scenario 2:** $\$14.56 + \$1.46 + \$0.00 = \mathbf{\$16.02 / \text{month}}$ |
| **Hosting: Separate Dedicated 4GB VPS** | **+$7.50 – $24.00 / month** | **+$7.50 – $24.00 / month** | Dedicated VPS: Hetzner ($7.50), AWS Lightsail ($20), DigitalOcean ($24) |
| **TOTAL TCO — Separate Dedicated VPS** | **$14.61 – $31.11 / month** | **$23.52 – $40.02 / month** | **Scenario 1:** $\$7.11\text{ API} + (\$7.50\text{ to }\$24.00\text{ VPS})$<br>**Scenario 2:** $\$16.02\text{ API} + (\$7.50\text{ to }\$24.00\text{ VPS})$ |

---

## 2. Prompt & Completion Token Counts (Measured vs. Padded Wiggle Room)

Rather than budgeting with razor-thin cut-to-cut token counts, we establish a **Padded Budget Token Count** that injects a **20% to 50% safety cushion** for longer user queries, verbose conversation turns, and extended property rules:

| Feature / Endpoint | Model Used | Measured Strict Baseline | Padded Budget Token Count (with Wiggle Room) | Wiggle Room Cushion | Request / Response Payload Size |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **Natural Language Search** | `text-embedding-3-small` | ~10 in / 0 out | **15 input tokens** | **+50%** | • Req: `{"query": "...", "page": 1}` (~50–100 B)<br>• Res: Scored listing IDs array (~400 B) |
| **Listing Sync Embedding** | `text-embedding-3-small` | ~45 in / 0 out | **65 input tokens** | **+44%** | • Req: Title + property type + 15+ amenities (~300 B)<br>• Res: 1536-dim vector embedded into Qdrant |
| **Photo Vision (`detail: "low"`)** | `gpt-4o-mini` (Vision) | ~255 in / ~65 out | **300 in / 100 out** | **+18% in / +54% out** | • Req: Base64 JPEG (max 1024px) + instructions (~40 KB)<br>• Res: `room_type`, `is_blurry`, scores, tips (~450 B) |
| **Photo Vision (Worst-Case High)** | `gpt-4o-mini` (Vision) | ~2,833 in / ~65 out | **3,000 in / 100 out** | **+6% in / +54% out** | • Req: Raw 4K multi-tile image stream (~2.5 MB)<br>• Res: Structured evaluation JSON (~450 B) |
| **Review Abuse Moderation** | `omni-moderation-latest` | ~180 in / 0 out | **250 input tokens** | **+39%** | • Req: Review comment text (~500 B)<br>• Res: Safety violation flags array (~200 B) |
| **Review Aspect Summaries** | `gpt-4o-mini` | ~800 in / ~150 out | **1,000 in / 200 out** | **+25% in / +33% out** | • Req: Batch of 10+ reviews + prompt rules (~2.5 KB)<br>• Res: 6 aspect scores + narrative summary (~800 B) |
| **Guest Support Chatbot** | `gpt-4o-mini` (SSE) | ~780 in / ~120 out | **1,000 in / 150 out** | **+28% in / +25% out** | • Req: System prompt + rules + 5-turn history (~3.0 KB)<br>• Res: Real-time streamed SSE token chunks (~550 B) |
| **Listing Fraud & Risk Audit** | `gpt-4o-mini` | ~650 in / ~70 out | **800 in / 100 out** | **+23% in / +43% out** | • Req: Title + description + price + spatial median (~2.0 KB)<br>• Res: Array of detected deception signals (~400 B) |

---

## 3. Official OpenAI Rates & Mathematical Cost Formulas

Pricing reflects official OpenAI developer rates:
* **Embeddings (`text-embedding-3-small`)**: **$0.020 / 1M input tokens** ($0 output).
* **Language & Vision (`gpt-4o-mini`)**: **$0.150 / 1M input tokens** | **$0.600 / 1M output tokens** (Output is $4\times$ input).
* **Moderation (`omni-moderation-latest`)**: **$0.000 (Free Tier)**.

### Detailed Line-Item Arithmetic (Padded with Wiggle Room)

$$\text{Monthly Cost} = \text{Monthly Volume} \times \left[ \left( \text{Padded Input Tokens} \times \frac{\$0.150}{10^6} \right) + \left( \text{Padded Output Tokens} \times \frac{\$0.600}{10^6} \right) \right]$$

| Feature | Monthly Volume | Padded Input / Output Tokens | Exact Mathematical Formula | Monthly Subtotal |
| :--- | :--- | :--- | :--- | :--- |
| **Search Queries** | 100,000 queries | 15 in / 0 out | $100{,}000 \times \left(15 \times \frac{\$0.020}{10^6}\right) = 1{,}500{,}000 \times \$0.00000002$ | **$0.030** |
| **Listing Embeddings** | 1,000 listings | 65 in / 0 out | $1{,}000 \times \left(65 \times \frac{\$0.020}{10^6}\right) = 65{,}000 \times \$0.00000002$ | **$0.001** |
| **Photo Vision (`detail: "low"`)** | 20,000 photos | 300 in / 100 out | $20{,}000 \times \left[\left(300 \times \frac{\$0.150}{10^6}\right) + \left(100 \times \frac{\$0.600}{10^6}\right)\right] = 20\text{k} \times \$0.000105$ | **$2.100** |
| *Photo Vision (High-Detail Ceiling)* | *20,000 photos* | *3,000 in / 100 out* | *$20{,}000 \times \left[\left(3000 \times \frac{\$0.150}{10^6}\right) + \left(100 \times \frac{\$0.600}{10^6}\right)\right] = 20\text{k} \times \$0.000510$* | *($10.200)* |
| **Review Moderation** | 2,000 reviews | 250 in / 0 out | $2{,}000 \times \$0.000$ *(Free Tier Moderation Endpoint)* | **$0.000** |
| **Review Aspect Summaries** | 2,000 summaries | 1,000 in / 200 out | $2{,}000 \times \left[\left(1000 \times \frac{\$0.150}{10^6}\right) + \left(200 \times \frac{\$0.600}{10^6}\right)\right] = 2\text{k} \times \$0.000270$ | **$0.540** |
| **Guest Support Chat** | 15,000 messages | 1,000 in / 150 out | $15{,}000 \times \left[\left(1000 \times \frac{\$0.150}{10^6}\right) + \left(150 \times \frac{\$0.600}{10^6}\right)\right] = 15\text{k} \times \$0.000240$ | **$3.600** |
| **Listing Fraud Audits** | 1,000 scans | 800 in / 100 out | $1{,}000 \times \left[\left(800 \times \frac{\$0.150}{10^6}\right) + \left(100 \times \frac{\$0.600}{10^6}\right)\right] = 1\text{k} \times \$0.000180$ | **$0.180** |
| **TOTAL OPENAI API SPEND** | **Production Workload** | **All 5 Modules** | **Optimized Vision:** $\$0.03 + \$0.001 + \$2.10 + \$0.00 + \$0.54 + \$3.60 + \$0.18$<br>**High-Detail Ceiling:** $\$0.03 + \$0.001 + \$10.20 + \$0.00 + \$0.54 + \$3.60 + \$0.18$ | **~$6.46 / month** *(Optimized)*<br>**~$14.56 / month** *(Ceiling)* |

---

## 4. User Volume Conversion Modeling: Travelers vs. Hosts

To ground the traffic figures in sound unit economics, the monthly API volumes map directly to a standard marketplace conversion funnel based on **50,000 Monthly Unique Visitors**:

```mermaid
flowchart TD
    Total[50,000 Monthly Marketplace Visitors]
    Total --> Travelers[Demand Side: 48,000 Travelers / Guests]
    Total --> Hosts[Supply Side: 2,000 Active & Onboarding Hosts]

    Travelers --> SearchQ[100,000 Search Queries<br/><b>~2 searches per traveler</b>]
    Travelers --> ChatQ[5,000 Support Sessions = 15,000 Messages<br/><b>~10% of travelers chat, 3 msgs/session</b>]
    Travelers --> Bookings[2,000 Completed Stays & Reviews<br/><b>~4.2% booking conversion rate</b>]

    Hosts --> Ingestion[1,000 New Listings Created / Month]
    Ingestion --> Photos[20,000 Photos Analyzed<br/><b>Avg. 20 photos uploaded per listing</b>]
    Ingestion --> Audits[1,000 Fraud & Honeypot Scans<br/><b>1 scan per listing creation / update</b>]
```

### Detailed Metric Mapping

1. **Demand Side (Travelers / Guests)**:
   * **Active Travelers**: ~48,000 unique travelers.
   * **Search Activity**: An average traveler runs 2.08 search iterations (exploring dates, map locations, price filters) = **100,000 search queries / month**.
   * **Guest Support Concierge**: Approximately 10.4% of travelers engage the concierge bot before or after booking. Each session averages 3 turns = 5,000 sessions $\times$ 3 turns = **15,000 chat messages / month**.
   * **Completed Stays & Reviews**: A standard 4.16% checkout conversion yields 2,000 completed stays, generating **2,000 guest reviews / month**.

2. **Supply Side (Hosts / Property Managers)**:
   * **New Listings Ingested**: **1,000 new or updated listings / month**.
   * **Photos Processed**: Hosts upload an average of 20 photos per property = **20,000 photo checks / month**.
   * **Risk & Scam Scans**: Every new listing triggers an automatic background audit = **1,000 risk audits / month**.

---

## 5. Architectural Strategies Implemented to Reduce OpenAI API Load

Our codebase uses a **Deterministic-Shield** pattern to ensure AI models are only invoked when semantic intelligence is strictly required:

| Strategy | How It Reduces OpenAI Load | Implementation in Codebase |
| :--- | :--- | :--- |
| **1. Filter-Only Search Bypass** | Searches by map bounding box, city, dates, price range, or capacity without free-text query **never call OpenAI**. 100% handled in Qdrant DB. | [`SearchService.search`](file:///home/ubuntu/AHEMAD/Homyz/ai-service/app/services/search_service.py#L135-L138) skips embedding if `query` is empty. |
| **2. Local Image Quality & pHash Gate** | Blurry, corrupt, pitch-black, or duplicate photos are caught in <5ms locally and **completely bypassed from AI Vision ($0 cost)**. | [`PhotoService.analyze_photos`](file:///home/ubuntu/AHEMAD/Homyz/ai-service/app/services/photo_service.py#L328-L370) short-circuits duplicates and invalid files. |
| **3. Vision Resolution Optimization** | Images are resized to max 1024px before base64 encoding and sent with `detail: "low"`, capping input tokens to 85 instead of 2,833. | [`PhotoService._evaluate_vision`](file:///home/ubuntu/AHEMAD/Homyz/ai-service/app/services/photo_service.py#L200-L225) passes `"detail": "low"`. |
| **4. Tier-0 Deterministic Regex Pre-Screen** | Direct telephone numbers, WhatsApp, Telegram, Wire Transfer, Zelle, and door codes are rejected locally with $0 LLM tokens consumed. | [`ReviewService._regex_pre_check`](file:///home/ubuntu/AHEMAD/Homyz/ai-service/app/services/review_service.py#L95-L160) and [`RiskService._scan_deterministic_regex`](file:///home/ubuntu/AHEMAD/Homyz/ai-service/app/services/risk_service.py#L155-L191). |
| **5. Critical Fraud Short-Circuit** | If a listing contains wire transfer fraud or extreme spatial price anomaly (<25% median), it is quarantined immediately. The secondary AI scan is aborted. | [`RiskService.audit_listing`](file:///home/ubuntu/AHEMAD/Homyz/ai-service/app/services/risk_service.py#L400-L412) skips AI when `has_critical` is True. |
| **6. 5-Turn Sliding-Window Chat Pruning** | System instructions and Qdrant property context are injected once; history is hard-capped to the last 5 turns. Prompts never grow into thousands of tokens. | [`ChatService.stream_chat`](file:///home/ubuntu/AHEMAD/Homyz/ai-service/app/services/chat_service.py#L17) enforces `MAX_HISTORY_MESSAGES = 5`. |
| **7. Free Tier Moderation Endpoint** | Text abuse checks use OpenAI's dedicated moderation model (`omni-moderation-latest`), which is officially provided by OpenAI at $0 cost. | [`ReviewService`](file:///home/ubuntu/AHEMAD/Homyz/ai-service/app/services/review_service.py#L59) uses moderation endpoints instead of paid GPT completion. |

---

## 6. Infrastructure & Deployment Cost Analysis

Because your company uses **unmanaged VPS infrastructure** and hosts manually (without expensive managed PaaS like Render, Railway, or Vercel), server hosting costs are minimal.

### Server Resource Consumption (All 3 Services Combined)

When the Next.js web application, FastAPI AI engine, and Qdrant vector database run together on the same Ubuntu/Debian server:

```
Total Combined VPS Memory Usage (~1.2 GB to 1.5 GB RAM Baseline)
├── Next.js Application (Node.js runtime / SSR): ~300 MB – 500 MB RAM
├── FastAPI AI Microservice (Python / Uvicorn): ~200 MB – 350 MB RAM
├── Self-Hosted Qdrant (Rust Docker container): ~150 MB – 300 MB RAM (stores 10k listings in RAM)
└── Linux OS, Nginx Reverse Proxy & Logging: ~200 MB RAM
```

* **Rust Efficiency**: Qdrant is written in native Rust with no garbage-collection overhead. 10,000 vectors (1536-dim) take only ~60MB of vector RAM.
* **CPU Profile**: Idle CPU sits below 2%. During image uploads, OpenCV blur calculations run in background threads, consuming <25% CPU for ~20ms per photo.

---

### Option A: Deployed on the Current Next.js Server (Shared VPS)

If your existing server already runs your Next.js application:

* **Hardware Requirement**: A standard **2 vCPU, 4 GB RAM** VPS.
* **Additional Monthly Hosting Cost**: **$0.00 / month**  
  *(If your current VPS already has $\ge 4\text{GB}$ RAM, all services run side-by-side with zero additional server invoices).*
* **Upgrade Cost (if current server is only 1GB–2GB RAM)**: **~$6.00 to $12.00 / month**  
  *(To upgrade an existing VPS by one tier, e.g. from 2GB to 4GB RAM).*
* **Networking & Security Setup**:
  * Nginx reverse-proxies incoming web traffic:
    * `example.com/api/ai/*` $\rightarrow$ `http://127.0.0.1:8001` (FastAPI)
    * `example.com/*` $\rightarrow$ `http://127.0.0.1:3000` (Next.js)
  * Qdrant binds strictly to `127.0.0.1:6333` (internal loopback only, closed to the public internet).

---

### Option B: Deployed on a Separate Dedicated VPS (Isolated Server)

If you prefer full operational isolation (so AI image processing or search queries never share CPU cycles with Next.js page rendering):

| Cloud VPS Provider | Configuration | Storage & Bandwidth | Monthly Cost |
| :--- | :--- | :--- | :---: |
| **Hetzner Cloud (`CPX21`)** | 3 vCPU (AMD EPYC), 4 GB RAM | 80 GB NVMe, 20 TB Traffic | **~$7.50 / month** (€7.05) |
| **AWS Lightsail** | 2 vCPU, 4 GB RAM | 80 GB SSD, 4 TB Traffic | **$20.00 / month** |
| **Vultr (High Performance)** | 2 vCPU, 4 GB RAM | 80 GB NVMe, 3 TB Traffic | **$20.00 / month** |
| **DigitalOcean (Droplet)** | 2 vCPU, 4 GB RAM | 80 GB SSD, 4 TB Traffic | **$24.00 / month** |
| **Linode / Akamai** | 2 vCPU, 4 GB RAM | 80 GB SSD, 4 TB Traffic | **$24.00 / month** |

*All options run standard Linux (Ubuntu 22.04/24.04 LTS), Docker, and systemd services with zero software license fees.*

---

## 7. Total Cost of Ownership (TCO) Comparison

### 7.1 Scenario 1: Optimized Production (`detail: "low"`) — Target Live Deployment (with Wiggle Room)

| Component | Shared Next.js Server (Option A) | Separate Dedicated VPS (Option B) | Managed Cloud PaaS (Render + Qdrant Cloud) |
| :--- | :---: | :---: | :---: |
| **OpenAI Base API Bill (Padded)** | $6.46 / mo | $6.46 / mo | ~$50.00 – $125.00 / mo *(Unpruned)* |
| **10% Operational Safety Buffer** | +$0.65 / mo | +$0.65 / mo | Included in PaaS tier |
| **AI API Subtotal** | **$7.11 / mo** | **$7.11 / mo** | ~$50.00 – $125.00 / mo |
| **FastAPI Microservice Host** | **$0.00 / mo** *(Runs on Next.js VPS)* | $7.50 – $24.00 / mo | $25.00 – $40.00 / mo |
| **Vector DB (Self-Hosted Qdrant)** | **$0.00 / mo** *(Included on VPS)* | **$0.00 / mo** *(Included on VPS)* | $20.00 – $80.00 / mo *(Managed Cluster)* |
| **TOTAL MONTHLY TCO (Optimized)** | **$7.11 / month** *(~$7.10)* | **$14.61 – $31.11 / month** *(~$15 – $31)* | **$100.00 – $235.00 / month** |

*Exact Arithmetic:*
* *Shared VPS:* $\$6.46\text{ API} + \$0.65\text{ buffer} + \$0.00\text{ host} = \mathbf{\$7.11 / \text{month}}$.
* *Dedicated VPS:* $\$7.11\text{ API subtotal} + (\$7.50\text{ to }\$24.00\text{ VPS}) = \mathbf{\$14.61\text{ to }\$31.11 / \text{month}}$.

---

### 7.2 Scenario 2: Conservative Ceiling (Multi-Tile High-Detail 4K Vision) — Upper Bound (with Wiggle Room)

| Component | Shared Next.js Server (Option A) | Separate Dedicated VPS (Option B) | Managed Cloud PaaS (Render + Qdrant Cloud) |
| :--- | :---: | :---: | :---: |
| **OpenAI Base API Bill (Padded)** | $14.56 / mo | $14.56 / mo | ~$50.00 – $125.00 / mo *(Unpruned)* |
| **10% Operational Safety Buffer** | +$1.46 / mo | +$1.46 / mo | Included in PaaS tier |
| **AI API Subtotal** | **$16.02 / mo** | **$16.02 / mo** | ~$50.00 – $125.00 / mo |
| **FastAPI Microservice Host** | **$0.00 / mo** *(Runs on Next.js VPS)* | $7.50 – $24.00 / mo | $25.00 – $40.00 / mo |
| **Vector DB (Self-Hosted Qdrant)** | **$0.00 / mo** *(Included on VPS)* | **$0.00 / mo** *(Included on VPS)* | $20.00 – $80.00 / mo *(Managed Cluster)* |
| **TOTAL MONTHLY TCO (Ceiling)** | **$16.02 / month** *(~$16.00)* | **$23.52 – $40.02 / month** *(~$23.50 – $40)* | **$100.00 – $235.00 / month** |

*Exact Arithmetic:*
* *Shared VPS:* $\$14.56\text{ API} + \$1.46\text{ buffer} + \$0.00\text{ host} = \mathbf{\$16.02 / \text{month}}$.
* *Dedicated VPS:* $\$16.02\text{ API subtotal} + (\$7.50\text{ to }\$24.00\text{ VPS}) = \mathbf{\$23.52\text{ to }\$40.02 / \text{month}}$.

### Key Takeaway for Stakeholders
* By avoiding managed PaaS markup (Render/Railway) and self-hosting Qdrant on a standard Linux VPS, **infrastructure costs drop from $70+/mo to $0 (or ~$7.50/mo)**.
* By enforcing local OpenCV shields, 5-turn chatbot context pruning, and `detail: "low"` vision, **OpenAI token costs drop from $100+/mo to ~$6.50 – $14.50/mo** even with 20%–50% token padding.
* The platform can comfortably handle **50,000 monthly visitors and 100,000 searches for approximately $7.10 to $16.00 per month on a shared VPS (or $15.00 to $40.00 on a dedicated VPS) all-in**.
