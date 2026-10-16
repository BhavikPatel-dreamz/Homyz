import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  calculatePriceTips,
  resolveNightlyRate,
  resolveNightlyPrice,
  isWeekendNight,
} from "@/lib/pricing/price-tips";

function expect(val: any) {
  return {
    toBe: (expected: any) => assert.strictEqual(val, expected),
    not: {
      toBe: (expected: any) => assert.notStrictEqual(val, expected),
      toContain: (expected: any) => assert.ok(!val.includes(expected)),
    },
    toEqual: (expected: any) => assert.deepStrictEqual(val, expected),
    toBeGreaterThan: (expected: number) => assert.ok(val > expected, `expected ${val} > ${expected}`),
    toBeLessThan: (expected: number) => assert.ok(val < expected, `expected ${val} < ${expected}`),
    toContain: (expected: any) => assert.ok(val.includes(expected), `expected ${JSON.stringify(val)} to contain ${expected}`),
    toBeUndefined: () => assert.strictEqual(val, undefined),
  };
}

describe("Host Price Tips Recommendation Engine v2.0", () => {
  const baseListing = {
    id: "prop-alpha",
    price: 63000, // SAR 630 in cents
    weekdayBasePrice: 63000,
    weekendPrice: 70000, // SAR 700
    smartPricingMinPrice: 40000, // SAR 400 floor
    smartPricingMaxPrice: 90000, // SAR 900 ceiling
    customPrices: {} as Record<string, number>,
  };

  it("TEST 1: Previous hardcoded +10% is removed — does not blindly increase by 10%", () => {
    // 15 days of historical bookings (which previously triggered occupancyRatio >= 0.5 and +10%)
    const historicalBookings = [
      {
        startDate: "2026-08-01",
        endDate: "2026-08-16",
        status: "CONFIRMED",
      },
    ];

    // Evaluate a date far out (e.g. 2026-11-15, which is a Sunday weekday) with zero bookings in its window
    const result = calculatePriceTips({
      listing: baseListing,
      dateKeys: ["2026-11-15"],
      bookings: historicalBookings,
      todayKey: "2026-10-01",
    });

    const rec = result.recommendations[0];
    // Under the old bug, rec.suggestedPrice would have been 63000 * 1.10 = 69300 with "+10%"
    // Under the new engine, a distant unbooked date with 0 surrounding occupancy does NOT get +10%
    expect(rec.suggestedPrice).not.toBe(69300);
    expect(rec.reasons.some((r) => r.includes("High occupancy demand adjustment (+10%)"))).toBe(false);
  });

  it("TEST 2: Same current price with different real demand conditions produces different recommendations", () => {
    // Two dates with identical current base price = SAR 630
    // Date A: 2026-10-20 (weekday, surrounded by 80% confirmed bookings)
    // Date B: 2026-10-03 (weekday, 2 days away, 0% forward bookings)

    // Build dense bookings around Date A (2026-10-20)
    const bookings = [
      {
        startDate: "2026-10-10",
        endDate: "2026-10-19", // 9 nights
        status: "CONFIRMED",
      },
      {
        startDate: "2026-10-21",
        endDate: "2026-11-05", // 15 nights -> total 24 of 30 nights = 80% occupancy
        status: "CONFIRMED",
      },
    ];

    const resultA = calculatePriceTips({
      listing: baseListing,
      dateKeys: ["2026-10-20"],
      bookings,
      todayKey: "2026-10-01",
    });

    const resultB = calculatePriceTips({
      listing: baseListing,
      dateKeys: ["2026-10-03"], // 2 days away, unbooked, 0 surrounding occupancy
      bookings: [
        // Has prior completed booking so it's not "insufficient data"
        {
          startDate: "2026-09-01",
          endDate: "2026-09-05",
          status: "CONFIRMED",
        },
      ],
      todayKey: "2026-10-01",
    });

    const recA = resultA.recommendations[0];
    const recB = resultB.recommendations[0];

    expect(recA.currentPrice).toBe(63000);
    expect(recB.currentPrice).toBe(63000);

    // Date A has high occupancy compression -> PRICE INCREASE
    expect(recA.action).toBe("INCREASE");
    expect(recA.suggestedPrice).toBeGreaterThan(63000);
    expect(recA.reasonCodes).toContain("HIGH_OCCUPANCY_SURGE");

    // Date B is approaching in 2 days with 0 occupancy -> PRICE DECREASE (discount to capture last-minute bookings)
    expect(recB.action).toBe("DECREASE");
    expect(recB.suggestedPrice).toBeLessThan(63000);
    expect(recB.reasonCodes).toContain("LAST_MINUTE_UNBOOKED_DISCOUNT");

    // Recommendations differ strictly due to actual data
    expect(recA.suggestedPrice).not.toBe(recB.suggestedPrice);
  });

  it("TEST 3: Genuinely strong demand triggers price increase with clear reasons", () => {
    // 24 nights booked in surrounding 30-day window (80% occupancy), leaving 2026-10-15 unbooked
    const bookings = [
      {
        startDate: "2026-10-05",
        endDate: "2026-10-15", // 10 nights
        status: "CONFIRMED",
      },
      {
        startDate: "2026-10-16",
        endDate: "2026-10-30", // 14 nights
        status: "CONFIRMED",
      },
    ];

    const result = calculatePriceTips({
      listing: baseListing,
      dateKeys: ["2026-10-15"],
      bookings,
      todayKey: "2026-10-01",
    });

    const rec = result.recommendations[0];
    expect(rec.action).toBe("INCREASE");
    expect(rec.suggestedPrice).toBeGreaterThan(rec.currentPrice);
    expect(rec.difference).toBeGreaterThan(0);
    expect(rec.percentChange).toBeGreaterThan(0);
    expect(rec.reasonCodes).toContain("HIGH_OCCUPANCY_SURGE");
  });

  it("TEST 4: Genuinely weaker demand triggers price decrease", () => {
    // Target date is in 3 days, calendar has low occupancy (<20%)
    const bookings = [
      {
        startDate: "2026-09-10",
        endDate: "2026-09-15",
        status: "CONFIRMED",
      },
    ];

    const result = calculatePriceTips({
      listing: baseListing,
      dateKeys: ["2026-10-04"],
      bookings,
      todayKey: "2026-10-01", // 3 days lead time
    });

    const rec = result.recommendations[0];
    expect(rec.action).toBe("DECREASE");
    expect(rec.suggestedPrice).toBeLessThan(rec.currentPrice);
    expect(rec.difference).toBeLessThan(0);
    expect(rec.percentChange).toBeLessThan(0);
    expect(rec.reasonCodes).toContain("LAST_MINUTE_UNBOOKED_DISCOUNT");
  });

  it("TEST 5: Date already well-aligned triggers NO_CHANGE", () => {
    // Normal lead time (20 days), moderate/neutral occupancy (30-40%)
    // 10 nights booked out of 30
    const bookings = [
      {
        startDate: "2026-10-10",
        endDate: "2026-10-20",
        status: "CONFIRMED",
      },
    ];

    const result = calculatePriceTips({
      listing: baseListing,
      dateKeys: ["2026-10-22"], // Wednesday (weekday)
      bookings,
      todayKey: "2026-10-01", // 21 days out
    });

    const rec = result.recommendations[0];
    expect(rec.action).toBe("NO_CHANGE");
    expect(rec.suggestedPrice).toBe(rec.currentPrice);
    expect(rec.difference).toBe(0);
    expect(rec.percentChange).toBe(0);
    expect(rec.reasonCodes).toContain("OPTIMAL_RATE");
  });

  it("TEST 6: New / zero-data property returns INSUFFICIENT_DATA, never fake +10%", () => {
    const result = calculatePriceTips({
      listing: baseListing,
      dateKeys: ["2026-10-15", "2026-10-16"],
      bookings: [], // Zero bookings ever
      todayKey: "2026-10-01",
    });

    expect(result.overallAction).toBe("INSUFFICIENT_DATA");
    expect(result.insufficientDataCount).toBe(2);
    for (const rec of result.recommendations) {
      expect(rec.action).toBe("INSUFFICIENT_DATA");
      expect(rec.difference).toBe(0);
      expect(rec.suggestedPrice).toBe(rec.currentPrice);
      expect(rec.reasons[0]).toContain("No reliable price tip available yet");
    }
  });

  it("TEST 7: Applying tip updates custom prices map without touching unrelated dates", () => {
    const customPrices: Record<string, number> = {
      "2026-10-10": 55000,
    };

    const targetDate = "2026-10-15";
    const result = calculatePriceTips({
      listing: {
        ...baseListing,
        customPrices,
      },
      dateKeys: [targetDate],
      bookings: [
        {
          startDate: "2026-10-01",
          endDate: "2026-10-15",
          status: "CONFIRMED",
        },
        {
          startDate: "2026-10-16",
          endDate: "2026-10-25",
          status: "CONFIRMED",
        },
      ],
      todayKey: "2026-10-01",
    });

    const rec = result.recommendations[0];
    // Host applies tip
    const nextCustomPrices = { ...customPrices };
    if (!rec.isBooked && (rec.action === "INCREASE" || rec.action === "DECREASE")) {
      nextCustomPrices[rec.dateKey] = rec.suggestedPrice;
    }

    // Previous custom price remains intact
    expect(nextCustomPrices["2026-10-10"]).toBe(55000);
    // Target date has new effective price
    expect(nextCustomPrices[targetDate]).toBe(rec.suggestedPrice);
  });

  it("TEST 8: Closing or canceling leaves custom prices completely unchanged", () => {
    const initialCustom = { "2026-10-15": 60000 };
    const listingState = { ...baseListing, customPrices: initialCustom };

    const result = calculatePriceTips({
      listing: listingState,
      dateKeys: ["2026-10-15"],
      bookings: [{ startDate: "2026-10-01", endDate: "2026-10-25", status: "CONFIRMED" }],
    });

    expect(result.recommendations.length).toBe(1);
    // User cancels without calling save: state is unchanged
    expect(listingState.customPrices).toEqual({ "2026-10-15": 60000 });
  });

  it("TEST 9: Protected booked dates are never modified", () => {
    const bookings = [
      {
        startDate: "2026-10-15",
        endDate: "2026-10-18", // 3 nights booked
        status: "CONFIRMED",
      },
    ];

    const result = calculatePriceTips({
      listing: baseListing,
      dateKeys: ["2026-10-15", "2026-10-16", "2026-10-19"],
      bookings,
      todayKey: "2026-10-01",
    });

    const bookedRec1 = result.recommendations.find((r) => r.dateKey === "2026-10-15")!;
    const bookedRec2 = result.recommendations.find((r) => r.dateKey === "2026-10-16")!;
    const unbookedRec = result.recommendations.find((r) => r.dateKey === "2026-10-19")!;

    expect(bookedRec1.isBooked).toBe(true);
    expect(bookedRec1.action).toBe("NO_CHANGE");
    expect(bookedRec1.suggestedPrice).toBe(bookedRec1.currentPrice);

    expect(bookedRec2.isBooked).toBe(true);
    expect(bookedRec2.action).toBe("NO_CHANGE");

    expect(unbookedRec.isBooked).toBe(false);

    // Simulating apply loop: only unbooked dates receive custom price
    const nextCustom: Record<string, number> = {};
    for (const r of result.recommendations) {
      if (!r.isBooked && (r.action === "INCREASE" || r.action === "DECREASE")) {
        nextCustom[r.dateKey] = r.suggestedPrice;
      }
    }

    expect(nextCustom["2026-10-15"]).toBeUndefined();
    expect(nextCustom["2026-10-16"]).toBeUndefined();
  });

  it("TEST 10: Multi-date range selection produces per-date recommendations and range summary", () => {
    const dateKeys = [
      "2026-10-10", "2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14",
      "2026-10-15", "2026-10-16", "2026-10-17", "2026-10-18", "2026-10-19",
    ];

    const bookings = [
      {
        startDate: "2026-10-01",
        endDate: "2026-10-08",
        status: "CONFIRMED",
      },
    ];

    const result = calculatePriceTips({
      listing: baseListing,
      dateKeys,
      bookings,
      todayKey: "2026-10-01",
    });

    expect(result.recommendations.length).toBe(10);
    expect(result.applicableCount).toBe(10);
    expect(result.averageCurrentPrice).toBeGreaterThan(0);
    expect(result.averageSuggestedPrice).toBeGreaterThan(0);
    expect(result.recommendationVersion).toBe("2.0.0");
  });

  it("TEST 11: Currency consistency — calculations remain proportional regardless of base amount", () => {
    // Property with EUR or USD values (e.g. $150.00 / 15000 cents)
    const usdListing = {
      price: 15000,
      weekdayBasePrice: 15000,
      weekendPrice: 18000,
    };

    const result = calculatePriceTips({
      listing: usdListing,
      dateKeys: ["2026-10-15"], // Thursday night (weekend)
      bookings: [{ startDate: "2026-09-01", endDate: "2026-09-05", status: "CONFIRMED" }],
      todayKey: "2026-10-01",
    });

    const rec = result.recommendations[0];
    expect(rec.isWeekend).toBe(true);
    // Configured weekend rate is $180
    expect(rec.suggestedPrice).toBe(18000);
  });

  it("TEST 12: Internal comparable listings — strictly requires sampleCount >= 3", () => {
    const bookings = [{ startDate: "2026-09-01", endDate: "2026-09-05", status: "CONFIRMED" }];

    // Case A: Sample size is 2 (below minimum threshold of 3)
    const resultSubSample = calculatePriceTips({
      listing: baseListing,
      dateKeys: ["2026-10-25"],
      bookings,
      todayKey: "2026-10-01",
      comparables: { sampleCount: 2, averagePrice: 90000 },
    });
    // Should NOT include comparable benchmark in reasons
    expect(resultSubSample.recommendations[0].reasonCodes).not.toContain("COMPARABLE_LISTINGS_HIGHER");

    // Case B: Sample size is 4 (qualifying)
    const resultValidSample = calculatePriceTips({
      listing: baseListing,
      dateKeys: ["2026-10-25"],
      bookings,
      todayKey: "2026-10-01",
      comparables: { sampleCount: 4, averagePrice: 90000 },
    });
    expect(resultValidSample.recommendations[0].reasonCodes).toContain("COMPARABLE_LISTINGS_HIGHER");
  });

  it("TEST 13: Property isolation — Property A recommendations do not affect Property B", () => {
    const propertyA = { ...baseListing, id: "prop-A", price: 50000, weekdayBasePrice: 50000, weekendPrice: null };
    const propertyB = { ...baseListing, id: "prop-B", price: 120000, weekdayBasePrice: 120000, weekendPrice: null };

    const resultA = calculatePriceTips({
      listing: propertyA,
      dateKeys: ["2026-10-15"],
      bookings: [
        { startDate: "2026-10-01", endDate: "2026-10-15", status: "CONFIRMED" },
        { startDate: "2026-10-16", endDate: "2026-10-25", status: "CONFIRMED" },
      ],
      todayKey: "2026-10-01",
    });

    const resultB = calculatePriceTips({
      listing: propertyB,
      dateKeys: ["2026-10-15"],
      bookings: [], // Property B has no bookings
      todayKey: "2026-10-01",
    });

    expect(resultA.recommendations[0].currentPrice).toBe(50000);
    expect(resultA.overallAction).toBe("INCREASE");

    expect(resultB.recommendations[0].currentPrice).toBe(120000);
    expect(resultB.overallAction).toBe("INSUFFICIENT_DATA");
  });

  it("TEST 14: Performance & Determinism — fast, synchronous, zero randomness", () => {
    const dateKeys: string[] = [];
    for (let i = 1; i <= 30; i++) {
      dateKeys.push(`2026-11-${String(i).padStart(2, "0")}`);
    }

    const t0 = performance.now();
    const run1 = calculatePriceTips({
      listing: baseListing,
      dateKeys,
      bookings: [{ startDate: "2026-11-05", endDate: "2026-11-15", status: "CONFIRMED" }],
      todayKey: "2026-10-01",
    });
    const t1 = performance.now();

    const run2 = calculatePriceTips({
      listing: baseListing,
      dateKeys,
      bookings: [{ startDate: "2026-11-05", endDate: "2026-11-15", status: "CONFIRMED" }],
      todayKey: "2026-10-01",
    });

    // Sub-millisecond execution for 30 dates
    expect(t1 - t0).toBeLessThan(50);
    // Identical output on consecutive runs (deterministic)
    expect(run1).toEqual(run2);
  });
});

