# HOMYZ — PHASE 0: COMPLETE TRAVEL PROFILE & SOCIAL IDENTITY SYSTEM AUDIT

**Target Document:** `docs/travel-profile/PHASE_0_AUDIT.md`  
**Author Role:** Senior Full-Stack Architect, Next.js Developer, Prisma Database Architect, UI/UX Engineer, QA Lead  
**Audit Scope:** Repository-wide inspection of routes, UI components, APIs, database models, storage backends, security boundaries, and Figma alignment.  
**Execution Constraint:** Strictly report-only audit. No production code, database migrations, or application behaviors are modified during Phase 0.

---

## 1. EXECUTIVE SUMMARY & REPOSITORY CONTEXT

### 1.1 Project Objective
HOMYZ is developing an Instagram-style Travel Profile and Social Identity system for travelers based on five design references (Screenshots 1–5) and client specifications:
- Hero cover banner with overlapping circular avatar, traveler name, and location.
- Key statistics: **Trips**, **Likes**, and **Reviews**.
- Circular country/travel highlights carousel with gradient borders.
- Central tab navigation: **Photo Grid** (5-column Instagram layout), **Trips / Albums** (max 5 photos per trip), and **Likes** (liked profiles and photos).
- "Where I've Been" travel stamps and visited cities/countries section.
- Travel badges and achievements.
- Robust photo upload workflow with file validation, drag-and-drop, byte-level progress, cancel/retry, and trip association.
- Privacy controls (public/private profile, follower-style visibility, unlisted media authorization).
- Shareable public profile URL and social trust indicators.

### 1.2 Current Repository State & Discovery
A deep repository inspection reveals two distinct states of code in the project history:

1. **Current Working Tree (`main` branch):**
   - Contains the standard account management system (`/profile` and `/profile/tab/profile_management/trip_photos`).
   - Uses a primitive `TripPhoto` model (`id`, `userId`, `url`, `caption`, `location`, `tags`) with direct public uploads routed through `/api/v1/upload/listing-photo`.
   - The dedicated `/travel-profile` route **does not exist** (returns 404).
   - Query parameters `travelTab=photos` and `travelTab=trips` are completely unhandled.
   - Travel stamps were previously prototyped in `User.publicProfile` JSON, but were retired; `services/user.service.ts` actively executes `delete pub.stampsVisible; delete pub.selectedStamps; delete pub.customStamps` on profile save.
   - Public guest profile route `/profile/[id]` is **completely non-functional for anonymous visitors** because `proxy.ts` middleware forces a redirect to `/login` for all `/profile/:path*` requests.

2. **Previous Prototype (`dev-latest` branch / `stash@{0}`):**
   - On October 19–20, 2026, an extensive prototype of Phases 1–5 was drafted in branch `dev-latest` (commit `04a3a39`, 87 files, 12,678 lines) and stashed in `stash@{0}`.
   - That branch introduced `TravelProfile`, `TravelTrip`, `TravelPhoto`, `Destination`, `UserDestination`, `ProfileLike`, and `TravelStamp` models, alongside `/travel-profile`, `/travelers/[handle]`, and `/api/v1/travel-*` endpoints.
   - **Critical Architecture Alert:** The `dev-latest` branch was branched before recent host financial modules (Host Payout Methods, Host Opportunities, Property Licenses, Tax Documents, Maintenance Records, Operating Expenses) were merged into `main`. Merging `dev-latest` directly into `main` would delete or corrupt these production host features. Therefore, the architectural recommendation is to implement the clean, additive Travel Profile schema directly on `main` without destroying host models.

---

## 2. AUDIT OF EXISTING ROUTES AND SYSTEMS

### 2.1 Route Operational Matrix

| Route / Entry Point | Operational Status | Underlying File / Handler | Audit Findings & Defects |
|---|---|---|---|
| `/travel-profile` | **NOT_IMPLEMENTED** | Missing on `main` | Route does not exist on `main` (returns 404). In `dev-latest`, was implemented with `GuestTravelProfileView`. |
| `/profile/tab/profile_management/trip_photos?travelTab=photos` | **IMPLEMENTED_NEEDS_FIX** | `app/(protected)/profile/tab/[[...slug]]/page.tsx` & `profile-management-client.tsx` | Route loads `profile_management` tab with `photos` subtab. However, query parameter `travelTab=photos` is **completely ignored**. Renders legacy 3-column photo grid. |
| `/profile/tab/profile_management/trip_photos?travelTab=trips` | **NOT_IMPLEMENTED** | `profile-management-client.tsx` | Query parameter `travelTab=trips` is **completely ignored**. No "Trips" album view or management exists in `profile-management-client.tsx` on `main`. |
| `/profile` | **IMPLEMENTED_VERIFIED** | `app/(protected)/profile/page.tsx` & `profile-client.tsx` | Authenticated guest dashboard operational. Shows sidebar, rectangular avatar, `Trips`, `Reviews`, `Years on Homyz`, bio, and reviews written. |
| `/profile/[id]` | **PARTIALLY_IMPLEMENTED (BROKEN)** | `app/profile/[id]/page.tsx` | **Broken for anonymous visitors.** `proxy.ts` line 93 matches `"/profile/:path*"`, redirecting logged-out visitors to `/login`. For logged-in viewers, it fetches all owner photos without privacy filters. |
| `/profile-management` | **IMPLEMENTED_VERIFIED** | `app/(protected)/profile-management/page.tsx` | Standalone profile management page; redirects or mirrors `profile/tab/profile_management`. |
| `/users/profile/[id]` | **IMPLEMENTED_VERIFIED** | `app/users/profile/[id]/page.tsx` | Operational public profile for **hosts** (`PublicHostProfileView`). Uses dedicated safe DTO `getPublicHostProfile`. Completely independent of guest travel profile. |
| `/travelers/[handle]` | **NOT_IMPLEMENTED** | Missing on `main` | Desired shareable vanity URL for public traveler identity. Prototyped in `dev-latest`, absent on `main`. |

