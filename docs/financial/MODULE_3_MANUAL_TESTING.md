# HOMYZ — MODULE 3: REFUND MANAGEMENT MANUAL TESTING GUIDE

**Version:** 1.0.0  
**Date:** 2026-10-14  
**Environment:** Staging / Sandbox Mode (Mock Payment Adapter & Moyasar Sandbox)

---

## Cross-Role Test Matrix Summary

| Test ID | Scenario | Actor / Role | Endpoint / Route | Result |
|---|---|---|---|---|
| **TC-REF-01** | Guest Full Cancellation (FLEXIBLE $\ge 24\text{h}$) | Guest | `/api/v1/bookings/[id]/cancel` | **PASS** |
| **TC-REF-02** | Guest Late Cancellation (FLEXIBLE $< 24\text{h}$) | Guest | `/api/v1/bookings/[id]/cancel` | **PASS** |
| **TC-REF-03** | Host-Initiated Cancellation Full Refund | Host | `/api/v1/bookings/[id]/cancel` | **PASS** |
| **TC-REF-04** | Request to Book Host Rejection Void | Host | `/api/v1/host/bookings/[id]/reject` | **PASS** |
| **TC-REF-05** | Admin Refund Request Creation & Approval | Admin | `/admin/bookings/refunds` | **PASS** |
| **TC-REF-06** | Admin Refund Settlement Execution | Admin | `/api/v1/admin/bookings/refunds/[id]/process` | **PASS** |
| **TC-REF-07** | Partial Refund Bounded Balance & Retained Earnings | Admin | `/api/v1/admin/bookings/refunds` | **PASS** |
| **TC-REF-08** | Duplicate Submission & Webhook Idempotency | System | `/api/v1/payments/webhooks/moyasar` | **PASS** |
| **TC-REF-09** | Dispute Case Resolution Linked Refund | Admin | `/api/v1/admin/bookings/disputes/[id]/resolve` | **PASS** |
| **TC-REF-10** | Security Authorization & Role Privacy Verification | Unauthorized | Direct API Access | **PASS** |

---

## Detailed Test Cases

### TC-REF-01: Guest Full Cancellation (FLEXIBLE $\ge 24\text{h}$)
- **Role:** Guest (`USER`)
- **URL:** `GET /api/v1/bookings/{id}/cancel` then `POST /api/v1/bookings/{id}/cancel`
- **Sandbox Data:** Confirmed booking with `FLEXIBLE` policy, check-in 5 days in the future, captured payment of 1,500.00 SAR (150,000 halalas).
- **Steps:**
  1. Call `GET /api/v1/bookings/{id}/cancel` to retrieve preview quote.
  2. Verify quote displays `estimatedRefund: 150000`, `cancellationPolicy: "FLEXIBLE"`, `milestoneApplied: "Full Refund Window (>= 24 hours before check-in)"`.
  3. Call `POST /api/v1/bookings/{id}/cancel` to execute cancellation.
- **Expected Outcome:**
  - Booking transitions to `status: CANCELLED`.
  - `BookingRefund` record is created for 150,000 halalas with `status: SUCCEEDED`.
  - `BookingPayment.refundedAmount` is updated to 150,000 halalas with `status: REFUNDED`.
  - Stored `cancellation.hostPayoutRetained` is updated to 0.
- **Actual Outcome:** As expected. Verified via automated suite assertion.
- **Status:** **PASS**

---

### TC-REF-02: Guest Late Cancellation (FLEXIBLE $< 24\text{h}$)
- **Role:** Guest (`USER`)
- **URL:** `POST /api/v1/bookings/{id}/cancel`
- **Sandbox Data:** Confirmed booking with `FLEXIBLE` policy, check-in 10 hours in the future. Total: 1,500.00 SAR (Accommodation 1,200.00 SAR, Cleaning 150.00 SAR, Service 100.00 SAR, Tax 50.00 SAR).
- **Steps:**
  1. Submit cancellation via `POST /api/v1/bookings/{id}/cancel`.
  2. Inspect generated `BookingRefund` and `priceBreakdown.cancellation`.
- **Expected Outcome:**
  - Accommodation subtotal is retained by host.
  - Cleaning fee (150.00 SAR) and proportional taxes are refunded to guest.
  - Host retained payout retains the accommodation earnings.
  - No 100% full refund is issued erroneously.
- **Actual Outcome:** Authoritative policy engine refunds 150.00 SAR cleaning fee + proportional tax; accommodation retained.
- **Status:** **PASS**

---

### TC-REF-03: Host-Initiated Cancellation Full Refund
- **Role:** Host (`HOST`)
- **URL:** Host reservation cancellation flow
- **Sandbox Data:** Confirmed booking, captured payment of 2,000.00 SAR.
- **Steps:**
  1. Host cancels reservation due to emergency maintenance.
  2. System triggers `cancelBookingByHost`.
- **Expected Outcome:**
  - Guest is granted 100% full refund (2,000.00 SAR) under `HOST_CANCELLATION`.
  - `BookingRefund` created with `status: SUCCEEDED`.
  - Host retained earnings set to 0.
- **Actual Outcome:** 100% reimbursement created and payment marked `REFUNDED`.
- **Status:** **PASS**

---

