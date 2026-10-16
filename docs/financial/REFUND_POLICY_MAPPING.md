# HOMYZ — CANCELLATION & REFUND POLICY MAPPING SPECIFICATION

**Version:** 1.0.0  
**Date:** 2026-10-14  
**Engine Reference:** `lib/refund/policy-engine.ts`  
**Registry Version:** `v1`  
**Precision:** Integer Minor Units (Halalas / Cents)

---

## 1. Overview & Policy Immutability

Cancellation policies in Homyz are **versioned and immutable**. When a Guest completes a booking, the exact policy snapshot (`cancellationPolicySnapshot` in `priceBreakdown`) is permanently recorded. If a Host subsequently alters their listing's cancellation policy, existing reservations remain governed strictly by the terms accepted at booking time.

---

## 2. Authoritative Policy Rules Matrix

| Policy Identifier | Category | Timing Window (Hours to Check-in) | Accommodation Refund | Cleaning Fee Refund | Service Fee Refund | Tax Refund | Approved Status |
|---|---|---|---|---|---|---|---|
| **`FLEXIBLE:v1`** | Short Stay (< 28 nights) | $\ge 24\text{ hours}$ | 100% | 100% (FULL) | 100% (FULL) | Proportional | **APPROVED** |
| | | $< 24\text{ hours}$ | 0% (Retained) | 100% (FULL) | 0% (NONE) | Proportional to refunded base | **APPROVED** |
| **`MODERATE:v1`** | Short Stay (< 28 nights) | $\ge 120\text{ hours}$ (5 days) | 100% | 100% (FULL) | 100% (FULL) | Proportional | **APPROVED** |
| | | $< 120\text{ hours}$ | 0% (Retained) | 100% (FULL) | 0% (NONE) | Proportional to refunded base | **APPROVED** |
| **`FIRM:v1`** | Short Stay (< 28 nights) | $\ge 720\text{ hours}$ (30 days) | 100% | 100% (FULL) | 100% (FULL) | Proportional | **APPROVED** |
| | | $168\text{ to }720\text{ hours}$ (7–30 days) | 50% | 100% (FULL) | 0% (NONE) | Proportional to refunded base | **APPROVED** |
| | | $< 168\text{ hours}$ (< 7 days) | 0% (Retained) | 100% (FULL) | 0% (NONE) | Proportional to refunded base | **APPROVED** |
| **`NON_REFUNDABLE:v1`** | Special Rate Option | Any timing before check-in | 0% (Forfeited) | 100% (FULL) | 0% (NONE) | Proportional to refunded base | **APPROVED** |
| **`FIRM_LONG_TERM:v1`** | Long Stay ($\ge 28$ nights) | Any timing | Needs Review | Needs Review | Needs Review | Needs Review | **UNAPPROVED (Awaiting Sign-off)** |
| **`STRICT_LONG_TERM:v1`** | Long Stay ($\ge 28$ nights) | Any timing | Needs Review | Needs Review | Needs Review | Needs Review | **UNAPPROVED (Awaiting Sign-off)** |

---

## 3. Component Refund Treatment

### 3.1 Accommodation Subtotal
- Calculated based on the nightly room rate snapshot stored in the booking.
- Forfeited or partially refunded based on the matched policy milestone.

### 3.2 Cleaning Fee
- **Before Check-In**: Cleaning fee is **always 100% refunded** if cancelled prior to the scheduled check-in time because no cleaning services were rendered.
- **After Check-In**: Cleaning fee is 0% non-refundable once check-in has elapsed.

### 3.3 Guest Service Fee
- Refunded 100% when cancellation occurs during the full-refund window ($\ge 24\text{h}$ for Flexible, $\ge 120\text{h}$ for Moderate, $\ge 720\text{h}$ for Firm).
- Non-refundable during late or partial-refund cancellation windows.

### 3.4 Taxes (VAT 15%)
- Taxes are calculated proportionally using exact integer arithmetic:
  $$\text{Tax Refund} = \left\lfloor \frac{\text{Stored Taxes} \times (\text{Accommodation Refund} + \text{Cleaning Refund})}{\text{Taxable Base}} \right\rfloor$$
- Ensures tax authorities receive tax only on funds actually retained by the marketplace and host.

---

## 4. Special Scenarios & Exceptions

### 4.1 Host-Initiated Cancellation (`HOST_CANCELLATION`)
- When a Host cancels a confirmed reservation, the Guest is legally entitled to a **100% full reimbursement** of all captured funds (accommodation, cleaning fee, service fee, and taxes).
- Host retained payout drops immediately to $0$.

### 4.2 Past Scheduled Check-In (`isPastCheckIn === true`)
- If cancellation is requested after 15:00 local time on the check-in date:
  - `status: "INELIGIBLE"`
  - Total refundable amount is $0$.
  - Accommodation and cleaning fees are retained.

### 4.3 Administrative Discretionary Override (`ADMIN_DISCRETIONARY`)
- Authorized administrators can provide a custom refund amount.
- **Strict Invariant**: Discretionary amounts are strictly bounded by:
  $$\text{Discretionary Refund} \le \text{Captured Amount} - (\text{Already Refunded} + \text{Pending Reserved})$$
- Prevents platform over-refunding under any circumstance.

### 4.4 Unapproved Long-Term Policies
- Under Homyz safety governance, unapproved long-term policies (`FIRM_LONG_TERM`, `STRICT_LONG_TERM`) fail safe into `status: "NEEDS_REVIEW"` with `isCalculated: false`.
- The system never fabricates retention schedules or percentages.
- Triggers an administrative review in the Admin Refund Management dashboard.