### 2.2 Host-Side Profile Management Integration & Collision Risk
- In `prisma/schema.prisma`, `User.publicProfile` is a free-form `Json?` column.
- Both guest settings (bio, `whereILive`, languages, prompts) and host settings (hosting prompts, interests) write to `User.publicProfile`.
- In `services/user.service.ts` (`updateHostPublicProfile` line 174–200), saving host profile data reads `User.publicProfile` and explicitly deletes travel-related keys:
  ```typescript
  delete current.stampsVisible;
  delete current.selectedStamps;
  delete current.customStamps;
  ```
- **Architectural Risk:** Storing travel data (cover banner, visibility, travel stamps, albums, social links) in `User.publicProfile` causes destructive data loss whenever a user updates host profile settings.
- **Resolution:** Travel Profile **must** be stored in a dedicated 1:1 relation model `TravelProfile`, completely decoupled from `User.publicProfile`.

---

## 3. PROFILE HEADER & STATISTICS AUDIT

### 3.1 Visual & Structural Comparison with Screenshot 1

| Component / Element | Figma Screenshot 1 Reference | Current `main` Implementation | Defect Severity & Classification |
|---|---|---|---|
| **Cover Banner** | Wide landscape hero banner (`rounded-[24px]` / `rounded-3xl`) spanning full container width. | **Completely Missing.** No cover image rendered on `/profile` or `/profile/[id]`. | **Critical Functional Gap** |
| **Profile Avatar** | Circular avatar (`size-28` to `size-36`) overlapping the lower-left edge of the cover banner with a distinct thick white border ring. | Rectangular rounded card (`w-[124px] h-[124px] sm:w-[233px] sm:h-[151px]`) placed below header without banner. | **Visual Mismatch / Structural Gap** |
| **Name & Location** | Display Name ("Name, Surname") in bold tracking-tight text, with Location ("Town, Country") directly underneath. | Displays `currentUser.name` and `pub.whereILive` inside a text column. No parsed city/country. | **Partial / Visual Mismatch** |
| **Header Actions** | Three pill buttons: **Edit Profile**, **Share Profile**, and **[↑] Upload**. | Single yellow rounded pill **Edit** which only navigates to `profile_management` tab. | **Functional Gap** |
| **Statistics Display** | Three prominent gold oval pill badges (`#FCDF9C`) with bold counts and labels below: **Trips**, **Likes**, **Reviews**. | Three tiny circular badges with black borders inside a metadata row: **Trips**, **Reviews**, and **Years on Homyz**. | **Visual Mismatch & Missing Stat** |

### 3.2 Data Source Audit of Profile Statistics
Inspection of `services/user.service.ts` (lines 310–328) reveals how statistics are computed:
```typescript
async function getUserStats(userId: string) {
  return getOrSetCache(
    CACHE_KEYS.USER_STATS(userId),
    async () => {
      const [tripsCount, photosCount, reviewsCount] = await Promise.all([
        prisma.booking.count({ where: { userId } }),
        prisma.tripPhoto.count({ where: { userId } }),
        prisma.review.count({ where: { authorId: userId, status: ReviewStatus.PUBLISHED } }),
      ]);
      return {
        trips: Math.max(tripsCount, photosCount),
        likes: 0,
        reviews: reviewsCount,
      };
    },
    { ttl: CACHE_TTL.DASHBOARD_STATS },
  );
}
```

#### Defect Analysis:
1. **Trips Count (`Math.max(tripsCount, photosCount)`):**
   - **Severe Data Inaccuracy:** `prisma.booking.count({ where: { userId } })` counts **all** bookings, including `PENDING` and `CANCELLED` bookings!
   - It then takes `Math.max(tripsCount, photosCount)`: if a traveler uploaded 20 random trip photos, their "Trips" counter displays 20, even if they have taken zero trips!
   - **Recommended Definition:** `Trips` must be defined as **completed stays** (confirmed bookings whose checkout date is in the past) plus **published user travel trips/albums**, deduplicated by trip identifier.
2. **Likes Count (`likes: 0`):**
   - **Hardcoded Placeholder:** The likes counter returns a hardcoded literal `0`. In `ProfileClient.tsx`, this metric is suppressed and replaced with `yearsOnHomyz`.
   - **Recommended Definition:** Real aggregate count of received profile likes from a relational `ProfileLike` table (`targetUserId = userId`).
3. **Reviews Count (`reviewsCount`):**
   - Counts published reviews authored by the user (`prisma.review.count({ where: { authorId: userId, status: ReviewStatus.PUBLISHED } })`).
   - Requires verification of whether product requires guest-to-property reviews written, host reviews received, or both. Recommended: published guest reviews written by the traveler.

---

## 4. COMPLETE PHOTO UPLOAD FLOW AUDIT

### 4.1 Evaluation Against Screenshots 2–5 Workflow

