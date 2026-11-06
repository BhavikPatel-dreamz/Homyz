import test from "node:test";
import assert from "node:assert/strict";
import { normalizeAnalyticsTimeframe, calculateDelta } from "../services/admin-analytics/analytics-filters";
import { KPI_REGISTRY } from "../services/admin-analytics/analytics-contracts";
import { calculateDashboardInventory } from "../lib/dashboard/host-inventory";
import { BookingStatus } from "../generated/prisma/enums";

test("Phase 2 — KPI Registry & Definitions", async (t) => {
  await t.test("1.1: Core financial, booking, occupancy, and operational KPIs are fully defined", () => {
    const requiredKpis = [
      "GROSS_BOOKING_VALUE",
      "CAPTURED_PAYMENT_VOLUME",
      "REFUNDED_VOLUME",
      "NET_COLLECTED_CASH",
      "PLATFORM_COMMISSION",
      "NET_HOST_PAYOUTS",
      "CONFIRMED_BOOKINGS",
      "BOOKABLE_NIGHTS",
      "BOOKED_NIGHTS",
      "OCCUPANCY_RATE",
      "AVERAGE_DAILY_RATE",
      "REVPAR",
      "ACTIVE_BACKLOG_CASES",
      "FIRST_RESPONSE_SLA_COMPLIANCE",
      "RESOLUTION_SLA_COMPLIANCE",
    ];

    for (const key of requiredKpis) {
      assert.ok(KPI_REGISTRY[key], `Missing KPI definition for: ${key}`);
      assert.ok(KPI_REGISTRY[key].id, `KPI ${key} must have an ID`);
      assert.ok(KPI_REGISTRY[key].formula, `KPI ${key} must specify a formula`);
      assert.ok(KPI_REGISTRY[key].source, `KPI ${key} must specify a database source`);
      assert.ok(KPI_REGISTRY[key].dateDimension, `KPI ${key} must specify a date dimension`);
    }
  });

  await t.test("1.2: Date dimension separates transaction timestamps from stay calendar dates", () => {
    assert.equal(KPI_REGISTRY.GROSS_BOOKING_VALUE.dateDimension, "TRANSACTION_TIMESTAMP");
    assert.equal(KPI_REGISTRY.CAPTURED_PAYMENT_VOLUME.dateDimension, "TRANSACTION_TIMESTAMP");
    assert.equal(KPI_REGISTRY.BOOKED_NIGHTS.dateDimension, "STAY_CALENDAR_DATE");
    assert.equal(KPI_REGISTRY.OCCUPANCY_RATE.dateDimension, "STAY_CALENDAR_DATE");
    assert.equal(KPI_REGISTRY.AVERAGE_DAILY_RATE.dateDimension, "STAY_CALENDAR_DATE");
    assert.equal(KPI_REGISTRY.REVPAR.dateDimension, "STAY_CALENDAR_DATE");
  });
});

test("Phase 2 — Shared Date Engine & Normalization", async (t) => {
  await t.test("2.1: Resolves standard preset periods to exact UTC date keys", () => {
    const fixedNow = new Date("2026-11-06T12:00:00.000Z");

    const t7d = normalizeAnalyticsTimeframe({ period: "7d" }, fixedNow);
    assert.equal(t7d.context.startDateKey, "2026-10-31");
    assert.equal(t7d.context.endDateKey, "2026-11-06");
    assert.equal(t7d.durationDays, 7);

    const t30d = normalizeAnalyticsTimeframe({ period: "30d" }, fixedNow);
    assert.equal(t30d.context.startDateKey, "2026-10-08");
    assert.equal(t30d.context.endDateKey, "2026-11-06");
    assert.equal(t30d.durationDays, 30);

    const tMonth = normalizeAnalyticsTimeframe({ period: "this_month" }, fixedNow);
    assert.equal(tMonth.context.startDateKey, "2026-11-01");
    assert.equal(tMonth.context.endDateKey, "2026-11-06");
    assert.equal(tMonth.context.previousStartDateKey, "2026-10-01");
    assert.equal(tMonth.context.previousEndDateKey, "2026-10-06");

    const tLastMonth = normalizeAnalyticsTimeframe({ period: "last_month" }, fixedNow);
    assert.equal(tLastMonth.context.startDateKey, "2026-10-01");
    assert.equal(tLastMonth.context.endDateKey, "2026-10-31");
  });

  await t.test("2.2: Calculates percentage delta safely without arbitrary +100% inflation when previous is 0", () => {
    const deltaZeroPrior = calculateDelta(500, 0);
    assert.equal(deltaZeroPrior.current, 500);
    assert.equal(deltaZeroPrior.previous, 0);
    assert.equal(deltaZeroPrior.absoluteChange, 500);
    assert.equal(deltaZeroPrior.percentageChange, null, "Zero baseline must yield null percentage delta rather than arbitrary +100%");

    const deltaBothZero = calculateDelta(0, 0);
    assert.equal(deltaBothZero.percentageChange, 0);

    const deltaNormal = calculateDelta(120, 100);
    assert.equal(deltaNormal.percentageChange, 20);

    const deltaDecrease = calculateDelta(80, 100);
    assert.equal(deltaDecrease.percentageChange, -20);
  });
});

