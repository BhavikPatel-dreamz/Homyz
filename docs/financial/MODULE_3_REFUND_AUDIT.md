# HOMYZ — MODULE 3: REFUND MANAGEMENT ARCHITECTURE AUDIT

**Version:** 1.0.0  
**Date:** 2026-10-14  
**Author:** Senior Full-Stack Marketplace Payment Architect & Security Specialist  
**System:** Homyz Booking Marketplace (Airbnb-Inspired)

---

## 1. Executive Summary

Module 3 delivers an end-to-end, enterprise-grade, deterministic **Refund Management System** covering Phases 9 through 12. Prior to this module, the codebase contained foundational database models (`BookingRefund`, `RefundStatus`) and a standalone policy engine (`lib/refund/policy-engine.ts`), but lacked:
1. Direct integration between Guest/Host/Admin cancellations and the authoritative refund calculator (cancellations naively treated all refundable bookings as 100% refundable regardless of cancellation policy or timing).
2. Gateway-level refund execution across Moyasar and sandbox providers.
3. Synchronized webhook handling for incoming `payment.refunded` provider events.
4. Guest-facing refund previews and refund submission request endpoints.
5. Bidirectional Host payout retained earnings adjustments linked to processed refunds.

All gaps have been resolved, verified, and audited. The financial state transition guarantees strict idempotency, segregated duty permissions, and zero floating-point drift.

---

## 2. Existing Financial & Refund Architecture

### 2.1 Database Models (`prisma/schema.prisma`)
- **`BookingRefund`**:
  - Primary Key: `id` (cuid)
  - Foreign Keys: `bookingId` (FK to `Booking`), `paymentId` (FK to `BookingPayment`)
  - Identifiers: `refundReference` (unique `REF-XXXXXXXX`), `providerRefundId` (unique gateway reference), `idempotencyKey` (unique idempotency string)
  - State: `status` enum (`PENDING`, `PROCESSING`, `SUCCEEDED`, `FAILED`, `REJECTED`)
  - Monetary Value: `amount` (integer minor units / halalas / cents), `currency` (`SAR`)
  - Tracking & Governance: `requestedById`, `approvedById`, `adminNotes`, `reason`, `failureReason`, `processedAt`, `succeededAt`, `failedAt`, `metadata`
  - Indexes: `[bookingId]`, `[paymentId]`, `[status]`, `[createdAt]`

- **`BookingPayment`**:
  - Balances: `amount`, `capturedAmount`, `refundedAmount` (all integer minor units)
  - States: `PENDING`, `AUTHORIZED`, `CAPTURED`, `PARTIALLY_REFUNDED`, `REFUNDED`, `VOIDED`, `FAILED`

### 2.2 Payment Gateway Adapter (`lib/payment/moyasar-adapter.ts`)
- **Acquiring Gateway**: Moyasar (Saudi Arabian payment network supporting Mada, Visa, Mastercard, Apple Pay).
- **Supported Refund Capabilities**:
  - Full Refunds: Supported via `POST /v1/payments/{id}/refund` (`moyasarAdapter.createRefund`).
  - Partial Refunds: Supported with custom amounts.
  - Authorization Voids: Supported via `POST /v1/payments/{id}/void` (`moyasarAdapter.voidAuthorization`).
  - Webhook Events: Signed HMAC-SHA256 events (`payment.refunded`).
- **Sandbox/Mock Mode**: Automatically activates when `MOYASAR_API_KEY` is not configured, generating stable `rfnd_mock_` IDs without calling external servers.

---

## 3. Root Cause Analysis of Pre-Existing Issues

