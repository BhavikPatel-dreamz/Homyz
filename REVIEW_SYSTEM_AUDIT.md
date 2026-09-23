# Homyz Review System — Comprehensive Audit

**Status:** ❌ **Review system is NOT implemented**  
**Last Updated:** September 22, 2026  
**Scope:** Guest reviews and ratings on single property listings

---

## Executive Summary

The Homyz platform currently has **NO guest review system**. While the property card component displays `rating` and `reviewCount` fields, and host permissions for reviewing are defined, there is no:
- Database Review model
- Review service or repository
- Review API endpoints
- Review display components (only a placeholder placeholder)
- Review submission flow
- Rating calculation from reviews

The single property page has an **explicit placeholder** stating: *"No property review model or public review API exists yet."*

---

## 1. Database Models/Schema Analysis

**File:** [prisma/schema.prisma](prisma/schema.prisma)

### ❌ Missing Models

No Review or Rating model exists in the schema.

### ✅ Related Models (Foundation)

```
User                    → publicProfile (JSON, can store ratings data)
Listing                 → id, hostId, published, status
Booking                 → userId, listingId, status, createdAt
```

**Note:** Admin review concepts exist (`PENDING_REVIEW`, `IN_REVIEW`, etc.) but these are for listing approval, not guest feedback.

---

## 2. Review Service/Repository

**Expected File:** `services/review.service.ts` (DOES NOT EXIST)

### ✅ Existing Related Services

| Service | File | Purpose |
|---------|------|---------|
| **listing.service** | `services/listing.service.ts` | Listing CRUD, public listing queries |
| **booking.service** | `services/booking.service.ts` | Booking flow, quote calculation |
| **qualification.service** | `services/qualification.service.ts` | Guest Favorite/Superhost badge logic |
| **guidebook.service** | `services/guidebook.service.ts` | Host guidebooks (local tips) |

### ❌ Missing Service Methods

Would need:
- `createReview(userId, listingId, booking, rating, text)`
- `updateReview(reviewId, rating, text)`
- `deleteReview(reviewId)`
- `getReviewsForListing(listingId)`
- `getReviewsByGuest(userId)`
- `getReviewStats(listingId)` → avg rating, total count
- `createHostResponse(reviewId, responseText)`
- `getApprovedReviewsForListing(listingId, pagination)`

---

## 3. API Endpoints

**Base Path:** `app/api/v1/`

### ✅ Existing Listing Endpoints

- `GET /api/v1/listings` — Public listings search
- `GET /api/v1/listings/:id` — Single listing detail
- `POST /api/v1/listings` — Create listing (host)
- `PATCH /api/v1/listings/:id` — Update listing
- `GET /api/v1/hosts/listings` — Host's listings

### ❌ Missing Review Endpoints

Would need:
- `POST /api/v1/listings/:id/reviews` — Submit review (guest + must have completed booking)
- `GET /api/v1/listings/:id/reviews` — List reviews for property
- `PATCH /api/v1/reviews/:id` — Update own review
- `DELETE /api/v1/reviews/:id` — Delete own review
- `GET /api/v1/reviews/:id` — Get single review detail
- `POST /api/v1/reviews/:id/responses` — Host responds to review (with permission check)
- `GET /api/v1/hosts/reviews` — All reviews received by host
- `GET /api/v1/guests/reviews` — All reviews submitted by guest

---

## 4. Review-Related Components

**Expected Location:** `components/listings/review-*` or `components/reviews/`

### ❌ Missing Components

- `ReviewForm` — Submit new review (rating + text input)
- `ReviewCard` — Display single review with guest name, date, rating, text, host response
- `ReviewList` — Paginated list of reviews
- `ReviewStats` — Rating distribution (4.5★ 120 reviews, % breakdown by star)
- `ReviewFilters` — Sort/filter by rating, helpful count, date
- `HostReviewResponse` — Host response display + edit modal
- `ReviewPhotos` — Guest can attach photos to review

### ✅ Related Components (Existing)

