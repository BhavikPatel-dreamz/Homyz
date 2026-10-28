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

## 2. Search & Ranking Endpoints

### 2.1 Sync Listing
* **Path**: `POST /listings/sync`
* **Description**: Ingests listing details into vector space for semantic search and executes initial fraud audit.

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

### 2.2 Search Listings
* **Path**: `POST /search`
* **Description**: Executes semantic vector search with geo-radius and price filtering.

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
  "session_id": "string",
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

### 2.3 Track In-Session Click
* **Path**: `POST /sessions/track-click`
* **Description**: Tracks clicks in active browsing session to enable real-time re-ranking.

#### Request Body
```json
{
  "session_id": "string",
  "listing_id": "string"
}
```

#### Response (`200 OK`)
```json
{
  "status": "tracked",
  "session_id": "string",
  "active_history_count": 3
}
```

---

## 3. Photo Categorization & Quality Endpoints

### 3.1 Analyze Listing Photos
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
  "processed_count": 2,
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
        "poor_quality": true
      },
      "feedback_tips": [
        "Photo is out of focus or motion-blurred.",
        "Lighting is dim. Consider retaking with natural daylight."
      ]
    }
  ]
}
```

---

## 4. Review Filtering & Summarization Endpoints

### 4.1 Moderate Review
* **Path**: `POST /reviews/moderate`
* **Description**: Scans review for abuse, hate speech, contact info solicitation, and extortion.

#### Request Body
```json
{
  "review_id": "string",
  "listing_id": "string",
  "comment": "string"
}
```

#### Response (`200 OK`)
```json
{
  "review_id": "string",
  "is_flagged": true,
  "confidence_score": 0.98,
  "rejection_reason": "Off-platform contact solicitation",
  "moderation_notes": "Contains external phone number / WhatsApp pattern.",
  "toxicity_categories": {
    "harassment": false,
    "hate_speech": false,
    "profanity": false,
    "sexual": false,
    "violence": false
  },
  "contains_contact_info": true,
  "is_extortion": false
}
```

---

### 4.2 Summarize Listing Reviews
* **Path**: `POST /reviews/summarize`
* **Description**: Extracts 1–10 aspect ratings and generates a 3-sentence summary for a listing.

#### Request Body
```json
{
  "listing_id": "string",
  "reviews": [
    "Spotless apartment! The bed was very comfortable and check-in was seamless.",
    "Host responded in under 5 minutes when we had a question about wifi. Great location near subway."
  ]
}
```

#### Response (`200 OK`)
```json
{
  "listing_id": "string",
  "total_reviews_analyzed": 2,
  "aspect_ratings": {
    "cleanliness": 9.8,
    "accuracy": 9.6,
    "check_in": 9.9,
    "communication": 10.0,
    "location": 9.2,
    "value": 9.4
  },
  "summary": "Guests consistently praise the pristine cleanliness, exceptionally responsive host, and seamless check-in. The location offers easy transit access.",
  "highlights": [
    "Spotless cleanliness and comfortable bedding",
    "Host responds in under 5 minutes",
    "Convenient transit access"
  ],
  "considerations": [
    "Mild weekend street noise"
  ]
}
```

---

## 5. Guest Support Chatbot Endpoint

### 5.1 Streaming Support Chatbot
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

## 6. Fake Listing & Risk Audit Endpoints

### 6.1 Audit Listing for Fraud
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
