import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  evaluateDiscountEligibility,
  DISCOUNT_ELIGIBILITY_REASONS,
  type DiscountEligibilityResult,
} from "../services/discount-eligibility.service";
import {
  calculateBookingPrice,
  resolveSingleDiscount,
} from "../services/pricing.service";

describe("Phase 3 — Central Discount Eligibility Engine", () => {
  const baseDiscountConfig = {
    weekly: { enabled: true, percentage: 10 },
    monthly: { enabled: true, percentage: 25 },
    last_minute: { enabled: true, percentage: 15 },
    new_listing: { enabled: true, percentage: 20 },
  };

  describe("1. Engine Contract & Output Structure (Section 4 & 5)", () => {
    it("returns normalized eligibility items with configured, eligible, percentage, and reasons", () => {
      const result: DiscountEligibilityResult = evaluateDiscountEligibility({
        checkIn: "2026-10-10",
        checkOut: "2026-10-18", // 8 nights
        bookingDate: "2026-10-01", // 9 days before check-in
        discounts: baseDiscountConfig,
        isNewListing: true,
      });

      assert.ok(result.weekly);
      assert.ok(result.monthly);
      assert.ok(result.lastMinute);
      assert.ok(result.newListing);
      assert.ok(Array.isArray(result.eligibleDiscounts));

      // Aliases
      assert.equal(result.new_listing, result.newListing);
      assert.equal(result.last_minute, result.lastMinute);

      assert.equal(result.weekly.configured, true);
      assert.equal(result.weekly.eligible, true);
      assert.equal(result.weekly.percentage, 10);
      assert.equal(result.weekly.requiredNights, 7);
      assert.equal(result.weekly.actualNights, 8);
      assert.equal(result.weekly.reason, DISCOUNT_ELIGIBILITY_REASONS.MINIMUM_STAY_MET);

      assert.equal(result.monthly.configured, true);
      assert.equal(result.monthly.eligible, false);
      assert.equal(result.monthly.percentage, 25);
      assert.equal(result.monthly.requiredNights, 28);
      assert.equal(result.monthly.actualNights, 8);
      assert.equal(result.monthly.reason, DISCOUNT_ELIGIBILITY_REASONS.STAY_TOO_SHORT);

      assert.equal(result.lastMinute.configured, true);
      assert.equal(result.lastMinute.eligible, false);
      assert.equal(result.lastMinute.percentage, 15);
      assert.equal(result.lastMinute.windowDays, 2);
      assert.equal(result.lastMinute.daysUntilCheckIn, 9);
      assert.equal(result.lastMinute.reason, DISCOUNT_ELIGIBILITY_REASONS.OUTSIDE_LAST_MINUTE_WINDOW);

      assert.equal(result.newListing.configured, true);
      assert.equal(result.newListing.eligible, true);
      assert.equal(result.newListing.percentage, 20);
      assert.equal(result.newListing.reason, DISCOUNT_ELIGIBILITY_REASONS.ELIGIBLE);
    });
  });

  describe("2. Weekly Discount Eligibility (Section 7 & 25)", () => {
    it("marks weekly discount as STAY_TOO_SHORT below threshold (e.g. 6 nights)", () => {
      const result = evaluateDiscountEligibility({
        checkIn: "2026-10-10",
        checkOut: "2026-10-16", // 6 nights
        discounts: { weekly: { enabled: true, percentage: 10 } },
      });

      assert.equal(result.weekly.configured, true);
      assert.equal(result.weekly.eligible, false);
      assert.equal(result.weekly.requiredNights, 7);
      assert.equal(result.weekly.actualNights, 6);
      assert.equal(result.weekly.reason, DISCOUNT_ELIGIBILITY_REASONS.STAY_TOO_SHORT);
    });

    it("marks weekly discount as MINIMUM_STAY_MET at exact threshold (7 nights)", () => {
      const result = evaluateDiscountEligibility({
        checkIn: "2026-10-10",
        checkOut: "2026-10-17", // 7 nights
        discounts: { weekly: { enabled: true, percentage: 10 } },
      });

      assert.equal(result.weekly.configured, true);
      assert.equal(result.weekly.eligible, true);
      assert.equal(result.weekly.requiredNights, 7);
      assert.equal(result.weekly.actualNights, 7);
      assert.equal(result.weekly.reason, DISCOUNT_ELIGIBILITY_REASONS.MINIMUM_STAY_MET);
    });

    it("marks weekly discount as MINIMUM_STAY_MET above threshold (14 nights)", () => {
      const result = evaluateDiscountEligibility({
        checkIn: "2026-10-10",
        checkOut: "2026-10-24", // 14 nights
        discounts: { weekly: { enabled: true, percentage: 10 } },
      });

      assert.equal(result.weekly.configured, true);
      assert.equal(result.weekly.eligible, true);
      assert.equal(result.weekly.actualNights, 14);
      assert.equal(result.weekly.reason, DISCOUNT_ELIGIBILITY_REASONS.MINIMUM_STAY_MET);
    });
  });

  describe("3. Monthly Discount Eligibility (Section 8 & 26)", () => {
    it("marks monthly discount as STAY_TOO_SHORT below threshold (27 nights)", () => {
      const result = evaluateDiscountEligibility({
        checkIn: "2026-10-01",
        checkOut: "2026-10-28", // 27 nights
        discounts: { monthly: { enabled: true, percentage: 25 } },
      });

      assert.equal(result.monthly.configured, true);
      assert.equal(result.monthly.eligible, false);
      assert.equal(result.monthly.requiredNights, 28);
      assert.equal(result.monthly.actualNights, 27);
      assert.equal(result.monthly.reason, DISCOUNT_ELIGIBILITY_REASONS.STAY_TOO_SHORT);
    });

    it("marks monthly discount as MINIMUM_STAY_MET at exact threshold (28 nights)", () => {
      const result = evaluateDiscountEligibility({
        checkIn: "2026-10-01",
        checkOut: "2026-10-29", // 28 nights
        discounts: { monthly: { enabled: true, percentage: 25 } },
      });

      assert.equal(result.monthly.configured, true);
      assert.equal(result.monthly.eligible, true);
      assert.equal(result.monthly.requiredNights, 28);
      assert.equal(result.monthly.actualNights, 28);
      assert.equal(result.monthly.reason, DISCOUNT_ELIGIBILITY_REASONS.MINIMUM_STAY_MET);
    });

    it("marks monthly discount as MINIMUM_STAY_MET above threshold (35 nights)", () => {
      const result = evaluateDiscountEligibility({
        checkIn: "2026-10-01",
        checkOut: "2026-11-05", // 35 nights
        discounts: { monthly: { enabled: true, percentage: 25 } },
      });

      assert.equal(result.monthly.configured, true);
      assert.equal(result.monthly.eligible, true);
      assert.equal(result.monthly.actualNights, 35);
      assert.equal(result.monthly.reason, DISCOUNT_ELIGIBILITY_REASONS.MINIMUM_STAY_MET);
    });
  });

  describe("4. Last-Minute Discount Eligibility (Section 9, 13 & 27)", () => {
    it("marks outside window when daysUntilCheckIn > window threshold (e.g. 5 days > 2)", () => {
      const result = evaluateDiscountEligibility({
        checkIn: "2026-10-10",
        checkOut: "2026-10-12",
        bookingDate: "2026-10-05", // 5 days prior
        discounts: { last_minute: { enabled: true, percentage: 15 } },
      });

      assert.equal(result.lastMinute.configured, true);
      assert.equal(result.lastMinute.eligible, false);
      assert.equal(result.lastMinute.daysUntilCheckIn, 5);
      assert.equal(result.lastMinute.reason, DISCOUNT_ELIGIBILITY_REASONS.OUTSIDE_LAST_MINUTE_WINDOW);
    });

    it("marks eligible at exact boundary (daysUntilCheckIn = 2)", () => {
      const result = evaluateDiscountEligibility({
        checkIn: "2026-10-10",
        checkOut: "2026-10-12",
        bookingDate: "2026-10-08", // exactly 2 days prior
        discounts: { last_minute: { enabled: true, percentage: 15 } },
      });

      assert.equal(result.lastMinute.configured, true);
      assert.equal(result.lastMinute.eligible, true);
      assert.equal(result.lastMinute.daysUntilCheckIn, 2);
      assert.equal(result.lastMinute.reason, DISCOUNT_ELIGIBILITY_REASONS.ELIGIBLE);
    });

    it("marks eligible inside window (daysUntilCheckIn = 1)", () => {
      const result = evaluateDiscountEligibility({
        checkIn: "2026-10-10",
        checkOut: "2026-10-12",
        bookingDate: "2026-10-09", // 1 day prior
        discounts: { last_minute: { enabled: true, percentage: 15 } },
      });

      assert.equal(result.lastMinute.configured, true);
      assert.equal(result.lastMinute.eligible, true);
      assert.equal(result.lastMinute.daysUntilCheckIn, 1);
      assert.equal(result.lastMinute.reason, DISCOUNT_ELIGIBILITY_REASONS.ELIGIBLE);
    });

    it("marks eligible for same-day check-in (daysUntilCheckIn = 0)", () => {
      const result = evaluateDiscountEligibility({
        checkIn: "2026-10-10",
        checkOut: "2026-10-12",
        bookingDate: "2026-10-10", // same day
        discounts: { last_minute: { enabled: true, percentage: 15 } },
      });

      assert.equal(result.lastMinute.configured, true);
      assert.equal(result.lastMinute.eligible, true);
      assert.equal(result.lastMinute.daysUntilCheckIn, 0);
      assert.equal(result.lastMinute.reason, DISCOUNT_ELIGIBILITY_REASONS.ELIGIBLE);
    });

    it("marks INVALID_DATES when check-in is in the past (daysUntilCheckIn < 0)", () => {
      const result = evaluateDiscountEligibility({
        checkIn: "2026-10-08",
        checkOut: "2026-10-10",
        bookingDate: "2026-10-10", // past check-in
        discounts: { last_minute: { enabled: true, percentage: 15 } },
      });

      assert.equal(result.lastMinute.eligible, false);
      assert.equal(result.lastMinute.reason, DISCOUNT_ELIGIBILITY_REASONS.INVALID_DATES);
    });
  });

  describe("5. New Listing Promotion Eligibility (Section 10 & 28)", () => {
    it("marks eligible for new listing promotion when enabled and first 3 bookings not exceeded", () => {
      const result = evaluateDiscountEligibility({
        checkIn: "2026-10-10",
        checkOut: "2026-10-12",
        discounts: { new_listing: { enabled: true, percentage: 20 } },
        isNewListing: true,
        completedBookingsCount: 1,
      });

      assert.equal(result.newListing.configured, true);
      assert.equal(result.newListing.eligible, true);
      assert.equal(result.newListing.percentage, 20);
      assert.equal(result.newListing.reason, DISCOUNT_ELIGIBILITY_REASONS.ELIGIBLE);
    });

    it("marks PROMOTION_EXPIRED once 3 bookings are completed (Section 10)", () => {
      const result = evaluateDiscountEligibility({
        checkIn: "2026-10-10",
        checkOut: "2026-10-12",
        discounts: { new_listing: { enabled: true, percentage: 20 } },
        isNewListing: true,
        completedBookingsCount: 3,
      });

      assert.equal(result.newListing.configured, true);
      assert.equal(result.newListing.eligible, false);
      assert.equal(result.newListing.reason, DISCOUNT_ELIGIBILITY_REASONS.PROMOTION_EXPIRED);
    });

    it("marks LISTING_NOT_ELIGIBLE when isNewListing is false", () => {
      const result = evaluateDiscountEligibility({
        checkIn: "2026-10-10",
        checkOut: "2026-10-12",
        discounts: { new_listing: { enabled: true, percentage: 20 } },
        isNewListing: false,
      });

      assert.equal(result.newListing.configured, true);
      assert.equal(result.newListing.eligible, false);
      assert.equal(result.newListing.reason, DISCOUNT_ELIGIBILITY_REASONS.LISTING_NOT_ELIGIBLE);
    });

    it("marks PROMOTION_EXCLUDED when includeNewListingPromotion is false", () => {
      const result = evaluateDiscountEligibility({
        checkIn: "2026-10-10",
        checkOut: "2026-10-12",
        discounts: { new_listing: { enabled: true, percentage: 20 } },
        isNewListing: true,
        includeNewListingPromotion: false,
      });

      assert.equal(result.newListing.eligible, false);
      assert.equal(result.newListing.reason, DISCOUNT_ELIGIBILITY_REASONS.PROMOTION_EXCLUDED);
    });

    it("marks NOT_CONFIGURED when no new listing discount is configured and listing is not new", () => {
      const result = evaluateDiscountEligibility({
        checkIn: "2026-10-10",
        checkOut: "2026-10-12",
        discounts: {},
      });

      assert.equal(result.newListing.configured, false);
      assert.equal(result.newListing.eligible, false);
      assert.equal(result.newListing.reason, DISCOUNT_ELIGIBILITY_REASONS.NOT_CONFIGURED);
    });
  });

  describe("6. Multiple Eligible Discounts & NO Stacking (Section 1, 16 & 29)", () => {
    it("returns multiple eligible discounts in eligibleDiscounts without picking a winner", () => {
      const result = evaluateDiscountEligibility({
        checkIn: "2026-10-10",
        checkOut: "2026-10-18", // 8 nights (qualifies for Weekly)
        bookingDate: "2026-10-09", // 1 day before (qualifies for Last Minute)
        discounts: baseDiscountConfig,
        isNewListing: true, // qualifies for New Listing
      });

      // Weekly, Last-Minute, and New Listing are ALL eligible
      assert.equal(result.weekly.eligible, true);
      assert.equal(result.lastMinute.eligible, true);
      assert.equal(result.newListing.eligible, true);
      assert.equal(result.monthly.eligible, false);

      // Exactly 3 eligible discounts returned in the list
      assert.equal(result.eligibleDiscounts.length, 3);
      const eligibleKeys = result.eligibleDiscounts.map((d) => d.key);
      assert.ok(eligibleKeys.includes("weekly"));
      assert.ok(eligibleKeys.includes("last_minute"));
      assert.ok(eligibleKeys.includes("new_listing"));

      // Phase 3 DOES NOT stack or pick a winner
      assert.ok(result.eligibleDiscounts.every((d) => typeof d.percentage === "number"));
    });
  });

  describe("7. Disabled Discounts (Section 6 & 30)", () => {
    it("returns eligible: false and reason: DISABLED when host toggle is OFF, even if percentage is present", () => {
      const result = evaluateDiscountEligibility({
        checkIn: "2026-10-10",
        checkOut: "2026-10-20", // 10 nights (would otherwise qualify for Weekly)
        discounts: {
          weekly: { enabled: false, percentage: 10 },
          monthly: { enabled: false, percentage: 25 },
          last_minute: { enabled: false, percentage: 15 },
          new_listing: { enabled: false, percentage: 20 },
        },
        isNewListing: true,
      });

      assert.equal(result.weekly.configured, true);
      assert.equal(result.weekly.eligible, false);
      assert.equal(result.weekly.percentage, 10);
      assert.equal(result.weekly.reason, DISCOUNT_ELIGIBILITY_REASONS.DISABLED);

      assert.equal(result.monthly.configured, true);
      assert.equal(result.monthly.eligible, false);
      assert.equal(result.monthly.percentage, 25);
      assert.equal(result.monthly.reason, DISCOUNT_ELIGIBILITY_REASONS.DISABLED);

      assert.equal(result.lastMinute.configured, true);
      assert.equal(result.lastMinute.eligible, false);
      assert.equal(result.lastMinute.percentage, 15);
      assert.equal(result.lastMinute.reason, DISCOUNT_ELIGIBILITY_REASONS.DISABLED);

      assert.equal(result.newListing.configured, true);
      assert.equal(result.newListing.eligible, false);
      assert.equal(result.newListing.percentage, 20);
      assert.equal(result.newListing.reason, DISCOUNT_ELIGIBILITY_REASONS.DISABLED);

      assert.equal(result.eligibleDiscounts.length, 0);
    });
  });

  describe("8. Edge Cases: Invalid Dates & No Dates (Section 20, 31 & 32)", () => {
    it("returns INVALID_DATES when checkOut <= checkIn", () => {
      const result = evaluateDiscountEligibility({
        checkIn: "2026-10-15",
        checkOut: "2026-10-10", // checkOut before checkIn
        discounts: baseDiscountConfig,
      });

      assert.equal(result.weekly.eligible, false);
      assert.equal(result.weekly.reason, DISCOUNT_ELIGIBILITY_REASONS.INVALID_DATES);
      assert.equal(result.monthly.eligible, false);
      assert.equal(result.monthly.reason, DISCOUNT_ELIGIBILITY_REASONS.INVALID_DATES);
      assert.equal(result.lastMinute.eligible, false);
      assert.equal(result.lastMinute.reason, DISCOUNT_ELIGIBILITY_REASONS.INVALID_DATES);
      assert.equal(result.eligibleDiscounts.length, 0);
    });

    it("returns NOT_EVALUATED for stay-length discounts when dates are not provided", () => {
      const result = evaluateDiscountEligibility({
        checkIn: null,
        checkOut: null,
        discounts: baseDiscountConfig,
      });

      assert.equal(result.weekly.eligible, false);
      assert.equal(result.weekly.reason, DISCOUNT_ELIGIBILITY_REASONS.NOT_EVALUATED);
      assert.equal(result.monthly.eligible, false);
      assert.equal(result.monthly.reason, DISCOUNT_ELIGIBILITY_REASONS.NOT_EVALUATED);
      assert.equal(result.lastMinute.eligible, false);
      assert.equal(result.lastMinute.reason, DISCOUNT_ELIGIBILITY_REASONS.NOT_EVALUATED);
    });
  });

  describe("9. Client / Server Parity (Section 24 & 33)", () => {
    it("produces identical eligibility results when executed on date strings vs Date objects", () => {
      const fromStrings = evaluateDiscountEligibility({
        checkIn: "2026-10-10",
        checkOut: "2026-10-18",
        bookingDate: "2026-10-09",
        discounts: baseDiscountConfig,
        isNewListing: true,
      });

      const fromDates = evaluateDiscountEligibility({
        checkIn: new Date("2026-10-10T00:00:00.000Z"),
        checkOut: new Date("2026-10-18T00:00:00.000Z"),
        bookingDate: new Date("2026-10-09T00:00:00.000Z"),
        discounts: baseDiscountConfig,
        isNewListing: true,
      });

      assert.deepEqual(fromStrings, fromDates);
    });
  });

  describe("10. Pricing Engine Integration (Section 19 & 34)", () => {
    it("calculateBookingPrice includes discountEligibility in its return breakdown", async () => {
      const quote = await calculateBookingPrice({
        weekdayBasePrice: 100_00,
        checkIn: "2026-10-10",
        checkOut: "2026-10-17", // 7 nights
        discounts: {
          weekly: { enabled: true, percentage: 10 },
          monthly: { enabled: true, percentage: 25 },
        },
      });

      assert.ok(quote.discountEligibility);
      assert.equal(quote.discountEligibility.weekly.eligible, true);
      assert.equal(quote.discountEligibility.monthly.eligible, false);
      assert.equal(quote.discountEligibility.eligibleDiscounts.length, 1);
      assert.equal(quote.discountEligibility.eligibleDiscounts[0].key, "weekly");
    });

    it("resolveSingleDiscount uses evaluateDiscountEligibility before picking the winning discount", () => {
      const winningDiscount = resolveSingleDiscount({
        staySubtotal: 100_000,
        nights: 28,
        checkIn: new Date("2026-10-01T00:00:00.000Z"),
        discounts: {
          weekly: { enabled: true, percentage: 10 },
          monthly: { enabled: true, percentage: 25 },
        },
      });

      // Monthly wins over weekly
      assert.ok(winningDiscount);
      assert.equal(winningDiscount.key, "monthly");
      assert.equal(winningDiscount.percentage, 25);
    });
  });
});