- `PropertyCard` — Shows rating badges but no review data
- `PublicListingDetailClient` — Container for single property page

---

## 5. Single Property Listing Page Components & Sections

**File:** [app/listings/[id]/public-listing-detail-client.tsx](app/listings/[id]/public-listing-detail-client.tsx)  
**Lines:** 1,273  
**Layout:** Grid (7 cols left content + 5 cols right booking widget)

### Current Sections (Rendered)

| # | Section | Status | Lines | Notes |
|---|---------|--------|-------|-------|
| 1 | **Header** (location, badges) | ✅ | 600-650 | Shows Guest Favorite, Superhost, Featured badges |
| 2 | **Photo Gallery** | ✅ | 660-680 | ListingGallery component, lightbox, lazy loading |
| 3 | **Property Summary** | ✅ | 690-720 | Listing type, guests, beds, baths, host avatar |
| 4 | **Property Highlights** | ✅ | 730-750 | "✨ Highlights" tags (max 3 from listing.highlights[]) |
| 5 | **Sleeping Arrangements** | ✅ | 760-800 | Rooms breakdown with bed counts |
| 6 | **Amenities** | ✅ | 810-840 | CANONICAL_AMENITIES displayed, "Show all" modal |
| 7 | **Availability Calendar** | ✅ | 850-870 | Month calendar, booked ranges, date selection |
| 8 | **Guest Reviews** | ❌ | **822-828** | **PLACEHOLDER ONLY** |
| 9 | **House Rules** | ✅ | 835-875 | Check-in/out times, pets, smoking, quiet hours, custom rules |
| 10 | **Cancellation Policy** | ✅ | 880-890 | Short-stay vs long-stay policies |
| 11 | **Safety & Property** | ✅ | 895-920 | Safety equipment, hazards, disclosures |
| 12 | **Location & Map** | ✅ | 925-960 | Address, map section, Google Maps link |
| 13 | **About the Host** | ✅ | 970-1050 | Host profile info, guidebooks list, co-host badge |
| 14 | **Booking Widget** | ✅ | Right sidebar | Date picker, guest count, price breakdown, reserve button |

### Reviews Placeholder Code

