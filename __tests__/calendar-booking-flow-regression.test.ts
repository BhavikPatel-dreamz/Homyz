import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getEarliestCheckInKey,
  getMinimumStayForCheckIn,
  validateStayAvailability,
} from "../lib/booking/availability";
import { toPropertyCardPricingViewModel } from "../lib/booking/property-card-pricing";
import { calculateBookingPrice } from "../services/pricing.service";

const calendarPricing = {
  id: "listing-calendar-regression",
  price: 70_000,
  weekdayBasePrice: 70_000,
  weekendPrice: 80_000,
  customPrices: { "2026-10-16": 72_000 },
  country: "Saudi Arabia",
  discounts: {
    custom_promotion: {
      enabled: true,
      percentage: 15,
      startDate: "2026-10-16",
      endDate: "2026-10-16",
      name: "Special days discount",
    },
  },
};

function assertUnavailableCode(
  result: ReturnType<typeof validateStayAvailability>,
  expected: string,
): void {
  assert.equal(result.available, false);
  if (result.available) assert.fail(`Expected ${expected}, but the stay was available`);
  assert.equal(result.code, expected);
}

describe("calendar-driven guest booking regression coverage", () => {
  it("uses custom > weekend > weekday rates and scopes a special-day promotion to its date", async () => {
    const quote = await calculateBookingPrice({
      checkIn: "2026-10-13",
      checkOut: "2026-10-17",
      weekdayBasePrice: calendarPricing.weekdayBasePrice,
      weekendPrice: calendarPricing.weekendPrice,
      customPrices: calendarPricing.customPrices,
      discounts: calendarPricing.discounts,
      hostServiceFeePercentage: 0,
    });

    assert.deepEqual(
      quote.breakdown.map(({ date, price, rateSource }) => ({ date, price, rateSource })),
      [
        { date: "2026-10-13", price: 70_000, rateSource: "WEEKDAY" },
        { date: "2026-10-14", price: 70_000, rateSource: "WEEKDAY" },
        { date: "2026-10-15", price: 80_000, rateSource: "WEEKEND" },
        { date: "2026-10-16", price: 72_000, rateSource: "CUSTOM" },
      ],
    );
    assert.equal(quote.staySubtotal, 292_000);
    assert.equal(quote.appliedDiscount?.key, "custom_promotion");
    assert.equal(quote.discountAmount, 10_800, "15% applies only to the promoted SAR 720 night");
    assert.equal(quote.accommodationSubtotal, 281_200);
  });

  it("shows the same effective average rate and promotion on listing cards", () => {
    const pricing = toPropertyCardPricingViewModel(calendarPricing, {
      checkIn: "2026-10-13",
      checkOut: "2026-10-17",
      bookingDate: "2026-10-05",
    });

    assert.equal(pricing.baseDisplayPrice, 73_000);
    assert.equal(pricing.discountedDisplayPrice, 70_300);
    assert.equal(pricing.hasDiscount, true);
    assert.equal(pricing.discountType, "CUSTOM_PROMOTION");
    assert.equal(pricing.discountPercentage, 15);
  });

  it("keeps accommodation and total unchanged across the inclusive guest capacity", async () => {
    const totals = await Promise.all([1, 2, 3, 4, 5].map((guests) => calculateBookingPrice({
      checkIn: "2026-10-13",
      checkOut: "2026-10-17",
      weekdayBasePrice: 70_000,
      guests,
      extraGuestFee: 20_000,
      cleaningFee: 4_800,
      hostServiceFeePercentage: 0,
    })));

    assert.deepEqual(totals.map((quote) => quote.accommodationSubtotal), [280_000, 280_000, 280_000, 280_000, 280_000]);
    assert.deepEqual(totals.map((quote) => quote.extraGuestFee), [0, 0, 0, 0, 0]);
    assert.deepEqual(totals.map((quote) => quote.guestTotal), [284_800, 284_800, 284_800, 284_800, 284_800]);
    assert.ok(totals.every((quote) => !quote.feeBreakdown.some((fee) => fee.id === "extra-guests")));
  });

  it("enforces custom minimum stays, maximum stays, capacity, blocks, and reservation overlap", () => {
    const listing = {
      guests: 4,
      minNights: 2,
      maxNights: 5,
      advanceNotice: "Same day",
      allowSameDayRequests: true,
      sameDayCutoff: "6:00 PM",
      blockedDates: ["2026-10-15"],
      discounts: { customMinNights: { "2026-10-13": 3 } },
    };
    const now = new Date(2026, 9, 5, 9, 0);

    assert.equal(getMinimumStayForCheckIn(listing, "2026-10-13"), 3);
    assertUnavailableCode(validateStayAvailability({ listing, checkIn: "2026-10-13", checkOut: "2026-10-15", guests: 2, now }), "MINIMUM_STAY");
    assertUnavailableCode(validateStayAvailability({ listing, checkIn: "2026-10-13", checkOut: "2026-10-19", guests: 2, now }), "MAXIMUM_STAY");
    assertUnavailableCode(validateStayAvailability({ listing, checkIn: "2026-10-13", checkOut: "2026-10-16", guests: 5, now }), "GUEST_CAPACITY");
    assertUnavailableCode(validateStayAvailability({ listing, checkIn: "2026-10-13", checkOut: "2026-10-16", guests: 2, now }), "BLOCKED_DATE");

    const unblocked = { ...listing, blockedDates: [] };
    assertUnavailableCode(validateStayAvailability({
      listing: unblocked,
      checkIn: "2026-10-13",
      checkOut: "2026-10-16",
      guests: 2,
      now,
      unavailableRanges: [{ start: "2026-10-14", end: "2026-10-17" }],
    }), "BOOKING_OVERLAP");
  });

  it("enforces advance notice and the host's same-day switch and cutoff", () => {
    const beforeCutoff = new Date(2026, 9, 5, 11, 30);
    const afterCutoff = new Date(2026, 9, 5, 13, 0);
    const sameDayListing = {
      guests: 2,
      minNights: 1,
      maxNights: 10,
      advanceNotice: "Same day",
      allowSameDayRequests: true,
      sameDayCutoff: "12:00 PM",
    };

    assert.equal(getEarliestCheckInKey(sameDayListing, beforeCutoff), "2026-10-05");
    assert.equal(getEarliestCheckInKey(sameDayListing, afterCutoff), "2026-10-06");
    assertUnavailableCode(validateStayAvailability({ listing: sameDayListing, checkIn: "2026-10-05", checkOut: "2026-10-06", now: afterCutoff }), "SAME_DAY_CUTOFF");
    assertUnavailableCode(validateStayAvailability({ listing: { ...sameDayListing, allowSameDayRequests: false }, checkIn: "2026-10-05", checkOut: "2026-10-06", now: beforeCutoff }), "SAME_DAY_DISABLED");

    const noticeListing = { ...sameDayListing, advanceNotice: "At least 2 days" };
    assert.equal(getEarliestCheckInKey(noticeListing, beforeCutoff), "2026-10-07");
    assertUnavailableCode(validateStayAvailability({ listing: noticeListing, checkIn: "2026-10-06", checkOut: "2026-10-07", now: beforeCutoff }), "ADVANCE_NOTICE");
    assert.equal(validateStayAvailability({ listing: noticeListing, checkIn: "2026-10-07", checkOut: "2026-10-08", now: beforeCutoff }).available, true);
  });
});
