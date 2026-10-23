import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  resolveReportingPeriod,
  normalizeDateRangePreset,
} from "../lib/dashboard/reporting-filter";
import { convertCurrency, formatMoney, resolvePropertyCurrency } from "../lib/currency";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("Phase 1 & Phase 2 Host Dashboard Foundation & Overview", () => {
  describe("1. Shared Reporting Filter Foundation", () => {
    const fixedNow = new Date("2026-10-21T12:00:00Z");

    it("derives this_month preset and previous-month comparison accurately", () => {
      const period = resolveReportingPeriod({ period: "this_month" }, fixedNow);
      assert.equal(period.preset, "this_month");
      assert.equal(period.startDateKey, "2026-10-01");
      assert.equal(period.endDateKey, "2026-10-31");
      assert.equal(period.comparisonStartDateKey, "2026-09-01");
      assert.equal(period.comparisonEndDateKey, "2026-09-30");
      assert.equal(period.comparisonLabel, "vs last month");
    });

    it("derives last_month preset and prior-month comparison accurately", () => {
      const period = resolveReportingPeriod({ period: "last_month" }, fixedNow);
      assert.equal(period.preset, "last_month");
      assert.equal(period.startDateKey, "2026-09-01");
      assert.equal(period.endDateKey, "2026-09-30");
      assert.equal(period.comparisonStartDateKey, "2026-08-01");
      assert.equal(period.comparisonEndDateKey, "2026-08-31");
      assert.equal(period.comparisonLabel, "vs prior month");
    });

    it("derives last_30_days preset accurately with 30-day duration", () => {
      const period = resolveReportingPeriod({ period: "last_30_days" }, fixedNow);
      assert.equal(period.preset, "last_30_days");
      assert.equal(period.durationDays, 30);
      assert.equal(period.comparisonLabel, "vs prior 30 days");
    });

    it("derives year_to_date preset starting on Jan 1 with prior-year comparison", () => {
      const period = resolveReportingPeriod({ period: "year_to_date" }, fixedNow);
      assert.equal(period.preset, "year_to_date");
      assert.equal(period.startDateKey, "2026-01-01");
      assert.equal(period.comparisonStartDateKey, "2025-01-01");
      assert.match(period.comparisonLabel, /vs same period 2025/);
    });

    it("derives custom date range accurately with preceding duration comparison", () => {
      const period = resolveReportingPeriod(
        { period: "custom", startDate: "2026-10-01", endDate: "2026-10-10" },
        fixedNow,
      );
      assert.equal(period.preset, "custom");
      assert.equal(period.startDateKey, "2026-10-01");
      assert.equal(period.endDateKey, "2026-10-10");
      assert.equal(period.durationDays, 10);
      assert.equal(period.comparisonEndDateKey, "2026-09-30");
      assert.equal(period.comparisonStartDateKey, "2026-09-21");
    });
  });

  describe("2. Financial Correctness and Multi-Currency Separation", () => {
    it("never silently combines USD and SAR into one number without currency conversion", () => {
      const usdBooking = { netPayout: 10000, currency: "USD" }; // $100.00
      const sarBooking = { netPayout: 37500, currency: "SAR" }; // SAR 375.00

      // In the old buggy implementation, 10000 + 37500 = 47500 was labeled "SAR 475.00"
      // In the new implementation, USD is converted using the authoritative FX rate
      const convertedUsdInSar = convertCurrency(usdBooking.netPayout, "USD", "SAR");
      assert.equal(convertedUsdInSar, 37500, "$100 USD converts to SAR 375.00 (3.75 peg)");

      const totalConvertedSar = convertedUsdInSar + sarBooking.netPayout;
      assert.equal(totalConvertedSar, 75000, "Combined total in SAR is SAR 750.00");
    });

    it("preserves native booking currency on individual reservation and payout objects", () => {
      const nextBookingUsd = { currency: "USD", hostPayoutCents: 50000 };
      const formattedUsd = formatMoney(nextBookingUsd.hostPayoutCents, "USD");
      assert.equal(formattedUsd, "$500");

      const nextBookingSar = { currency: "SAR", hostPayoutCents: 150000 };
      const formattedSar = formatMoney(nextBookingSar.hostPayoutCents, "SAR");
      assert.equal(formattedSar, "SAR 1,500");
    });
  });

  describe("3. Host Navigation Integrity", () => {
    const appHeaderCode = read("components/dashboard/app-header.tsx");

    it("exposes Dashboard, Earnings, and Insights in desktop hostNavTabs", () => {
      assert.match(appHeaderCode, /id:\s*"dashboard"/);
      assert.match(appHeaderCode, /href:\s*"\/host\/dashboard"/);
      assert.match(appHeaderCode, /id:\s*"earnings"/);
      assert.match(appHeaderCode, /href:\s*"\/host\/earnings"/);
      assert.match(appHeaderCode, /id:\s*"insights"/);
      assert.match(appHeaderCode, /href:\s*"\/host\/insights"/);
    });

    it("includes Earnings, Dashboard, and Insights in the mobile host dropdown menu", () => {
      assert.match(appHeaderCode, /href="\/host\/dashboard"/);
      assert.match(appHeaderCode, /href="\/host\/earnings"/);
      assert.match(appHeaderCode, /href="\/host\/insights"/);
    });
  });

  describe("4. Dashboard KPI Deep Navigation & Reservation Click-Through", () => {
    const overviewCode = read("components/host/dashboard/host-kpi-overview.tsx");

    it("connects Monthly Earnings and YTD Earnings KPI cards to /host/earnings", () => {
      assert.match(overviewCode, /href="\/host\/earnings"/);
    });

    it("connects Occupancy KPI to /host/calendar", () => {
      assert.match(overviewCode, /href="\/host\/calendar"/);
    });

    it("connects Guest Rating KPI to /host/reviews", () => {
      assert.match(overviewCode, /href="\/host\/reviews"/);
    });

    it("connects Cancellation Rate KPI to /host/resolution-center", () => {
      assert.match(overviewCode, /href="\/host\/resolution-center"/);
    });

    it("navigates directly to /host/bookings/[id] on reservation details action", () => {
      assert.match(overviewCode, /href=\{`\/host\/bookings\/\$\{reservation\.id\}`\}/);
    });
  });

  describe("5. This Month Snapshot and Upcoming Payout Details", () => {
    const overviewCode = read("components/host/dashboard/host-kpi-overview.tsx");
    const serviceCode = read("services/host-dashboard.service.ts");

    it("defines and calculates This Month Snapshot with bookings, cancellations, and avg stay", () => {
      assert.match(serviceCode, /thisMonthSnapshot:\s*HostDashboardThisMonthSnapshot/);
      assert.match(serviceCode, /thisMonthBookingsCount/);
      assert.match(serviceCode, /thisMonthCancellationsCount/);
      assert.match(serviceCode, /averageStayNights/);
      assert.match(overviewCode, /id="this-month-snapshot-heading"/);
      assert.match(overviewCode, /thisMonthSnapshot\.bookingsCount/);
      assert.match(overviewCode, /thisMonthSnapshot\.cancellationsCount/);
    });

    it("renders Upcoming Payout details with status, arrival condition, and masked account", () => {
      assert.match(overviewCode, /id="upcoming-payout-details-heading"/);
      assert.match(overviewCode, /nextPayoutStatus/);
      assert.match(overviewCode, /nextPayoutExpectedArrival/);
      assert.match(overviewCode, /nextPayoutMethodMasked/);
    });
  });

  describe("6. AI Features Exclusion & Non-Fabricated Data", () => {
    const overviewCode = read("components/host/dashboard/host-kpi-overview.tsx");
    const serviceCode = read("services/host-dashboard.service.ts");

    it("strictly excludes AI copilot, AI pricing, and automated AI generation from dashboard", () => {
      assert.doesNotMatch(overviewCode, /copilot|ai pricing|gpt|gemini|llm|ai recommendations/i);
      assert.doesNotMatch(serviceCode, /copilot|ai pricing|gpt|gemini|llm|ai recommendations/i);
    });

    it("displays explicit unavailable state for check-in instruction tracking rather than fake data", () => {
      assert.match(serviceCode, /Check-in instructions viewed tracking is not currently instrumented/);
      assert.match(overviewCode, /checkInInstructionsViewed\.message/);
      assert.match(overviewCode, /Unavailable/);
    });
  });
});