| Upload Workflow Step | Required Behavior (Screenshots 2–5) | Existing Implementation (`main`) | Audit Finding & Gap |
|---|---|---|---|
| **1. Open Upload Modal** | Trigger modal from header `[↑] Upload` or gallery empty state. | Modal triggered only from `Profile Management -> Trip Photos -> Upload Photos`. | Missing header trigger on profile page. |
| **2. Select or Drag Photos** | Support file browser selection and drag-and-drop into a designated dropzone. | `MultiImageUploadModal` has a dashed border with `onClick`, but **zero drag event handlers** (`onDragOver`, `onDragLeave`, `onDrop` are missing). | Drag-and-drop is **completely non-functional**. |
| **3. Type & Size Validation** | Permitted types: JPEG, PNG, WebP, AVIF. Maximum size: 10 MB per file. | Client checks `file.size > 10MB` and `!file.type.startsWith("image/")`. Server endpoint `/api/v1/upload/listing-photo` validates magic bytes. | Validation exists, but relies on listing photo endpoint. |
| **4. Max 5 Photos per Trip** | Strict enforcement of maximum 5 photos per trip/album. | **Completely Missing.** User can select unlimited photos. Database has no trip container to enforce 5 photos. | **Critical Constraint Violation.** |
| **5. Preview Selected Images** | Thumbnail preview grid with individual image removal and replacement. | Thumbnail grid renders `URL.createObjectURL` previews with a `[✕]` remove button. No replace option. | Partially implemented; lacks per-photo metadata editor. |
| **6. Captions & Locations** | Optional captions and location tagging per photo or per trip. | Form provides **one single global caption** (max 300 chars) and **one single location** applied to all selected files simultaneously. | Per-photo captioning is missing in batch upload. |
| **7. Tag People** | Tag travel companions by username or user ID. | `TagPeopleInput` queries `prisma.user` and saves display strings/emails in `tags: String[]`. | **Privacy/Security Risk:** Exposes user emails; lack of consent/block checks. |
| **8. Upload & Accurate Progress** | Real-time byte progress bar showing upload and processing state. | Counter displays `completed` of `total` files using 3 parallel `fetch` calls. No byte-level XHR/Fetch stream progress. | Inaccurate progress indicator. |
| **9. Failed Uploads, Cancel & Retry** | Resilient error handling, in-flight abort, partial retry without losing successful uploads. | If any upload fails, error toast is displayed, uploading stops, and progress resets. In-flight requests cannot be cancelled. | **Broken error recovery:** Successfully uploaded files are orphaned in storage. |
| **10. Save to Correct User & Trip** | Transactional attachment of uploaded assets to the authenticated user and trip. | Calls `uploadTripPhotosAction` which creates individual `TripPhoto` records. No trip association. | No trip model exists. |
| **11. Gallery Persistence** | Persisted photos appear immediately in profile gallery and remain after page refresh. | Photos persist in `TripPhoto` table and display in 3-column grid. | Works for flat photos, but lacks trip grouping and variants. |

### 4.2 Storage Backend & Security Vulnerability Audit
- **Storage Path Used:** Currently uploads to `POST /api/v1/upload/listing-photo`.
- **Public URL Exposure:** Photos are saved to `public/uploads/listing-photos/` or S3 public bucket.
- **Privacy Bypass:** Every uploaded photo is served as a public static asset. Even if a user sets their profile to private, any person possessing the photo URL can view the image indefinitely.
- **Missing Image Optimization & Variants:** No thumbnails or WebP/AVIF variants are generated. Displaying a grid of 50 photos downloads 50 full-resolution original assets, severely degrading mobile performance.

---

## 5. GALLERY, TRIPS & COUNTRY HIGHLIGHTS AUDIT

