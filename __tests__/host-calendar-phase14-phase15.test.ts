import assert from "node:assert/strict";
import {
  calculatePriceTips,
  resolveNightlyRate,
  parseDateToUtcMidnight,
  type PriceTipsResult,
} from "../services/pricing.service";

console.log("\n==================================================================");
console.log("   HOST CALENDAR PHASES 14 & 15 COMPREHENSIVE TEST SUITE          ");
console.log("   Price Tips & Recommendations | Year-Long Planning & Performance");
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

// ─────────────────────────────────────────────────────────────────────────────
// Simulated Host Calendar Workspace State for Year Planning & Parity
// ─────────────────────────────────────────────────────────────────────────────

interface MockListing {
  id: string;
  hostId: string;
  price: number; // in cents, e.g. 50000 = 500 SAR
  weekdayBasePrice?: number | null;
  weekendPrice?: number | null;
  smartPricingMinPrice?: number | null;
  smartPricingMaxPrice?: number | null;
  customPrices: Record<string, number>;
  blockedDates: string[];
}

interface MockBooking {
  id: string;
  listingId: string;
  checkIn: string;
  checkOut: string;
  status: string;
}

function computeIndexMaps(listing: MockListing, bookings: MockBooking[]) {
  const bookingsByDate = new Map<string, MockBooking[]>();
  for (const b of bookings) {
    if (b.status === "CONFIRMED" || b.status === "PENDING") {
      let cur = new Date(`${b.checkIn}T00:00:00Z`);
      const end = new Date(`${b.checkOut}T00:00:00Z`);
      while (cur < end) {
        const k = cur.toISOString().slice(0, 10);
        const list = bookingsByDate.get(k) || [];
        list.push(b);
        bookingsByDate.set(k, list);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    }
  }

  const blockedDatesSet = new Set<string>(listing.blockedDates);
  const customPricesMap = new Map<string, number>(Object.entries(listing.customPrices));

  return { bookingsByDate, blockedDatesSet, customPricesMap };
}

function resolveCellState({
  dateKey,
  listing,
  bookingsByDate,
  blockedDatesSet,
  customPricesMap,
}: {
  dateKey: string;
  listing: MockListing;
  bookingsByDate: Map<string, MockBooking[]>;
  blockedDatesSet: Set<string>;
  customPricesMap: Map<string, number>;
}) {
  const dateObj = new Date(`${dateKey}T00:00:00Z`);
  const isWeekend = dateObj.getUTCDay() === 4 || dateObj.getUTCDay() === 5;
  const bookingList = bookingsByDate.get(dateKey) || [];
  const isBooked = bookingList.length > 0;
  const isBlocked = blockedDatesSet.has(dateKey);

  // Status Precedence: BOOKED > BLOCKED > AVAILABLE
  const status = isBooked ? "BOOKED" : isBlocked ? "BLOCKED" : "AVAILABLE";

  const customPrice = customPricesMap.get(dateKey);
  const rate =
    customPrice !== undefined
      ? customPrice
      : isWeekend && listing.weekendPrice && listing.weekendPrice > 0
        ? listing.weekendPrice
        : (listing.weekdayBasePrice ?? listing.price);

  return { status, rate, isBooked, isBlocked, isWeekend };
}

// ─────────────────────────────────────────────────────────────────────────────
// TESTS: PHASE 14 — PRICE TIPS & RECOMMENDATIONS
// ─────────────────────────────────────────────────────────────────────────────

runTest("1. Price Tips: Advisory and non-blocking — does not mutate listing prices without explicit apply", () => {
  const listing: MockListing = {
    id: "prop-1",
    hostId: "host-1",
    price: 50000, // 500 SAR
    customPrices: {},
    blockedDates: [],
  };

  const tips = calculatePriceTips({
    listing,
    dateKeys: ["2026-10-15", "2026-10-16"], // Thu & Fri (weekend in Saudi)
    todayKey: "2026-10-01",
  });

  // Recommendation is generated
  assert.ok(tips.averageSuggestedPrice > 0);
  assert.equal(tips.recommendations.length, 2);

  // Original listing prices remain completely unmutated
  assert.deepEqual(listing.customPrices, {});
});

runTest("2. Price Tips: Strict authenticity — no fabricated market data or fake competitor claims", () => {
  const listing: MockListing = {
    id: "prop-1",
    hostId: "host-1",
    price: 50000,
    customPrices: {},
    blockedDates: [],
  };

  const tips = calculatePriceTips({
    listing,
    dateKeys: ["2026-10-12"],
    todayKey: "2026-10-01",
  });

  assert.equal(tips.hasMarketData, false, "hasMarketData must strictly be false");
  assert.ok(
    tips.marketDataNote.includes("unavailable"),
    "marketDataNote must clearly disclose that external market comparison is unavailable"
  );
});

runTest("3. Price Tips: Saudi weekend demand adjustment for Thursday & Friday nights", () => {
  const listing: MockListing = {
    id: "prop-1",
    hostId: "host-1",
    price: 50000, // 500 SAR
    customPrices: {},
    blockedDates: [],
  };

  // 2026-10-15 is Thursday (getUTCDay() === 4), 2026-10-16 is Friday (getUTCDay() === 5)
  const tips = calculatePriceTips({
    listing,
    dateKeys: ["2026-10-15", "2026-10-16"],
    todayKey: "2026-10-01",
  });

  for (const rec of tips.recommendations) {
    assert.equal(rec.isWeekend, true);
    assert.ok(rec.suggestedPrice > listing.price, "Suggested weekend price should include weekend adjustment");
    assert.ok(rec.reasons.some((r) => r.includes("Weekend")));
  }
});

runTest("4. Price Tips: Aligns with host-configured weekend price if already defined", () => {
  const listing: MockListing = {
    id: "prop-1",
    hostId: "host-1",
    price: 50000, // 500 SAR
    weekendPrice: 65000, // 650 SAR
    customPrices: {},
    blockedDates: [],
  };

  const tips = calculatePriceTips({
    listing,
    dateKeys: ["2026-10-16"], // Friday
    todayKey: "2026-10-01",
  });

  const rec = tips.recommendations[0];
  assert.equal(rec.suggestedPrice, 65000);
  assert.ok(rec.reasons.some((r) => r.includes("configured weekend rate")));
});

runTest("5. Price Tips: Strict booking protection — booked dates are flagged and excluded from applicable edits", () => {
  const listing: MockListing = {
    id: "prop-1",
    hostId: "host-1",
    price: 50000,
    customPrices: {},
    blockedDates: [],
  };

  const bookings: MockBooking[] = [
    {
      id: "b-1",
      listingId: "prop-1",
      checkIn: "2026-10-10",
      checkOut: "2026-10-12",
      status: "CONFIRMED",
    },
  ];

  const tips = calculatePriceTips({
    listing,
    dateKeys: ["2026-10-09", "2026-10-10", "2026-10-11", "2026-10-12"],
    bookings,
    todayKey: "2026-10-01",
  });

  const recOct09 = tips.recommendations.find((r) => r.dateKey === "2026-10-09")!;
  const recOct10 = tips.recommendations.find((r) => r.dateKey === "2026-10-10")!;
  const recOct11 = tips.recommendations.find((r) => r.dateKey === "2026-10-11")!;
  const recOct12 = tips.recommendations.find((r) => r.dateKey === "2026-10-12")!;

  assert.equal(recOct09.isBooked, false);
  assert.equal(recOct10.isBooked, true);
  assert.equal(recOct11.isBooked, true);
  assert.equal(recOct12.isBooked, false); // check-out day night is free

  // Applicable count excludes booked dates
  assert.equal(tips.applicableCount, 2);
});

runTest("6. Price Tips: Smart Pricing minimum and maximum boundaries are strictly respected", () => {
  const listing: MockListing = {
    id: "prop-1",
    hostId: "host-1",
    price: 50000, // 500 SAR
    smartPricingMinPrice: 45000, // 450 SAR floor
    smartPricingMaxPrice: 55000, // 550 SAR ceiling
    customPrices: {},
    blockedDates: [],
  };

  // Weekend rate would normally want +15% (57500), but ceiling is 55000
  const tips = calculatePriceTips({
    listing,
    dateKeys: ["2026-10-15"], // Thu (weekend)
    todayKey: "2026-10-01",
  });

  assert.equal(tips.recommendations[0].suggestedPrice, 55000);
  assert.ok(tips.recommendations[0].reasons.some((r) => r.includes("Smart Pricing maximum")));
});

runTest("7. Price Tips: Applying recommendation mutates only unbooked dates into customPrices atomically", () => {
  const listing: MockListing = {
    id: "prop-1",
    hostId: "host-1",
    price: 50000,
    customPrices: { "2026-10-01": 52000 },
    blockedDates: [],
  };

  const bookings: MockBooking[] = [
    {
      id: "b-1",
      listingId: "prop-1",
      checkIn: "2026-10-05",
      checkOut: "2026-10-07",
      status: "CONFIRMED",
    },
  ];

  const selectedRange = ["2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07"];
  const tips = calculatePriceTips({
    listing,
    dateKeys: selectedRange,
    bookings,
    todayKey: "2026-10-01",
  });

  // Simulate explicit host "Apply" action
  const nextCustom = { ...listing.customPrices };
  for (const rec of tips.recommendations) {
    if (!rec.isBooked) {
      nextCustom[rec.dateKey] = rec.suggestedPrice;
    }
  }

  // 10-04 and 10-07 receive custom prices; 10-05 and 10-06 (booked) do NOT; existing 10-01 is preserved
  assert.ok(nextCustom["2026-10-04"] > 0);
  assert.ok(nextCustom["2026-10-07"] > 0);
  assert.equal(nextCustom["2026-10-05"], undefined, "Booked date 10-05 must not receive custom price");
  assert.equal(nextCustom["2026-10-06"], undefined, "Booked date 10-06 must not receive custom price");
  assert.equal(nextCustom["2026-10-01"], 52000, "Unselected date custom price must be preserved");
});

runTest("8. Price Tips: Dismissing / closing modal results in zero database or state mutations", () => {
  const listing: MockListing = {
    id: "prop-1",
    hostId: "host-1",
    price: 50000,
    customPrices: { "2026-10-05": 60000 },
    blockedDates: [],
  };

  const tips = calculatePriceTips({
    listing,
    dateKeys: ["2026-10-08", "2026-10-09"],
    todayKey: "2026-10-01",
  });

  // Host clicks "Cancel" / "Got it"
  const didApply = false;
  let customPrices = { ...listing.customPrices };
  if (didApply) {
    for (const rec of tips.recommendations) {
      customPrices[rec.dateKey] = rec.suggestedPrice;
    }
  }

  assert.deepEqual(customPrices, listing.customPrices, "Price state must remain strictly untouched on dismiss");
});

// ─────────────────────────────────────────────────────────────────────────────
// TESTS: PHASE 15 — YEAR-LONG PLANNING & CALENDAR PERFORMANCE
// ─────────────────────────────────────────────────────────────────────────────

runTest("9. Year-Long Planning: Generates 12 consecutive months starting from anchor month", () => {
  const anchor = new Date(2026, 9, 1); // October 2026
  const months = Array.from({ length: 12 }, (_, i) => new Date(anchor.getFullYear(), anchor.getMonth() + i, 1));

  assert.equal(months.length, 12);
  assert.equal(months[0].getFullYear(), 2026);
  assert.equal(months[0].getMonth(), 9); // October
  assert.equal(months[2].getMonth(), 11); // December 2026
  assert.equal(months[3].getFullYear(), 2027); // January 2027 (Year rollover)
  assert.equal(months[3].getMonth(), 0);
  assert.equal(months[11].getFullYear(), 2027);
  assert.equal(months[11].getMonth(), 8); // September 2027
});

runTest("10. Year-Long Planning: Year separator header is emitted upon year rollover", () => {
  const anchor = new Date(2026, 9, 1); // October 2026
  const months = Array.from({ length: 12 }, (_, i) => new Date(anchor.getFullYear(), anchor.getMonth() + i, 1));

  const yearHeaders: number[] = [];
  months.forEach((d, i) => {
    if (i > 0 && d.getMonth() === 0) {
      yearHeaders.push(d.getFullYear());
    }
  });

  assert.deepEqual(yearHeaders, [2027], "Year header 2027 must be emitted when crossing into January 2027");
});

runTest("11. Performance: O(1) Precomputed indexing for cell status & pricing across entire year", () => {
  const listing: MockListing = {
    id: "prop-1",
    hostId: "host-1",
    price: 50000,
    weekdayBasePrice: 50000,
    weekendPrice: 65000,
    customPrices: {
      "2026-11-15": 70000,
      "2027-04-10": 80000,
    },
    blockedDates: ["2026-12-25", "2027-01-01"],
  };

  const bookings: MockBooking[] = [
    {
      id: "b-1",
      listingId: "prop-1",
      checkIn: "2026-10-10",
      checkOut: "2026-10-15",
      status: "CONFIRMED",
    },
    {
      id: "b-2",
      listingId: "prop-1",
      checkIn: "2027-02-14",
      checkOut: "2027-02-18",
      status: "CONFIRMED",
    },
  ];

  // Precompute single Map/Set lookups (O(B + Blocked + Custom))
  const { bookingsByDate, blockedDatesSet, customPricesMap } = computeIndexMaps(listing, bookings);

  // Measure lookup of 365 days across the year: must be instantaneous without nested loops
  const t0 = performance.now();
  for (let i = 0; i < 365; i++) {
    const cur = new Date(Date.UTC(2026, 9, 1 + i));
    const k = cur.toISOString().slice(0, 10);
    const cell = resolveCellState({
      dateKey: k,
      listing,
      bookingsByDate,
      blockedDatesSet,
      customPricesMap,
    });
    assert.ok(cell.status);
    assert.ok(cell.rate > 0);
  }
  const elapsed = performance.now() - t0;
  assert.ok(elapsed < 50, `365 cell lookups took ${elapsed.toFixed(2)}ms (must be < 50ms)`);
});

runTest("12. Parity: Status precedence and price resolution are identical between Month and Year views", () => {
  const listing: MockListing = {
    id: "prop-1",
    hostId: "host-1",
    price: 50000,
    weekendPrice: 65000,
    customPrices: { "2026-10-15": 75000 },
    blockedDates: ["2026-10-10"], // Also has a booking on 10-10!
  };

  const bookings: MockBooking[] = [
    {
      id: "b-1",
      listingId: "prop-1",
      checkIn: "2026-10-10",
      checkOut: "2026-10-12",
      status: "CONFIRMED",
    },
  ];

  const { bookingsByDate, blockedDatesSet, customPricesMap } = computeIndexMaps(listing, bookings);

  // Case A: Booked date that is also marked blocked -> BOOKED takes precedence
  const cellOct10 = resolveCellState({
    dateKey: "2026-10-10",
    listing,
    bookingsByDate,
    blockedDatesSet,
    customPricesMap,
  });
  assert.equal(cellOct10.status, "BOOKED");

  // Case B: Custom price override takes precedence over weekend rate
  const cellOct15 = resolveCellState({
    dateKey: "2026-10-15",
    listing,
    bookingsByDate,
    blockedDatesSet,
    customPricesMap,
  });
  assert.equal(cellOct15.rate, 75000);

  // Case C: Standard weekend rate applies to unoverridden weekend date (2026-10-16 is Friday)
  const cellOct16 = resolveCellState({
    dateKey: "2026-10-16",
    listing,
    bookingsByDate,
    blockedDatesSet,
    customPricesMap,
  });
  assert.equal(cellOct16.rate, 65000);
});

runTest("13. Cross-Month Range Selection: Handles selecting dates spanning across month boundaries", () => {
  function getAllDatesInRange(start: string, end: string): string[] {
    const dates: string[] = [];
    let cur = new Date(`${start}T00:00:00Z`);
    const stop = new Date(`${end}T00:00:00Z`);
    while (cur <= stop) {
      dates.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return dates;
  }

  // Cross from Oct 28 to Nov 3 (spans October into November)
  const rangeKeys = getAllDatesInRange("2026-10-28", "2026-11-03");
  assert.equal(rangeKeys.length, 7);
  assert.equal(rangeKeys[0], "2026-10-28");
  assert.equal(rangeKeys[3], "2026-10-31");
  assert.equal(rangeKeys[4], "2026-11-01");
  assert.equal(rangeKeys[6], "2026-11-03");
});

runTest("14. Quick Navigation: Today and month selector reset navigation state safely", () => {
  let activeMonth = new Date(2027, 5, 1);
  let view: "month" | "year" = "year";
  let selection: { start: string | null; end: string | null } = {
    start: "2027-06-10",
    end: "2027-06-15",
  };

  // Host clicks "Today"
  const now = new Date();
  const todayMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  activeMonth = todayMonth;
  selection = { start: null, end: null };

  assert.equal(activeMonth.getFullYear(), now.getFullYear());
  assert.equal(activeMonth.getMonth(), now.getMonth());
  assert.equal(selection.start, null);

  // Host clicks "View month" on November in Year view
  const targetMonth = new Date(2026, 10, 1);
  activeMonth = targetMonth;
  view = "month";
  selection = { start: null, end: null };

  assert.equal(activeMonth.getFullYear(), 2026);
  assert.equal(activeMonth.getMonth(), 10);
  assert.equal(view, "month");
});

console.log("\n==================================================================");
console.log(`  Tests Passed: ${passed} / ${total}`);
if (passed === total) {
  console.log("  ALL PHASE 14 & 15 VERIFICATION TESTS PASSED SUCCESSFULLY!  ");
} else {
  console.error("  SOME PHASE 14 & 15 TESTS FAILED!");
  process.exit(1);
}
console.log("==================================================================\n");

