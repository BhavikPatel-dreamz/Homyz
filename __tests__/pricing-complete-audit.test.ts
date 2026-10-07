import "dotenv/config";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculateBookingPrice,
  calculateSpecialOffer,
  resolveNightlyRate,
  resolveSingleDiscount,
  isWeekendNight,
} from "../services/pricing.service";
import type { TaxRuleDTO } from "../lib/tax/types";

// Standard Saudi VAT Tax Rule (15% on accommodation + cleaning fee + extra guest fee)
const SAUDI_VAT_RULE: TaxRuleDTO = {
  id: "rule_sa_vat",
  jurisdictionId: "jur_sa",
  taxType: "VAT",
  name: "Saudi VAT",
  description: "Standard Saudi 15% VAT",
  calculationMethod: "PERCENTAGE",
  rate: 15,
  amount: null,
  taxableComponents: ["BASE_PRICE", "CLEANING_FEE", "GUEST_FEE"],
  remittanceResponsibility: "PLATFORM",
  isSystemManaged: true,
  isInclusive: false,
  longStayExemptionNights: null,
  effectiveFrom: new Date().toISOString(),
  effectiveUntil: null,
  version: 1,
  isActive: true,
};

describe("Complete Property Pricing & Fee System Audit Suite (16 Business Rules)", () => {
  // 1. Weekday-only stay uses weekdayBasePrice
  it("1. Weekday-only stay uses weekdayBasePrice", async () => {
    // 2026-10-04 (Sun) to 2026-10-07 (Wed) = 3 weekday nights (Sun, Mon, Tue)
    const res = await calculateBookingPrice({
      checkIn: "2026-10-04",
      checkOut: "2026-10-07",
      weekdayBasePrice: 50000, // SAR 500.00
      weekendPrice: 70000,
      hostServiceFeePercentage: 15,
    });

    assert.equal(res.nights, 3);
    assert.equal(res.weekdayNights, 3);
    assert.equal(res.weekendNights, 0);
    assert.equal(res.staySubtotal, 150000, "3 nights * 500.00 SAR = 150,000 cents");
    assert.equal(res.breakdown.every((n) => n.price === 50000 && n.rateSource === "WEEKDAY"), true);
  });

  // 2. Weekend-only stay uses weekendPrice
  it("2. Weekend-only stay uses weekendPrice", async () => {
    // In Saudi Arabia / Middle East: Thursday (day 4) and Friday (day 5) are weekend nights
    // 2026-10-08 (Thu) to 2026-10-10 (Sat) = 2 weekend nights (Thu, Fri)
    const res = await calculateBookingPrice({
      checkIn: "2026-10-08",
      checkOut: "2026-10-10",
      weekdayBasePrice: 50000,
      weekendPrice: 70000, // SAR 700.00
      hostServiceFeePercentage: 15,
    });

    assert.equal(res.nights, 2);
    assert.equal(res.weekdayNights, 0);
    assert.equal(res.weekendNights, 2);
    assert.equal(res.staySubtotal, 140000, "2 weekend nights * 700.00 SAR = 140,000 cents");
    assert.equal(res.breakdown.every((n) => n.price === 70000 && n.rateSource === "WEEKEND"), true);
  });

  // 3. Mixed weekday + weekend stay correctly splits rates
  it("3. Mixed weekday + weekend stay correctly splits rates", async () => {
    // 2026-10-07 (Wed) to 2026-10-10 (Sat) = 3 nights:
    // Wed 10-07: Weekday (50,000)
    // Thu 10-08: Weekend (70,000)
    // Fri 10-09: Weekend (70,000)
    const res = await calculateBookingPrice({
      checkIn: "2026-10-07",
      checkOut: "2026-10-10",
      weekdayBasePrice: 50000,
      weekendPrice: 70000,
      hostServiceFeePercentage: 15,
    });

    assert.equal(res.nights, 3);
    assert.equal(res.weekdayNights, 1);
    assert.equal(res.weekendNights, 2);
    assert.equal(res.staySubtotal, 50000 + 70000 + 70000, "1 weekday + 2 weekend = 190,000 cents");
    assert.equal(res.breakdown[0].rateSource, "WEEKDAY");
    assert.equal(res.breakdown[1].rateSource, "WEEKEND");
    assert.equal(res.breakdown[2].rateSource, "WEEKEND");
  });

  // 4. Fallback to weekdayBasePrice when weekendPrice is not provided
  it("4. Fallback to weekdayBasePrice when weekendPrice is not provided", async () => {
    // 2026-10-08 (Thu) to 2026-10-10 (Sat) = 2 weekend nights, no weekendPrice specified
    const res = await calculateBookingPrice({
      checkIn: "2026-10-08",
      checkOut: "2026-10-10",
      weekdayBasePrice: 50000,
      weekendPrice: null, // Host did not set weekend price
      hostServiceFeePercentage: 15,
    });

    assert.equal(res.nights, 2);
    assert.equal(res.weekendPrice, null);
    assert.equal(res.staySubtotal, 100000, "Falls back to weekday rate: 2 * 50,000 = 100,000 cents");
    assert.equal(res.breakdown.every((n) => n.price === 50000 && n.rateSource === "WEEKDAY"), true);
  });

  // 5. Calendar custom date price overrides weekday price
  it("5. Calendar custom date price overrides weekday price", async () => {
    // 2026-10-05 (Mon) is a weekday night. Custom price = 85,000 cents
    const res = await calculateBookingPrice({
      checkIn: "2026-10-05",
      checkOut: "2026-10-06",
      weekdayBasePrice: 50000,
      customPrices: { "2026-10-05": 85000 },
      hostServiceFeePercentage: 15,
    });

    assert.equal(res.nights, 1);
    assert.equal(res.customPricedNights, 1);
    assert.equal(res.staySubtotal, 85000, "Custom calendar rate must override weekday base price");
    assert.equal(res.breakdown[0].rateSource, "CUSTOM");
    assert.equal(res.breakdown[0].price, 85000);
  });

  // 6. Calendar custom date price overrides weekend price
  it("6. Calendar custom date price overrides weekend price", async () => {
    // 2026-10-08 (Thu) is a weekend night. Weekend price = 70,000 cents, Custom price = 95,000 cents
    const res = await calculateBookingPrice({
      checkIn: "2026-10-08",
      checkOut: "2026-10-09",
      weekdayBasePrice: 50000,
      weekendPrice: 70000,
      customPrices: { "2026-10-08": 95000 },
      hostServiceFeePercentage: 15,
    });

    assert.equal(res.nights, 1);
    assert.equal(res.customPricedNights, 1);
    assert.equal(res.staySubtotal, 95000, "Custom calendar rate must override weekend price (Custom > Weekend > Weekday)");
    assert.equal(res.breakdown[0].rateSource, "CUSTOM");
    assert.equal(res.breakdown[0].price, 95000);
  });

  // 7. Single discount rule applies only the highest / highest priority discount
  it("7. Single discount rule applies only the highest / highest priority discount", async () => {
    // 30 nights stay with Monthly (25%) and Weekly (10%) and New Listing (20%) configured
    const res = await calculateBookingPrice({
      checkIn: "2026-10-01",
      checkOut: "2026-10-31",
      weekdayBasePrice: 10000, // SAR 100 / night
      discounts: {
        weekly: { enabled: true, percentage: 10 },
        monthly: { enabled: true, percentage: 25 },
        new_listing: { enabled: true, percentage: 20 },
      },
      hostServiceFeePercentage: 15,
    });

    assert.equal(res.nights, 30);
    assert.ok(res.appliedDiscount);
    assert.equal(res.appliedDiscount.key, "monthly", "Monthly discount is highest (25%)");
    assert.equal(res.discountPercentage, 25);
    assert.equal(res.discountAmount, Math.round((res.staySubtotal * 25) / 100));
    assert.equal(res.accommodationSubtotal, res.staySubtotal - res.discountAmount);
  });

  // 8. Discounts do not stack
  it("8. Discounts do not stack under any circumstance", async () => {
    // Qualifies for both New Listing (20%) and Last-Minute (10%)
    const res = await calculateBookingPrice({
      checkIn: "2026-10-01",
      checkOut: "2026-10-04",
      bookingCreatedAt: "2026-09-30", // 1 day before check-in -> triggers last minute
      weekdayBasePrice: 20000,
      discounts: {
        new_listing: { enabled: true, percentage: 20 },
        last_minute: { enabled: true, percentage: 10, daysBefore: 2 },
      },
      hostServiceFeePercentage: 15,
    });

    assert.equal(res.nights, 3);
    // Highest is 20%
    assert.equal(res.discountPercentage, 20, "Must NOT combine 20% + 10% into 30%");
    assert.equal(res.appliedDiscount?.key, "new_listing");
    assert.equal(res.discountAmount, Math.round((res.staySubtotal * 20) / 100));
  });

  // 9. Extra guest fees are added correctly when guest count exceeds base capacity
  it("9. Extra guest fees are added correctly when guest count exceeds base capacity", async () => {
    // Base guests = 2, Requested guests = 4 (2 extra guests)
    // Extra guest fee = 5000 cents (50 SAR per extra guest per night) for 3 nights
    const res = await calculateBookingPrice({
      checkIn: "2026-10-04",
      checkOut: "2026-10-07",
      weekdayBasePrice: 30000,
      baseGuests: 2,
      guests: 4,
      extraGuestFee: 5000,
      hostServiceFeePercentage: 15,
    });

    assert.equal(res.nights, 3);
    // 2 extra guests * 5000 * 3 nights = 30000 cents (300 SAR)
    assert.equal(res.extraGuestFee, 30000);
    assert.equal(res.totalAdditionalFees, 30000);
  });

  // 10. An unset cleaning fee remains zero and does not affect the guest total.
  it("10. Unset cleaning fee is not charged", async () => {
    const res = await calculateBookingPrice({
      checkIn: "2026-10-04",
      checkOut: "2026-10-07",
      weekdayBasePrice: 40000,
      hostServiceFeePercentage: 15,
    });

    assert.equal(res.staySubtotal, 120000);
    assert.equal(res.cleaningFee, 0);
    assert.equal(res.totalAdditionalFees, 0);
    assert.equal(res.guestTotal, 120000, "Cleaning fee is excluded from the guest total");
  });

  // 11. Host Service Fee is calculated using admin-configured percentage
  it("11. Host Service Fee is calculated using admin-configured percentage", async () => {
    // 15% Host Service Fee on SAR 1,000.00 (100,000 cents) = SAR 150.00 (15,000 cents)
    const res = await calculateBookingPrice({
      checkIn: "2026-10-04",
      checkOut: "2026-10-06",
      weekdayBasePrice: 50000, // 2 nights * 50,000 = 100,000 cents
      hostServiceFeePercentage: 15,
    });

    assert.equal(res.staySubtotal, 100000);
    assert.equal(res.hostServiceFeePercentage, 15);
    assert.equal(res.hostServiceFee, 15000);
  });

  // 12. Host Service Fee is NOT included in the taxable base
  it("12. Host Service Fee is strictly NOT included in the taxable base", async () => {
    // Accommodation = 100,000 cents. Host Service Fee = 15,000 cents.
    const res = await calculateBookingPrice({
      checkIn: "2026-10-04",
      checkOut: "2026-10-06",
      weekdayBasePrice: 50000,
      hostServiceFeePercentage: 15,
      taxRules: [SAUDI_VAT_RULE],
    });

    assert.equal(res.accommodationSubtotal, 100000);
    assert.equal(res.cleaningFee, 0);
    assert.equal(res.hostServiceFee, 15000);

    assert.equal(res.taxableBase, 100000);
    assert.equal(res.taxTotal, 15000, "VAT applies to accommodation, never a removed cleaning fee or platform fee");
  });

  // 13. Taxes are computed correctly on taxable amounts
  it("13. Taxes are computed correctly on taxable amounts", async () => {
    // Accommodation: 60,000 cents, Extra guest fee: 10,000 cents.
    const res = await calculateBookingPrice({
      checkIn: "2026-10-04",
      checkOut: "2026-10-06",
      weekdayBasePrice: 30000,
      baseGuests: 1,
      guests: 2,
      extraGuestFee: 5000, // 1 extra guest * 5,000 * 2 nights = 10,000 cents
      hostServiceFeePercentage: 15,
      taxRules: [SAUDI_VAT_RULE],
    });

    assert.equal(res.accommodationSubtotal, 60000);
    assert.equal(res.extraGuestFee, 10000);
    assert.equal(res.cleaningFee, 0);
    assert.equal(res.taxableBase, 70000);
    assert.equal(res.taxTotal, 10500);
    assert.equal(res.guestTotal, 60000 + 10000 + 10500);
  });

  // 14. Host payout excludes cleaning and deducts the platform fee
  it("14. Host payout equals accommodation minus host service fee", async () => {
    const res = await calculateBookingPrice({
      checkIn: "2026-10-04",
      checkOut: "2026-10-06",
      weekdayBasePrice: 50000, // 100,000 accommodation
      hostServiceFeePercentage: 15, // 15,000 fee
      taxRules: [SAUDI_VAT_RULE], // Platform remitted
    });

    assert.equal(res.accommodationSubtotal, 100000);
    assert.equal(res.cleaningFee, 0);
    assert.equal(res.hostServiceFee, 15000);

    assert.equal(res.payoutBreakdown.netHostPayout, 85000);
    assert.equal(res.payoutBreakdown.platformServiceFee, 15000);
  });

  // 15. Special Offer excludes cleaning and guest-facing platform fees
  it("15. Special Offer calculates supported charges and taxes correctly", async () => {
    // Special offer for SAR 2,000.00 (200,000 cents) for 5 nights
    const res = await calculateSpecialOffer({
      specialOfferAmount: 200000,
      nights: 5,
      extraGuestFee: 10000, // SAR 100.00
      hostServiceFeePercentage: 15,
      taxRules: [SAUDI_VAT_RULE],
    });

    assert.equal(res.accommodationSubtotal, 200000);
    assert.equal(res.cleaningFee, 0);
    assert.equal(res.extraGuestFee, 10000);
    // Host fee = 15% on 200,000 = 30,000 cents
    assert.equal(res.hostServiceFee, 30000);
    assert.equal(res.taxableBase, 210000);
    assert.equal(res.taxTotal, 31500);
    assert.equal(res.guestTotal, 241500);
    assert.equal(res.payoutBreakdown.netHostPayout, 180000);
  });

  // 16. Invalid date ranges, negative prices, or unsupported discount combinations are rejected gracefully
  it("16. Invalid date ranges, negative prices, or unsupported discount combinations are rejected gracefully", async () => {
    // Check-out same as check-in (0 nights)
    await assert.rejects(
      async () => {
        await calculateBookingPrice({
          checkIn: "2026-10-04",
          checkOut: "2026-10-04",
          weekdayBasePrice: 50000,
        });
      },
      /Check-out date must be at least one night after check-in date/,
    );

    // Check-out before check-in
    await assert.rejects(
      async () => {
        await calculateBookingPrice({
          checkIn: "2026-10-05",
          checkOut: "2026-10-04",
          weekdayBasePrice: 50000,
        });
      },
      /Check-out date must be at least one night after check-in date/,
    );

    // Negative weekday price
    await assert.rejects(
      async () => {
        await calculateBookingPrice({
          checkIn: "2026-10-04",
          checkOut: "2026-10-07",
          weekdayBasePrice: -500,
        });
      },
      /Weekday base price must be greater than zero/,
    );

    // Invalid date format
    await assert.rejects(
      async () => {
        await calculateBookingPrice({
          checkIn: "invalid-date",
          checkOut: "2026-10-07",
          weekdayBasePrice: 50000,
        });
      },
      /Invalid check-in or check-out date/,
    );
  });
});