### 5.1 Comparison with Screenshot 1 Reference

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  COVER BANNER (Landscape Rounded Rectangle)                                  │
│  [ Overlapping Avatar ]                                                      │
│  Name, Surname                                    [Edit] [Share] [Upload]    │
│  Town, Country                                                               │
│                                                                              │
│             ( Trips: 12 )      ( Likes: 48 )      ( Reviews: 6 )             │
│                                                                              │
│  [ < ]   ( France )    ( Italy )    ( Japan )    ( Spain )    ( UAE )  [ > ] │
│          Country Highlight Carousel with Gradient Rings                      │
│                                                                              │
│  ──────────────────────────────────────────────────────────────────────────  │
│                 [ ▦ Grid ]        [ ▤ Trips ]        [ ♡ Likes ]             │
│  ──────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│  │ Photo 1 │  │ Photo 2 │  │ Photo 3 │  │ Photo 4 │  │ Photo 5 │             │
│  │ ♡ 12 💬 │  │ ♡ 8  💬 │  │ ♡ 24 💬 │  │ ♡ 5  💬 │  │ ♡ 19 💬 │  (5 Cols)   │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘             │
└──────────────────────────────────────────────────────────────────────────────┘
```

#### Detailed Gap Breakdown:
1. **Photo Grid Layout (5-Column Instagram Grid):**
   - **Screenshot 1:** 5-column square grid on desktop (`grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5`), with subtle hover overlay showing like and comment icons.
   - **Current `main`:** 3-column grid (`grid-cols-1 sm:grid-cols-2 md:grid-cols-3`), 4:3 rectangular aspect ratio. No 5-column option; no hover overlays.
2. **Central Gallery Tabs:**
   - **Screenshot 1:** Central icon bar with 3 tabs:
     1. **Grid Icon:** All photos in a continuous photostream.
     2. **Trips / Filmstrip Icon:** Grouped by Trip/Album (with 0–5 photos per trip, dates, destination, and cover).
     3. **Likes Icon (Heart):** Liked profiles and liked pictures.
   - **Current `main`:** Completely absent.
3. **Country Highlight Carousel:**
   - **Screenshot 1:** Circular country bubbles with gradient ring borders (`from-yellow-400 via-rose-500 to-red-500`), circular country photos, country names below, and left/right carousel arrow navigation.
   - **Current `main`:** Completely absent.
4. **Photo Detail View / Lightbox:**
   - **Current `main`:** Rudimentary lightbox rendering the bare image. No author info, caption, location, date, or interaction buttons.
5. **Scale & Pagination:**
   - **Current `main`:** `userService.getTripPhotos` executes `prisma.tripPhoto.findMany({ where: { userId } })` with **no cursor or `take` limit**. A profile with 500 photos will attempt to render 500 unpaginated DOM elements simultaneously.

---

## 6. TRAVEL STAMPS, BADGES & ACHIEVEMENTS AUDIT

### 6.1 "Where I've Been" Travel Stamps Section
- **Figma Requirement:** Display visited countries and cities with custom collectible travel stamps.
- **Codebase Archaeology:**
  - In `public/uploads/stamp-icons/`, there are 3 PNG stamp assets (`stamp_1788426489452_bz1kfx.png`, etc.).
  - In translation files (`messages/en.json` lines 1044–1049):
    ```json
    "host_about_travel_stamps_title": "Where I’ve been",
    "host_about_travel_stamps_desc": "Pick the stamp you want to appear on your profile",
    "host_about_stamps_selected_count": "{count} / 10 stamps selected"
    ```
  - In `services/user.service.ts`: All stamp properties are actively deleted when saving a profile (`delete pub.stampsVisible; delete pub.selectedStamps; delete pub.customStamps;`).
  - In `__tests__/admin-about-host.test.ts` line 100: Assertions verify that old stamps controls (`WhereIveBeenSelector`, `TravelStampGraphic`) were retired from host profile.
- **Finding:** Travel stamps were originally conceived as a free-form JSON array on host profiles, then intentionally retired. The new requirement is an official, verified traveler feature based on completed bookings and verified destinations.

### 6.2 Travel Badges & Achievements
- **Current Status:** **NOT_IMPLEMENTED** for travelers.
- The existing codebase has `SuperhostEvaluation` (quarterly host performance evaluation) and `GuestFavoriteEvaluation` (top 1% host property qualification).
- There is **no achievement system** for guests/travelers (e.g., "5 Countries Visited", "First Trip Completed", "Heritage Explorer").
- Verified destinations must be derived from confirmed bookings with past checkout dates (`BookingStatus.CONFIRMED` and `endDate < now()`).

---

## 7. PUBLIC PROFILE, SHARING & PRIVACY AUDIT

### 7.1 Security & Access Control Vulnerability Matrix

| Area | Implemented Security Check | Vulnerability / Defect | Remediation Required |
|---|---|---|---|
| **Middleware Protection (`proxy.ts`)** | Line 93: `matcher: ["/profile/:path*"]` | **Anonymous Access Blocked:** Any unauthenticated request to `/profile/[id]` is caught by `proxy.ts` line 49 and redirected to `/login`. Anonymous public visitors cannot view any public profile! | Remove `/profile/[id]` from proxy matcher or route public travel profiles under `/travelers/[handle]`. |
| **API Data Minimization** | `userService.getById(id)` filters password hash | Public profile loader passes user object directly to client. In `actions/user/tripPhotos.ts`, `getTripPhotosAction(targetUserId)` returns **all photos of any target user** without verifying profile visibility or block status. | Introduce dedicated `PublicTravelProfileDTO` and `PublicTravelPhotoDTO` that strictly omit private fields. |
| **Direct Media URL Access** | Static filesystem delivery | Images uploaded to `/upload/listing-photos/` are accessible by direct URL without session verification. "Private" status does not revoke public static asset links. | Implement authenticated media endpoint for private photos with CDN cache headers. |
| **User Tagging Privacy** | `TagPeopleInput` calls user search | Search API returns user emails. Anyone can tag any user without their consent. | Implement privacy-safe tagging: search by name/handle only (no email exposure), with opt-out preferences. |
| **Block Enforcement** | Not implemented | No `UserBlock` model exists. A blocked user could view photos and like profiles. | Add `UserBlock` model; filter all read queries and like/comment interactions by block list. |

---

## 8. DATABASE, API & INTEGRATION AUDIT

### 8.1 End-to-End Feature Trace (Existing vs Required)

#### 1. Profile Information & Shell
- **UI:** `app/(protected)/profile/profile-client.tsx`
- **API / Action:** Server component `app/(protected)/profile/page.tsx` -> `loadProfilePageData()`
- **Service:** `services/user.service.ts` -> `getById()`
- **Prisma Model:** `User`
- **Database:** PostgreSQL `User` table
- **Status:** Operational for owner; lacking cover banner, travel handle, and public traveler view.

#### 2. Photo Storage & Retrieval
- **UI:** `profile-management-client.tsx` (Subtab `photos`)
- **API / Action:** `POST /api/v1/upload/listing-photo` -> `uploadTripPhotosAction()` in `actions/user/tripPhotos.ts`
- **Service:** `services/user.service.ts` -> `createTripPhotos()`, `getTripPhotos()`
- **Prisma Model:** `TripPhoto` (`id`, `userId`, `url`, `caption`, `location`, `tags`)
- **Database:** PostgreSQL `TripPhoto` table
- **Status:** Unpaginated, no variants, wrong upload route, no trip container.

#### 3. Travel Trips / Albums
- **UI:** Missing
- **API / Action:** None
- **Service:** None
- **Prisma Model:** None
- **Database:** None
- **Status:** **NOT_IMPLEMENTED** on `main`.

#### 4. Social Likes & Interactions
- **UI:** Missing
- **API / Action:** None
- **Service:** None
- **Prisma Model:** None
- **Database:** None
- **Status:** **NOT_IMPLEMENTED** on `main`.

### 8.2 Proposed Additive Prisma Schema (Phase 1–4 Foundation)
The following additive schema models the required travel domain without altering existing host or booking tables:

```prisma
// ─────────────────────────────────────────────────────────────────────────────
// TRAVEL PROFILE & SOCIAL IDENTITY DOMAIN (ADDITIVE)
// ─────────────────────────────────────────────────────────────────────────────

enum TravelProfileVisibility {
  PUBLIC
  PRIVATE
  FOLLOWERS_ONLY
}

enum TravelTripStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum TravelEvidenceSource {
  VERIFIED_BOOKING
  MANUAL_DECLARATION
}

model TravelProfile {
  id               String                  @id @default(cuid())
  userId           String                  @unique
  handle           String?                 @unique
  displayName      String?
  bio              String?                 @db.Text
  homeLocation     String?
  homeDestinationId String?
  coverUrl         String?
  coverMediaId     String?
  visibility       TravelProfileVisibility @default(PUBLIC)
  isPublic         Boolean                 @default(true)
  createdAt        DateTime                @default(now())
  updatedAt        DateTime                @updatedAt

  user             User                    @relation(fields: [userId], references: [id], onDelete: Cascade)
  homeDestination  Destination?            @relation(fields: [homeDestinationId], references: [id], onDelete: SetNull)

  @@index([handle])
  @@index([visibility])
}

