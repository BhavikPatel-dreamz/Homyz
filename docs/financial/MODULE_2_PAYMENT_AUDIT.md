# HOMYZ — MODULE 2 PAYMENT & TRANSACTION SYSTEM AUDIT

**Module:** Module 2 — Payments & Transactions (Phases 5–8)  
**Target Provider:** Moyasar (SAMA Regulated, Kingdom of Saudi Arabia)  
**Status:** **AUDITED, IMPLEMENTED & VERIFIED**  

---

## 1. Executive Summary

This audit evaluates the end-to-end payment processing, authorization/capture lifecycles, webhook ingress reliability, and administrative payment management in Homyz across Phases 5 through 8.

Building upon the Module 1 Financial Foundation, Module 2 bridges user checkout intents to verified database records and provider interfaces. Prior to our intervention:
1. **Host Rejection & Expiration Desynchronization:** When hosts rejected pending reservation requests or when requests expired after 24 hours, the `Booking.status` transitioned to `CANCELLED`, but the related `BookingPayment` remained indefinitely in `PENDING` (or `AUTHORIZED`), misrepresenting open liabilities in Admin Payments.
2. **Terminal State Regression Vulnerability:** Out-of-order or delayed webhook delivery could theoretically revert a terminal `CAPTURED`, `REFUNDED`, or `VOIDED` payment back to `FAILED` or `AUTHORIZED`.
3. **Host Notification Gap:** When webhooks confirmed a guest's payment capture, notifications were only dispatched to the guest, leaving the host unnotified of the payment confirmation.
4. **Admin Dashboard Financial Visibility:** KPI metrics only calculated gross captured volume and count, lacking explicit calculations for net revenue after refunds, total refunded volume, and failed volume.

All four areas have been remediated, verified, and backed by automated regression tests.

---

## 2. Audited Architectural Areas & Findings

### 2.1 Guest Checkout & Instant Book (Phase 5)
- **Routes Audited:** `app/book/[id]/booking-checkout-client.tsx`, `app/api/v1/bookings/route.ts`, `services/booking.service.ts`.
- **Finding:** Checkout never sends payable amounts in URLs or client bundles. `expectedGuestTotal` is transmitted solely as an optimistic concurrency guard.
- **Verification:** If listing prices or date availability change during checkout review, the server strictly returns `409 PRICE_CHANGED` or `409 DATES_NO_LONGER_AVAILABLE`.
- **Payment Creation:** Instant bookings atomically generate a `BookingPayment` row in the same PostgreSQL transaction as `Booking` and `ReservationTax`, enforcing unique idempotency keys (`pay_idem_${submissionId}`).

### 2.2 Request to Book Lifecycle & Host Actions (Phase 6)
- **Routes Audited:** `services/request-to-book.service.ts`, `services/booking.service.ts`, `app/api/v1/host/bookings/[id]/accept/route.ts`, `app/api/v1/host/bookings/[id]/reject/route.ts`, `app/api/v1/bookings/expire-stale/route.ts`.
- **Finding:** Host approval correctly transitions `BookingPayment` to `CAPTURED`. However, `rejectBookingRequest` and `expireBookingRequest` previously omitted updating `BookingPayment`, leaving records in `PENDING` or `AUTHORIZED`.
- **Fix Implemented:** Updated `rejectBookingRequest`, `expireBookingRequest`, and lazy expiration checks in `acceptBookingRequest` and `getBookingDetails` to atomically update `BookingPayment.status = VOIDED` with `voidedAt = new Date()`.
- **Privacy Boundary:** In `getBookingDetails`, guests and admins receive full payment transaction telemetry, whereas hosts receive only payment confirmation status (`PAID` or `PENDING`) and their net payout calculation, protecting guest card references.

### 2.3 Webhooks & Out-of-Order Safety (Phase 7)
- **Routes Audited:** `services/payment-webhook.service.ts`, `app/api/v1/payments/webhooks/moyasar/route.ts`.
- **Finding:** Webhook processor previously handled only `payment.paid`, `payment.failed`, and `payment.refunded`. Out-of-order events or late delivery lacked explicit guards against reverting terminal states.
- **Fix Implemented:**
  - Added support for `payment.authorized` and `payment.voided`.
  - Added terminal state immunity: if a payment is `REFUNDED` or `VOIDED`, no incoming event can alter its status.
  - Added `CAPTURED` state protection: incoming `payment.failed` or `payment.authorized` cannot downgrade an already captured payment.
  - Dispatched `Payment Confirmed` notifications to the listing host upon payment capture.

### 2.4 Admin Payments Management (Phase 8)
- **Routes Audited:** `app/(protected)/admin/bookings/payments/`, `services/payment-admin.service.ts`.
- **Finding:** Summary aggregates previously omitted net captured volume and refunded volume breakdown.
- **Fix Implemented:** Extended `PaymentSummaryData` to compute `refundedVolume`, `netCapturedVolume`, and `failedVolume`. Updated `reconcilePaymentForAdmin` to query Moyasar via `MoyasarAdapter.verifyPayment` when a live provider payment reference is present.

---

## 3. Files Modified in Module 2

| File Path | Description of Changes |
|---|---|
| `services/booking.service.ts` | Added atomic `BookingPayment` voiding on host rejection, request expiration, and lazy expiry. Added `payment` and `paymentConfirmation` fields to `BookingDetailsData` with strict role-based privacy. |
| `services/payment-webhook.service.ts` | Added terminal state protection, `payment.authorized` and `payment.voided` handling, and host notification upon payment capture. |
| `services/payment-admin.service.ts` | Added `refundedVolume`, `netCapturedVolume`, and `failedVolume` to `PaymentSummaryData`. Enhanced `reconcilePaymentForAdmin` with gateway verification. |
| `app/(protected)/admin/bookings/payments/admin-payments-client.tsx` | Updated KPI summary cards to display Net Captured and Refunded Volume metrics. |
| `__tests__/module2-payments-and-transactions.test.ts` | **NEW:** Comprehensive verification test suite for Phases 5 through 8. |

---

## 4. Audit Conclusion

All payment flows across Guest, Host, and Admin roles are synchronized, protected by idempotency keys, and resilient against race conditions and out-of-order events. Zero TypeScript compilation errors exist across the codebase.

