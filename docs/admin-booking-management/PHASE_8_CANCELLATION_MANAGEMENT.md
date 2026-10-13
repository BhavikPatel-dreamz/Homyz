# Homyz Admin Booking Management — Phase 8: Booking Cancellation Management

## 1. Executive Summary

Phase 8 introduces **Booking Cancellation Management** (`/admin/bookings/cancellations`) inside the Homyz Admin Panel. This module delivers a dedicated operational command center where administrators can monitor, investigate, and process cancellations across the entire platform.

It categorizes cancellations by initiator (`GUEST`, `HOST`, `ADMIN`), flags cases requiring financial attention (such as pending refunds or payment disputes), and equips administrators with a secure, authorized cancellation mutation that frees inventory immediately and maintains an unbroken audit trail.

---

## 2. Core Architecture & Backend Services

### 2.1 Backend Service Methods (`services/booking.service.ts`)

1. **`listCancellationsForAdmin(actor, opts)`**:
   - Strictly enforces `assertRole(actor, [Role.ADMIN])`.
   - Filters on canonical database status `BookingStatus.CANCELLED`.
   - Segregates cancellations by initiator via `priceBreakdown.cancellation.cancelledBy` or `priceBreakdown.rejection.rejectedBy`.
   - Supports search across booking ID, listing title, guest name/email, and host name/email.
   - Applies date range filtering on check-in dates and cancellation dates.
   - Enforces bounded server-side pagination (`limit <= 100`) and safe offset calculation.

2. **`getCancellationSummaryForAdmin(actor)`**:
   - Produces authoritative aggregate counts across 5 KPI metrics:
     * `totalCancellations`: Total cancelled bookings.
     * `guestCancellations`: Cancelled by guest (`cancelledBy === "GUEST"`).
     * `hostCancellations`: Cancelled by host or rejected booking requests (`cancelledBy === "HOST"` or `rejectedBy === "HOST"`).
     * `adminCancellations`: Administratively intervened cancellations (`cancelledBy === "ADMIN"`).
     * `requiresAttention`: Cancellations with payment status `REFUND_PENDING`, `DISPUTED`, or explicit attention flags.

3. **`cancelBookingByAdmin(actor, id, reason, notes)`**:
   - **Access Control**: Requires `assertRole(actor, [Role.ADMIN])` and `requireApiPermission(req, PERMISSIONS.BOOKINGS_CANCEL)`.
   - **Validation**: Enforces non-empty cancellation reason. Rejects double cancellation (`AppError.conflict`) and past completed reservations (`AppError.badRequest`).
   - **Atomic Transaction (`prisma.$transaction`)**:
     * Updates `Booking.status` to `BookingStatus.CANCELLED`.
     * Records metadata in `priceBreakdown.cancellation`:
       ```json
       {
         "cancelledAt": "2026-10-10T14:00:00.000Z",
         "cancelledBy": "ADMIN",
         "adminId": "admin-uuid",
         "adminEmail": "admin@homyz.com",
         "reason": "Administrative cancellation reason",
         "notes": "Optional internal context",
         "guestRefundAmount": 120000,
         "hostPayoutRetained": 0
       }
       ```
   - **Immediate Inventory Release**: Releasing the reservation dates so they become immediately bookable on guest and host calendars.
   - **Cache Invalidation**: Triggers `invalidateBookingCache(id, userId, hostId)` and `triggerGuestFavoriteReevaluation(listingId)`.
   - **Dual Notification**: Dispatches distinct, professional notifications to both the Guest and the Host informing them of the administrative cancellation and the recorded reason.
   - **Messaging System Update**: Inserts a conversation status message via `messagingService.recordBookingStatusMessage`.
   - **Audit Log Entry**: Records an unalterable `AuditLog` entry with action `"BOOKING_CANCELLED_BY_ADMIN"`.

### 2.2 Dedicated API Endpoints