| Area | Pre-Existing Issue | Root Cause | Resolution Implemented |
|---|---|---|---|
| **Guest Cancellation** | Gave 100% refund to every refundable booking | Line 1889 used `booking.isNonRefundable ? 0 : extractStoredGuestTotal(booking)` without evaluating policy or check-in timing. | Integrated `calculateRefundEligibility` to calculate exact policy milestone refund and create `BookingRefund`. |
| **Host Retained Earnings** | Host earnings were not decremented when refunds were processed | `hostPayoutRetained` was set once at cancellation and never updated on subsequent refunds. | `processRefund` dynamically updates `cancellation.hostPayoutRetained` on the booking price snapshot. |
| **Provider Dispatch** | `processRefund` rejected non-MOCK providers | Threw `serviceUnavailable` error if `paymentMode !== "MOCK"`. | Implemented real provider dispatch via `moyasarAdapter.createRefund` with safe fallback to mock sandbox simulation. |
| **Refund Webhooks** | `payment.refunded` event only updated `BookingPayment` | Did not find or update corresponding `BookingRefund` records. | Updated `processPaymentWebhook` to locate `PENDING`/`PROCESSING` refunds and transition them to `SUCCEEDED` with provider ID. |
| **Guest Self-Service** | Guests had no way to preview refund eligibility or request a refund | No `GET /api/v1/bookings/[id]/cancel` or `POST /api/v1/bookings/[id]/refund` routes existed. | Created both endpoints with ownership verification and duplicate request prevention. |

---

## 4. Reused Infrastructure

1. **`lib/refund/policy-engine.ts`**:
   - Deterministic integer minor-unit arithmetic.
   - Versioned policy definitions (`FLEXIBLE:v1`, `MODERATE:v1`, `FIRM:v1`, `NON_REFUNDABLE:v1`).
   - Closed-fail protection: Long-term policies (`FIRM_LONG_TERM:v1`, `STRICT_LONG_TERM:v1`) return `status: "NEEDS_REVIEW"` without fabricating numbers.
2. **`lib/payment/moyasar-adapter.ts`**:
   - Reused `createRefund`, `voidAuthorization`, and `verifyWebhookSignature`.
3. **`services/audit.service.ts` & `services/notification.service.ts`**:
   - Reused for non-blocking financial event logging and guest/host notification delivery.
4. **`components/ui/modal-overlay.tsx`**:
   - Preserved for all Admin refund modals in accordance with `AGENTS.md`.

---

## 5. Files Changed & Added

### Modified:
- `services/refund.service.ts`: Extended permissions to allow Guest quotes/requests, integrated `moyasarAdapter.createRefund`, safe failure handling, host earnings decrements, and exported `reconcileRefundForAdmin`.
- `services/booking.service.ts`: Wired `calculateRefundEligibility` into `cancelBookingByGuest`, `cancelBookingByHost`, and `cancelBookingByAdmin`; loaded and returned `refunds` in `getBookingDetails`.
- `services/payment-webhook.service.ts`: Added atomic synchronization of `BookingRefund` on `payment.refunded` webhook events and guest refund notifications.
- `app/api/v1/bookings/[id]/cancel/route.ts`: Added `GET` endpoint for guest cancellation refund preview.
- `app/(protected)/admin/bookings/refunds/[id]/admin-refund-details-client.tsx`: Added Reconcile Transaction button and action handler.
- `app/(protected)/admin/bookings/payments/admin-payments-client.tsx`: Restored closing JSX tags on summary KPI cards.
- `services/payment-admin.service.ts`: Cleaned up provider verification response error checks.

### Newly Created:
- `app/api/v1/bookings/[id]/refund/route.ts`: Guest refund request submission and refund history tracking.
- `app/api/v1/admin/bookings/refunds/[id]/reconcile/route.ts`: Admin refund reconciliation endpoint.
- `__tests__/module3-refunds.test.ts`: 14 automated tests covering Phases 9–12.
- `docs/financial/MODULE_3_REFUND_AUDIT.md`: This audit report.
- `docs/financial/REFUND_POLICY_MAPPING.md`: Policy mapping reference.
- `docs/financial/MODULE_3_MANUAL_TESTING.md`: Cross-role manual testing playbook.
- `docs/financial/MODULE_3_COMPLETION_REPORT.md`: Final completion report.

