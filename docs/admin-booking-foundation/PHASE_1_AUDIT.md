# HOMYZ — ADMIN BOOKING & REFUND MANAGEMENT
## PHASE 1 AUDIT: COMPLETE SYSTEM AUDIT & ARCHITECTURE INVESTIGATION

**Platform:** Homyz Travel & Hospitality Platform  
**Target Module:** Admin Booking & Refund Management (Foundation Phases 1 & 2)  
**Date of Audit:** October 2026  
**Auditor:** Senior Next.js Architect, Backend Engineer & Security Auditor  

---

## 1. EXECUTIVE SUMMARY & ARCHITECTURAL OVERVIEW

Homyz is a modern hospitality and booking platform built on **Next.js 16.3.3 (App Router)** and **React 19.2.8**, operating in `output: "standalone"` mode. The database tier runs on **PostgreSQL** via **Prisma 7.10.0** with `@prisma/adapter-pg` driver adapter. The application features dual-channel authentication supporting NextAuth JWT cookies for web browser clients and `jose` Bearer access tokens for mobile and API clients.

The system currently includes functioning Guest checkout, Host listing management, Host calendar availability, and basic Admin dashboard views. However, administrative management of bookings, payments, and refunds is currently in an unformalized foundation state:
- There are **no versioned administrative booking REST endpoints** under `/api/v1/admin/bookings/`.
- The current Admin Bookings web interface (`app/(protected)/admin/bookings/page.tsx`) queries a hardcoded `take: 50` records from Prisma without server-side filtering, searching, or pagination.
- Payment processing is currently running in `DEFERRED` / `MOCK` mode (`lib/booking/payment-policy.ts`). No live payment gateway SDK (e.g. Moyasar) is currently connected.
- The database schema lacks explicit entities for payment transactions and refunds; all payment status and financial reconciliation data are stored inside an unstructured `priceBreakdown: Json?` field on the `Booking` model.
- Concurrency and double-booking protections are implemented at checkout via PostgreSQL transactional advisory locks (`pg_advisory_xact_lock`), but lack complementary database indexes for admin queries and administrative audit tracing.

---

## 2. ARCHITECTURE MAP & BOOKING WORKFLOW

```
                                      ┌────────────────────────┐
                                      │  Guest Checkout Flow   │
                                      │   (app/book/[id]/)     │
                                      └───────────┬────────────┘
                                                  │
                                                  ▼
                                      ┌────────────────────────┐
                                      │ Booking Service / R2B  │
                                      │(services/booking.ts)   │
                                      └───────────┬────────────┘
                                                  │
                                                  ▼
                        ┌─────────────────────────────────────────────────┐
                        │              Database (PostgreSQL)              │
                        │  - pg_advisory_xact_lock(hashtext(listingId))   │
                        │  - Listing FOR SHARE concurrency check          │
                        │  - Booking.create (Status: PENDING / CONFIRMED) │
                        │  - ReservationTax snapshots                     │
                        └──────────┬───────────────────────────┬──────────┘
                                   │                           │
                   [Instant Book]  │                           │  [Request to Book]
                                   ▼                           ▼
                        ┌─────────────────────┐     ┌─────────────────────┐
                        │ Status: CONFIRMED   │     │ Status: PENDING     │
                        │ Immediate Hold      │     │ 24h Expiry Hold     │
                        └──────────┬──────────┘     └──────────┬──────────┘
                                   │                           │
                                   │                           ▼
                                   │                ┌─────────────────────┐
                                   │                │  Host Notification  │
                                   │                │ & Host Approval API │
                                   │                │  (accept / reject)  │
                                   │                └──────────┬──────────┘
                                   │                           │
                                   ├───────────────────────────┘
                                   │
                                   ▼
                        ┌─────────────────────────────────────────────────┐
                        │          Post-Confirmation Operations           │
                        │  - Messaging: Conversation status update        │
                        │  - Notifications: Guest / Host alerts           │
                        │  - Calendar: Confirmed inventory hold           │
                        │  - Audit Service: Trace event recorded          │
                        └──────────┬──────────────────────────────────────┘
                                   │
                                   ▼
                        ┌─────────────────────────────────────────────────┐
                        │        Admin Operations & Audit Interface       │
                        │  ⚠️ MISSING: /api/v1/admin/bookings endpoints   │
                        │  ⚠️ MISSING: Structured Payment/Refund tables   │
                        │  ⚠️ PARTIAL: RSC Dashboard (50 item in-memory)  │
                        └─────────────────────────────────────────────────┘
```

