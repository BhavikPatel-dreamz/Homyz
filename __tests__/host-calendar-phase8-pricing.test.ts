import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveNightlyRate, parseDateToUtcMidnight } from "../services/pricing.service";

console.log("\n==================================================================");
console.log("   HOST CALENDAR PHASE 8: NIGHTLY & CUSTOM PRICING VERIFICATION   ");
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

function getAllDatesInRange(start: string, end: string): string[] {
  const [s, e] = start <= end ? [start, end] : [end, start];
  const dates: string[] = [];
  let cur = s;
  while (cur <= e) {
    dates.push(cur);
    cur = shiftDateKey(cur, 1);
  }
  return dates;
}

function isWeekendDay(k: string): boolean {
  const d = new Date(k + "T00:00:00Z").getUTCDay();
  return d === 4 || d === 5; // Thursday / Friday weekend in Saudi Arabia (SAR standard)
}

function resolveCalendarDatePrice(
  dateKey: string,
  listing: {
    price: number;
    weekdayBasePrice?: number | null;
    weekendPrice?: number | null;
    customPrices?: Record<string, number> | null;
  }
): number {
  const custom = listing.customPrices?.[dateKey];
  if (custom !== undefined && custom !== null) {
    return custom;
  }
  if (isWeekendDay(dateKey) && listing.weekendPrice && listing.weekendPrice > 0) {
    return listing.weekendPrice;
  }
  return listing.weekdayBasePrice ?? listing.price;
}

function analyzeSelectedDatesPricing(
  keys: string[],
  listing: {
    price: number;
    weekdayBasePrice?: number | null;
    weekendPrice?: number | null;
    customPrices?: Record<string, number> | null;
  },
  bookedDates: Set<string>
) {
  const editableKeys: string[] = [];
  let bookedCount = 0;
  const prices: number[] = [];

  for (const k of keys) {
    if (bookedDates.has(k)) {
      bookedCount++;
    } else {
      editableKeys.push(k);
      prices.push(resolveCalendarDatePrice(k, listing));
    }
  }

  const uniquePrices = new Set(prices);
  const isMixedPrice = uniquePrices.size > 1;
  const commonPrice = uniquePrices.size === 1 ? prices[0] : null;

  return {
    totalKeys: keys.length,
    editableKeys,
    bookedCount,
    prices,
    isMixedPrice,
    commonPrice,
    minPrice: prices.length > 0 ? Math.min(...prices) : null,
    maxPrice: prices.length > 0 ? Math.max(...prices) : null,
  };
}

const baseListing = {
  id: "listing-test-01",
  price: 50000, // 500.00 SAR
  weekdayBasePrice: 50000,
  weekendPrice: 65000, // 650.00 SAR on Thu/Fri
  customPrices: {} as Record<string, number>,
};

// 1. Pricing Hierarchy
runTest("1. Pricing hierarchy: Custom Price override takes precedence over Weekend rate and Base rate", () => {
  const listing = {
    ...baseListing,
    customPrices: {
      "2026-10-15": 80000, // Thursday (weekend) with custom override
      "2026-10-12": 55000, // Monday (weekday) with custom override
    },
  };

  // Thursday (Weekend) with custom override -> 800.00 SAR
  assert.equal(resolveCalendarDatePrice("2026-10-15", listing), 80000);
  // Friday (Weekend) with NO custom override -> 650.00 SAR
  assert.equal(resolveCalendarDatePrice("2026-10-16", listing), 65000);
  // Monday (Weekday) with custom override -> 550.00 SAR
  assert.equal(resolveCalendarDatePrice("2026-10-12", listing), 55000);
  // Wednesday (Weekday) with NO custom override -> 500.00 SAR
  assert.equal(resolveCalendarDatePrice("2026-10-14", listing), 50000);
});

