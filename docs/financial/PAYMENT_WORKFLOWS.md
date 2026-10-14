# HOMYZ — PAYMENT WORKFLOWS & TRANSACTION LIFECYCLES

**Target Payment Gateway:** Moyasar  
**Currency Standard:** `SAR` (Minor units / Halalas)  
**Security Level:** SAMA-Compliant / PCI-DSS Tokenized  

---

## 1. Instant Book Workflow

Instant Book reservations bypass host approval, confirming the stay and capturing payment in a single atomic transaction.

```mermaid
sequenceDiagram
    autonumber
    actor Guest
    participant CheckoutClient as Booking Checkout UI
    participant ServerAPI as POST /api/v1/bookings
    participant PricingEngine as Pricing Service
    participant Gateway as Moyasar Gateway
    participant DB as Postgres Transaction
    participant NotifService as Notification Service

    Guest->>CheckoutClient: Selects dates & initiates booking
    CheckoutClient->>ServerAPI: Payload (dates, guests, expectedGuestTotal)
    ServerAPI->>PricingEngine: calculateBookingPrice(params)
    PricingEngine-->>ServerAPI: Authoritative quote (guestTotal in halalas)
    Note over ServerAPI: Mismatch Guard: expectedGuestTotal == quote.guestTotal
    ServerAPI->>Gateway: Process payment (mada / Visa / Apple Pay)
    Gateway-->>ServerAPI: Payment Success (providerPaymentId)
    ServerAPI->>DB: BEGIN TRANSACTION (Advisory Lock)
    DB->>DB: Create Booking (status: CONFIRMED)
    DB->>DB: Create BookingPayment (status: CAPTURED)
    DB->>DB: Create ReservationTax rows
    DB->>DB: Create AuditLog
    DB-->>ServerAPI: COMMIT
    ServerAPI->>NotifService: Dispatch Confirmation to Guest & Host
    ServerAPI-->>CheckoutClient: 201 Created (Booking details)
    CheckoutClient->>Guest: Display Booking Confirmation
```

### Recovery Conditions:
- **Price Discrepancy:** If `expectedGuestTotal !== quote.guestTotal`, the API aborts with `409 PRICE_CHANGED` without creating any charge or booking record.
- **Card Decline:** If the gateway declines the card, the transaction aborts with `400 PAYMENT_FAILED`. No booking or inventory hold is created.
- **Double Submission:** The client submits `requestSubmissionId`. If duplicate submission arrives, `findUnique({ submissionId })` intercepts it and returns the existing booking safely.

---

## 2. Request to Book Workflow (Pre-Auth & Host Approval)

Request to Book allows the host 24 to 48 hours to review the reservation request while funds are held via pre-authorization.

```mermaid
sequenceDiagram
    autonumber
    actor Guest
    participant ServerAPI as POST /api/v1/bookings/request
    participant Gateway as Moyasar Gateway
    participant DB as Postgres Transaction
    actor Host
    participant HostAPI as POST /api/v1/host/bookings/{id}/accept

    Guest->>ServerAPI: Submit Request (dates, guests, expectedGuestTotal)
    ServerAPI->>Gateway: Pre-authorize hold (capture: false)
    Gateway-->>ServerAPI: Authorization Created (7-day window)
    ServerAPI->>DB: Create Booking (PENDING) & BookingPayment (AUTHORIZED)
    ServerAPI-->>Guest: 201 Created (Request submitted)

    Note over Host: Host reviews request within 24-48h
    Host->>HostAPI: Accept Request
    HostAPI->>Gateway: POST /v1/payments/{id}/capture
    Gateway-->>HostAPI: Capture Success
    HostAPI->>DB: Atomic Update (Booking: CONFIRMED, Payment: CAPTURED)
    HostAPI-->>Host: 200 OK (Confirmed)
```

---

## 3. Host Rejection & Expiration Workflows

When a request is rejected by the host or passes the 24-hour response deadline without action, the hold is released immediately.

### 3.1 Host Rejection Flow
1. **Trigger:** Host clicks "Decline Request" on `/host/bookings/[id]`.
2. **Gateway Action:** Server dispatches `POST /v1/payments/{id}/void` to Moyasar to cancel the authorization hold.
3. **Database Transaction:**
   - `Booking.status` updates to `CANCELLED` (reason: `HOST_DECLINED`).
   - `BookingPayment.status` updates to `VOIDED` with `voidedAt = new Date()`.
   - Temporary inventory calendar holds are released.
4. **Notifications:** Guest receives immediate notification explaining the host declined the request.

### 3.2 Request Expiration Flow
1. **Trigger:** Automated hourly cron (`POST /api/v1/bookings/expire-stale`) or lazy evaluation upon detail view.
2. **Precondition:** `Booking.status === PENDING` and `createdAt <= (now - 24 hours)`.
3. **Gateway Action:** Server dispatches `POST /v1/payments/{id}/void`.
4. **Database Transaction:**
   - `Booking.status` updates to `CANCELLED` (reason: `EXPIRED`).
   - `BookingPayment.status` updates to `VOIDED` with `voidedAt = new Date()`.
   - Inventory dates are released back to public availability.
5. **Notifications:** Guest receives notification: *"Your booking request expired because the host did not respond within 24 hours."*

---

## 4. Payment Failure & Delayed Webhook Confirmation

```mermaid
stateDiagram-v2
    [*] --> PENDING: Guest starts checkout
    PENDING --> FAILED: Card declined / 3DS failure
    FAILED --> PENDING: Guest retries with valid card

    PENDING --> CAPTURED: Synchronous payment success
    PENDING --> CAPTURED: Asynchronous webhook payment.paid

    CAPTURED --> PARTIALLY_REFUNDED: Partial cancellation refund
    CAPTURED --> REFUNDED: Full cancellation refund

    PARTIALLY_REFUNDED --> REFUNDED: Subsequent refund

    REFUNDED --> [*]: Terminal State
    VOIDED --> [*]: Terminal State
```

### Delayed Webhook Confirmation Handling
In scenarios where 3D-Secure card authentication redirects the user or network drops before the client receives the synchronous response:
1. Moyasar dispatches `payment.paid` or `payment.captured` webhook event.
2. Ingress endpoint (`POST /api/v1/payments/webhooks/moyasar`) authenticates the HMAC signature using `crypto.timingSafeEqual`.
3. Advisory lock (`pg_advisory_xact_lock`) prevents race conditions between simultaneous webhooks.
4. If the payment is already `CAPTURED`, the event is recognized as idempotent and acknowledges with `200 OK`.
5. If the payment is still `PENDING`, it is atomically updated to `CAPTURED`, and `Booking.status` is transitioned to `CONFIRMED`.
6. Notifications are dispatched to both the guest and the host.

