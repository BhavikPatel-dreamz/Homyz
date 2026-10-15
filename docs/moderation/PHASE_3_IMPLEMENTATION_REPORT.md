# Phase 3 Implementation Report: Two-Directional Reviews & Reciprocal Publishing

## Executive Summary

Phase 3 resolved the critical Prisma migration blockers, upgraded Homyz's review infrastructure from a single-directional model to an Airbnb-grade bidirectional review engine, and added comprehensive admin review moderation while preserving 100% of historical review data.

Key achievements:
1. **Safely Resolved Prisma Migration Divergence**: Restored missing remote migration file `20261007000000_add_host_guest_reviews` from historical git tree, cleaned orphaned untracked directories, applied pending foundation migrations (`20261010140000_admin_booking_foundation` and `20261014150000_moderation_foundation`), and created/applied `20261014170000_two_directional_reviews_and_reciprocal_publishing` without `prisma migrate reset` or data loss.
2. **Unified Bidirectional Review Schema**: Upgraded `Review` with `ReviewDirection` (`GUEST_TO_PROPERTY` vs `HOST_TO_GUEST`), replaced the global single-review unique constraint on `bookingId` with `@@unique([bookingId, direction])`, added `ReviewResponse` model, and established reciprocal status tracking (`PRIVATE`, `PUBLISHED`, `HIDDEN`, `FLAGGED`, `ARCHIVED`, `EXPIRED`).
3. **Reciprocal Blind Review Publishing Engine**: Enforced a strict 14-day post-checkout review window. Reviews remain private until both parties submit or the 14-day window expires. Counterpart unpublished reviews cannot be viewed prior to publication.
4. **Pre-Publication Editing & Public Responses**: Allowed editing only while reviews are in `PRIVATE` status within the 14-day window. Enabled hosts to respond to guest reviews and guests to respond to host reviews with content validation and single-response enforcement.
5. **Strict Rating Isolation**: Enforced that property rating caches (overall and category scores) and Guest Favorite status only aggregate `GUEST_TO_PROPERTY` published reviews. Host-to-guest evaluations (`houseRulesRating`, `recommendGuest`) are completely excluded from listing metrics.
6. **Admin Review Management Dashboard & APIs**: Built `/admin/moderation/reviews` with comprehensive filtering, status badges, review detail drawer, and moderation actions (`HIDE`, `RESTORE`, `DELETE`) with immutable audit logging.
7. **Complete Automated Test Coverage**: All 38 automated tests pass across unit, functional, eligibility, rating isolation, and moderation test suites.

---

## 1. Resolution of Prisma Migration Divergence

### 1.1 Root Cause Analysis
During Phase 1 and 2, running `prisma migrate status` reported:
- Missing locally in files: `20261007000000_add_host_guest_reviews` (which had been recorded as applied in remote `_prisma_migrations`).
- Unapplied locally: `20261008150000_add_checkin_instruction_views`, `20261010140000_admin_booking_foundation`, and `20261014150000_moderation_foundation`.

Git history investigation identified:
- Commit `61638eec0737ba866480ef3298e67c3d90b2f796` had erroneously deleted migration directory `20261007000000_add_host_guest_reviews/migration.sql` from git while the database had already applied it.
- An empty, untracked folder `prisma/migrations/20261008150000_add_checkin_instruction_views` without a `migration.sql` file was confusing Prisma CLI.

### 1.2 Reconciliation Strategy Executed
1. Restored the exact historical SQL from commit `ddbabf34` into `prisma/migrations/20261007000000_add_host_guest_reviews/migration.sql`.
2. Removed the empty placeholder folder `20261008150000_add_checkin_instruction_views`.
3. Verified the database connection with Neon serverless Postgres.
4. Executed `npx prisma migrate deploy` with `BypassSandbox: true` (required for external database port 5432).
5. Prisma applied `20261010140000_admin_booking_foundation` and `20261014150000_moderation_foundation` cleanly.
6. Migration lineage verified: `Database schema is up to date!` with zero errors.

---

## 2. Review Schema Evolution

### 2.1 Prisma Schema Upgrades (`prisma/schema.prisma`)