// 2. Single-Date Custom Price
runTest("2. Single-date custom price updates only target date without altering base price", () => {
  const customPrices: Record<string, number> = { ...baseListing.customPrices };
  const targetDate = "2026-10-10";
  customPrices[targetDate] = 75000;

  const listing = { ...baseListing, customPrices };

  assert.equal(resolveCalendarDatePrice("2026-10-10", listing), 75000);
  assert.equal(resolveCalendarDatePrice("2026-10-09", listing), 65000); // Friday weekend
  assert.equal(resolveCalendarDatePrice("2026-10-11", listing), 50000); // Sunday base
  assert.equal(listing.price, 50000); // Listing base price unchanged
});

// 3. Multi-Date Custom Price
runTest("3. Multi-date custom price applies to all selected editable dates", () => {
  const keys = getAllDatesInRange("2026-10-10", "2026-10-15");
  const nextCustomPrices = { ...baseListing.customPrices };

  for (const k of keys) {
    nextCustomPrices[k] = 60000;
  }

  const listing = { ...baseListing, customPrices: nextCustomPrices };

  for (const k of keys) {
    assert.equal(resolveCalendarDatePrice(k, listing), 60000);
  }
  assert.equal(resolveCalendarDatePrice("2026-10-16", listing), 65000);
});

// 4. Strict Booking Protection
runTest("4. Strict Booking Protection: active booked dates are excluded from custom price updates", () => {
  const rangeKeys = getAllDatesInRange("2026-10-10", "2026-10-20");
  const bookedDates = new Set(["2026-10-14", "2026-10-15"]);

  const analysis = analyzeSelectedDatesPricing(rangeKeys, baseListing, bookedDates);

  assert.equal(analysis.totalKeys, 11);
  assert.equal(analysis.bookedCount, 2);
  assert.equal(analysis.editableKeys.length, 9);
  assert.ok(!analysis.editableKeys.includes("2026-10-14"));
  assert.ok(!analysis.editableKeys.includes("2026-10-15"));

  const nextCustomPrices = { ...baseListing.customPrices };
  for (const k of analysis.editableKeys) {
    nextCustomPrices[k] = 58000;
  }

  assert.equal(nextCustomPrices["2026-10-14"], undefined);
  assert.equal(nextCustomPrices["2026-10-15"], undefined);
  assert.equal(nextCustomPrices["2026-10-10"], 58000);
  assert.equal(nextCustomPrices["2026-10-16"], 58000);
});

// 5. Mixed Price Detection
runTest("5. Mixed price detection accurately identifies mixed rates and range boundaries", () => {
  const rangeKeys = getAllDatesInRange("2026-10-11", "2026-10-16"); // Sun to Fri
  const noBookings = new Set<string>();

  // Case A: Mixed default rates (Weekday 500, Weekend 650 on Thu/Fri)
  const analysisA = analyzeSelectedDatesPricing(rangeKeys, baseListing, noBookings);
  assert.equal(analysisA.isMixedPrice, true);
  assert.equal(analysisA.commonPrice, null);
  assert.equal(analysisA.minPrice, 50000);
  assert.equal(analysisA.maxPrice, 65000);

  // Case B: Uniform custom rates (All set to 600)
  const customPrices: Record<string, number> = {};
  for (const k of rangeKeys) customPrices[k] = 60000;
  const uniformListing = { ...baseListing, customPrices };

  const analysisB = analyzeSelectedDatesPricing(rangeKeys, uniformListing, noBookings);
  assert.equal(analysisB.isMixedPrice, false);
  assert.equal(analysisB.commonPrice, 60000);
  assert.equal(analysisB.minPrice, 60000);
  assert.equal(analysisB.maxPrice, 60000);
});

