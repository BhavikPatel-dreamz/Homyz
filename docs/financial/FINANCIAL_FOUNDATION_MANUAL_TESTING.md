# HOMYZ — FINANCIAL FOUNDATION MANUAL TESTING & VERIFICATION GUIDE

**Module:** Module 1 — Financial Foundation  
**Target Environment:** Test / Staging Sandbox  
**Execution Node Version:** v22.23.2  
**Test Suite Path:** `__tests__/module1-financial-foundation.test.ts`  

---

## 1. Automated Test Execution

To execute the automated financial foundation verification suite:

```bash
export PATH=/home/ubuntu/.nvm/versions/node/v22.23.2/bin:$PATH
npx tsx __tests__/module1-financial-foundation.test.ts
```

**Expected Result:** 15 passing tests across 7 test suites, 0 failures, execution duration < 1 second.

---

## 2. Step-by-Step Manual Test Procedures

### Test Case: TC-FIN-01 — Instant Book Server-Side Price Calculation & Minor Units
- **Target Route:** `POST /api/v1/bookings`
- **Objective:** Verify price calculation executes server-side in minor units with zero floating-point drift.
- **Input Payload:**
  ```json
  {
    "listingId": "listing_test_riyadh_01",
    "checkIn": "2026-11-01",
    "checkOut": "2026-11-04",
    "guests": 2,
    "pets": 1,
    "expectedGuestTotal": 181700
  }
  ```
- **Expected Results:**
  1. HTTP 201 Created.
  2. `Booking.totalPrice` is integer `181700` (1,817.00 SAR).
  3. `BookingPayment` record created with status `CAPTURED` and amount `181700`.
  4. Currency recorded strictly as `SAR`.
- **Status:** **PASS (Verified via automated test & code audit)**

---

### Test Case: TC-FIN-02 — Optimistic Concurrency Mismatch Rejection
- **Target Route:** `POST /api/v1/bookings`
- **Objective:** Prevent race conditions where property nightly rate updates between client quote preview and submission.
- **Input Payload:**
  ```json
  {
    "listingId": "listing_test_riyadh_01",
    "checkIn": "2026-11-01",
    "checkOut": "2026-11-04",
    "guests": 2,
    "expectedGuestTotal": 120000 
  }
  ```
  *(Simulated: Client submits stale price 1,200.00 SAR, but server quote calculates 1,817.00 SAR).*
- **Expected Results:**
  1. HTTP 409 Conflict.
  2. Error code: `PRICE_CHANGED`.
  3. Response contains updated server quote for user confirmation.
  4. Zero database booking or payment records created.
- **Status:** **PASS (Verified in `phase9-10-checkout-server-pricing.test.ts`)**

---

### Test Case: TC-FIN-03 — Host Platform Fee Deduction Invariant
- **Target Function:** `calculateBookingPrice()` in `services/pricing.service.ts`
- **Objective:** Verify platform commission is deducted from host payout and NOT added to guest total.
- **Input:** Nightly subtotal = 100,000 halalas (1,000.00 SAR), platform fee = 15%.
- **Expected Results:**
  1. `hostServiceFee` = 15,000 halalas.
  2. `payoutBreakdown.netHostPayout` = 85,000 halalas (100,000 - 15,000).
  3. `guestTotal` = 100,000 halalas (+ applicable taxes).
  4. `guestTotal` does NOT include the 15,000 halalas platform fee.
- **Status:** **PASS (Verified in `module1-financial-foundation.test.ts`)**

---

### Test Case: TC-FIN-04 — Request-to-Book Authorization & Host Delayed Capture
- **Target Routes:**
  - `POST /api/v1/bookings` (Guest request)
  - `POST /api/v1/host/bookings/{id}/accept` (Host approval)
- **Objective:** Verify delayed capture flow for two-step reservation requests.
- **Input:** Listing requires host approval.
- **Expected Results:**
  1. On booking creation: `Booking.status = PENDING`, `BookingPayment.status = AUTHORIZED`.
  2. Funds pre-authorized at gateway; no capture executed yet.
  3. Host accepts request: Server calls `POST /v1/payments/{id}/capture`.
  4. `BookingPayment.status` transitions atomically to `CAPTURED`.
  5. `Booking.status` transitions to `CONFIRMED`.
- **Status:** **PASS (Verified in `services/booking.service.ts` audit)**

---

### Test Case: TC-FIN-05 — Request-to-Book Decline & Authorization Void
- **Target Routes:** `POST /api/v1/host/bookings/{id}/reject` or cancellation
- **Objective:** Verify authorization hold is released with zero fee penalty when host declines.
- **Expected Results:**
  1. Host declines request within 48-hour window.
  2. Server calls `POST /v1/payments/{id}/void`.
  3. `BookingPayment.status` transitions atomically to `VOIDED`.
  4. `Booking.status` transitions to `REJECTED`.
  5. Authorization hold drops from guest card with zero transaction fees.
- **Status:** **PASS (Verified in `services/booking.service.ts` audit)**

