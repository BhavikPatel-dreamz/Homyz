# Backend API Documentation: Homyz AI Engine

## 1. Authentication & Common Conventions

### 1.1 Base URL & Headers
* **Base URL**: `http://localhost:8000/api/v1`
* **Authentication**: All requests must include the internal API key in the request header:
  ```http
  X-API-Key: <SECRET_KEY>
  Content-Type: application/json
  ```
* **Currency / Monetary Fields**: All `price` fields are integers denominated in minor units (**cents**, e.g., $150.00 is `15000`).

### 1.2 Error Responses
All error responses return standard JSON:
```json
{
  "code": "BAD_REQUEST",
  "detail": "Description of the validation or processing error."
}
```

| HTTP Status | Error Code | Description |
| :--- | :--- | :--- |
| **400** | `BAD_REQUEST` | Missing or invalid required fields. |
| **401** | `UNAUTHORIZED` | Missing or invalid `X-API-Key` header. |
| **404** | `NOT_FOUND` | Referenced entity (`listing_id`) not found. |
| **422** | `UNPROCESSABLE_ENTITY` | Pydantic payload schema validation failure. |
| **500** | `INTERNAL_SERVER_ERROR` | Internal server or third-party AI provider failure. |

---

## 2. Listing Sync & Management Endpoints

### 2.1 Sync Listing
* **Path**: `POST /listings/sync`
* **Description**: Ingests listing details into Qdrant for semantic search and initial risk auditing.
* **Vector Document vs. Payload**:
  * **Embedded in Vector**: High-signal search signals only (`title`, `property_type`, `listing_type`, `city`, `country`, `amenities`).
  * **Payload Storage**: `description`, `price`, `location`, `guests`, `house_rules` are preserved in Qdrant's payload for filtering, scam audits (Module 5), and Guest Chatbot RAG (Module 4).
* **`is_new_listing` Recommendation**: The caller should send `is_new_listing: listing.reviewsCount === 0 && listing.completedBookingsCount < 3`.

#### Request Body
```json
{
  "listing_id": "string",
  "title": "string",
  "description": "string",
  "price": 15000,
  "city": "string",
  "country": "string",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "guests": 2,
  "bedrooms": 1,
  "beds": 1,
  "bathrooms": 1,
  "property_type": "string",
  "listing_type": "string",
  "amenities": ["Fast Wifi", "Dedicated workspace", "Balcony"],
  "is_guest_favorite": false,
  "is_new_listing": false,
  "house_rules": {
    "check_in_method": "SMART_LOCK",
    "check_in_start": "15:00",
    "check_in_end": "22:00",
    "check_out_time": "11:00",
    "parking_available": true,
    "parking_type": "FREE",
    "parking_instructions": "string",
    "wifi_network": "string",
    "wifi_password": "string",
    "cancellation_policy": "FLEXIBLE",
    "quiet_hours": true,
    "quiet_hours_start": "22:00",
    "quiet_hours_end": "08:00",
    "pets_allowed": false,
    "smoking_allowed": false,
    "additional_rules": "string"
  }
}
```

#### Response (`200 OK`)
```json
{
  "status": "success",
  "listing_id": "string",
  "indexed": true,
  "risk_audit": {
    "risk_score": 8,
    "verdict": "AUTO_APPROVE",
    "is_flagged": false,
    "signals": []
  }
}
```

---

### 2.2 Delete Listing
* **Path**: `DELETE /listings/{listing_id}`
* **Description**: Unindexes and deletes a listing from the Qdrant vector collection when unpublished or deleted on the main platform.

#### Response (`200 OK`)
```json
{
  "status": "deleted",
  "listing_id": "string",
  "deleted": true
}
```

---

## 3. Search & Discovery Endpoints

### 3.1 Search Listings
* **Path**: `POST /search`
* **Description**: Executes semantic vector search with geo-radius, price filtering, and user behavior personalization.

