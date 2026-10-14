# HOMYZ — HOST PAYOUT WORKFLOWS & OPERATIONAL PROCEDURES

## 1. Host Payout Account Onboarding Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Host
    participant UI as Host Earnings UI (/host/earnings)
    participant API as Payout API (/api/v1/host/payout-methods)
    participant Engine as Payout Service
    participant DB as Postgres (User.personalInfo)
    actor Admin

    Host->>UI: Input IBAN, Bank Name, Account Holder
    UI->>API: POST /api/v1/host/payout-methods
    API->>Engine: validateSaudiIban(iban)
    Engine-->>API: Validated (MOD-97 OK, Bank: Al Rajhi)
    API->>Engine: maskIban(iban)
    API->>DB: Store in personalInfo.payoutMethods
    DB-->>UI: Masked Account (SA03 **** **** **** **** 7519)
    Admin->>API: POST /api/v1/admin/hosts/:id/payout-methods/:methodId/verify
    API->>DB: status: VERIFIED
```

1. **Host Input:** Host navigates to `/host/earnings` and clicks `+ Add Payout Method`.
2. **MOD-97 & Bank Code Verification:** System validates that IBAN starts with `SA`, has 24 characters, and satisfies international mod-97 remainder equal to 1. Resolves bank name automatically.
3. **Data Sanitization & Masking:** IBAN is masked to protect sensitive account details.
4. **Admin Review:** Admin verifies that the beneficiary name matches the Host's verified KYC government identity.

---

## 2. Reservation Payout Lifecycle & Scheduling Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Guest
    participant System as Booking & Payment Engine
    participant Payout as Payout Engine
    actor Host
    actor Admin

    Guest->>System: Completes Checkout & Payment
    System->>System: Payment CAPTURED (Booking CONFIRMED)
    System->>Payout: Schedule Payout (Check-in + 24 hours)
    Payout-->>Payout: Status = SCHEDULED
    Note over Payout: Stay Begins... 24h elapses
    Payout->>Payout: Check Eligibility (No disputes, verified account)
    Payout-->>Payout: Status = ELIGIBLE_SETTLEMENT
    Admin->>Payout: Process Settlement (or SARIE Batch Export)
    Payout-->>Payout: Status = PAID (Ref: SARIE-XXXXXX)
    Payout->>Host: Notification: Earnings Disbursed
```

1. **Reservation Confirmation:** Once Guest payment is captured, the system records `priceBreakdown.payoutBreakdown` and computes scheduled release timestamp (`booking.startDate + 24h`). Status is `SCHEDULED`.
2. **Release Check:** Upon arrival of scheduled timestamp, the eligibility engine evaluates 7 conditions:
   - Confirmed booking status
   - Captured payment
   - Check-in + 24h passed
   - No active disputes (`ListingQualityIncident`)
   - No open refunds (`BookingRefund`)
   - Verified default payout method configured
   - No administrative hold active
3. If all criteria pass, status transitions to `ELIGIBLE_SETTLEMENT`.

---

## 3. Administrative Hold & Release Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Admin
    participant UI as Admin Payouts (/admin/bookings/payouts)
    participant API as Admin Payout API
    participant DB as Postgres (Booking.priceBreakdown)
    participant Audit as AuditLog

    Admin->>UI: Select Payout -> Click "Place Hold"
    UI->>Admin: Prompt Mandatory Hold Reason & Type
    Admin->>UI: Submit Hold (e.g., FRAUD_REVIEW, "Suspicious activity")
    UI->>API: POST /api/v1/admin/bookings/payouts/:id/hold
    API->>DB: Save payoutHold { isHeld: true, holdType, reason, heldBy }
    API->>Audit: Log HOST_PAYOUT_HELD
    DB-->>UI: Payout Status -> ON_HOLD
    Note over Admin: Investigation complete, issues cleared
    Admin->>UI: Click "Release Hold"
    UI->>API: POST /api/v1/admin/bookings/payouts/:id/release
    API->>API: Validate no open disputes or pending refunds
    API->>DB: Save payoutHold { isHeld: false, releasedBy, releaseReason }
    API->>Audit: Log HOST_PAYOUT_RELEASED
    DB-->>UI: Payout Status -> ELIGIBLE_SETTLEMENT (or SCHEDULED)
```

---

## 4. Corporate Banking SARIE Settlement & Batch Export Workflow

Because acquiring payment gateways (such as Moyasar) do not provide direct host bank disbursement rails in Saudi Arabia:
1. Payouts in `ELIGIBLE_SETTLEMENT` status represent verified platform financial readiness.
2. The Admin clicks **SARIE Batch Export** on `/admin/bookings/payouts`.
3. An authoritative CSV file is generated conforming to Saudi corporate banking format:
   - `Booking Reference`
   - `Beneficiary Name`
   - `Beneficiary IBAN`
   - `Bank Name`
   - `Amount SAR`
   - `Currency`
   - `Scheduled Date`
   - `Property Title`
   - `Status`
4. Admin uploads the batch file to the corporate banking portal (e.g. Al Rajhi Corporate / SNB e-Corp).
5. Upon confirmation, Admin executes settlement via `/api/v1/admin/bookings/payouts/:id/process`, assigning an authoritative `SARIE-XXXXXXXX` reference and locking the record as `PAID`.