- `GET /api/v1/admin/bookings/cancellations`: Server-side paginated list of cancellations with filtering and sorting.
- `GET /api/v1/admin/bookings/cancellations/summary`: Authoritative KPI metrics summary.
- `POST /api/v1/admin/bookings/[id]/cancel`: Authorized administrative cancellation mutation requiring `{ reason: string, notes?: string }`.

---

## 3. UI/UX Implementation Details

### 3.1 Route & Access Control
- **Path**: `/admin/bookings/cancellations` (with backwards-compatible redirect from `/admin/cancellation`).
- **Guards**: Server-side page guard `requirePageRole([Role.ADMIN])`.

### 3.2 5 KPI Metric Cards
- **Total Cancellations**: All-time cancellation count.
- **Guest Initiated**: Blue badge, filter tab shortcut.
- **Host Initiated**: Amber badge, host declines & cancellations.
- **Admin Initiated**: Purple badge, administrative interventions.
- **Needs Review**: Rose badge, pending refunds or disputes.
- Clicking any KPI card immediately filters the table to that specific category.

### 3.3 Status Filter Tabs
- Five tabs: `All Cancellations`, `Guest Canceled`, `Host Canceled`, `Admin Canceled`, `Requires Attention`.
- Displays real-time badge counts per category.

### 3.4 Search & Advanced Filters Drawer
- Debounced text search matching booking reference, listing title, guest name/email, and host name/email.
- Slide-out filter drawer rendered using `ModalOverlay` from `@/components/ui/modal-overlay` with reference-counted scroll locking:
  - Cancellation policy filter (Flexible, Moderate, Strict).
  - Stay check-in date range picker.
  - Multi-column sort options (Cancellation date, Check-in date, Total price; Ascending / Descending).

### 3.5 Cancellations Table & Initiator Badging
- Responsive, tabular layout with columns:
  * **Reference**: Booking ID snippet with attention alert badge if flagged.
  * **Property**: Listing thumbnail, title, and city.
  * **Guest & Host**: Contact details for both parties.
  * **Initiator**: Prominent badge (`👤 Guest`, `🏠 Host`, `🛡️ Admin`, `System`).
  * **Reason & Date**: Truncated cancellation reason with full timestamp.
  * **Stay Dates**: Check-in, check-out, and duration in nights.
  * **Financials**: Total price and cancellation policy.
  * **Actions**: "View Details" action button.

### 3.6 Cancellation Details Modal
- Outer overlay rendered exclusively with `ModalOverlay`.
- Displays comprehensive audit breakdown:
  * Initiator and administrator identity.
  * Recorded cancellation reason and internal notes.
  * Cancellation policy snapshot.
  * Calculated guest refund amount and host payout retention.
  * Underlying payment transactions (Captured, Refunded, Pending).
  * Direct deep link to `/admin/bookings/[id]`.

### 3.7 Admin Cancellation Action Modal
- Triggerable directly from booking previews.
- Explicit cancellation reason input with mandatory validation.
- Internal notes textarea for audit recording.
- Clear warning of inventory and notification consequences.
- Submits to `POST /api/v1/admin/bookings/[id]/cancel` and auto-refreshes data upon completion.

### 3.8 Layout-Matched Loading Skeleton
- `app/(protected)/admin/bookings/cancellations/loading.tsx` precisely preserves container widths, 5 KPI cards, tab bar, search input, and table row heights to prevent layout shift.

---

## 4. Verification & Testing

Automated tests in `__tests__/admin-booking-calendar-cancellation-phase7-phase8.test.ts` verify:
1. Server-side RBAC guards: `Role.ADMIN` and `PERMISSIONS.BOOKINGS_CANCEL` enforced; hosts and guests rejected.
2. Mandatory reason validation: Empty or whitespace-only reasons rejected with 400 Bad Request.
3. Cancellation idempotency: Already cancelled reservations rejected with 409 Conflict; completed stays rejected with 400 Bad Request.
4. Administrative metadata persistence: Complete audit details recorded in `priceBreakdown.cancellation`.
5. 5 KPI metrics calculations: Correct segmentation across guest, host, admin, and attention counts.
6. Status tab isolation: Clean segregation of cancellations without overlapping records.