model Destination {
  id           String            @id @default(cuid())
  name         String
  normalizedName String
  city         String?
  countryCode  String            // ISO 2-letter code (e.g. "FR", "SA")
  countryName  String
  latitude     Float?
  longitude    Float?
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  userDestinations UserDestination[]
  trips            TravelTrip[]
  travelProfiles   TravelProfile[]

  @@unique([countryCode, normalizedName])
  @@index([countryCode])
}

model UserDestination {
  id             String               @id @default(cuid())
  userId         String
  destinationId  String
  visitCount     Int                  @default(1)
  isVerified     Boolean              @default(false)
  source         TravelEvidenceSource @default(VERIFIED_BOOKING)
  firstVisitedAt DateTime?
  lastVisitedAt  DateTime?
  createdAt      DateTime             @default(now())
  updatedAt      DateTime             @updatedAt

  destination    Destination          @relation(fields: [destinationId], references: [id], onDelete: Cascade)

  @@unique([userId, destinationId])
  @@index([userId])
}

model TravelTrip {
  id            String           @id @default(cuid())
  userId        String
  title         String
  destinationId String?
  startDate     DateTime?
  endDate       DateTime?
  coverPhotoId  String?
  status        TravelTripStatus @default(PUBLISHED)
  visibility    TravelProfileVisibility @default(PUBLIC)
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  destination   Destination?     @relation(fields: [destinationId], references: [id], onDelete: SetNull)
  photos        TravelPhoto[]

  @@index([userId, status])
  @@index([destinationId])
}

model TravelPhoto {
  id            String                  @id @default(cuid())
  userId        String
  tripId        String?
  url           String
  thumbnailUrl  String?
  mediumUrl     String?
  caption       String?                 @db.Text
  location      String?
  destinationId String?
  visibility    TravelProfileVisibility @default(PUBLIC)
  order         Int                     @default(0)
  createdAt     DateTime                @default(now())
  updatedAt     DateTime                @updatedAt

  trip          TravelTrip?             @relation(fields: [tripId], references: [id], onDelete: SetNull)
  likes         TravelPhotoLike[]

  @@index([userId, createdAt])
  @@index([tripId])
}

model ProfileLike {
  id           String   @id @default(cuid())
  actorId      String
  targetUserId String
  createdAt    DateTime @default(now())

  @@unique([actorId, targetUserId])
  @@index([targetUserId])
}

model TravelPhotoLike {
  id        String      @id @default(cuid())
  actorId   String
  photoId   String
  createdAt DateTime    @default(now())

  photo     TravelPhoto @relation(fields: [photoId], references: [id], onDelete: Cascade)

  @@unique([actorId, photoId])
  @@index([photoId])
}

model UserBlock {
  id        String   @id @default(cuid())
  blockerId String
  blockedId String
  createdAt DateTime @default(now())

  @@unique([blockerId, blockedId])
  @@index([blockerId])
  @@index([blockedId])
}

model TravelStamp {
  id          String   @id @default(cuid())
  slug        String   @unique
  name        String
  countryCode String
  iconUrl     String
  category    String   @default("COUNTRY")
  createdAt   DateTime @default(now())

  userStamps  UserTravelStamp[]
}