#### Request Body
```json
{
  "query": "quiet cabin with mountain view and fast wifi",
  "city": "string",
  "latitude": 37.7749,
  "longitude": -122.4194,
  "radius_km": 15.0,
  "min_price": 5000,
  "max_price": 25000,
  "guests": 2,
  "positive_listing_ids": ["listing_1", "listing_2"],
  "negative_listing_ids": [],
  "page": 1,
  "page_size": 20
}
```
*(All fields optional except `page` and `page_size`).*

#### Response (`200 OK`)
```json
{
  "total_matches": 42,
  "page": 1,
  "page_size": 20,
  "results": [
    {
      "listing_id": "string",
      "relevance_score": 0.924,
      "price": 15000,
      "is_personalized_boost": true,
      "is_new_listing_boost": false
    }
  ]
}
```

---

## 4. Photo Categorization & Quality Endpoints

### 4.1 Analyze Listing Photos
* **Path**: `POST /photos/analyze`
* **Description**: Evaluates image array for room categories, quality, lighting, blur, duplicates, and recommends cover photo.

#### Request Body
```json
{
  "listing_id": "string",
  "photos": [
    "https://storage.domain.com/photos/image_1.jpg",
    "https://storage.domain.com/photos/image_2.jpg"
  ]
}
```

#### Response (`200 OK`)
```json
{
  "listing_id": "string",
  "processed_count": 3,
  "recommended_cover_photo": "https://storage.domain.com/photos/image_1.jpg",
  "room_assignments": {
    "Living Room": ["https://storage.domain.com/photos/image_1.jpg"],
    "Bathroom": ["https://storage.domain.com/photos/image_2.jpg"]
  },
  "photos": [
    {
      "url": "https://storage.domain.com/photos/image_1.jpg",
      "room_type": "Living Room",
      "is_recommended_cover": true,
      "scores": {
        "lighting": 9,
        "composition": 9,
        "overall_aesthetic": 9.0
      },
      "flags": {
        "is_blurry": false,
        "is_duplicate": false,
        "duplicate_of": null,
        "is_non_property": false,
        "poor_quality": false
      },
      "feedback_tips": []
    },
    {
      "url": "https://storage.domain.com/photos/image_2.jpg",
      "room_type": "Bathroom",
      "is_recommended_cover": false,
      "scores": {
        "lighting": 4,
        "composition": 5,
        "overall_aesthetic": 4.6
      },
      "flags": {
        "is_blurry": true,
        "is_duplicate": false,
        "duplicate_of": null,
        "is_non_property": false,
        "poor_quality": true
      },
      "feedback_tips": [
        "Photo is out of focus or motion-blurred.",
        "Lighting is dim. Consider retaking with natural daylight."
      ]
    },
    {
      "url": "https://storage.domain.com/photos/non_property.jpg",
      "room_type": null,
      "is_recommended_cover": false,
      "scores": null,
      "flags": {
        "is_blurry": false,
        "is_duplicate": false,
        "duplicate_of": null,
        "is_non_property": true,
        "poor_quality": true
      },
      "feedback_tips": [
        "This photo does not appear to portray accommodation spaces or amenities. Please upload genuine property photos."
      ]
    }
  ]
}
```
*(Notes: `recommended_cover_photo` is optional and returns `null` if no uploaded photo qualifies. For non-property, duplicate, pitch-black, or corrupt images, `scores` and `room_type` are `null` to avoid misleading ratings and prevent non-property media from polluting `room_assignments`).*

---

## 5. Review Filtering & Summarization Endpoints

### 5.1 Moderate Review
* **Path**: `POST /reviews/moderate`
* **Description**: Real-time safety audit for guest and host reviews. Checks for personal attacks, hate speech, severe profanity, violence, physical security disclosures (door keypad codes, lockbox combos), off-platform contact solicitation (phone numbers, WhatsApp, emails, external payment handles, social handles), and review extortion / blackmail.
* **Cost Optimization ($0 AI Cost)**:
  * **Empty / Star-Only Reviews**: Submissions with empty comments (`comment: ""`) immediately return an unflagged verdict without calling the LLM.
  * **Deterministic Regex Pre-Filter**: Obvious phone, email, WhatsApp, or lockbox pattern hits are rejected immediately before LLM invocation.
