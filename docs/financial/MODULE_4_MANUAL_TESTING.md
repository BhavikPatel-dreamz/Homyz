# HOMYZ — MODULE 4: MANUAL TESTING & VERIFICATION GUIDE

This manual verification protocol guides QA engineers, financial controllers, and developers through testing the complete Host Payout lifecycle across Guest, Host, and Admin roles.

---

## Scenario 1: Host Payout Method Setup & Saudi IBAN Validation

### Steps:
1. Log in as a Host (`Role: HOST`).
2. Navigate to `/host/earnings`.
3. Verify the **Configured Payout Methods** card is displayed.
4. Click **+ Add Payout Method**.
5. Test validation with invalid inputs:
   - Enter `GB82WEST12345698765432` → Observe error: *"Saudi IBAN must start with 'SA'"*.
   - Enter `SA038000000060801016` (20 chars) → Observe error: *"Saudi IBAN must be exactly 24 characters"*.
   - Enter `SA9980000000608010167519` (invalid checksum) → Observe error: *"Invalid IBAN checksum digits"*.
6. Enter a valid Saudi IBAN:
   - Account Holder: `Abdullah Al-Ghamdi`
   - Bank Name: `Al Rajhi Bank`
   - IBAN: `SA0380000000608010167519`
   - Check *"Set as my default payout account"*.
   - Click **Save Account**.
7. **Verification Outcome:**
   - Account displays as `SA03 **** **** **** **** 7519`.
   - Default pill is highlighted.
   - Initial status is `Pending Verification` (or `Verified` if Host identity verification was already approved).

---

## Scenario 2: Admin Payout Account Verification

### Steps:
1. Log in as an Admin (`Role: ADMIN`).
2. Make a verification call via API or Admin Host Management:
   - `POST /api/v1/admin/hosts/{hostId}/payout-methods/{methodId}/verify`
   - Body: `{"status": "VERIFIED"}`
3. Switch to Host session at `/host/earnings`.
4. **Verification Outcome:**
   - Payout method badge changes from amber (`Pending Verification`) to green (`Verified`).

---

## Scenario 3: Booking Confirmation & Scheduled Payout

### Steps:
1. Log in as a Guest (`Role: USER`).
2. Reserve a listing starting in 5 days for 3 nights (Instant Book).
3. Complete payment with test card.
4. Log in as Host and navigate to `/host/earnings`:
   - Under **Upcoming Scheduled**, find the new reservation.
   - Scheduled Payout Date displays as `Check-in + 24 hours`.
   - Status badge displays as `SCHEDULED`.
   - Gross earnings, platform fee (15%), and net disbursement are calculated accurately.
5. Log in as Admin and navigate to `/admin/bookings/payouts`:
   - The booking appears under the `Pending Stay` KPI count and volume.
   - Payout status is `SCHEDULED`.

---

## Scenario 4: Post-Check-In Eligibility Arrival

### Steps:
1. Simulate or test with a reservation where check-in occurred > 24 hours ago.
2. Ensure guest payment is `CAPTURED` and host payout method is `VERIFIED`.
3. Check `/admin/bookings/payouts`:
   - The reservation transitions automatically from `SCHEDULED` to `ELIGIBLE_SETTLEMENT`.
   - The KPI card **Eligible for Settlement** reflects the net payout amount.

---

## Scenario 5: Administrative Hold & Dispute Protection

### Steps:
1. From `/admin/bookings/payouts`, locate an `ELIGIBLE_SETTLEMENT` reservation.
2. Click **Breakdown & Actions**.
3. Click **Place Hold**:
   - Select Hold Type: `FRAUD_REVIEW`.
   - Enter Mandatory Reason: *"Payment chargeback inquiry received from issuer."*
   - Click **Confirm Hold**.
4. **Verification Outcome:**
   - Status changes immediately to `ON_HOLD`.
   - KPI card **On Hold** increments.
   - Hold reason and admin email are visible in the breakdown details.
5. In the details modal, click **Release Hold**:
   - The system verifies that no pending refund or active dispute exists.
   - Status returns to `ELIGIBLE_SETTLEMENT`.
   - AuditLog records `HOST_PAYOUT_RELEASED`.

---

## Scenario 6: Automatic Dispute Hold Integration

### Steps:
1. For an eligible reservation, file a quality incident or dispute as Guest or Admin (`ListingQualityIncident` with status `PENDING`).
2. Refresh `/admin/bookings/payouts`.
3. **Verification Outcome:**
   - System automatically locks payout in `ON_HOLD`.
   - Payout cannot be settled until the incident status transitions to `RESOLVED` or `REJECTED`.

---

## Scenario 7: Settlement Execution & SARIE Batch Export

### Steps:
1. At `/admin/bookings/payouts`, click **SARIE Batch Export**.
2. **Verification Outcome:**
   - A `.csv` file downloads with headers: `Booking Reference`, `Beneficiary Name`, `Beneficiary IBAN`, `Bank Name`, `Amount SAR`, `Currency`, `Scheduled Date`, `Property Title`, `Status`.
   - Only `ELIGIBLE_SETTLEMENT` bookings are included in the export.
3. Open a payout breakdown and click **Process Settlement**:
   - Payout transitions to `PAID`.
   - Authoritative `SARIE-XXXXXXXX` reference is generated.
   - Duplicate execution attempt is safely rejected.
4. Log in as Host at `/host/earnings`:
   - The reservation moves from **Upcoming** to **Completed**.
   - Net payout amount is added to **Total Paid Out**.

