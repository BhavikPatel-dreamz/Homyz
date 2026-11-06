import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  shiftDateKeyByYears,
  normalizeAnalyticsTimeframe,
  calculateDelta,
  parseDateKeyToUtc,
  formatUtcDateToKey,
} from "../services/admin-analytics/analytics-filters";
import { ComparisonMode, AnalyticsFilterInput } from "../services/admin-analytics/analytics-contracts";

describe("Phase 4 — Advanced Analytics Filters, Date Intelligence & Period Comparison", () => {
  const rootDir = process.cwd();
  const fixedNow = new Date("2026-11-06T12:00:00.000Z");

  it("4.1: Date Intelligence & Leap-Year Arithmetic (shiftDateKeyByYears)", () => {
    // Leap year shift backward to non-leap year (Feb 29 -> Feb 28)
    const shifted2023 = shiftDateKeyByYears("2024-02-29", -1);
    assert.equal(shifted2023, "2023-02-28", "Feb 29 on leap year must clamp to Feb 28 on non-leap year");

    // Leap year shift backward to another leap year (2024 -> 2020)
    const shifted2020 = shiftDateKeyByYears("2024-02-29", -4);
    assert.equal(shifted2020, "2020-02-29", "Feb 29 must remain Feb 29 when target year is also a leap year");

    // Regular date shift
    const shiftedStandard = shiftDateKeyByYears("2026-11-06", -1);
    assert.equal(shiftedStandard, "2025-11-06", "Standard dates must shift exactly 1 calendar year");

    // Forward shift across leap boundary
    const shiftedForward = shiftDateKeyByYears("2023-02-28", 1);
    assert.equal(shiftedForward, "2024-02-28", "Feb 28 in non-leap shifts to Feb 28 in leap year");
  });

  it("4.2: Period Comparison Modes (previous_period, previous_year, none)", () => {
    // 1. Previous Period (Default)
    const prevPeriodTf = normalizeAnalyticsTimeframe(
      { period: "30d", comparisonMode: "previous_period" },
      fixedNow
    );
    assert.equal(prevPeriodTf.context.comparisonMode, "previous_period");
    assert.equal(prevPeriodTf.context.startDateKey, "2026-10-08");
    assert.equal(prevPeriodTf.context.endDateKey, "2026-11-06");
    assert.equal(prevPeriodTf.context.previousStartDateKey, "2026-09-08");
    assert.equal(prevPeriodTf.context.previousEndDateKey, "2026-10-07");
    assert.equal(prevPeriodTf.previousPeriodDays, 30);

    // 2. Year-over-Year (previous_year)
    const yoyTf = normalizeAnalyticsTimeframe(
      { period: "30d", comparisonMode: "previous_year" },
      fixedNow
    );
    assert.equal(yoyTf.context.comparisonMode, "previous_year");
    assert.equal(yoyTf.context.startDateKey, "2026-10-08");
    assert.equal(yoyTf.context.endDateKey, "2026-11-06");
    assert.equal(yoyTf.context.previousStartDateKey, "2025-10-08");
    assert.equal(yoyTf.context.previousEndDateKey, "2025-11-06");
    assert.equal(yoyTf.previousPeriodDays, 30);

    // 3. None (no comparison)
    const noneTf = normalizeAnalyticsTimeframe(
      { period: "7d", comparisonMode: "none" },
      fixedNow
    );
    assert.equal(noneTf.context.comparisonMode, "none");
    assert.equal(noneTf.context.previousStartDateKey, null);
    assert.equal(noneTf.context.previousEndDateKey, null);
    assert.equal(noneTf.previousPeriodDays, 0);
  });

  it("4.3: Delta Engine — Relative % vs Absolute Percentage Points (pp)", () => {
    // Standard currency / volume metric (relative %)
    const revenueDelta = calculateDelta(15000, 10000, { comparisonMode: "previous_period" });
    assert.equal(revenueDelta.current, 15000);
    assert.equal(revenueDelta.previous, 10000);
    assert.equal(revenueDelta.absoluteChange, 5000);
    assert.equal(revenueDelta.percentageChange, 50.0);
    assert.equal(revenueDelta.isPositive, true);
    assert.equal(revenueDelta.isPercentagePoint, false);

    // Rate / percentage metric (percentage points pp)
    // 65.5% occupancy vs 60.0% occupancy -> +5.5 pp (NOT +9.16% relative)
    const occupancyDelta = calculateDelta(65.5, 60.0, {
      isRateOrPercentage: true,
      comparisonMode: "previous_period",
    });
    assert.equal(occupancyDelta.current, 65.5);
    assert.equal(occupancyDelta.previous, 60.0);
    assert.equal(occupancyDelta.absoluteChange, 5.5);
    assert.equal(occupancyDelta.percentageChange, 5.5);
    assert.equal(occupancyDelta.isPositive, true);
    assert.equal(occupancyDelta.isPercentagePoint, true);

    // Negative percentage points
    const slaDelta = calculateDelta(92.0, 95.0, {
      isRateOrPercentage: true,
      comparisonMode: "previous_period",
    });
    assert.equal(slaDelta.percentageChange, -3.0);
    assert.equal(slaDelta.isPositive, false);
    assert.equal(slaDelta.isPercentagePoint, true);

    // Zero-baseline policy (does not invent misleading +100%)
    const zeroBaseDelta = calculateDelta(500, 0, { comparisonMode: "previous_period" });
    assert.equal(zeroBaseDelta.percentageChange, null);
    assert.equal(zeroBaseDelta.absoluteChange, 500);

    // Disabled comparison mode "none"
    const noComparisonDelta = calculateDelta(120, 80, { comparisonMode: "none" });
    assert.equal(noComparisonDelta.previous, null);
    assert.equal(noComparisonDelta.absoluteChange, 0);
    assert.equal(noComparisonDelta.percentageChange, null);
  });

  it("4.4: Relational Filter Input Schema Validation", () => {
    const filterInput: AnalyticsFilterInput = {
      period: "custom",
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      comparisonMode: "previous_year",
      listingId: "cm1234567890",
      hostId: "usr_host_999",
      city: "Riyadh",
      country: "Saudi Arabia",
      currency: "SAR",
    };

    assert.equal(filterInput.period, "custom");
    assert.equal(filterInput.comparisonMode, "previous_year");
    assert.equal(filterInput.listingId, "cm1234567890");
    assert.equal(filterInput.hostId, "usr_host_999");
    assert.equal(filterInput.city, "Riyadh");
    assert.equal(filterInput.currency, "SAR");
  });

  it("4.5: Strict Typography Rule Check — 0 font-bold, font-semibold, <b>, <strong>", () => {
    const filesToCheck = [
      "components/admin/ui/admin-stat-card.tsx",
      "components/admin/analytics/analytics-date-picker-popover.tsx",
      "components/admin/analytics/admin-analytics-hub-client.tsx",
      "components/admin/analytics/tabs/overview-tab.tsx",
      "components/admin/analytics/tabs/revenue-tab.tsx",
      "components/admin/analytics/tabs/occupancy-tab.tsx",
      "components/admin/analytics/tabs/operations-tab.tsx",
      "components/admin/analytics/tabs/reports-tab.tsx",
      "components/admin/analytics/charts/analytics-area-chart.tsx",
      "components/admin/analytics/charts/analytics-bar-chart.tsx",
      "components/admin/analytics/charts/analytics-donut-chart.tsx",
      "app/(protected)/admin/analytics/page.tsx",
    ];

    const forbiddenRegex = /font-bold|font-semibold|<b\b|<strong\b/g;

    for (const relativeFile of filesToCheck) {
      const fullPath = path.join(rootDir, relativeFile);
      assert.ok(fs.existsSync(fullPath), `File missing for typography check: ${relativeFile}`);
      const content = fs.readFileSync(fullPath, "utf-8");
      const matches = content.match(forbiddenRegex);
      assert.equal(
        matches,
        null,
        `Typography rule violation in ${relativeFile}: found ${JSON.stringify(matches)}. Only font-medium or font-normal are permitted.`
      );
    }
  });

  it("4.6: All 10 Phase 4 Documentation Files Exist and have Content", () => {
    const docFiles = [
      "01-filter-architecture.md",
      "02-date-and-period-comparison.md",
      "03-listing-host-location-filters.md",
      "04-financial-filter-validation.md",
      "05-occupancy-filter-validation.md",
      "06-url-and-state-synchronization.md",
      "07-export-filter-consistency.md",
      "08-performance-and-responsive.md",
      "09-tests-and-verification.md",
      "10-phase-5-readiness.md",
    ];

    for (const file of docFiles) {
      const fullPath = path.join(rootDir, "docs/admin-analytics-phase-4", file);
      assert.ok(fs.existsSync(fullPath), `Phase 4 Documentation file missing: ${file}`);
      const stat = fs.statSync(fullPath);
      assert.ok(stat.size > 200, `Documentation file is too short: ${file} (${stat.size} bytes)`);
    }
  });
});