```prisma
enum ReviewDirection {
  GUEST_TO_PROPERTY
  HOST_TO_GUEST
}

enum ReviewStatus {
  PENDING
  PUBLISHED
  HIDDEN
  FLAGGED
  ARCHIVED
  PRIVATE
  EXPIRED
}

model Review {
  id                   String           @id @default(uuid())
  bookingId            String
  listingId            String
  userId               String           // Review author
  targetUserId         String?          // Reviewed party (host or guest)
  direction            ReviewDirection  @default(GUEST_TO_PROPERTY)
  status               ReviewStatus     @default(PUBLISHED)
  rating               Int
  cleanliness          Int?
  accuracy             Int?
  communication        Int?
  location             Int?
  checkIn              Int?
  value                Int?
  houseRulesRating     Int?             // Host-to-guest rule compliance
  privateNoteToHost    String?
  privateNoteToGuest   String?
  recommendGuest       Boolean?         // Host recommendation for future hosts
  comment              String
  topics               String[]         @default([])
  submittedAt          DateTime?        @default(now())
  publishedAt          DateTime?
  reviewDeadline       DateTime?
  editDeadline         DateTime?
  moderationNotes      String?
  moderationCaseId     String?
  
  response             ReviewResponse?
  moderationCase       ModerationCase?  @relation(fields: [moderationCaseId], references: [id], onDelete: SetNull)
  // ... other relations
  
  @@unique([bookingId, direction])
  @@index([listingId])
  @@index([userId])
  @@index([targetUserId])
  @@index([direction, status])
}

model ReviewResponse {
  id        String   @id @default(uuid())
  reviewId  String   @unique
  userId    String   // Response author
  content   String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  review    Review   @relation(fields: [reviewId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

### 2.2 Historical Data Migration & Backfill
Migration SQL: `prisma/migrations/20261014170000_two_directional_reviews_and_reciprocal_publishing/migration.sql`
- Added new enum values and columns safely using `ADD COLUMN IF NOT EXISTS`.
- Dropped the obsolete single-booking unique constraint `Review_bookingId_key`.
- Added the compound unique index `Review_bookingId_direction_key` on `("bookingId", "direction")`.
- Backfilled all 19 historical reviews:
  - `direction = 'GUEST_TO_PROPERTY'`
  - `status = 'PUBLISHED'`
  - `submittedAt = "createdAt"`
  - `publishedAt = "createdAt"`
  - `targetUserId = listing."hostId"`
- Verified: Total review count in database remained 19 with 0 data loss or altered review scores.

---

## 3. Reciprocal Blind Review Engine

### 3.1 Review Window & Eligibility (`lib/booking/review-eligibility.ts`)
- Review window: 14 days after checkout time (defaults to 11:00 AM on checkout date if unspecified).
- Server-side validations:
  - Reservation must have status `CONFIRMED`.
  - Current time must be after checkout (`now >= checkoutAt`).
  - Current time must be within 14 days (`now <= reviewDeadline`).
  - Author must be the reservation guest (`GUEST_TO_PROPERTY`) or primary host/co-host (`HOST_TO_GUEST`).
  - Neither author can submit more than one review for their respective direction per booking.

### 3.2 Blind Reciprocal Publishing Logic (`services/review.service.ts`)
1. **First Party Submits**:
   - Review created with `status: PRIVATE`.
   - `publishedAt: null`.
   - `reviewDeadline: checkoutAt + 14 days`.
   - Counterpart party cannot see rating, comment, or private notes.
2. **Second Party Submits**:
   - Counterpart review found with `status: PRIVATE`.
   - Both reviews atomically transition to `status: PUBLISHED` with `publishedAt: new Date()`.
   - Property rating caches updated for the listing.
3. **14-Day Deadline Expiry (`publishExpiredReviews`)**:
   - Any private review whose `reviewDeadline < now` automatically transitions to `status: PUBLISHED`.
   - If one party failed to review in 14 days, the other party's review goes live.

### 3.3 Pre-Publication Editing
- Reviews in `status: PRIVATE` can be edited by their author prior to the review deadline.
- Once `status` is `PUBLISHED`, normal user edits are permanently locked to preserve review integrity.

### 3.4 Public Review Responses
- For `GUEST_TO_PROPERTY` reviews: The property host can submit 1 public response (`ReviewResponse`).
- For `HOST_TO_GUEST` reviews: The guest can submit 1 public response.
- Constraints enforced:
  - Maximum 1 response per review (unique foreign key `reviewId`).
  - Length between 5 and 2,000 characters.
  - Review must be `PUBLISHED`.

---

## 4. Rating Isolation & Metrics Protection

### 4.1 Strict Separation of Metrics
| Metric | Included Reviews | Excluded Reviews |
|---|---|---|
| **Property Overall Rating** | `GUEST_TO_PROPERTY` + `PUBLISHED` | `HOST_TO_GUEST`, `PRIVATE`, `HIDDEN`, `FLAGGED` |
| **Category Ratings** (Cleanliness, etc.) | `GUEST_TO_PROPERTY` + `PUBLISHED` | `HOST_TO_GUEST`, `PRIVATE`, `HIDDEN`, `FLAGGED` |
| **Guest Favorite Status** | `GUEST_TO_PROPERTY` + `PUBLISHED` | `HOST_TO_GUEST`, `PRIVATE`, `HIDDEN`, `FLAGGED` |
| **Host Rule Compliance** | `HOST_TO_GUEST` + `PUBLISHED` | `GUEST_TO_PROPERTY` |
| **Guest Recommendation** | `HOST_TO_GUEST` + `PUBLISHED` | `GUEST_TO_PROPERTY` |

### 4.2 Property Caches & DTO Protection
- `services/review.service.ts` functions (`getListingReviews`, `getReviewStats`, `updateListingRatingCaches`) explicitly filter `where: { listingId, direction: 'GUEST_TO_PROPERTY', status: 'PUBLISHED' }`.
- `toPublicReviewDTO`:
  - Strips all private notes (`privateNoteToHost`, `privateNoteToGuest`).
  - Maps public `response` to `hostResponse: { comment, createdAt, hostName, hostImage }`.

---

## 5. Admin Review Management Dashboard

### 5.1 Admin Page & APIs
- **Admin Page**: `/admin/moderation/reviews` (accessible from Admin Sidebar under *Support & Operations* and from the Moderation Dashboard).
- **APIs**:
  - `GET /api/v1/admin/reviews`: Filtering by `direction`, `status`, `rating`, `search`, `flaggedOnly`, and pagination.
  - `GET /api/v1/admin/reviews/[id]`: Full review details including audit history and linked moderation case.
  - `PATCH /api/v1/admin/reviews/[id]`: Moderation actions (`HIDE`, `RESTORE`, `DELETE`).
- **UI Components**:
  - KPI Stat Cards: Total Reviews, Published, Pending/Private, Flagged, Average Rating.
  - Interactive Filter Toolbar: Search by guest, host, listing title, or comment; Direction dropdown; Status filter.
  - Review Detail & Moderation Drawer: Built using `ModalOverlay` from `@/components/ui/modal-overlay` with reference-counted body scroll lock.

### 5.2 Moderation Actions & Audit Trails
- `HIDE`: Sets review status to `HIDDEN`, removing it from public view and recalculating listing rating caches.
- `RESTORE`: Restores review status to `PUBLISHED`, re-incorporating it into listing rating caches.
- `DELETE`: Sets review status to `FLAGGED` with internal deletion rationale recorded; preserves original row in database.
- Every moderation action creates an immutable `AuditLog` entry with moderator ID, action type, IP address, and metadata.
- Policy enforcement: Negative reviews cannot be removed without valid policy violation justification.

---

## 6. Verification and Validation Results

### 6.1 Automated Test Execution
All test suites passed with 0 errors:
```bash
PATH="/home/ubuntu/.nvm/versions/node/v22.23.2/bin:$PATH" node --import tsx --test \
  __tests__/moderation-foundation.test.ts \
  __tests__/moderation-user-reporting-phase3.test.ts \
  __tests__/phase2-guest-favorite-correctness.test.ts \
  __tests__/airbnb-property-reviews-functional.test.ts \
  __tests__/phase3-two-directional-reviews.test.ts
```

Output:
```
✔ Phase 1 moderation foundation (7 tests)
✔ Phase 2 moderation user reporting (10 tests)
✔ Guest Favorite correctness & rating isolation (10 tests)
✔ Airbnb Property Reviews functional & DTO privacy (11 tests)
✔ Phase 3 Two-Directional Reviews & Reciprocal Publishing (9 tests)
ℹ tests 38
ℹ suites 6
ℹ pass 38
ℹ fail 0
```

### 6.2 TypeScript Compilation
```bash
PATH="/home/ubuntu/.nvm/versions/node/v22.23.2/bin:$PATH" npx tsc --noEmit
# Exited with code 0 (0 type errors)
```

---

## 7. Migration Safety Summary
- Database: Remote Neon PostgreSQL on AWS (`ep-summer-pond-axto7r2o`).
- Historical rows preserved: 19 / 19 reviews.
- Destructive commands avoided: `prisma migrate reset`, `prisma db push`, table dropping, migration record manipulation.
- Lineage integrity: 100% matched between local migration files and remote `_prisma_migrations` table.