---

### Test Case: TC-FIN-06 — Webhook HMAC Signature Verification
- **Target Route:** `POST /api/v1/payments/webhooks/moyasar`
- **Objective:** Guard against unauthorized or forged webhook injection.
- **Test Scenarios:**
  - **Scenario A:** Valid payload with valid HMAC-SHA256 signature in header `x-moyasar-signature`.  
    *Result:* **HTTP 200 OK.**
  - **Scenario B:** Valid payload with tampered signature string.  
    *Result:* **HTTP 401 Unauthorized (`Invalid webhook signature`).**
  - **Scenario C:** Tampered payload (amount altered) with signature from original payload.  
    *Result:* **HTTP 401 Unauthorized (`Invalid webhook signature`).**
  - **Scenario D:** Missing signature header or unconfigured webhook secret.  
    *Result:* **HTTP 401 Unauthorized.**
- **Status:** **PASS (Verified in `module1-financial-foundation.test.ts`)**

---

### Test Case: TC-FIN-07 — Webhook Duplicate Event Deduplication
- **Target Route:** `POST /api/v1/payments/webhooks/moyasar`
- **Objective:** Ensure duplicate webhook delivery does not result in double state changes.
- **Procedure:** Send identical webhook payload with same `id: "evt_duplicate_001"` twice.
- **Expected Results:**
  1. First delivery processes payload, acquires advisory lock, transitions status, and writes `PAYMENT_WEBHOOK_PROCESSED` audit record. Returns `200 OK`.
  2. Second delivery detects existing audit record for `resourceId: "evt_duplicate_001"`. Returns `200 OK` with `{ duplicate: true, message: "Webhook event was already processed." }`.
  3. No secondary database mutations or duplicate notifications dispatched.
- **Status:** **PASS (Verified in `module1-financial-foundation.test.ts`)**

---

### Test Case: TC-FIN-08 — Webhook Unknown Transaction Handling
- **Target Route:** `POST /api/v1/payments/webhooks/moyasar`
- **Objective:** Ensure gateway events with unrecognized transaction IDs fail safely and write audit entries.
- **Input:** Webhook payload with `providerPaymentId: "pay_unknown_99999"`.
- **Expected Results:**
  1. System attempts lookup on `BookingPayment`.
  2. No record found.
  3. System records audit log: `PAYMENT_WEBHOOK_UNKNOWN_TRANSACTION` with status `FAILURE`.
  4. Returns `404 Not Found`.
- **Status:** **PASS (Verified in `services/payment-webhook.service.ts`)**

---

### Test Case: TC-FIN-09 — Cancellation Policy Refund Limits
- **Target Route:** `services/refund.service.ts`
- **Objective:** Prevent issuing refunds greater than captured funds or outside cancellation policy.
- **Expected Results:**
  1. System checks `capturedAmount`.
  2. Refund amount is validated: `refundAmount <= (capturedAmount - refundedAmount)`.
  3. Attempting to refund more than available balance throws `AppError.badRequest("Refund amount exceeds available captured balance")`.
  4. Status transitions to `PARTIALLY_REFUNDED` or `REFUNDED`.
- **Status:** **PASS (Verified in `services/refund.service.ts`)**

---

### Test Case: TC-FIN-10 — Admin Financial Ledger Query Resilience
- **Target Route:** `app/(protected)/admin/bookings/payments/page.tsx`
- **Objective:** Verify aggregate calculations handle zero-state databases without crashing.
- **Expected Results:**
  1. `getPaymentSummaryForAdmin` executes with `isMissingBookingPaymentTable` guard.
  2. Returns default zeroed schema:
     `{ totalCapturedVolume: 0, totalCapturedCount: 0, authorizedVolume: 0, currency: "SAR" }`.
  3. No unhandled 500 exceptions on dashboard.
- **Status:** **PASS (Verified in `services/payment-admin.service.ts`)**

---

## 3. Test Summary Matrix

| Test ID | Test Description | Category | Result |
|---|---|---|---|
| `TC-FIN-01` | Minor unit pricing calculation | Pricing Engine | **PASS** |
| `TC-FIN-02` | Stale quote optimistic concurrency check | Booking Ingress | **PASS** |
| `TC-FIN-03` | Host platform fee deduction invariant | Financial Integrity | **PASS** |
| `TC-FIN-04` | Request-to-book delayed capture | Payment Lifecycle | **PASS** |
| `TC-FIN-05` | Request-to-book authorization void | Payment Lifecycle | **PASS** |
| `TC-FIN-06` | Webhook HMAC-SHA256 signature check | Security | **PASS** |
| `TC-FIN-07` | Webhook duplicate event deduplication | Idempotency | **PASS** |
| `TC-FIN-08` | Webhook unknown transaction audit | Security & Audit | **PASS** |
| `TC-FIN-09` | Refund balance limit enforcement | Ledger Integrity | **PASS** |
| `TC-FIN-10` | Admin payments summary zero-state resilience | Resilience | **PASS** |

