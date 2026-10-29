# Photo Analysis & Categorization API — Frontend Integration Guide

This document is the complete API specification and integration reference for the **Photo Analysis & Categorization Engine** (`POST /api/v1/photos/analyze`). It contains everything required to connect your frontend listing onboarding, photo upload, and gallery management workflows to the AI service.

---

## 1. Overview & Key Capabilities

When a host uploads listing photos, this endpoint analyzes the photo batch in parallel to:
1. **Automatic Room Categorization**: Automatically categorizes images into accommodation spaces (`Living Room`, `Bedroom`, `Kitchen`, `Bathroom`, `Balcony/Patio`, etc.).
2. **Room Assignments**: Groups photo URLs by category so you can immediately render tabbed room filters and galleries.
3. **Smart Cover Photo Recommendation**: Evaluates photo quality, aesthetics, and room types to recommend the best primary hero/cover photo.
4. **Content Validation & Non-Property Detection**: Flags non-property media (e.g., memes, receipts, documents, selfies, random objects) and excludes them from listing room catalogs.
5. **Quality & Defect Flagging**: Flags blurry, dark/overexposed, low-resolution, and duplicate photos.
6. **Host-Facing Feedback Tips**: Delivers actionable suggestions to help hosts improve photo quality and listing conversion.

---

## 2. Endpoint Specification

| Property | Details |
| :--- | :--- |
| **HTTP Method** | `POST` |
| **Path** | `/api/v1/photos/analyze` |
| **Content-Type** | `application/json` |
| **Authentication** | `X-API-Key: <API_KEY_SECRET>` (Header) |
| **Batch Size** | 1 to 50 image URLs per request |

### Request Headers
```http
POST /api/v1/photos/analyze HTTP/1.1
Host: <API_BASE_URL>
Content-Type: application/json
X-API-Key: <YOUR_INTERNAL_API_KEY>
```

---

## 3. TypeScript Interfaces & DTOs

You can directly copy and paste these TypeScript interfaces into your frontend project:

```typescript
export interface PhotoScores {
  /** Lighting score from 1 (dim/blown out) to 10 (balanced natural light) */
  lighting: number;
  /** Composition score from 1 (cluttered/crooked) to 10 (well-staged/straight) */
  composition: number;
  /** Composite aesthetic rating from 1.0 to 10.0 */
  overall_aesthetic: number;
}

export interface PhotoFlags {
  /** True if the photo is blurry or out of focus */
  is_blurry: boolean;
  /** True if this photo is an identical or near-identical duplicate of an earlier photo in the batch */
  is_duplicate: boolean;
  /** If is_duplicate is true, contains the URL of the original photo */
  duplicate_of: string | null;
  /** True if the photo is NOT an accommodation room or guest amenity (e.g. meme, receipt, selfie, object) */
  is_non_property: boolean;
  /** True if the photo has defects (blurry, corrupt, pitch-black, low resolution, or aesthetic < 5.0) */
  poor_quality: boolean;
}

export type ValidRoomType =
  | 'Living Room'
  | 'Bedroom'
  | 'Bathroom'
  | 'Kitchen'
  | 'Balcony/Patio'
  | 'Dining Room'
  | 'Exterior/Entrance'
  | 'Amenities/Pool'
  | 'Other';

export interface PhotoItemResult {
  /** Original image URL */
  url: string;
  /** Categorized room type, or null if non-property or unreadable */
  room_type: ValidRoomType | null;
  /** True if this photo is recommended as the listing cover photo */
  is_recommended_cover: boolean;
  /** Quality and aesthetic scores, or null if non-property, corrupt, or duplicate */
  scores: PhotoScores | null;
  /** Quality and defect flags */
  flags: PhotoFlags;
  /** Actionable tips for the host to improve the photo (empty if high quality) */
  feedback_tips: string[];
}

export interface PhotoAnalysisRequest {
  /** Unique listing identifier */
  listing_id: string;
  /** Array of public HTTP/HTTPS image URLs to analyze (1 to 50 items) */
  photos: string[];
}

export interface PhotoAnalysisResponse {
  /** Listing identifier */
  listing_id: string;
  /** Total number of photos processed */
  processed_count: number;
  /** URL of the recommended primary cover photo, or null if no photo qualified */
  recommended_cover_photo: string | null;
  /** Mapping of room categories to image URLs (only genuine property rooms) */
  room_assignments: Record<string, string[]>;
  /** Detailed analysis results for each photo, in the original submission order */
  photos: PhotoItemResult[];
}

export interface APIErrorResponse {
  code: string;
  detail: string;
}
```

---

## 4. Request Payload

### Schema
```json
{
  "listing_id": "string (min_length: 1)",
  "photos": [
    "string (valid http/https image URL)"
  ]
}
```

### Constraints
* `photos` array must contain between **1 and 50 URLs**.
* Duplicate URLs in the request array are automatically deduplicated while preserving order.
* Images must be accessible via public HTTP or HTTPS URLs (e.g., S3, Cloudinary, Supabase Storage, CDN).