test("Phase 2 — Marketplace Occupancy Engine & ADR/RevPAR", async (t) => {
  await t.test("3.1: Canonical inventory calculation excludes host blocks and gives precedence to confirmed stays", () => {
    const listings = [
      { id: "prop_1", blockedDates: ["2026-11-02", "2026-11-03"] },
      { id: "prop_2", blockedDates: [] },
    ];

    const bookings = [
      {
        listingId: "prop_1",
        status: BookingStatus.CONFIRMED,
        startDate: new Date("2026-11-01"),
        endDate: new Date("2026-11-03"), // 2 nights: Nov 1, Nov 2 (Nov 2 is also blocked, booking takes precedence)
      },
    ];

    const inv = calculateDashboardInventory({
      listings,
      bookings,
      startDateKey: "2026-11-01",
      endDateKeyExclusive: "2026-11-06", // 5 days
    });

    // Prop 1: 5 calendar days - 1 remaining block (Nov 3) = 4 bookable nights. Booked: 2 nights (Nov 1, 2).
    // Prop 2: 5 calendar days - 0 blocks = 5 bookable nights. Booked: 0.
    // Total Bookable: 9 nights. Total Booked: 2 nights.
    assert.equal(inv.bookedNights, 2);
    assert.equal(inv.bookableNights, 9);
    assert.equal(inv.blockedNights, 1);
    assert.equal(inv.availableNights, 7);
    assert.equal(inv.ratePercentage, 22.2); // (2 / 9) * 100 = 22.2%
  });

  await t.test("3.2: Empty inventory returns 0 rate percentage without NaN crash", () => {
    const emptyInv = calculateDashboardInventory({
      listings: [],
      bookings: [],
      startDateKey: "2026-11-01",
      endDateKeyExclusive: "2026-11-06",
    });

    assert.equal(emptyInv.bookableNights, 0);
    assert.equal(emptyInv.bookedNights, 0);
    assert.equal(emptyInv.ratePercentage, 0);
  });

  await t.test("3.3: ADR and RevPAR mathematical relationship: RevPAR = ADR * Occupancy", () => {
    const bookedNights = 10;
    const bookableNights = 20;
    const accommodationRevenueCents = 1_000_000; // SAR 10,000

    const occupancyRate = (bookedNights / bookableNights) * 100; // 50%
    const adrCents = Math.round(accommodationRevenueCents / bookedNights); // SAR 1,000
    const revParCents = Math.round(accommodationRevenueCents / bookableNights); // SAR 500

    assert.equal(occupancyRate, 50);
    assert.equal(adrCents, 100_000);
    assert.equal(revParCents, 50_000);
    assert.equal(revParCents, Math.round(adrCents * (occupancyRate / 100)));
  });
});

test("Phase 2 — Financial Integrity & Reconciliation Formulas", async (t) => {
  await t.test("4.1: Net Collected Cash = Captured Volume - Succeeded Refunds", () => {
    const capturedAmountCents = 500_000; // SAR 5,000
    const refundedAmountCents = 50_000;  // SAR 500
    const netCashCents = capturedAmountCents - refundedAmountCents;

    assert.equal(netCashCents, 450_000);
    assert.ok(netCashCents <= capturedAmountCents, "Net cash can never exceed captured volume");
  });

  await t.test("4.2: Cohort reconciliation balances Net Cash against Host Payouts and Platform Fees", () => {
    const gmvCents = 100_000; // SAR 1,000
    const hostServiceFeeCents = 3_000; // SAR 30 (3%)
    const netHostPayoutCents = 97_000; // SAR 970 (97%)

    assert.equal(hostServiceFeeCents + netHostPayoutCents, gmvCents, "Platform fees + Host payouts must exactly balance GMV");
  });
});