---

## 3. AUDIT FINDINGS REGISTER

### 3.1 Project Architecture & Setup

| ID | Feature | Current Implementation | Status | Relevant File Path | Technical Issue | Severity | Recommended Resolution |
|---|---|---|---|---|---|---|---|
| ARC-01 | Next.js Architecture | App Router only (`app/`), Next.js 16.3.3, React 19.2.8, TypeScript 5 | Implemented | `package.json`, `next.config.ts` | Node engine `>=22` required by `nanoid@6`. Shell default node version was v16.15.0; must run with Node v22 (`/home/ubuntu/.nvm/versions/node/v22.23.2/bin/node`). | Low | Ensure all scripts and CI workflows explicitly target Node 22. |
| ARC-02 | Admin Booking Routes | Only RSC page `app/(protected)/admin/bookings/page.tsx` exists. | Partial | `app/(protected)/admin/bookings/page.tsx` | No versioned API routes under `/api/v1/admin/bookings/`. RSC loads 50 bookings into memory and passes to client component. | High | Establish versioned, reusable endpoints under `/api/v1/admin/bookings` supporting server-side filtering, pagination, and sorting. |
| ARC-03 | Request Proxy & Guards | `proxy.ts` handles optimistic redirects. Server-side guards enforce roles. | Implemented | `proxy.ts`, `lib/permissions/guards.ts` | None; proxy correctly leaves security boundaries to route handlers and service guards. | Info | Retain existing defense-in-depth security boundary. |

---

### 3.2 Guest Booking Workflow

| ID | Feature | Current Implementation | Status | Relevant File Path | Technical Issue | Severity | Recommended Resolution |
|---|---|---|---|---|---|---|---|
| GST-01 | Stay Validation | Dates, min/max nights, advance notice, same-day cutoff, blocked dates | Implemented | `lib/booking/availability.ts` | Fully checks calendar boundaries, local midnight adjustments, and cutoff hours. | Info | Reuse `validateStayAvailability` as authoritative availability engine. |
| GST-02 | Price Calculation & Quote | Authoritative quote calculation with taxes, discounts, and fees | Implemented | `services/booking.service.ts`, `services/pricing.service.ts` | Calculates exact minor-unit integers. Validates `expectedGuestTotal` against quote to prevent checkout price skew. | Info | Keep `getBookingQuote` as the single source of truth for pricing. |
| GST-03 | Instant Book vs Request to Book | Authoritative resolution based on `listing.bookingApprovalMode` and `instantBook` flag | Implemented | `lib/booking/booking-mode.ts`, `services/booking.service.ts` | Instant Book immediately sets `status: CONFIRMED`. Request to Book sets `status: PENDING` and calculates 24h `expiresAt`. | Info | Maintain distinct workflows while standardizing status representations. |
| GST-04 | Double Submission Idempotency | Client provides `requestSubmissionId` | Implemented | `services/booking.service.ts`, `services/request-to-book.service.ts` | Uses PostgreSQL transactional advisory lock `pg_advisory_xact_lock(hashtext(submissionId))` and unique column index. | Info | Preserve idempotency locking strategy across all booking mutations. |
| GST-05 | Client-side Payment Simulation | Mock credit card, Apple Pay, Google Pay, and mada inputs in UI | Partial | `lib/booking/payment-method.ts` | No real payment gateway SDK is active. Operates in `DEFERRED` mode. Raw card fields are cleared in client memory via `clearRawCardFields()`. | Medium | Maintain safe mock UI while preparing backend architecture for real payment transactions. |