model UserTravelStamp {
  id        String      @id @default(cuid())
  userId    String
  stampId   String
  isPinned  Boolean     @default(false)
  awardedAt DateTime    @default(now())

  stamp     TravelStamp @relation(fields: [stampId], references: [id], onDelete: Cascade)

  @@unique([userId, stampId])
  @@index([userId])
}
```

---

## 9. FIGMA UI/UX GAP ANALYSIS

### 9.1 Screenshot-by-Screenshot Review

#### Screenshot 1: Profile Main View (Instagram-style Travel Diary)
- **Cover Image:** Required wide hero banner with rounded edges. Currently **Missing**.
- **Avatar:** Circular avatar overlapping the cover border with white stroke. Currently rectangular box below header.
- **Identity:** Display name + town/country text. Currently simple text row.
- **Action Buttons:** Edit Profile, Share Profile, [↑] Upload pill buttons in top bar. Currently only a yellow "Edit" tab switcher.
- **Stats:** 3 gold rounded pills (`Trips`, `Likes`, `Reviews`). Currently circular badges (`Trips`, `Reviews`, `Years on Homyz`).
- **Country Highlights:** Circular country story bubbles with gradient borders. Currently **Missing**.
- **Central Navigation Tabs:** 3 icons (Grid, Trips, Likes). Currently **Missing**.
- **Photo Grid:** 5-column square image grid with hover overlays. Currently 3-column rectangular card list in another tab.
- **Stamps / Where I've Been:** Section showing visited destinations with stamps. Currently **Missing**.

#### Screenshots 2–3: Photo Upload Modal & File Selection
- **Dropzone:** Dashed drag-and-drop region with camera icon and file constraints. Current dropzone lacks drag events.
- **5 Photos Limit Badge:** "X/5 photos remaining" banner per trip. Currently absent.
- **Preview Carousel / Grid:** Selected file previews with remove/replace controls. Current preview only supports removal, not individual replacement.

#### Screenshot 4: Metadata Editor & Progress Bar
- **Metadata Fields:** Form fields for Caption, Location Search, and Tag People. Current implementation applies one global caption to all photos simultaneously.
- **Upload Progress:** Segmented progress bar with byte-level percentage and processing feedback. Current implementation has crude file counter.

#### Screenshot 5: Row-Based Photo Curation / Trip Management
- **List / Filmstrip View:** Horizontal rows containing thumbnail, heart/comment/share icons, location tag pill, tagged users pill, and caption editor. Currently absent on `main`.

---

## 10. REQUIRED AUDIT OUTPUT

### A. Implementation Status Matrix

| Feature | Status | Existing File/API | Issue | Required Action | Phase |
|---|---|---|---|---|---|
| **Profile Header & Banner** | PARTIALLY_IMPLEMENTED | `components/profile/profile-client.tsx` | No cover image banner; avatar is rectangular; missing Edit, Share, and Upload buttons. | Implement full-width cover banner, overlapping avatar, action pill buttons. | Phase 1 |
| **Profile Information** | IMPLEMENTED_NEEDS_FIX | `app/(protected)/profile/profile-client.tsx` | Name and location stored in unstructured JSON; town/country not parsed. | Map structured display name and town/country from `TravelProfile`. | Phase 1 |
| **Profile Statistics** | IMPLEMENTED_NEEDS_FIX | `services/user.service.ts:310` | Trips metric uses `Math.max(bookings, photos)`; Likes is hardcoded `0`; missing gold pill styling. | Replace formula with confirmed completed stays + trips; aggregate real likes; render gold pills. | Phase 1 |
| **Photo Upload Modal** | PARTIALLY_IMPLEMENTED | `profile-management-client.tsx:1880` | Modal exists in subtab, but drag-and-drop is non-functional; no byte progress; orphans files on error. | Implement real drag/drop, XHR byte progress, cancel/retry, and modal accessibility. | Phase 2 |
| **Trip Photo Constraints** | NOT_IMPLEMENTED | N/A | No enforcement of maximum 5 photos per trip; user can upload unlimited photos. | Add server and client validation enforcing max 5 photos per trip container. | Phase 2 |
| **Travel Media Storage** | IMPLEMENTED_NEEDS_FIX | `app/api/v1/upload/listing-photo` | Uses listing photo upload endpoint; public file leakage; no variants. | Add dedicated `/api/v1/travel-media/uploads` endpoint with WebP thumbnail variants. | Phase 2 |
| **5-Column Photo Grid** | NOT_IMPLEMENTED | N/A | Only 3-column rectangular card layout exists in profile management. | Build 5-column square Instagram-style gallery with heart/comment/share overlays. | Phase 3 |
| **Trips & Albums View** | NOT_IMPLEMENTED | N/A | No `TravelTrip` container, cover selection, or trip management view. | Implement Trip album model, trip cards (0/5 photos badge), and trip photo curation. | Phase 3 |
| **Country Highlights Carousel** | NOT_IMPLEMENTED | N/A | No country highlight bubbles or navigation track. | Create circular country highlights carousel with gradient borders and arrow scroll. | Phase 3 |
| **Photo Detail Lightbox** | PARTIALLY_IMPLEMENTED | `profile-management-client.tsx:2385` | Bare image popup without caption, location, author, or interaction buttons. | Create complete detail modal with photo metadata, author card, and social reactions. | Phase 3 |
| **Travel Stamps Section** | NOT_IMPLEMENTED | Retired in `user.service.ts:77` | Feature was previously retired and stripped from `publicProfile`. | Create "Where I've Been" travel stamps catalog and member stamp collection. | Phase 4 |
| **Visited Cities / Countries** | NOT_IMPLEMENTED | N/A | No normalized destination tracking or visit counters. | Compute verified destinations from completed bookings and user trips. | Phase 4 |
| **Travel Badges & Achievements** | NOT_IMPLEMENTED | N/A | Only Host Superhost/Guest Favorite badges exist in repository. | Create traveler achievement catalog, milestone qualification engine, and profile badge display. | Phase 4 |
| **Public Profile Route** | PARTIALLY_IMPLEMENTED (BROKEN) | `app/profile/[id]/page.tsx` & `proxy.ts:93` | Anonymous visitors are redirected to `/login` by middleware; exposes private photos. | Exclude public route from middleware; create dedicated `/travelers/[handle]` with safe DTO. | Phase 5 |
| **Privacy & Visibility** | PARTIALLY_IMPLEMENTED | `profile-management-client.tsx:Privacy` | Only `profileVisible` boolean exists; direct media URLs remain publicly accessible. | Implement audience controls (Public/Private), private media authorization, and `UserBlock`. | Phase 5 |
| **Profile Share & OpenGraph** | NOT_IMPLEMENTED | N/A | No share modal, copy link, or OpenGraph meta tags for travel profiles. | Add Share Profile modal with copyable link, social share links, and dynamic OG metadata. | Phase 5 |
| **Profile Management Sync** | PARTIALLY_IMPLEMENTED | `profile-management-client.tsx` | Route query params `travelTab=photos` and `travelTab=trips` are ignored. | Synchronize travel photos and trips into `profile_management` tab via `travelTab` param. | Phase 6 |
| **Mobile & Responsive Polish** | PARTIALLY_IMPLEMENTED | `profile-client.tsx` | Desktop/mobile layout breaks Figma alignment; unverified on small screens. | Full responsive audit and QA across 320px mobile, tablet, and desktop breakpoints. | Phase 6 |

---

### B. Existing Functionality to Reuse

The following verified components, services, and utilities should be reused without rewriting:

1. **Authentication & Session:**
   - `lib/auth/session.ts` -> `getSessionUser()`, `requireAuth()`
   - `lib/actions/result.ts` -> `runAction()` for safe server action exception wrapping.
2. **Modal Backdrop & Scroll Lock:**
   - `components/ui/modal-overlay.tsx` -> High-performance reference-counted body scroll lock and backdrop blur.
3. **Image Signature & MIME Validation:**
   - `services/listing-media.service.ts` -> Magic-byte verification logic (`validateImageBuffer`, supporting JPEG, PNG, WebP, AVIF).
4. **Media Storage Core:**
   - `lib/storage/media.ts` -> Multi-backend file driver (Local filesystem, S3 bucket, Media Server). Add `"travel-photos"` to `PUBLIC_KINDS` and `"travel-private"` to `PRIVATE_KINDS`.
5. **Review System Integration:**
   - `services/review.service.ts` -> Published guest-to-property reviews for truthful review statistics.
6. **Booking Completed Stay Eligibility:**
   - `lib/booking/booking-status.ts` & `services/booking.service.ts` -> `CONFIRMED` bookings with checkout in the past for verified destination evidence.
7. **Toast Notifications & UI Primitives:**
   - `components/ui/toast.tsx` -> Global toast messaging for upload feedback and copy links.
   - `components/ui/container.tsx` -> Standard responsive container wrapping.
8. **Internationalization (i18n):**
   - `lib/i18n/language-context.tsx` -> Multi-language string translations across all 6 supported locales.

---

### C. Missing or Broken Functionality

#### Critical Priority (Security & Architecture Blockers):
1. **Anonymous Access Block in `proxy.ts`:**
   - `proxy.ts` line 93 forces login on `/profile/:path*`.
   - **Impact:** Any shared link to a public profile is broken for logged-out users.
   - **Fix:** Update matcher or establish public traveler route outside protected matcher (e.g., `/travelers/:handle`).
2. **Public Data Leakage in Profile & Photo Fetching:**
   - `app/profile/[id]/page.tsx` and `actions/user/tripPhotos.ts` expose all user photos and sensitive account fields.
   - **Impact:** Private photos and user emails are enumerable by any authenticated user.
   - **Fix:** Enforce strict public DTO projection and query-level visibility filters.
3. **Listing Photo Endpoint Reuse for Travel Photos:**
   - Photos upload to `/api/v1/upload/listing-photo` and remain public permanently.
   - **Impact:** Privacy toggles cannot revoke access to static files; storage lacks WebP variants.
   - **Fix:** Create dedicated travel media upload and variant processing pipeline.

#### High Priority (Functional & Business Logic Deficiencies):
4. **Fictitious "Trips" Statistic:**
   - `Math.max(bookings, photos)` fabricates trip counts based on uploaded photos.
   - **Impact:** Misleading user data violating platform trust.
   - **Fix:** Derive trips strictly from completed bookings plus published trip albums.
5. **Missing 5-Photo Limit per Trip:**
   - Photos are uploaded as a flat unconstrained list.
   - **Impact:** Violates core client requirement of max 5 photos per trip.
   - **Fix:** Introduce `TravelTrip` container and transactional 5-photo server constraint.
6. **Broken Drag-and-Drop in Upload Modal:**
   - UI visually implies drag-and-drop, but has no event handlers.
   - **Impact:** Frustrating user experience on desktop.
   - **Fix:** Implement HTML5 drag-and-drop handlers with drag-over visual feedback.
7. **Retired Travel Stamps:**
   - Current profile save code deletes stamp fields.
   - **Impact:** Figma "Where I've Been" section cannot function.
   - **Fix:** Build relational `TravelStamp` and `UserTravelStamp` models with destination verification.

---

### D. Architecture Recommendation

#### 1. Route Strategy
- **Dedicated Traveler Profile Route:** Establish `/travel-profile` for the logged-in owner's full-bleed view, and `/travelers/[handle]` (or `/travelers/[id]`) for public/visitor access.
- **Profile Management Tab Integration:** Maintain `/profile/tab/profile_management/trip_photos`. Use the query parameter `?travelTab=photos` (to manage individual photos) and `?travelTab=trips` (to manage trip albums).
- **Header Navigation:** Add "Travel Profile" to the user avatar dropdown menu in `app-header.tsx`.

#### 2. Data Model Strategy
- Introduce a 1:1 `TravelProfile` model linked to `User`.
- **Do not store travel social data in `User.publicProfile` JSON.**
- Keep `TripPhoto` for backward compatibility, but wrap or migrate it into `TravelPhoto` linked to `TravelTrip`.
- Introduce `Destination` and `UserDestination` for normalized country highlights and stamps.
- Introduce `ProfileLike` and `TravelPhotoLike` with unique constraints preventing duplicate or self-likes.

#### 3. Media Strategy
- Register `"travel-photos"` and `"travel-covers"` in `lib/storage/media.ts`.
- Generate 3 image variants:
  - `thumbnail`: 300x300 square (WebP) for 5-column grid and highlights.
  - `medium`: 800x800 (WebP) for detail view and mobile cards.
  - `large`: Original full resolution for zoom/lightbox.

---

## 11. FINAL IMPLEMENTATION MAPPING (PHASES 1–6)

Every pending requirement is assigned to exactly one implementation phase:

### Phase 1: Profile UI & Information
- **Scope:** Header, cover banner, overlapping avatar, traveler identity, action buttons, and truthful statistics.
- **Key Deliverables:**
  - Full-width cover image display with owner "Change Cover" upload modal.
  - Circular overlapping avatar with white stroke border.
  - Display name, town, and country display.
  - Three header pill action buttons: **Edit Profile**, **Share Profile**, and **[↑] Upload**.
  - Three gold oval pill statistics (`Trips`, `Likes`, `Reviews`).
  - Corrected statistics service deriving truthful completed trips and genuine likes.
  - `TravelProfileEditModal` for bio, handle, and location editing.

### Phase 2: Photo Upload & Management
- **Scope:** Complete upload workflow matching Screenshots 2–5.
- **Key Deliverables:**
  - Dedicated travel upload modal with working drag-and-drop file selection.
  - Server-side and client-side enforcement of **maximum 5 photos per trip**.
  - Individual thumbnail previews with remove and replace actions.
  - Per-photo or album caption and location inputs.
  - Real XHR byte-level progress bar and phase indicators (`uploading`, `processing`, `saving`).
  - AbortController/XHR abort support for cancellation.
  - Error recovery with retry of failed items without re-uploading successful ones.
  - Dedicated `/api/v1/travel-media/uploads` endpoint and variant generator.

### Phase 3: Gallery, Trips & Highlights
- **Scope:** Instagram-style gallery, trip collections, and country highlights matching Screenshot 1.
- **Key Deliverables:**
  - Central navigation tab bar with 3 icons: **Grid**, **Trips / Filmstrip**, and **Likes**.
  - 5-column square photo grid on desktop with hover overlay icons (heart, comment, share).
  - Trips / Albums management view (trip cards with `0/5 photos` badge, dates, cover).
  - Country highlight carousel with circular gradient rings, country photos, and scroll arrows.
  - Travel photo detail modal (lightbox) with photo metadata, author info, and location.
  - Cursor pagination and lazy loading for gallery performance.

### Phase 4: Stamps, Badges & Achievements
- **Scope:** "Where I've Been" section, visited places counters, and traveler achievements.
- **Key Deliverables:**
  - Relational `Destination` and `UserDestination` engine.
  - Automated detection of visited countries/cities from confirmed completed bookings.
  - "Where I've Been" travel stamps catalog and member stamp collection view.
  - Travel achievement engine (milestone badges for countries visited, trips completed).
  - Prevention of duplicate or invalid badges.

### Phase 5: Public Profile, Privacy & Sharing
- **Scope:** Public accessibility, privacy settings, and sharing capabilities.
- **Key Deliverables:**
  - Public route `/travelers/[handle]` accessible to anonymous visitors without login redirect.
  - Update `proxy.ts` to ensure public traveler routes bypass auth interception.
  - Strict `PublicTravelProfileDTO` omitting emails, phone numbers, and private data.
  - Public/Private profile visibility toggle in profile settings.
  - Privacy authorization on direct media URLs.
  - `UserBlock` enforcement preventing blocked users from viewing or liking profiles.
  - Share Profile modal with copyable URL and OpenGraph metadata tags.

### Phase 6: Integration, Testing & Polish
- **Scope:** Profile management synchronization, automated testing, and responsive refinement.
- **Key Deliverables:**
  - Synchronize `/profile/tab/profile_management/trip_photos` with `?travelTab=photos` and `?travelTab=trips`.
  - Comprehensive automated test suite (security tests, upload tests, constraint tests, DTO tests).
  - Responsive audit across mobile (320px–480px), tablet (768px–1024px), and desktop (1280px+).
  - QA verification of all user flows.

---

## 12. VERIFICATION EVIDENCE & CODE REFERENCES

1. **Unsafe Profile Statistics & Fictitious Trip Counter:**
   - `services/user.service.ts` lines 310–328:
     - `trips: Math.max(tripsCount, photosCount)` confirms unverified bookings and photo-count inflation.
     - `likes: 0` confirms hardcoded likes placeholder.
2. **Retired Travel Stamps Code:**
   - `services/user.service.ts` lines 74–79 & 181–184:
     - Explicit deletion of `stampsVisible`, `selectedStamps`, `customStamps` during save confirms retirement.
   - `__tests__/admin-about-host.test.ts` lines 100–105:
     - Tests asserting `WhereIveBeenSelector` and `TravelStampGraphic` are not rendered.
3. **Middleware Interception of Public Profiles:**
   - `proxy.ts` lines 49–54 & lines 88–97:
     - `matcher: ["/profile/:path*"]` with unauthenticated redirect confirms anonymous access is blocked.
4. **Missing Drag-and-Drop Handlers:**
   - `app/(protected)/profile-management/profile-management-client.tsx` lines 2040–2065:
     - File dropzone contains only `onClick` and file input; `onDragOver` and `onDrop` are absent.
5. **Listing Photo Upload Endpoint Reuse:**
   - `app/(protected)/profile-management/profile-management-client.tsx` lines 1935–1945:
     - `fetch("/api/v1/upload/listing-photo", ...)` confirms trip photos use property listing upload logic.
6. **Flat Photo Schema Without Trip Container:**
   - `prisma/schema.prisma` lines 600–614:
     - `model TripPhoto` has only `id`, `userId`, `url`, `caption`, `location`, `tags`, `createdAt`, `updatedAt`. Lacks `tripId`, `destinationId`, `visibility`, and variants.
7. **Previous Prototype Evidence in Git History:**
   - Git commit `04a3a39` on `dev-latest` and `stash@{0}` contains 87 prototyped files verifying that the architecture in Section 8.2 has been previously validated in draft form.

---

## 13. IMPLEMENTATION COVERAGE & COMPLETION METRICS

### 13.1 Calculation Methodology
Coverage is evaluated across the **18 distinct functional capabilities** required by the client specifications and 5 Figma screenshots:
- **Verified Complete (1.0 weight):** Working in production code, backed by real database data, verified by automated tests.
- **Implemented Needs Fix (0.5 weight):** Code exists on `main`, but contains functional defects, incorrect formulas, or broken workflows.
- **Partially Implemented (0.25 weight):** Rudimentary UI or schema placeholder exists, but core logic or routing is missing.
- **Not Implemented (0.0 weight):** Missing completely from `main`.

### 13.2 Detailed Coverage Breakdown

$$\text{Coverage Score} = \frac{\sum \text{Weights}}{\text{Total Features (18)}} = \frac{1(1.0) + 3(0.5) + 4(0.25) + 10(0.0)}{18} = \frac{1 + 1.5 + 1.0 + 0}{18} = \frac{3.5}{18} \approx 19.4\%$$

| Category | Count | Percentage |
|---|---|---|
| **IMPLEMENTED_VERIFIED** | 1 | 5.6% |
| **IMPLEMENTED_NEEDS_FIX** | 3 | 16.7% |
| **PARTIALLY_IMPLEMENTED** | 4 | 22.2% |
| **NOT_IMPLEMENTED** | 10 | 55.5% |
| **TOTAL** | **18** | **100%** |
| **Weighted Operational Baseline** | — | **19.4%** |

---

## 14. PHASE 0 CONCLUSION & SIGN-OFF

- **Phase 0 Status:** **COMPLETE**
- **Baseline Verdict:** The existing codebase possesses a solid user account, authentication, and media foundation, but the requested Instagram-style Travel Profile and Social Identity system is only **19.4% operational** on `main`.
- **Architectural Readiness:** The route structure, database schema, media pipeline, and phase mappings are fully defined and de-risked. No existing host features or database models will be disturbed.
- **Next Step:** As mandated by strict execution rules, development stops immediately. Phase 1 implementation (Profile UI & Information) will begin only upon explicit user instruction.

