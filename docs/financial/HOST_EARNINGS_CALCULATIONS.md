# HOMYZ — HOST EARNINGS & COMMISSION CALCULATIONS REFERENCE

## 1. Principles of Financial Authority

1. **Integer Minor Units:** All monetary values in Homyz are stored strictly as 64-bit safe integers representing minor currency units (Saudi halalas / cents; $1\text{ SAR} = 100\text{ halalas}$). Floating-point values are never stored or accumulated.
2. **Snapshot Invariance:** When a booking is confirmed, the authoritative breakdown is saved to `Booking.priceBreakdown.payoutBreakdown`. Subsequent rate modifications or discounts by the Host on the listing never retroactively mutate past bookings.
3. **Commission Directionality:** Platform service fees are deducted from gross Host earnings, never double-charged or passed onto guests as hidden accommodation fees.

---

## 2. Core Mathematical Formulations

### 2.1 Standard Booking Earnings
For a reservation with accommodation nights, optional extra guest fees, pet fees, and cleaning fee:

$$\text{Gross Host Earnings} = \text{accommodationSubtotal} + \text{extraGuestFee} + \text{petFee} + \text{cleaningFee}$$

$$\text{Platform Commission} = \left\lfloor \frac{\text{Gross Host Earnings} \times \text{Host Service Fee \%}}{100} + 0.5 \right\rfloor$$

$$\text{Net Host Payout} = \text{Gross Host Earnings} - \text{Platform Commission}$$

### 2.2 Standard Benchmark Example (in Halalas)
- 3 Nights @ 500 SAR/night = 150,000 halalas
- Cleaning Fee = 15,000 halalas
- Extra Guest Fee = 5,000 halalas
- **Gross Earnings** = 170,000 halalas (1,700.00 SAR)
- Platform Commission (15%) = 25,500 halalas (255.00 SAR)
- **Net Host Payout** = 144,500 halalas (1,445.00 SAR)

---

## 3. Cancellation & Refund Adjustments

### 3.1 Pre-Payout Cancellation
When a cancellation occurs before the payout has been disbursed:
1. The Cancellation Policy Engine determines the Guest refund amount according to policy milestone and non-refundable terms.
2. The retained portion is recorded on `priceBreakdown.cancellation.hostPayoutRetained`.
3. If full refund is issued to the Guest:
   $$\text{Net Host Payout} = 0$$
   $$\text{Payout Status} = \text{CANCELLED}$$
4. If a partial refund is issued:
   $$\text{Net Host Payout} = \text{hostPayoutRetained}$$

### 3.2 Post-Payout Refund & Clawback Recovery
When a refund, damage claim deduction, or dispute resolution takes place after a payout is marked `PAID`:
1. The historical settled payout record remains **strictly immutable**. Its `netPayout` and `PAID` status are never reduced.
2. An adjustment record is entered in `User.personalInfo.payoutAdjustments`:
   ```typescript
   {
     id: "adj_xxxxxx",
     bookingId: "b_xxxxxx",
     type: "REFUND_DEDUCTION" | "DISPUTE_CLAWBACK",
     amount: 50000, // 500 SAR clawback
     currency: "SAR",
     status: "PENDING",
     reason: "Guest post-stay refund granted for AC failure."
   }
   ```
3. When the Host's next booking becomes `ELIGIBLE_SETTLEMENT`, pending deductions are applied to offset the next disbursement:
   $$\text{Disbursed Amount} = \max(0, \text{Next Net Payout} - \text{Pending Deductions})$$

---

## 4. Taxes & Local Compliance

- **VAT on Platform Services:** Platform fees include applicable Value Added Tax where mandated by the Zakat, Tax and Customs Authority (ZATCA).
- **Host-Remitted vs Platform-Remitted Taxes:** If municipal tourism or municipality fees apply, the calculation engine partitions them into `taxesRemittedByPlatform` and `taxesCollectedForHost`.
- Taxes collected for the host are added to gross disbursements so the Host can remit directly to relevant authorities.

