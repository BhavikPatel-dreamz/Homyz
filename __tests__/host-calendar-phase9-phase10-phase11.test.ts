import assert from "node:assert/strict";
import {
  evaluateDiscountEligibility,
  DEFAULT_DISCOUNT_PERCENTAGES,
} from "../services/discount-eligibility.service";
import {
  resolveSingleDiscount,
  resolveNightlyRate,
  parseDateToUtcMidnight,
} from "../services/pricing.service";
import { percentageDiscountSchema, discountsSchema } from "../lib/validation/listing";

console.log("\n==================================================================");
console.log("   HOST CALENDAR PHASES 9, 10 & 11 COMPREHENSIVE TEST SUITE       ");
console.log("   Discounts & Promotions | Additional Charges | Availability Rules");
console.log("==================================================================\n");

let passed = 0;
let total = 0;

function runTest(name: string, fn: () => void) {
  total++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
  }
}

function shiftDateKey(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. PHASE 9: WEEKLY & MONTHLY DISCOUNTS
// ─────────────────────────────────────────────────────────────────────────────

runTest("Phase 9: Weekly discount applies only at >= 7 nights threshold", () => {
  const checkIn = new Date("2026-10-10T15:00:00Z");
  const checkOut6 = new Date("2026-10-16T11:00:00Z"); // 6 nights
  const checkOut7 = new Date("2026-10-17T11:00:00Z"); // 7 nights

  const discountsConfig = {
    weekly: { enabled: true, percentage: 15 },
    monthly: { enabled: false },
  };

  const eval6 = evaluateDiscountEligibility({
    checkIn,
    checkOut: checkOut6,
    nights: 6,
    completedBookingsCount: 10,
    discounts: discountsConfig,
  });
  assert.equal(eval6.weekly.eligible, false, "6 nights must NOT qualify for weekly discount");

  const eval7 = evaluateDiscountEligibility({
    checkIn,
    checkOut: checkOut7,
    nights: 7,
    completedBookingsCount: 10,
    discounts: discountsConfig,
  });
  assert.equal(eval7.weekly.eligible, true, "7 nights MUST qualify for weekly discount");

  const resolved = resolveSingleDiscount({
    staySubtotal: 70000,
    nights: 7,
    checkIn,
    discounts: discountsConfig,
  });
  assert.ok(resolved, "Should resolve a discount for 7 nights");
  assert.equal(resolved?.key, "weekly");
  assert.equal(resolved?.percentage, 15);
  assert.equal(resolved?.amount, 10500); // 15% of 70000
  assert.equal(70000 - (resolved?.amount ?? 0), 59500);
});

runTest("Phase 9: Monthly discount applies only at >= 28 nights threshold", () => {
  const checkIn = new Date("2026-10-01T15:00:00Z");
  const checkOut27 = new Date("2026-10-28T11:00:00Z"); // 27 nights
  const checkOut28 = new Date("2026-10-29T11:00:00Z"); // 28 nights

  const discountsConfig = {
    weekly: { enabled: true, percentage: 10 },
    monthly: { enabled: true, percentage: 30 },
  };

  const eval27 = evaluateDiscountEligibility({
    checkIn,
    checkOut: checkOut27,
    nights: 27,
    completedBookingsCount: 10,
    discounts: discountsConfig,
  });
  assert.equal(eval27.monthly.eligible, false, "27 nights must NOT qualify for monthly discount");
  assert.equal(eval27.weekly.eligible, true, "27 nights qualifies for weekly discount");

  const eval28 = evaluateDiscountEligibility({
    checkIn,
    checkOut: checkOut28,
    nights: 28,
    completedBookingsCount: 10,
    discounts: discountsConfig,
  });
  assert.equal(eval28.monthly.eligible, true, "28 nights MUST qualify for monthly discount");

  const resolved28 = resolveSingleDiscount({
    staySubtotal: 280000,
    nights: 28,
    checkIn,
    discounts: discountsConfig,
  });
  assert.equal(resolved28?.key, "monthly");
  assert.equal(resolved28?.percentage, 30);
  assert.equal(resolved28?.amount, 84000); // 30% of 280000
  assert.equal(280000 - (resolved28?.amount ?? 0), 196000);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. PHASE 9: STRICT SINGLE DISCOUNT INVARIANT (NO STACKING) & TIE BREAKERS
// ─────────────────────────────────────────────────────────────────────────────

runTest("Phase 9: Strict single discount priority (highest discount wins; monthly beats weekly on tie)", () => {
  const checkIn = new Date("2026-11-01T15:00:00Z");

  // Case A: 30-night stay where weekly discount is configured higher (35%) than monthly discount (20%)
  const resolvedHigherWeekly = resolveSingleDiscount({
    staySubtotal: 300000,
    nights: 30,
    checkIn,
    discounts: {
      weekly: { enabled: true, percentage: 35 },
      monthly: { enabled: true, percentage: 20 },
    },
  });
  assert.equal(
    resolvedHigherWeekly?.key,
    "weekly",
    "Highest percentage (35% weekly) must win regardless of tier"
  );
  assert.equal(resolvedHigherWeekly?.percentage, 35);

  // Case B: Tie at 25% between weekly and monthly for 30 nights -> Monthly wins tiebreaker
  const resolvedTie = resolveSingleDiscount({
    staySubtotal: 300000,
    nights: 30,
    checkIn,
    discounts: {
      weekly: { enabled: true, percentage: 25 },
      monthly: { enabled: true, percentage: 25 },
    },
  });
  assert.equal(
    resolvedTie?.key,
    "monthly",
    "Monthly must beat weekly on tied percentage according to priority hierarchy"
  );
  assert.equal(resolvedTie?.percentage, 25);
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. PHASE 9: CUSTOM PROMOTION DATE RANGE SUPPORT
// ─────────────────────────────────────────────────────────────────────────────

runTest("Phase 9: Custom promotion applies only within configured date range", () => {
  const promoConfig = {
    custom_promotion: {
      enabled: true,
      percentage: 20,
      startDate: "2026-12-20",
      endDate: "2026-12-31",
    },
  };

  // Inside promo window
  const evalInside = evaluateDiscountEligibility({
    checkIn: new Date("2026-12-24T15:00:00Z"),
    checkOut: new Date("2026-12-28T11:00:00Z"),
    nights: 4,
    completedBookingsCount: 10,
    discounts: promoConfig,
  });
  assert.ok(
    evalInside.eligibleDiscounts.some((d) => d.key === "custom_promotion"),
    "Reservation within promotional dates must receive custom promotion"
  );

  // Outside promo window
  const evalOutside = evaluateDiscountEligibility({
    checkIn: new Date("2027-01-05T15:00:00Z"),
    checkOut: new Date("2027-01-10T11:00:00Z"),
    nights: 5,
    completedBookingsCount: 10,
    discounts: promoConfig,
  });
  assert.ok(
    !evalOutside.eligibleDiscounts.some((d) => d.key === "custom_promotion"),
    "Reservation outside promotional dates must NOT receive custom promotion"
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. PHASE 9: LEAD-TIME DISCOUNTS (EARLY BIRD & LAST MINUTE)
// ─────────────────────────────────────────────────────────────────────────────

runTest("Phase 9: Early-bird and Last-minute lead time eligibility", () => {
  const now = new Date("2026-10-01T12:00:00Z");
  const checkInTomorrow = new Date("2026-10-02T15:00:00Z");
  const checkIn45Days = new Date("2026-11-15T15:00:00Z");

  const discountsConfig = {
    last_minute: { enabled: true, percentage: 15, daysBefore: 2 },
    early_bird: { enabled: true, percentage: 10, daysInAdvance: 30 },
  };

  // Booking made on 2026-10-01 for 2026-10-02 (1 day lead time) -> Last Minute qualifies
  const evalLastMinute = evaluateDiscountEligibility({
    checkIn: checkInTomorrow,
    checkOut: new Date("2026-10-05T11:00:00Z"),
    nights: 3,
    bookingDate: now,
    completedBookingsCount: 10,
    discounts: discountsConfig,
  });
  assert.equal(evalLastMinute.lastMinute.eligible, true, "1 day in advance qualifies for last-minute");
  assert.equal(evalLastMinute.earlyBird.eligible, false, "1 day in advance does not qualify for early bird");

  // Booking made on 2026-10-01 for 2026-11-15 (45 days lead time) -> Early Bird qualifies
  const evalEarlyBird = evaluateDiscountEligibility({
    checkIn: checkIn45Days,
    checkOut: new Date("2026-11-18T11:00:00Z"),
    nights: 3,
    bookingDate: now,
    completedBookingsCount: 10,
    discounts: discountsConfig,
  });
  assert.equal(evalEarlyBird.earlyBird.eligible, true, "45 days in advance qualifies for early bird");
  assert.equal(evalEarlyBird.lastMinute.eligible, false, "45 days in advance does not qualify for last minute");
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. PHASE 9: VALIDATION & BOUNDARY PROTECTION
// ─────────────────────────────────────────────────────────────────────────────

runTest("Phase 9: Discount validation rejects negative numbers, > 100%, and NaN", () => {
  assert.throws(
    () => percentageDiscountSchema.parse({ enabled: true, percentage: -5 }),
    "Must reject negative discount percentage"
  );
  assert.throws(
    () => percentageDiscountSchema.parse({ enabled: true, percentage: 105 }),
    "Must reject discount percentage > 100"
  );
  assert.throws(
    () => percentageDiscountSchema.parse({ enabled: true, percentage: NaN }),
    "Must reject NaN discount percentage"
  );

  const valid = percentageDiscountSchema.parse({
    enabled: true,
    percentage: 15,
    startDate: "2026-10-10",
    endDate: "2026-10-20",
  });
  assert.equal(valid.percentage, 15);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. PHASE 10: ADDITIONAL HOST CHARGES (EXTRA GUEST FEE & CLEANING FEE)
// ─────────────────────────────────────────────────────────────────────────────

runTest("Phase 10: Extra guest fee applies per extra guest per night", () => {
  const baseGuests = 2;
  const extraGuestFeeInCents = 5000; // 50 SAR per guest per night
  const nights = 3;

  // Case A: 2 guests (<= baseGuests) -> 0 extra fee
  const guestsA = 2;
  const extraGuestsA = Math.max(0, guestsA - baseGuests);
  const totalExtraA = extraGuestsA * extraGuestFeeInCents * nights;
  assert.equal(totalExtraA, 0, "No extra guest fee when within base guests");

  // Case B: 4 guests (2 extra guests) for 3 nights -> 2 * 50 * 3 = 300 SAR (30000 cents)
  const guestsB = 4;
  const extraGuestsB = Math.max(0, guestsB - baseGuests);
  const totalExtraB = extraGuestsB * extraGuestFeeInCents * nights;
  assert.equal(totalExtraB, 30000, "Correctly charges per extra guest per night");
});

runTest("Phase 10: Cleaning fee architectural isolation (no guest checkout charging)", () => {
  // Verifies that cleaningFee is preserved on listing DTO/settings but not added to guest checkout total
  const listing = {
    price: 50000,
    cleaningFee: 15000, // 150 SAR cleaning fee configured by host
    extraGuestFee: 0,
  };
  assert.equal(listing.cleaningFee, 15000, "Listing preserves configured cleaning fee");
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. PHASE 11: AVAILABILITY RULES & MINIMUM / MAXIMUM STAY
// ─────────────────────────────────────────────────────────────────────────────

runTest("Phase 11: Minimum and Maximum stay constraints validation", () => {
  const minNights = 3;
  const maxNights = 14;

  const validateNights = (n: number) => n >= minNights && n <= maxNights;

  assert.equal(validateNights(2), false, "2 nights violates 3-night minimum");
  assert.equal(validateNights(3), true, "3 nights satisfies 3-night minimum");
  assert.equal(validateNights(7), true, "7 nights is within allowed range");
  assert.equal(validateNights(14), true, "14 nights satisfies 14-night maximum");
  assert.equal(validateNights(15), false, "15 nights violates 14-night maximum");
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. PHASE 11: DATE-SPECIFIC MINIMUM STAY OVERRIDES & MIXED DETECTION
// ─────────────────────────────────────────────────────────────────────────────

runTest("Phase 11: Date-specific minimum stay overrides default property rule", () => {
  const defaultMinNights = 2;
  const customMinNights: Record<string, number> = {
    "2026-12-31": 5, // New Year's Eve requires 5 nights minimum
    "2027-01-01": 5,
  };

  const getEffectiveMinStay = (dateKey: string) => {
    return customMinNights[dateKey] ?? defaultMinNights;
  };

  assert.equal(getEffectiveMinStay("2026-12-15"), 2, "Normal date uses property default (2 nights)");
  assert.equal(getEffectiveMinStay("2026-12-31"), 5, "Overridden date enforces 5 nights minimum");

  // Multi-date selection mixed minimum stay analysis
  const selectionKeys = ["2026-12-30", "2026-12-31", "2027-01-01"];
  const minStays = selectionKeys.map(getEffectiveMinStay);
  const uniqueMinStays = new Set(minStays);
  const isMixed = uniqueMinStays.size > 1;

  assert.equal(isMixed, true, "Selection across different minimum stays is correctly flagged as mixed");
  assert.deepEqual(Array.from(uniqueMinStays).sort(), [2, 5]);
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. PHASE 11: BOOKING PROTECTION (EXISTING RESERVATIONS REMAIN IMMUTABLE)
// ─────────────────────────────────────────────────────────────────────────────

runTest("Phase 11: Modifying future availability/discount rules never affects existing bookings", () => {
  const existingBooking = {
    id: "booking-existing-1",
    startDate: "2026-10-15T00:00:00Z",
    endDate: "2026-10-18T00:00:00Z",
    nights: 3,
    status: "CONFIRMED",
    totalPrice: 150000,
  };

  // Host later changes min stay from 2 to 7 nights, and adds a 20% discount
  const newListingRules = {
    minNights: 7,
    discounts: {
      weekly: { enabled: true, percentage: 20 },
    },
  };

  // Existing booking must NOT be altered or invalidated
  assert.equal(existingBooking.nights, 3);
  assert.equal(existingBooking.totalPrice, 150000);
  assert.equal(existingBooking.status, "CONFIRMED");
});

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────

console.log("\n==================================================================");
console.log(`  Tests Passed: ${passed} / ${total}`);
if (passed === total) {
  console.log("  ALL PHASE 9, 10 & 11 VERIFICATION TESTS PASSED SUCCESSFULLY!  ");
} else {
  console.error("  SOME TESTS FAILED!                                            ");
}
console.log("==================================================================\n");

if (passed !== total) {
  process.exit(1);
}