* **Safety Filter Fault-Tolerance**: If extreme violations trigger upstream Gemini safety blocks (`FinishReason.SAFETY`), the service gracefully captures the event and returns a definitive flagged verdict instead of a 500 server error.

#### Request Body
```json
{
  "review_id": "rev_clx001",
  "listing_id": "list_9901",
  "comment": "Spotless and cozy! Host was super fast to reply.",
  "direction": "GUEST_TO_PROPERTY"
}
```
*(Notes: `comment` has a hard limit of **1,000 characters maximum**. An empty string `""` is allowed for rating-only reviews. `direction` defaults to `"GUEST_TO_PROPERTY"`).*

#### Response (`200 OK` - Clean Review)
```json
{
  "review_id": "rev_clx001",
  "is_flagged": false,
  "confidence_score": 0.99,
  "rejection_reason": null,
  "moderation_notes": null,
  "toxicity_categories": {
    "harassment": false,
    "hate_speech": false,
    "profanity": false,
    "sexual": false,
    "violence": false,
    "security_violation": false
  },
  "contains_contact_info": false,
  "is_extortion": false
}
```

#### Response (`200 OK` - Flagged Violation Example)
```json
{
  "review_id": "rev_clx002",
  "is_flagged": true,
  "confidence_score": 0.98,
  "rejection_reason": "Off-platform contact solicitation",
  "moderation_notes": "Contains external phone number / WhatsApp pattern.",
  "toxicity_categories": {
    "harassment": false,
    "hate_speech": false,
    "profanity": false,
    "sexual": false,
    "violence": false,
    "security_violation": false
  },
  "contains_contact_info": true,
  "is_extortion": false
}
```

---

### 5.2 Summarize Listing Reviews
* **Path**: `POST /reviews/summarize`
* **Description**: Extracts ratings across the 6 standard Airbnb dimensions on a **1.0 to 5.0 scale** (strictly matching Homyz Next.js Prisma & React UI schema) and synthesizes an objective review summary.
* **Adaptive Summarization**:
  * **Ultra-Sparse Reviews (1–2 reviews)**: Produces a concise factual summary and strictly extracted highlights without hallucinating unmentioned amenities.
  * **Standard Reviews (3–50 reviews)**: Produces an objective 3-sentence narrative synthesis, 2–3 positive highlights, and constructive considerations (or empty `[]` if flawless).

#### Request Body
```json
{
  "listing_id": "list_9901",
  "reviews": [
    "Spotless apartment! The bed was very comfortable and check-in was seamless.",
    "Host responded in under 5 minutes when we had a question about wifi. Great location near subway."
  ],
  "language": "en"
}
```
*(Notes: `reviews` accepts 1 to 50 items. Each review comment must not exceed **1,000 characters**. `language` is optional and defaults to `"en"`).*

#### Response (`200 OK`)
```json
{
  "listing_id": "list_9901",
  "total_reviews_analyzed": 2,
  "aspect_ratings": {
    "cleanliness": 4.9,
    "accuracy": 4.8,
    "check_in": 5.0,
    "communication": 5.0,
    "location": 4.7,
    "value": 4.8
  },
  "summary": "Guests consistently praise the pristine cleanliness, exceptionally responsive host, and seamless check-in. The location offers convenient transit access.",
  "highlights": [
    "Spotless cleanliness and comfortable bedding",
    "Host responds in under 5 minutes",
    "Convenient transit access"
  ],
  "considerations": []
}
```
*(Notes: `aspect_ratings` supports both snake_case `check_in` and camelCase `checkIn` aliases for seamless client interoperability. All aspect ratings are calibrated strictly between **1.0 and 5.0**).*