### TC-REF-04: Request to Book Host Rejection Void
- **Role:** Host (`HOST`)
- **URL:** `/api/v1/host/bookings/{id}/reject`
- **Sandbox Data:** Request to Book with `status: PENDING`, payment with `status: AUTHORIZED`.
- **Steps:**
  1. Host clicks "Decline Request".
- **Expected Outcome:**
  - Payment authorization is voided (`status: VOIDED`).
  - No gateway refund of captured money is attempted (authorization release vs refund).
  - Booking is marked `DECLINED`.
- **Actual Outcome:** Payment voided atomically with `voidedAt` timestamp.
- **Status:** **PASS**

---

### TC-REF-05: Admin Refund Request Creation & Approval
- **Role:** Admin (`ADMIN`)
- **URL:** `/admin/bookings/refunds`
- **Sandbox Data:** Completed reservation with 1,000.00 SAR captured payment.
- **Steps:**
  1. Admin opens Refund Management dashboard.
  2. Creates refund request for 300.00 SAR (partial refund).
  3. Secondary administrator clicks "Approve Refund Request".
- **Expected Outcome:**
  - Refund record created with `status: PENDING`, `approvedById: null`.
  - Upon approval, `approvedById: admin_id`, status remains `PENDING` (approval $\ne$ settlement completion).
- **Actual Outcome:** Segregated approval sets `approvedById`, leaves status `PENDING` awaiting provider dispatch.
- **Status:** **PASS**

---

### TC-REF-06: Admin Refund Settlement Execution
- **Role:** Admin (`ADMIN`)
- **URL:** `/api/v1/admin/bookings/refunds/{id}/process`
- **Sandbox Data:** Approved pending refund of 300.00 SAR.
- **Steps:**
  1. Admin clicks "Process Refund Settlement".
  2. Confirms dialog checkbox acknowledging real settlement execution.
- **Expected Outcome:**
  - Dispatches to Moyasar API or mock sandbox simulator.
  - Generates durable `providerRefundId` (e.g., `rfnd_mock_...`).
  - `BookingRefund` transitions to `SUCCEEDED`.
  - `BookingPayment.refundedAmount` increments by 300.00 SAR.
  - Payment status transitions to `PARTIALLY_REFUNDED`.
  - Notifications dispatched to guest and host.
- **Actual Outcome:** Verified provider settlement and balance increment.
- **Status:** **PASS**

---

### TC-REF-07: Partial Refund Bounded Balance & Retained Earnings
- **Role:** Admin (`ADMIN`)
- **URL:** `/api/v1/admin/bookings/refunds`
- **Sandbox Data:** Payment with 1,000.00 SAR captured, 700.00 SAR already refunded, 200.00 SAR pending.
- **Steps:**
  1. Admin attempts to request refund of 250.00 SAR.
  2. Admin requests refund of 100.00 SAR.
- **Expected Outcome:**
  - Request for 250.00 SAR is rejected: exceeds available balance (100.00 SAR).
  - Request for 100.00 SAR succeeds.
- **Actual Outcome:** System enforces `availableBalance = captured - (refunded + pendingReserved)` and rejects excessive refund.
- **Status:** **PASS**

---

### TC-REF-08: Duplicate Submission & Webhook Idempotency
- **Role:** Payment Provider / Webhook
- **URL:** `POST /api/v1/payments/webhooks/moyasar`
- **Sandbox Data:** Signed webhook event `payment.refunded` for an existing payment.
- **Steps:**
  1. Send webhook payload with valid HMAC signature.
  2. Send identical webhook payload a second time (simulating network retry).
- **Expected Outcome:**
  - First call synchronizes `BookingRefund` to `SUCCEEDED` and increments payment balance.
  - Second call detects existing audit event and returns `duplicate: true, success: true` without double-crediting.
- **Actual Outcome:** Duplicate webhook acknowledged idempotently; zero duplicate transactions.
- **Status:** **PASS**

---

### TC-REF-09: Dispute Case Resolution Linked Refund
- **Role:** Admin (`ADMIN`)
- **URL:** `/api/v1/admin/bookings/disputes/{id}/resolve`
- **Sandbox Data:** Open listing quality incident dispute with linked refund request.
- **Steps:**
  1. Admin resolves dispute with decision category `REFUND_ISSUED`.
  2. Links `refundRequestId` to existing `BookingRefund`.
- **Expected Outcome:**
  - Dispute case updates to `status: RESOLVED`.
  - Linked refund is preserved as the single source of financial truth (no duplicate refund created inside dispute system).
- **Actual Outcome:** Dispute case and refund management remain synchronized.
- **Status:** **PASS**

---

### TC-REF-10: Security Authorization & Role Privacy Verification
- **Role:** Malicious / Cross-Guest Actor
- **URL:** `/api/v1/bookings/{id}/refund` and `/api/v1/admin/bookings/refunds`
- **Steps:**
  1. Guest A attempts to call refund endpoint for Guest B's reservation.
  2. Non-admin attempts to access `/api/v1/admin/bookings/refunds`.
  3. Host attempts to view guest payment card details on refunded booking.
- **Expected Outcome:**
  - Step 1: Returns 403 Forbidden ("You do not have permission to request a refund for this reservation").
  - Step 2: Returns 403 Forbidden.
  - Step 3: Host receives only `refundConfirmation: { status: "REFUNDED", totalRefunded: ... }` with no guest payment card or provider transaction references.
- **Actual Outcome:** Strict segregation and role-based privacy enforced.
- **Status:** **PASS**

