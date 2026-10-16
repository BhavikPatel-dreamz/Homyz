# Phase 5 Implementation Report — Reported Listings & Property Moderation

## 1. Executive Summary

Phase 5 delivers end-to-end functionality for **Reported Listings & Property Moderation** on Homyz. It builds directly upon the Phase 1 moderation foundation, Phase 2 admin moderation console, Phase 3 review system, and Phase 4 review dispute reporting without duplicating tables, controllers, or dispute engines.

Key capabilities introduced:
- **Public Property Detail Reporting Flow**: Public visitors and authenticated guests can report listings directly from the property detail page using the standard `ReportContentModal` and dedicated listing safety/accuracy policies.
- **Dedicated Admin Reported Listings Queue**: Available at `/admin/moderation/reported-listings` with comprehensive status tabs, full-text search, assignee filters, severity and date filters, and direct links to admin inspection.
- **Rich Target Inspection Card for Listings**: In `/admin/moderation/cases/[id]`, moderators can inspect high-resolution photo galleries, location specs, description, host status, active and upcoming guest reservations, prior quality incident disputes, and prior moderation case history.
- **Enforcement & Sanction Actions**: Administrators can resolve cases with explicit listing actions (`WARN_HOST`, `REQUEST_CORRECTION`, `TEMPORARY_RESTRICTION`, `SUSPEND`, `RESTORE`) with automatic audit trails, cache invalidation, and host/reporter notifications.
- **Booking & Marketplace Integrity**: Moderation restrictions (`isPaused: true, published: false` or `status: REJECTED`) immediately exclude properties from public catalogue search and new reservations without cancelling existing confirmed bookings or modifying payment schedules.
- **Host Permission Protection**: Enforced host permission boundaries prevent hosts from unpausing, re-publishing, or overriding administrative moderation restrictions.

---

## 2. Policy Catalog Additions

Added four listing-specific moderation policies in `lib/moderation/policies.ts`:

| Policy Code | Target Type | Severity | Description |
| :--- | :--- | :--- | :--- |
| `FAKE_OR_NONEXISTENT_PROPERTY` | `LISTING` | `CRITICAL` | Property does not exist or host lacks legal authority to list it. |
| `SAFETY_OR_SECURITY_CONCERNS` | `LISTING`, `REVIEW`, `MESSAGE` | `HIGH` | Property safety hazards, physical danger, or security risks. |
| `INCORRECT_PHOTOS` | `LISTING`, `LISTING_PHOTO` | `MEDIUM` | Photos do not represent the actual property. |
| `INACCURATE_LOCATION_OR_AMENITIES` | `LISTING` | `MEDIUM` | Property location, address, or canonical amenities are materially inaccurate. |

---

## 3. Architecture & Key Files Modified / Created

### 3.1 Public Listing Detail Reporting Integration
- **File**: `app/listings/[id]/public-listing-detail-client.tsx`
  - Replaced legacy static `mailto:` anchors with interactive "Report this listing" button triggers in both desktop sticky panel and mobile floating bar.
  - Rendered `ReportContentModal` using `ModalOverlay` (reference-counted body scroll lock, accessible ARIA dialog, clean unmount).
  - Wired report submissions directly to `/api/v1/moderation/reports` with `targetType: "LISTING"`.

### 3.2 Dedicated Admin Reported Listings Queue
- **Page Route**: `app/(protected)/admin/moderation/reported-listings/page.tsx`
  - Server-component with permission guard `PERMISSIONS.MODERATION_CASE_READ`.
  - Automatically scopes list queries to `targetType: "LISTING"`.
- **Loading Skeleton**: `app/(protected)/admin/moderation/reported-listings/loading.tsx`
  - Maintains strict layout contract with the loaded table view to prevent layout shift.
- **Navigation Integration**:
  - `components/admin/admin-sidebar.tsx`: Added `Reported Listings` nav item under Moderation with route prefix `/admin/moderation/reported-listings`.
  - `app/(protected)/admin/moderation/admin-moderation-dashboard-client.tsx`: Added quick-access button to the Reported Listings queue.

### 3.3 Listing Moderation Enforcement & Service Layer
- **Listing Service (`services/listing.service.ts`)**:
  - Added `applyModerationAction({ listingId, action, reason, notes })` encapsulating listing state mutations:
    - `WARN_HOST`: Maintains publication state, records formal warning.
    - `REQUEST_CORRECTION`: Sets `requestedChanges` structured action items on the listing.
    - `TEMPORARY_RESTRICTION`: Sets `isPaused: true, published: false` and invalidates Redis catalog version and listing caches.
    - `SUSPEND`: Sets `isPaused: true, published: false, status: REJECTED, rejectionReason: ...` and invalidates caches.
    - `RESTORE`: Clears restrictions, restores `published: true, isPaused: false, status: ACTIVE, rejectionReason: null, requestedChanges: Prisma.DbNull` and invalidates caches.
- **Moderation Service (`services/moderation.service.ts`)**:
  - Updated `UpdateModerationCaseInput` to accept `listingAction`.
  - Enforced `PERMISSIONS.MODERATION_DECISION_CREATE` check on any enforcement action.
  - Extended `getModerationTargetSummary("LISTING")` to return:
    - Photos, price, property type, location, description, canonical amenities.
    - Host details (name, email, account status, join date).
    - Active and upcoming reservations with guest info, stay dates, and status.
    - Prior `ListingQualityIncident` records.
    - Prior `ModerationCase` records for this property.
  - Dispatched targeted system notifications to hosts and reporters on resolution.

### 3.4 Admin Case Details UI
- **File**: `app/(protected)/admin/moderation/cases/[id]/admin-moderation-case-details-client.tsx`
  - `TargetPreview`: Rendered rich inspection UI for `LISTING` targets:
    - Status badges (Status, Published / Unpublished, Active / Paused).
    - Thumbnail photo gallery and pricing per night.
    - Description preview and canonical amenities.
    - Active & Upcoming reservations table to prevent blind suspensions during active guest stays.
    - Previous quality incidents and prior moderation cases.
    - Links to Admin Listing Management (`/admin/listings/[id]`) and public marketplace view (`/listings/[id]`).
  - `DecisionDialog`: Added `Listing moderation action` selection with descriptive options and safety guidelines when resolving listing cases.

---

## 4. Verification & Quality Assurance

- **TypeScript Compilation**: `npx tsc --noEmit` passed with 0 errors.
- **Unit & Specification Tests**:
  - `__tests__/phase5-reported-listings.test.ts`: 6/6 tests passing.
  - `__tests__/phase4-review-reports-and-disputes.test.ts`: 5/5 tests passing.
  - `__tests__/moderation-foundation.test.ts`: 7/7 tests passing.
  - Total: 18/18 tests passing across moderation test suites.
- **Architectural & Compliance Constraints Verified**:
  - `AGENTS.md` scroll lock compliance verified: `ReportContentModal` and `DecisionDialog` both mount inside `ModalOverlay` with reference-counted locks.
  - Existing confirmed reservations are preserved during restriction/suspension without automatic cancellations or refund side effects.
  - Host listing editor pages were left untouched.