---

### 3.3 Host Booking Management

| ID | Feature | Current Implementation | Status | Relevant File Path | Technical Issue | Severity | Recommended Resolution |
|---|---|---|---|---|---|---|---|
| HST-01 | Pending Requests List | Host query filters `listing.hostId = actor.id` and `status = PENDING` | Implemented | `services/booking.service.ts:listPendingForHost` | Properly excludes expired requests using `createdAt > expiryThresholdDate`. | Info | Reuse pending query filter logic. |
| HST-02 | Host Acceptance | `POST /api/v1/host/bookings/[id]/accept` | Implemented | `app/api/v1/host/bookings/[id]/accept/route.ts`, `services/booking.service.ts` | Uses advisory lock `pg_advisory_xact_lock(hashtext(id))`. Verifies host ownership, non-expiration, and absence of overlapping confirmed stays. Transitions status to `CONFIRMED`. | Info | Keep existing acceptance logic and integrate with centralized state transition manager. |
| HST-03 | Host Rejection | `POST /api/v1/host/bookings/[id]/reject` | Implemented | `app/api/v1/host/bookings/[id]/reject/route.ts`, `services/booking.service.ts` | Uses advisory lock. Transitions status to `CANCELLED`, records rejection reason in `priceBreakdown.rejection`, and releases held inventory. | Info | Keep existing rejection logic and standardize reason tracking. |
| HST-04 | 24-Hour Expiry Window | Centralized math in `lib/booking/booking-expiry.ts` | Implemented | `lib/booking/booking-expiry.ts`, `app/api/v1/bookings/expire-stale/route.ts` | `REQUEST_TO_BOOK_RESPONSE_HOURS = 24`. Stale requests can be expired on demand. Accepting an expired request fails closed with `409 Conflict` (`REQUEST_EXPIRED`). | Info | Keep 24-hour expiration rule and add admin triggering capabilities. |
| HST-05 | Host API Role Restriction | `requireApiRole(req, [Role.HOST])` on accept and reject routes | Broken | `app/api/v1/host/bookings/[id]/accept/route.ts`, `app/api/v1/host/bookings/[id]/reject/route.ts` | Host routes only accept `[Role.HOST]`. If an Administrator attempts to assist a host by approving or rejecting via host endpoints, `requireApiRole` rejects with `403 Forbidden`. | Medium | Allow `[Role.HOST, Role.ADMIN]` or provide dedicated administrative endpoints. |

---

### 3.4 Host Calendar & Availability

| ID | Feature | Current Implementation | Status | Relevant File Path | Technical Issue | Severity | Recommended Resolution |
|---|---|---|---|---|---|---|---|
| CAL-01 | Public Booked Dates API | `GET /api/v1/listings/[id]/booked-dates` | Implemented | `app/api/v1/listings/[id]/booked-dates/route.ts` | Returns active confirmed stays, non-expired pending holds, and host-blocked dates without leaking guest or financial details. | Info | Keep public endpoint privacy guarantees intact. |
| CAL-02 | Overlap Protection | Transactional concurrency lock during `bookingService.create` | Implemented | `services/booking.service.ts` | Acquires advisory lock on `listingId` and `FOR SHARE` row lock on `Listing`. Checks for overlapping `CONFIRMED` and active `PENDING` bookings before insert. | Info | Ensure admin booking modifications maintain this identical concurrency guarantee. |
| CAL-03 | Host Calendar Block vs Confirmed Bookings | Host can block dates via `listing.blockedDates` | Partial | `services/listing.service.ts` | Host editing blocked dates must never unblock or overwrite an active confirmed reservation. | Medium | Verify that unblocking dates does not mutate or release dates held by confirmed reservations. |

---

### 3.5 Existing Payment System