---

## 5. Response Payload & Field Rules

### 5.1 `recommended_cover_photo` (`string | null`)
The cover photo recommendation is **optional** and is **not mandatory**:
* **When populated (`string`)**: Points to the highest-scoring, well-lit, non-blurry, genuine property photo (prioritizing `Living Room`, `Exterior/Entrance`, `Bedroom`, or `Amenities/Pool`).
* **When `null`**: Returns `null` if no photo in the batch meets quality standards, or if the batch contains only bathrooms, duplicates, corrupt files, or non-property media.
* **Anti-Bathroom Rule**: Bathrooms are **never** recommended as cover photos, as travelers dislike seeing toilets or bathrooms as primary search card thumbnails.
* **`is_recommended_cover`**: The photo matching `recommended_cover_photo` has `is_recommended_cover: true`; all other photos have `is_recommended_cover: false`. If `recommended_cover_photo` is `null`, all photos have `is_recommended_cover: false`.

### 5.2 `room_assignments` (`Record<string, string[]>`)
* Contains grouped arrays of photo URLs keyed by their categorized room type.
* **Strict Accommodation Scope**: Only genuine accommodation spaces (`Living Room`, `Bedroom`, `Kitchen`, `Bathroom`, etc.) are included.
* Non-property media, unreadable photos, and duplicates are **automatically excluded** from `room_assignments`, keeping your listing catalog clean.

### 5.3 `scores` (`PhotoScores | null`)
* **When populated (`PhotoScores`)**: Contains `lighting` (1–10), `composition` (1–10), and composite `overall_aesthetic` (1.0–10.0).
* **When `null`**: `scores` is `null` when:
  * `is_non_property: true` (evaluating lighting/composition on a meme, selfie, or receipt is meaningless).
  * `is_duplicate: true` (redundant image).
  * Image download failed or file is corrupt.
  * Image is pitch-black.

### 5.4 `flags` (`PhotoFlags`)
* `is_blurry`: `true` if camera shake or out-of-focus blur was detected.
* `is_duplicate`: `true` if an identical or near-identical image exists earlier in the batch. `duplicate_of` will contain the URL of the first occurrence.
* `is_non_property`: `true` if the photo depicts documents, screenshots, receipts, selfies, memes, or non-accommodation objects.
* `poor_quality`: `true` if any defect exists (blurry, corrupt, pitch-black, low resolution $<400\times400\text{px}$, or overall aesthetic $<5.0$).

### 5.5 `feedback_tips` (`string[]`)
* Concise, actionable host advice (e.g., *"Photo is out of focus or motion-blurred"*, *"Lighting is dim. Retake with natural daylight"*, *"Extreme aspect ratio detected. Consider standard landscape (4:3 or 16:9)"*).
* For non-property images, returns: `"This photo does not appear to portray accommodation spaces or amenities. Please upload genuine property photos."`
* Empty array (`[]`) if the photo is already high quality.

---

## 6. Complete Response Examples

### Example 1: Standard Listing Upload (Mixed Rooms)

#### Request:
```json
{
  "listing_id": "listing_ocean_view_101",
  "photos": [
    "https://storage.homyz.com/photos/living_room.jpg",
    "https://storage.homyz.com/photos/bedroom.jpg",
    "https://storage.homyz.com/photos/bathroom.jpg"
  ]
}
```

#### Response (`200 OK`):
```json
{
  "listing_id": "listing_ocean_view_101",
  "processed_count": 3,
  "recommended_cover_photo": "https://storage.homyz.com/photos/living_room.jpg",
  "room_assignments": {
    "Living Room": [
      "https://storage.homyz.com/photos/living_room.jpg"
    ],
    "Bedroom": [
      "https://storage.homyz.com/photos/bedroom.jpg"
    ],
    "Bathroom": [
      "https://storage.homyz.com/photos/bathroom.jpg"
    ]
  },
  "photos": [
    {
      "url": "https://storage.homyz.com/photos/living_room.jpg",
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
      "url": "https://storage.homyz.com/photos/bedroom.jpg",
      "room_type": "Bedroom",
      "is_recommended_cover": false,
      "scores": {
        "lighting": 8,
        "composition": 8,
        "overall_aesthetic": 8.0
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
      "url": "https://storage.homyz.com/photos/bathroom.jpg",
      "room_type": "Bathroom",
      "is_recommended_cover": false,
      "scores": {
        "lighting": 7,
        "composition": 7,
        "overall_aesthetic": 7.0
      },
      "flags": {
        "is_blurry": false,
        "is_duplicate": false,
        "duplicate_of": null,
        "is_non_property": false,
        "poor_quality": false
      },
      "feedback_tips": []
    }
  ]
}
```

---

### Example 2: Edge Cases (Non-Property Object, Duplicate, Blurry Photo)

When a host uploads an unrelated object (e.g., a teddy bear), an identical photo twice, and an out-of-focus shot:

#### Request:
```json
{
  "listing_id": "listing_edge_cases",
  "photos": [
    "https://storage.homyz.com/photos/teddy_bear.jpg",
    "https://storage.homyz.com/photos/bedroom_blurry.jpg",
    "https://storage.homyz.com/photos/bedroom_blurry_copy.jpg",
    "https://storage.homyz.com/photos/only_bathroom.jpg"
  ]
}
```

#### Response (`200 OK`):
```json
{
  "listing_id": "listing_edge_cases",
  "processed_count": 4,
  "recommended_cover_photo": null,
  "room_assignments": {
    "Bedroom": [
      "https://storage.homyz.com/photos/bedroom_blurry.jpg"
    ],
    "Bathroom": [
      "https://storage.homyz.com/photos/only_bathroom.jpg"
    ]
  },
  "photos": [
    {
      "url": "https://storage.homyz.com/photos/teddy_bear.jpg",
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
    },
    {
      "url": "https://storage.homyz.com/photos/bedroom_blurry.jpg",
      "room_type": "Bedroom",
      "is_recommended_cover": false,
      "scores": {
        "lighting": 5,
        "composition": 5,
        "overall_aesthetic": 2.5
      },
      "flags": {
        "is_blurry": true,
        "is_duplicate": false,
        "duplicate_of": null,
        "is_non_property": false,
        "poor_quality": true
      },
      "feedback_tips": [
        "Photo is out of focus or motion-blurred. Retake with a steady camera or tripod."
      ]
    },
    {
      "url": "https://storage.homyz.com/photos/bedroom_blurry_copy.jpg",
      "room_type": null,
      "is_recommended_cover": false,
      "scores": null,
      "flags": {
        "is_blurry": true,
        "is_duplicate": true,
        "duplicate_of": "https://storage.homyz.com/photos/bedroom_blurry.jpg",
        "is_non_property": false,
        "poor_quality": true
      },
      "feedback_tips": [
        "Near-identical duplicate photo detected. Consider removing redundant shots."
      ]
    },
    {
      "url": "https://storage.homyz.com/photos/only_bathroom.jpg",
      "room_type": "Bathroom",
      "is_recommended_cover": false,
      "scores": {
        "lighting": 7,
        "composition": 7,
        "overall_aesthetic": 7.0
      },
      "flags": {
        "is_blurry": false,
        "is_duplicate": false,
        "duplicate_of": null,
        "is_non_property": false,
        "poor_quality": false
      },
      "feedback_tips": []
    }
  ]
}
```

---

## 7. Frontend UI Implementation Guidelines

Here are recommended UI patterns to handle the API response cleanly:

### 1. Handling Nullable Scores Safely
Because `scores` is `null` for non-property media, corrupt files, and duplicates, always guard score rendering:
```typescript
if (photo.scores) {
  // Render aesthetic badge / score bars
  console.log(`Rating: ${photo.scores.overall_aesthetic}/10`);
} else if (photo.flags.is_non_property) {
  // Render warning badge: "Non-Property Media"
} else if (photo.flags.is_duplicate) {
  // Render warning badge: "Duplicate Photo"
}
```

### 2. Cover Photo Selection & Fallback
If `recommended_cover_photo` is `null`:
* Do not auto-select an image.
* Display a banner prompt: *"Please upload or select a clear, well-lit photo of your living room or bedroom as the cover photo."*
* When `recommended_cover_photo` is a valid string, you can automatically set that image as the default active cover photo in your form state, while still allowing the host to manually change it.

### 3. Rendering Room Assignment Tabs
`room_assignments` returns a clean map of rooms to photo URLs:
```typescript
Object.entries(response.room_assignments).map(([roomName, photoUrls]) => {
  // Render Tab/Filter Chip: e.g. "Bedroom (3)", "Living Room (2)"
});
```

### 4. Displaying Host Improvement Tips
Render `feedback_tips` directly beneath each photo card in the upload grid:
* If `feedback_tips.length === 0`: Show a subtle green badge (e.g., `✓ High Quality`).
* If `feedback_tips.length > 0`: Show an alert card with the tips and an option to replace/retake.

---

## 8. HTTP Status Codes & Error Responses

| Status Code | Code / Condition | Meaning & Handling |
| :--- | :--- | :--- |
| **`200 OK`** | — | Request succeeded. Full analysis returned. |
| **`400 Bad Request`** | `BAD_REQUEST` | Empty photo list, no valid URLs, or invalid input structure. |
| **`401 Unauthorized`** | `UNAUTHORIZED` | Missing or invalid `X-API-Key` header. |
| **`422 Unprocessable Entity`** | `VALIDATION_ERROR` | Schema validation error (e.g., `photos` contains $>50$ URLs or missing `listing_id`). |
| **`500 Internal Server Error`** | `INTERNAL_SERVER_ERROR` | Server-side unexpected error. |

### Standard Error Payload Format
```json
{
  "code": "BAD_REQUEST",
  "detail": "No valid photo URLs provided in request"
}
```