#### TypeScript DTOs
```typescript
export interface ReviewModerationRequest {
  review_id: string;
  listing_id: string;
  comment?: string; // Max 1,000 characters; empty string allowed
  direction?: "GUEST_TO_PROPERTY" | "HOST_TO_GUEST";
}

export interface ReviewToxicityCategories {
  harassment: boolean;
  hate_speech: boolean;
  profanity: boolean;
  sexual: boolean;
  violence: boolean;
  security_violation: boolean;
}

export interface ReviewModerationResponse {
  review_id: string;
  is_flagged: boolean;
  confidence_score: number; // 0.0 - 1.0
  rejection_reason: string | null;
  moderation_notes: string | null;
  toxicity_categories: ReviewToxicityCategories;
  contains_contact_info: boolean;
  is_extortion: boolean;
}

export interface ReviewSummarizeRequest {
  listing_id: string;
  reviews: string[]; // 1 to 50 items, max 1,000 chars per item
  language?: string;
}

export interface ReviewAspectRatings {
  cleanliness: number; // 1.0 - 5.0
  accuracy: number;    // 1.0 - 5.0
  check_in: number;    // 1.0 - 5.0 (also aliased as checkIn)
  communication: number; // 1.0 - 5.0
  location: number;    // 1.0 - 5.0
  value: number;       // 1.0 - 5.0
}

export interface ReviewSummarizeResponse {
  listing_id: string;
  total_reviews_analyzed: number;
  aspect_ratings: ReviewAspectRatings;
  summary: string;
  highlights: string[];
  considerations: string[];
}
```

---

## 6. Guest Support Chatbot Endpoint

### 6.1 Streaming Support Chatbot
* **Path**: `POST /chat`
* **Description**: Support assistant for guests. If `listing_id` is provided, pulls property house rules from vector space; if omitted, answers general platform questions. Stateless: caller passes conversational history.
* **Headers Required**:
  ```http
  Accept: text/event-stream
  X-API-Key: <SECRET_KEY>
  Content-Type: application/json
  ```

#### Request Body
```json
{
  "message": "Hi, what time is check-in, and can I park a full-size SUV?",
  "listing_id": "string",
  "conversation_history": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help you today?" }
  ]
}
```
*(Note: `listing_id` and `conversation_history` are optional).*

#### Streaming Response (`200 OK` - `text/event-stream`)
```text
data: {"token": "Hello! "}

data: {"token": "Check-in starts at 3:00 PM. "}

data: {"token": "Yes, you can park your SUV—there is 1 free dedicated space that fits full-size SUVs."}

data: {"done": true, "suggested_quick_replies": ["Where is the nearest grocery store?", "What is the wifi password?"]}
```

---

## 7. Fake Listing & Risk Audit Endpoints

### 7.1 Audit Listing for Fraud
* **Path**: `POST /risk/audit-listing`
* **Description**: Scans listing pricing against neighborhood median and checks text for scam patterns.

#### Request Body
```json
{
  "listing_id": "string",
  "title": "string",
  "description": "string",
  "price": 3500,
  "capacity": 6,
  "city": "Miami",
  "latitude": 25.7617,
  "longitude": -80.1918
}
```

#### Response (`200 OK`)
```json
{
  "listing_id": "string",
  "risk_score": 95,
  "verdict": "FLAG_FOR_MANUAL_AUDIT",
  "is_flagged": true,
  "signals": [
    {
      "signal_type": "PRICE_ANOMALY",
      "severity": "HIGH",
      "details": "Price is 82% below neighborhood median for this capacity."
    },
    {
      "signal_type": "OFF_PLATFORM_SOLICITATION",
      "severity": "CRITICAL",
      "details": "Description explicitly requests off-platform communication and direct wire transfer."
    }
  ],
  "recommendation": "Block publishing until host completes identity verification and manual review."
}
```