| ID | Feature | Current Implementation | Status | Relevant File Path | Technical Issue | Severity | Recommended Resolution |
|---|---|---|---|---|---|---|---|
| PAY-01 | Payment Gateway Provider | No active provider SDK. Configured for future Moyasar integration. | Unverified | `lib/booking/payment-policy.ts` | `paymentMode: "DEFERRED"`. No live API keys, webhooks, or payment captures exist in the repository. | Medium | Truthfully document provider absence. Build database and service abstraction ready for Moyasar. |
| PAY-02 | Authorization vs Capture Separation | Documented conceptually in `payment-policy.ts` and `payment-method.ts` | Partial | `lib/booking/payment-policy.ts` | Because gateway is in DEFERRED mode, no actual authorization holds or captures are executed. Status is stored as `PAYMENT_PENDING`. | Medium | Establish structured database entities for `PaymentTransaction` with statuses (`PENDING`, `AUTHORIZED`, `CAPTURED`, `FAILED`, `VOIDED`). |
| PAY-03 | Webhook Infrastructure | No payment webhook handlers exist under `app/api/` | Missing | `app/api/` | No webhook endpoint, signature verification, or idempotency deduplication for payment callbacks exists. | High | Document webhook requirements for Phase 3/4 and design idempotent event logging foundation. |
| PAY-04 | Host Payouts | Calculations exist in `pricing.service.ts` (`calculateHostPayout`) | Partial | `services/pricing.service.ts`, `services/app-settings.service.ts` | Net host payout is calculated and stored in `priceBreakdown.payoutBreakdown`, but no disbursement or bank payout ledger exists. | Medium | Preserve payout calculations in snapshots without triggering real disbursements. |

---

### 3.6 Cancellation & Refund Logic

| ID | Feature | Current Implementation | Status | Relevant File Path | Technical Issue | Severity | Recommended Resolution |
|---|---|---|---|---|---|---|---|
| CAN-01 | Cancellation Policy Storage | Snapshot stored on `Booking.cancellationPolicy` and `priceBreakdown.cancellationPolicySnapshot` | Implemented | `prisma/schema.prisma`, `services/booking.service.ts` | Booking captures policy at reservation time. Changing listing policy does not mutate existing bookings. | Info | Maintain immutable policy snapshots on bookings. |
| CAN-02 | Guest Cancellation | `cancelBookingByGuest` and `cancelNonRefundableByGuest` | Implemented | `services/booking.service.ts` | Validates ownership; rejects cancellations after check-in date. Correctly sets `guestRefundAmount: 0` for non-refundable bookings. | Info | Retain existing guest cancellation rules. |
| CAN-03 | Refund Representation | Refund amounts stored inside `priceBreakdown.cancellation` JSON | Partial | `services/booking.service.ts` | No dedicated `Refund` entity. Total refunded amounts cannot be queried efficiently via SQL or capped by database constraints against captured payments. | High | Add dedicated `BookingRefund` model with foreign keys, statuses, and validation preventing refunds > captured amount. |
| CAN-04 | Cancellation Audit Logging | Audit log recording during guest/host cancellations | Broken | `services/booking.service.ts:cancelBookingByGuest`, `services/booking.service.ts:cancelBookingByHost` | While `create`, `accept`, `reject`, and `expire` call `auditService.record()`, `cancelBookingByGuest`, `cancelNonRefundableByGuest`, and `cancelBookingByHost` do NOT record audit logs! | High | Add `auditService.record()` calls to all cancellation functions to preserve operational audit trails. |

---

### 3.7 Admin Access & Permissions