**Location:** [app/listings/[id]/public-listing-detail-client.tsx#L822-L828](app/listings/[id]/public-listing-detail-client.tsx#L822-L828)

```tsx
{/* No property review model or public review API exists yet. Do
    not mislabel host-profile metrics as reviews for this stay. */}
<section className="space-y-2 border-b border-zinc-200/80 pb-6" aria-labelledby="guest-reviews-heading">
  <h3 id="guest-reviews-heading" className="text-base font-bold text-zinc-900">Guest reviews</h3>
  <p className="text-xs leading-relaxed text-zinc-600">This property has no guest reviews yet.</p>
</section>
```

---

## 6. Rating Calculation Logic

**File:** [services/qualification.service.ts](services/qualification.service.ts)

### ✅ Implemented Qualification Formulas

#### Guest Favorite Badge Formula

```typescript
interface GuestFavoriteListingInput {
  isFeatured?: boolean;
  rating?: number | string | null;              // ← expects this
  reviewCount?: number | null;                  // ← expects this
  bookings?: Array<{ status: string }>;
  confirmedBookingCount?: number;
}

export function isGuestFavorite(property): boolean {
  // Requires EITHER:
  // 1. rating >= 4.85 AND (reviewCount >= 3 OR confirmedBookings >= 2)
  // 2. isFeatured === true AND confirmedBookings >= 1
}
```

**Config:** [services/qualification.service.ts#L23-L37](services/qualification.service.ts#L23-L37)
```typescript
minRating: 4.85
minReviews: 3
minConfirmedBookings: 2
allowFeaturedWithConfirmedBookings: true
```

#### Superhost Badge Formula

```typescript
interface SuperhostHostInput {
  id?: string;
  createdAt?: Date | string | null;
  publicProfile?: Record<string, unknown> | null;
  bookings?: Array<{ status: string }>;
  bookingSummary?: { confirmed: number; cancelled: number };
}

export function isSuperhost(host): boolean {
  // Requires:
  // 1. rating >= 4.8
  // 2. completedBookings >= 3
  // 3. cancellationRate < 5%
  // 4. tenure >= 30 days
}
```

**Config:** [services/qualification.service.ts#L38-L46](services/qualification.service.ts#L38-L46)
```typescript
minRating: 4.8
minCompletedBookings: 3
maxCancellationRate: 0.05  // 5%
minTenureDays: 30
```

### ⚠️ Problem

These formulas **expect `rating` and `reviewCount` to exist**, but:
- ❌ No Review model to calculate rating from
- ❌ No aggregate review count calculated
- ❌ Qualification logic is implemented but data source is missing

---

## 7. Review Display Components

**Expected Location:** `components/listings/` or `app/listings/[id]/`

### ❌ Missing Components

1. **ReviewList**
   - Paginated display of approved reviews
   - Shows: guest name, date, rating stars, review text, helpful count, host response
   - Sorting: Most Recent, Most Helpful, Rating (High to Low, Low to High)

2. **ReviewForm**
   - Only shown to guests with completed bookings
   - Inputs: 1-5 star rating, text area (min 10 chars?, max 500 chars?)
   - Submit handler validates booking completion
   - Success toast + removes form / disables further submission

3. **ReviewStats**
   - Header above review list
   - Shows: Average rating (4.5★), total count (120 reviews)
   - Bar chart/breakdown: % at 5⭐, 4⭐, 3⭐, 2⭐, 1⭐
   - Filters: "Only verified guests", "With photos"

4. **HostReviewResponse**
   - Conditional rendering on each review card
   - Show: host name, response text, date responded
   - If own property: Edit/Delete buttons
   - Modal for composing response (with auth/permission check)

---

## 8. DTOs and Types

**Primary DTO Location:** [services/mappers.ts](services/mappers.ts)

### ✅ Existing DTOs

```typescript
// User DTO
export function toPublicUser(u: User) {
  return { id, name, email, role, status, image, publicProfile, ... };
}

// Listing DTO
export function toListingDTO(l: Listing) {
  return { id, title, description, price, photos, amenities, ... };
}
```

### ❌ Missing DTOs

```typescript
// Would need to add to mappers.ts:

export interface ReviewCreateInput {
  listingId: string;
  bookingId: string;  // Must verify guest has completed booking
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;  // Min 10 chars, max 500 chars
  photoUrls?: string[];  // Optional review photos
}

export interface ReviewDTO {
  id: string;
  listingId: string;
  guestId: string;
  guestName: string;  // May be public name or "A guest"
  guestImage?: string | null;
  bookingId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  photoUrls: string[];
  helpfulCount: number;
  status: "PENDING_MODERATION" | "APPROVED" | "REJECTED";
  createdAt: Date;
  updatedAt: Date;
  hostResponse?: {
    id: string;
    text: string;
    authorName: string;  // Host name
    createdAt: Date;
  } | null;
}

export interface ReviewStatsDTO {
  listingId: string;
  averageRating: number;  // e.g. 4.5
  totalReviews: number;   // e.g. 120
  ratingBreakdown: {
    5: number;  // count of 5-star reviews
    4: number;
    3: number;
    2: number;
    1: number;
  };
  verifiedGuestCount: number;
  percentHelpful: number;  // % marked helpful
}

export interface HostReviewResponseInput {
  reviewId: string;
  responseText: string;  // Max 500 chars
  listingId: string;  // For permission check
}
```

### ✅ Existing Qualification Types

```typescript
// [services/qualification.service.ts](services/qualification.service.ts)

export interface GuestFavoriteListingInput {
  isFeatured?: boolean;
  rating?: number | string | null;           // Expects this
  reviewCount?: number | null;                // Expects this
  reviewsCount?: number | null;               // Fallback field
  bookings?: Array<{ status: string }>;
  confirmedBookingCount?: number;
}

export interface SuperhostHostInput {
  id?: string;
  createdAt?: Date | string | null;
  publicProfile?: Record<string, unknown> | null;
  bookings?: Array<{ status: string }>;
  bookingSummary?: { confirmed: number; cancelled: number };
  listings?: Array<{ id: string; isFeatured?: boolean }>;
}

export interface QualificationConfig {
  guestFavorite: {
    minRating: number;
    minReviews: number;
    minConfirmedBookings: number;
    allowFeaturedWithConfirmedBookings: boolean;
  };
  superhost: {
    minRating: number;
    minCompletedBookings: number;
    maxCancellationRate: number;
    minTenureDays: number;
  };
}
```

---

## 9. Permissions Structure

**File:** [lib/permissions/host-permissions.ts](lib/permissions/host-permissions.ts#L179-L195)

### ✅ Review Permissions (Defined but Unused)

```typescript
{
  slug: "reviews.view",
  category: "reviews",
  action: "View",
  label: "View Reviews",
  description: "Read guest reviews and ratings for hosted properties",
  defaultEffect: "ALLOW",
},
{
  slug: "reviews.respond",
  category: "reviews",
  action: "Respond",
  label: "Respond to Reviews",
  description: "Post public host responses to guest stay reviews",
  defaultEffect: "ALLOW",
}
```

**Status:** Defined in code but NO service backing them yet

---

## 10. What's Missing vs. What Exists

### ✅ What Exists

| Component | File | Status |
|-----------|------|--------|
| Listing model with photos, amenities, descriptions | Prisma | ✅ |
| Booking model with status tracking | Prisma | ✅ |
| User model with publicProfile JSON field | Prisma | ✅ |
| Listing service with public data queries | services/listing.service.ts | ✅ |
| Booking service with quote calculation | services/booking.service.ts | ✅ |
| Guest Favorite qualification logic | services/qualification.service.ts | ✅ |
| Superhost qualification logic | services/qualification.service.ts | ✅ |
| Property card with rating/reviewCount display | components/home/property-card.tsx | ✅ |
| Single property page (12 sections) | app/listings/[id]/public-listing-detail-client.tsx | ✅ |
| Review permissions structure | lib/permissions/host-permissions.ts | ✅ |
| Host badge display (Guest Favorite, Superhost) | app/listings/[id]/public-listing-detail-client.tsx | ✅ |
| Listing detail modal/overlay patterns | components/ui/modal-overlay.tsx | ✅ |

### ❌ What's Missing

| Component | Type | Why Needed |
|-----------|------|-----------|
| **Review model** | Database | Core entity for guest feedback |
| **review.service.ts** | Service | CRUD operations for reviews |
| **Review DTOs** | Types | Data transfer between layers |
| **API endpoints** | Backend | POST/GET/PATCH reviews, responses |
| **ReviewForm component** | Frontend | Submit new review with validation |
| **ReviewList component** | Frontend | Display approved reviews paginated |
| **ReviewStats component** | Frontend | Show average rating, breakdown chart |
| **HostReviewResponse component** | Frontend | Display/edit host responses |
| **Review moderation flow** | Admin | Approve/reject reviews before display |
| **Rating aggregation logic** | Service | Calculate avg rating from reviews |
| **Helpful/unhelpful voting** | Feature | Allow guests to mark reviews helpful |
| **Review photos** | Feature | Allow guests to attach images to reviews |
| **Server actions for reviews** | Backend | Next.js mutations (create, respond, delete) |

---

## 11. Current State Summary

### On the Property Card

File: [components/home/property-card.tsx](components/home/property-card.tsx)

```typescript
interface PropertyCardData {
  rating?: string | number | null;           // 4.5
  averageRating?: number | string | null;    // 4.5
  reviewCount?: number | null;                // 120
  reviewsCount?: number | null;               // 120 (fallback)
  isGuestFavorite?: boolean;                  // Shows badge
  isSuperhost?: boolean;                      // Shows badge
}

// Renders:
{numericRating !== null ? (
  <span>⭐ {rating.toFixed(1)} ({reviewCount})</span>
) : (
  <span>No reviews yet</span>
)}
```

**Problem:** These fields are passed from homepage service queries, but there's no source model to populate them.

### On the Single Property Page

File: [app/listings/[id]/public-listing-detail-client.tsx](app/listings/[id]/public-listing-detail-client.tsx#L822-L828)

```tsx
{/* No property review model or public review API exists yet. Do
    not mislabel host-profile metrics as reviews for this stay. */}
<section className="space-y-2 border-b border-zinc-200/80 pb-6">
  <h3 className="text-base font-bold text-zinc-900">Guest reviews</h3>
  <p className="text-xs leading-relaxed text-zinc-600">This property has no guest reviews yet.</p>
</section>
```

### In Admin/Host Dashboard

- ❌ No "Reviews" tab or management section
- ❌ No review response interface
- ❌ No moderation queue

---

## 12. Implementation Roadmap (What Needs to Be Built)

### Phase 1: Core Data Model

1. **Database Migration**
   - Create Review model in Prisma
   - Create ReviewResponse model (optional, can be JSON)
   - Add indexes for efficient queries

2. **Service Layer**
   - Create review.service.ts with full CRUD
   - Add review aggregation (avg rating, count)
   - Add moderation logic (if needed)

### Phase 2: API & Actions

3. **Server Actions / API Routes**
   - POST /api/v1/listings/:id/reviews (with booking validation)
   - GET /api/v1/listings/:id/reviews (paginated, approved only)
   - PATCH /api/v1/reviews/:id (edit own review)
   - DELETE /api/v1/reviews/:id (delete own review)
   - POST /api/v1/reviews/:id/responses (host responds)

### Phase 3: Frontend

4. **Components**
   - ReviewForm (submit new review)
   - ReviewList (paginated display)
   - ReviewStats (rating breakdown)
   - HostReviewResponse (display/edit)

5. **Integration**
   - Replace placeholder in single property page
   - Wire up form submission
   - Add toast notifications
   - Handle loading/error states

### Phase 4: Admin Features (Optional)

6. **Review Moderation**
   - Admin panel for approving reviews
   - Flag for reporting inappropriate content
   - Moderation queue dashboard

---

## 13. Related Files & References

### Database
- [prisma/schema.prisma](prisma/schema.prisma)

### Services
- [services/listing.service.ts](services/listing.service.ts) — Public listing queries
- [services/booking.service.ts](services/booking.service.ts) — Booking logic (source for validation)
- [services/qualification.service.ts](services/qualification.service.ts) — Rating-based qualification
- [services/mappers.ts](services/mappers.ts) — DTO definitions

### Frontend - Single Property Page
- [app/listings/[id]/page.tsx](app/listings/[id]/page.tsx) — Server component (data fetch)
- [app/listings/[id]/public-listing-detail-client.tsx](app/listings/[id]/public-listing-detail-client.tsx) — Client component (1273 lines)

### Frontend - Property Card
- [components/home/property-card.tsx](components/home/property-card.tsx) — Homepage card with rating display

### Permissions & Auth
- [lib/permissions/host-permissions.ts](lib/permissions/host-permissions.ts) — Permission definitions (includes review perms)

### API Routes (Reference Structure)
- [app/api/v1/listings/route.ts](app/api/v1/listings/route.ts) — Example API pattern
- [app/api/v1/hosts/listings/route.ts](app/api/v1/hosts/listings/route.ts) — Host endpoint example

### Types
- [types/next-auth.d.ts](types/next-auth.d.ts) — Auth type augmentation

---

## 14. Conclusion

The Homyz platform has a **solid foundation** for implementing reviews:

✅ **Strengths:**
- Robust Listing and Booking models
- Qualified badge system already uses rating/reviewCount fields
- Permission structure defined for review access
- Single property page template ready
- Established API route patterns

❌ **Critical Gap:**
- **No Review model** in database
- **No review service layer**
- **No API endpoints** for review operations
- **No frontend components** to submit/display reviews
- **Explicit placeholder** acknowledging the missing feature

The review system is ready to be implemented from scratch, following the existing Homyz patterns and architectural decisions already in place.