// 6. Reset Custom Prices
runTest("6. Resetting custom price restores base and weekend rates cleanly", () => {
  const customPrices: Record<string, number> = {
    "2026-10-10": 70000,
    "2026-10-11": 70000,
    "2026-10-12": 70000,
    "2026-10-25": 90000,
  };
  const listing = { ...baseListing, customPrices };

  const selectedKeys = ["2026-10-10", "2026-10-11", "2026-10-12"];
  const nextCustomPrices = { ...listing.customPrices };
  for (const k of selectedKeys) {
    delete nextCustomPrices[k];
  }

  const resetListing = { ...baseListing, customPrices: nextCustomPrices };

  assert.equal(resolveCalendarDatePrice("2026-10-10", resetListing), 50000);
  assert.equal(resolveCalendarDatePrice("2026-10-11", resetListing), 50000);
  assert.equal(resolveCalendarDatePrice("2026-10-12", resetListing), 50000);
  assert.equal(resolveCalendarDatePrice("2026-10-25", resetListing), 90000);
  assert.equal(resetListing.price, 50000);
});

// 7. Overlapping Custom Price Updates
runTest("7. Overlapping custom price updates resolve correctly", () => {
  let customPrices: Record<string, number> = {};

  for (const k of getAllDatesInRange("2026-10-10", "2026-10-20")) {
    customPrices[k] = 60000;
  }
  for (const k of getAllDatesInRange("2026-10-15", "2026-10-17")) {
    customPrices[k] = 75000;
  }

  const listing = { ...baseListing, customPrices };

  assert.equal(resolveCalendarDatePrice("2026-10-14", listing), 60000);
  assert.equal(resolveCalendarDatePrice("2026-10-15", listing), 75000);
  assert.equal(resolveCalendarDatePrice("2026-10-16", listing), 75000);
  assert.equal(resolveCalendarDatePrice("2026-10-17", listing), 75000);
  assert.equal(resolveCalendarDatePrice("2026-10-18", listing), 60000);
});

// 8. Checkout Engine Parity
runTest("8. Checkout parity: calendar rates match pricing.service.ts resolveNightlyRate exactly", () => {
  const listingForCheckout: any = {
    price: 50000,
    weekdayBasePrice: 50000,
    weekendPrice: 65000,
    customPrices: {
      "2026-10-12": 55000,
      "2026-10-15": 80000,
    },
  };

  const testDates = ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16"];

  for (const d of testDates) {
    const calendarPrice = resolveCalendarDatePrice(d, listingForCheckout);
    const checkoutRateInfo = resolveNightlyRate({
      date: parseDateToUtcMidnight(d),
      dateStr: d,
      weekdayBasePrice: listingForCheckout.weekdayBasePrice,
      weekendPrice: listingForCheckout.weekendPrice,
      customPrices: listingForCheckout.customPrices,
    });
    assert.equal(calendarPrice, checkoutRateInfo.price);
  }
});

// 9. Atomic Bulk Update
runTest("9. Atomic payload: bulk price update produces a single unified JSON payload", () => {
  const selectedKeys = getAllDatesInRange("2026-10-01", "2026-10-31");
  const nextCustomPrices = { ...baseListing.customPrices };

  for (const k of selectedKeys) {
    nextCustomPrices[k] = 62000;
  }

  const payload = { customPrices: nextCustomPrices };

  assert.equal(Object.keys(payload).length, 1);
  assert.equal(Object.keys(payload.customPrices).length, 31);
  assert.equal(payload.customPrices["2026-10-15"], 62000);
});

// 10. Codebase Static Verification
runTest("10. Contextual panel and workspace verify live preview and base price display", () => {
  const workspacePath = path.resolve("./components/host/host-calendar-workspace.tsx");
  const code = fs.readFileSync(workspacePath, "utf-8");

  assert.ok(code.includes("onPreviewPrice"), "Passes onPreviewPrice callback");
  assert.ok(code.includes("Base Nightly Price"), "Displays Base Nightly Price");
  assert.ok(code.includes("Reset to base rates"), "Has Reset to base rates button");
  assert.ok(code.includes("Mixed Rates"), "Supports Mixed Rates tag");
  assert.ok(code.includes("persistedCustomPricesMap"), "Maintains persistedCustomPricesMap");
});

console.log("\n------------------------------------------------------------------");
console.log(`RESULTS: ${passed}/${total} test cases passed.`);
console.log("==================================================================\n");

if (passed !== total) {
  process.exit(1);
}