| ID | Feature | Current Implementation | Status | Relevant File Path | Technical Issue | Severity | Recommended Resolution |
|---|---|---|---|---|---|---|---|
| SEC-01 | Admin Authentication & RBAC | Role enum (`ADMIN`, `HOST`, `USER`), fine-grained permission slugs | Implemented | `lib/permissions/permissions.ts`, `lib/permissions/guards.ts` | Permissions like `BOOKINGS_VIEW`, `BOOKINGS_MANAGE`, `BOOKINGS_CANCEL`, `PAYMENTS_VIEW`, `PAYMENTS_REFUND` are defined and enforced server-side. | Info | Utilize `requireApiPermission` with `PERMISSIONS.BOOKINGS_VIEW` for all new admin booking endpoints. |
| SEC-02 | Protection of Sensitive Secrets | Door codes, Wi-Fi passwords, lockbox codes in listing | Partial | `services/booking.service.ts:getBookingDetails` | `getBookingDetails` gates Wi-Fi and door codes to 48 hours prior to check-in (`actions.isArrivalInfoReleased`). However, Admin read endpoints should never leak these private host/guest secrets. | High | In admin booking endpoints, explicitly omit or sanitize `wifiPassword`, `doorCode`, and `lockboxCode`. |
| SEC-03 | Unauthenticated Expiry Route | `POST /api/v1/bookings/expire-stale` | Broken | `app/api/v1/bookings/expire-stale/route.ts` | Route handler has no auth guard (`requireApiAuth` / `requireApiPermission` is absent). Anyone can trigger the query. | Medium | Add authentication / admin permission guard to `expire-stale` endpoint. |
| SEC-04 | IDOR Protection | Ownership assertions in service layer | Implemented | `lib/permissions/authorize.ts:assertOwnership` | Verifies user ownership on all guest/host operations. Admins bypass ownership checks server-side. | Info | Retain service-layer ownership assertions. |

---

### 3.8 Database Relationships & Performance

| ID | Feature | Current Implementation | Status | Relevant File Path | Technical Issue | Severity | Recommended Resolution |
|---|---|---|---|---|---|---|---|
| DB-01 | Cascade Deletion on User | `user User @relation(..., onDelete: Cascade)` on `Booking` | Broken | `prisma/schema.prisma:734` | If a user is deleted, their booking history would be deleted, destroying financial and audit history. | High | Change relation or enforce application constraint that users with booking history cannot be hard-deleted. |
| DB-02 | Missing Booking Indexes | Indexes only on `[userId, createdAt]`, `[listingId]`, `[listingId, startDate, endDate, status]` | Partial | `prisma/schema.prisma:742-745` | Missing indexes for `status`, `[status, createdAt]`, and `createdAt`. Admin queries filtering by status across all bookings will perform full table scans. | High | Add `@@index([status])`, `@@index([status, createdAt])`, and `@@index([createdAt])` to `model Booking`. |
| DB-03 | Missing AuditLog Index | `AuditLog` indexes: `[actorId]`, `[action]`, `[resourceType]`, `[createdAt]` | Partial | `prisma/schema.prisma:872-875` | Querying activity logs for a specific booking via `where: { resourceType: "BOOKING", resourceId }` performs an unindexed scan on `resourceId`. | Medium | Add `@@index([resourceType, resourceId])` to `model AuditLog`. |
| DB-04 | Unbounded Admin Queries | `bookingService.listForAdminDashboard` and `admin.service.ts` | Broken | `services/booking.service.ts:1926`, `services/admin.service.ts:2503` | `listForAdminDashboard` hardcodes `take: 50`. `admin.service.ts` loads all bookings into memory with `findMany` and filters in JS. | High | Implement true server-side pagination (`skip`, `take`, `page`, `limit`), server-side filters, and bounded page sizes (max 100). |

---

## 4. MISSING BUSINESS DECISIONS & DEFERRED ITEMS

1. **Live Payment Gateway Credentials**: Moyasar API keys and webhook secrets are not configured in environment variables. Live payment authorization and capture remain deferred to later phases.
2. **Cancellation Refund Policies**: The specification documents define policy types (Flexible, Moderate, Firm, Firm long-term, Strict long-term), but do not define exact cutoff hours before check-in or partial refund percentages (e.g. 50% vs 100% minus service fee). In accordance with the prompt's instructions, no arbitrary percentages or cutoffs have been invented.
3. **Admin Financial Discretion & Dispute Engine**: The authority rules for admin overrides (e.g., overriding a host policy to grant a full refund) and dispute arbitration are not specified in the current documents and are deferred to Phase 3/4.

