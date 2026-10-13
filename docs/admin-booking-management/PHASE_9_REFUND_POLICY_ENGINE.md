# Phase 9: Refund Policy Engine & Eligibility Calculation

## 1. Executive Overview

Phase 9 establishes an authoritative, deterministic, and auditable **Refund Policy Engine** for Homyz (`lib/refund/policy-engine.ts`). The engine evaluates refund entitlements for any reservation cancellation or refund request based strictly on:
1. Booking-time cancellation policy snapshot and policy version.
2. Exact check-in timing countdown (hours until check-in relative to 15:00 UTC property check-in time).
3. Initiating party (Guest vs Host vs Admin).
4. Actual captured payments and remaining refundable balances.
5. Exact integer minor units arithmetic (1 SAR = 100 Halalas/cents) to eliminate floating-point drift.

The engine strictly implements a **fail-closed** safety mechanism: any unapproved, ambiguous, or long-term policy rule fails safely into status `NEEDS_REVIEW` with `totalRefundableAmount: 0` and an explicit missing rule explanation, rather than inventing unapproved financial policies or payout amounts.

---

## 2. Policy Registry & Versioning

All refund policies are registered in the versioned `REFUND_POLICY_REGISTRY` with explicit approval flags, category tags, and granular milestone windows.

| Policy Identifier | Version | Category | Approval Status | Terms Summary |
| :--- | :--- | :--- | :--- | :--- |
| `FLEXIBLE` | `v1` | Short-Term (<28 nights) | **APPROVED** | 100% refund of room, cleaning, and guest fees if cancelled >= 24 hours before check-in. Cleaning fee refunded if cancelled < 24 hours before check-in. |
| `MODERATE` | `v1` | Short-Term (<28 nights) | **APPROVED** | 100% refund if cancelled >= 5 days (120 hours) before check-in. Cleaning fee refunded if cancelled < 5 days. |
| `FIRM` | `v1` | Short-Term (<28 nights) | **APPROVED** | 100% refund if cancelled >= 30 days (720 hours) before check-in. 50% room refund + 100% cleaning fee if cancelled between 7 and 30 days (168–720 hours). Cleaning fee only if < 7 days. |
| `NON_REFUNDABLE`| `v1` | Special Option | **APPROVED** | 0% room refund at all times. 100% cleaning fee refunded if cancelled prior to check-in. |
| `FIRM_LONG_TERM`| `v1` | Long-Term (>=28 nights) | **UNAPPROVED (NEEDS_REVIEW)** | Long-term 30-day rolling commitment awaiting formal executive sign-off. Automatically fails closed into `NEEDS_REVIEW`. |
| `STRICT_LONG_TERM`| `v1` | Long-Term (>=28 nights) | **UNAPPROVED (NEEDS_REVIEW)** | Strict long-term schedule awaiting finance executive sign-off. Automatically fails closed into `NEEDS_REVIEW`. |

---

## 3. Core Timing Calculation

```typescript
export function calculateHoursUntilCheckIn(
  checkInDate: Date | string,
  checkInTimeStr?: string | null,
  cancellationTime: Date = new Date(),
): { hours: number; isPastCheckIn: boolean; checkInDateTime: Date }
```

- **Check-in Timestamp Resolution**: Converts check-in date to UTC 15:00:00 (3:00 PM local property time) unless an explicit `checkInTimeStr` (e.g., `"14:00"`) is specified.
- **Hours Calculation**: `(checkInDateTime.getTime() - cancellationTime.getTime()) / (3600 * 1000)`.
- **Past Check-in Guard**: If `hours <= 0`, `isPastCheckIn` is flagged as `true`, blocking automatic accommodation and cleaning fee refunds under standard policies.

---

## 4. Integer Minor Units Arithmetic & Balance Invariants

All monetary values are modeled in **integer minor units** (e.g. 1,500.00 SAR = `150000` cents/halalas):
- Proportional taxes, fees, and accommodation refunds utilize `Math.round()` to prevent fraction-of-a-cent rounding errors.
- **Refundable Balance Invariant**:
  $$\text{Remaining Refundable Balance} = \max(0, \text{Captured Amount} - (\text{Already Refunded Amount} + \text{Pending Reserved Amount}))$$
- **Upper Bound Guard**: The proposed refund amount is strictly capped by the remaining refundable balance:
  $$\text{Total Refundable Amount} = \min(\text{Raw Proposed Total}, \text{Remaining Refundable Balance})$$
- If `Captured Amount <= 0` or `Remaining Refundable Balance <= 0`, the engine immediately evaluates to status `INELIGIBLE` with `totalRefundableAmount: 0`.

---

## 5. Special Execution Paths

### 5.1 Host-Initiated Cancellations
When a Host cancels a confirmed reservation (`cancellationActor === "HOST"`):
- The guest is entitled to a **100% full reimbursement** of all captured funds, including room rate, cleaning fee, service fee, and taxes.
- Host retains **0%** compensation.
- The refund calculation evaluates to `status: "ELIGIBLE"` with `milestoneApplied: "Host-Initiated Full Reimbursement"`.

### 5.2 Administrative Discretionary Overrides
When an Administrator executes an override (`cancellationActor === "ADMIN"` with `discretionaryAdjustmentAmount`):
- Accepts exact minor unit amount provided by the administrator.
- Strictly bounds the override to `remainingRefundableBalance`.
- Requires an accompanying `discretionaryReason` which is permanently recorded in the audit log.

### 5.3 Unapproved Policies (Fail-Closed)
If a booking references a policy not marked `isApproved: true` (such as `FIRM_LONG_TERM:v1`):
- `status: "NEEDS_REVIEW"`
- `isCalculated: false`
- `totalRefundableAmount: 0`
- `missingRules: ["Long-term 30-day rolling commitment and host payout retention schedule is awaiting formal platform executive approval."]`

---

## 6. Quote Preview API

- **Endpoint**: `POST /api/v1/admin/bookings/[id]/refund-quote`
- **RBAC Guard**: Enforces `Role.ADMIN` and permission `PERMISSIONS.BOOKINGS_VIEW`.
- **Payload (Optional)**:
  ```json
  {
    "cancellationActor": "GUEST",
    "effectiveCancellationTime": "2026-10-15T12:00:00.000Z",
    "isOverride": false,
    "discretionaryAmount": 0,
    "discretionaryReason": ""
  }
  ```
- **Response**: Returns a complete `RefundCalculationResult` without mutating database records or initiating financial transactions.
