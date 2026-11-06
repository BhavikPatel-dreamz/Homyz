import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getWarningIdentifier,
  normalizeDataQualityWarnings,
  filterWarningsForTab,
} from "@/services/admin-analytics/warning-normalization";
import type { DataQualityWarning } from "@/services/admin-analytics/analytics-contracts";
import { occupancyAnalyticsService } from "@/services/admin-analytics/occupancy.service";
import { adminAnalyticsOverviewService } from "@/services/admin-analytics/overview.service";
import { bookingDateKey } from "@/lib/booking/booking-date";

describe("Marketplace Transparency Warnings & Historical Occupancy Integrity", () => {
  const sampleOccupancyWarning: DataQualityWarning = {
    code: "HISTORICAL_AVAILABILITY_ESTIMATED",
    message:
      "Historical availability data may be incomplete. Some occupancy metrics are estimated.",
    affectedMetrics: ["bookable_nights", "occupancy_rate", "revpar"],
    scope: "occupancy",
    isEstimated: true,
  };

  const sampleRevenueWarning: DataQualityWarning = {
    code: "ESTIMATED_COMMISSION_FALLBACK",
    message: "2 booking(s) lacked an explicit hostServiceFee snapshot; 3% standard marketplace commission was applied.",
    affectedMetrics: ["platform_commission", "net_host_payouts"],
    scope: "revenue",
  };

  const sampleGlobalWarning: DataQualityWarning = {
    code: "CURRENCY_RATE_STALE",
    message: "Live ECB rates unavailable; cached rates used.",
    affectedMetrics: ["gross_booking_value"],
    scope: "global",
  };

  describe("1. Stable Warning Identifiers & Centralized Normalization", () => {
    it("generates deterministic stable identifier based on code, sorted metrics, and scope", () => {
      const id1 = getWarningIdentifier(sampleOccupancyWarning);
      const id2 = getWarningIdentifier({
        ...sampleOccupancyWarning,
        affectedMetrics: ["revpar", "bookable_nights", "occupancy_rate"], // reordered metrics
      });
      assert.equal(id1, id2, "Warning identifiers must match regardless of affectedMetrics ordering");
      assert.equal(id1, "HISTORICAL_AVAILABILITY_ESTIMATED::bookable_nights,occupancy_rate,revpar::occupancy");
    });

    it("deduplicates identical warnings returned by multiple aggregated services", () => {
      // Simulates Overview service and Occupancy service both providing the occupancy warning
      const duplicatedList: DataQualityWarning[] = [
        sampleOccupancyWarning,
        { ...sampleOccupancyWarning },
        { ...sampleOccupancyWarning },
      ];

      const normalized = normalizeDataQualityWarnings(duplicatedList);
      assert.equal(normalized.length, 1, "Expected exactly 1 warning after deduplication");
      assert.equal(normalized[0].code, "HISTORICAL_AVAILABILITY_ESTIMATED");
      assert.equal(normalized[0].message, sampleOccupancyWarning.message);
    });

    it("preserves distinct warnings with different codes or scopes", () => {
      const mixedList: DataQualityWarning[] = [
        sampleOccupancyWarning,
        sampleRevenueWarning,
        sampleGlobalWarning,
        sampleOccupancyWarning, // duplicate of first
      ];

      const normalized = normalizeDataQualityWarnings(mixedList);
      assert.equal(normalized.length, 3, "Expected 3 distinct warnings");
      const codes = normalized.map((w) => w.code).sort();
      assert.deepEqual(codes, [
        "CURRENCY_RATE_STALE",
        "ESTIMATED_COMMISSION_FALLBACK",
        "HISTORICAL_AVAILABILITY_ESTIMATED",
      ]);
    });

    it("gracefully handles null, undefined, or empty inputs", () => {
      const normalized = normalizeDataQualityWarnings([null, undefined, sampleOccupancyWarning, null]);
      assert.equal(normalized.length, 1);
      assert.equal(normalized[0].code, "HISTORICAL_AVAILABILITY_ESTIMATED");
    });
  });

  describe("2. Tab-Scoped Warning Visibility (Zero Irrelevant Noise)", () => {
    const combinedWarnings = [
      sampleOccupancyWarning,
      sampleRevenueWarning,
      sampleGlobalWarning,
    ];

    it("shows occupancy warning on the Overview and Occupancy tabs", () => {
      const overviewWarnings = filterWarningsForTab(combinedWarnings, "overview");
      assert.ok(
        overviewWarnings.some((w) => w.code === "HISTORICAL_AVAILABILITY_ESTIMATED"),
        "Overview tab must show occupancy warning"
      );

      const occupancyWarnings = filterWarningsForTab(combinedWarnings, "occupancy");
      assert.ok(
        occupancyWarnings.some((w) => w.code === "HISTORICAL_AVAILABILITY_ESTIMATED"),
        "Occupancy tab must show occupancy warning"
      );
    });

    it("filters out occupancy warning on unrelated operational and reporting tabs", () => {
      const revenueWarnings = filterWarningsForTab(combinedWarnings, "revenue");
      assert.ok(
        !revenueWarnings.some((w) => w.code === "HISTORICAL_AVAILABILITY_ESTIMATED"),
        "Revenue tab must not show occupancy warning"
      );
      assert.ok(
        revenueWarnings.some((w) => w.code === "ESTIMATED_COMMISSION_FALLBACK"),
        "Revenue tab must show revenue-scoped warning"
      );

      const operationsWarnings = filterWarningsForTab(combinedWarnings, "operations");
      assert.ok(
        !operationsWarnings.some((w) => w.code === "HISTORICAL_AVAILABILITY_ESTIMATED"),
        "Operations tab must not show occupancy warning"
      );

      const forecastWarnings = filterWarningsForTab(combinedWarnings, "forecast");
      assert.ok(
        !forecastWarnings.some((w) => w.code === "HISTORICAL_AVAILABILITY_ESTIMATED"),
        "Forecast tab must not show occupancy warning"
      );
      assert.ok(
        forecastWarnings.some((w) => w.code === "CURRENCY_RATE_STALE"),
        "Forecast tab should still show global warning"
      );
    });
  });

  describe("3. Historical Occupancy Handling & Conditionality", () => {
    it("emits historical availability notice when query timeframe includes past dates", async () => {
      const res = await occupancyAnalyticsService.getOccupancyAnalytics({
        period: "30d",
      });

      assert.ok(res.data, "Response data must exist");
      assert.equal(typeof res.data.isHistoricalAvailabilityEstimated, "boolean");

      // For standard 30d window (past 30 days), startDateKey is in the past
      const todayKey = bookingDateKey(new Date());
      const isHistorical = res.timeframe.startDateKey < todayKey;

      if (isHistorical) {
        assert.equal(res.data.isHistoricalAvailabilityEstimated, true);
        const warning = res.dataQualityWarnings.find(
          (w) => w.code === "HISTORICAL_AVAILABILITY_ESTIMATED"
        );
        assert.ok(warning, "Must emit HISTORICAL_AVAILABILITY_ESTIMATED for past dates");
        assert.equal(
          warning?.message,
          "Historical availability data may be incomplete. Some occupancy metrics are estimated."
        );
        assert.deepEqual(warning?.affectedMetrics, ["bookable_nights", "occupancy_rate", "revpar"]);
      }
    });

    it("marks daily points as estimated for past dates and non-estimated for future dates", async () => {
      const res = await occupancyAnalyticsService.getOccupancyAnalytics({
        period: "7d",
      });

      const todayKey = bookingDateKey(new Date());
      for (const pt of res.data.dailyTrends) {
        if (pt.dateKey < todayKey) {
          assert.equal(pt.isEstimated, true, `Date ${pt.dateKey} before today must be marked estimated`);
        } else {
          assert.equal(pt.isEstimated, false, `Date ${pt.dateKey} today or future must not be marked estimated`);
        }
      }
    });

    it("does not emit warning for purely future date ranges", async () => {
      // Query 30 days in the future
      const futureStart = new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10);
      const futureEnd = new Date(Date.now() + 40 * 86400000).toISOString().slice(0, 10);

      const res = await occupancyAnalyticsService.getOccupancyAnalytics({
        startDate: futureStart,
        endDate: futureEnd,
      });

      assert.equal(res.data.isHistoricalAvailabilityEstimated, false);
      const warning = res.dataQualityWarnings.find(
        (w) => w.code === "HISTORICAL_AVAILABILITY_ESTIMATED"
      );
      assert.equal(warning, undefined, "Future date range must not emit historical availability warning");
    });
  });

  describe("4. Overview Service Integration & Anti-Accumulation", () => {
    it("overview service normalizes and returns deduplicated warnings", async () => {
      const overviewRes = await adminAnalyticsOverviewService.getUnifiedOverview({
        period: "30d",
      });

      const codes = overviewRes.dataQualityWarnings.map((w) => w.code);
      const uniqueCodes = new Set(codes);
      assert.equal(codes.length, uniqueCodes.size, "Overview service must not contain duplicate warning codes");
    });
  });

  describe("5. Strict Typography Compliance (GEMINI.md)", () => {
    it("verifies 0 bold font tags or classes in data-quality-banner.tsx", () => {
      const bannerPath = path.join(
        process.cwd(),
        "components/admin/analytics/data-quality-banner.tsx"
      );
      assert.ok(fs.existsSync(bannerPath), "data-quality-banner.tsx must exist");
      const content = fs.readFileSync(bannerPath, "utf-8");

      assert.ok(!content.includes("font-bold"), "Must not contain font-bold");
      assert.ok(!content.includes("font-semibold"), "Must not contain font-semibold");
      assert.ok(!content.includes("<b>"), "Must not contain <b>");
      assert.ok(!content.includes("<strong>"), "Must not contain <strong>");
    });

    it("verifies 0 bold font tags or classes in admin-analytics-hub-client.tsx", () => {
      const hubPath = path.join(
        process.cwd(),
        "components/admin/analytics/admin-analytics-hub-client.tsx"
      );
      const content = fs.readFileSync(hubPath, "utf-8");

      assert.ok(!content.includes("font-bold"), "Must not contain font-bold");
      assert.ok(!content.includes("font-semibold"), "Must not contain font-semibold");
      assert.ok(!content.includes("<b>"), "Must not contain <b>");
      assert.ok(!content.includes("<strong>"), "Must not contain <strong>");
    });
  });

  describe("6. Compact & Professional Banner UI Specifications", () => {
    const bannerPath = path.join(
      process.cwd(),
      "components/admin/analytics/data-quality-banner.tsx"
    );
    const content = fs.readFileSync(bannerPath, "utf-8");

    it("includes required primary text and Marketplace Notice title", () => {
      assert.ok(
        content.includes("Historical availability data may be incomplete. Some occupancy metrics are estimated."),
        "Must contain canonical primary text"
      );
      assert.ok(
        content.includes("Marketplace Notice:"),
        "Must contain Marketplace Notice label"
      );
    });

    it("provides accessible 'View details' and 'Hide details' interactive toggle", () => {
      assert.ok(content.includes("View details"), "Must contain View details label");
      assert.ok(content.includes("Hide details"), "Must contain Hide details label");
      assert.ok(content.includes("aria-expanded"), "Must have aria-expanded attribute");
      assert.ok(content.includes("aria-controls"), "Must have aria-controls attribute");
    });

    it("displays explanation, data limitations, and affected metrics in expandable details", () => {
      assert.ok(content.includes("Why metrics are estimated"), "Must contain estimation reason header");
      assert.ok(content.includes("Historical record limitations"), "Must contain data limitations header");
      assert.ok(content.includes("hasMetrics"), "Must conditionally gate affected metrics");
      assert.ok(content.includes("METRIC_LABELS"), "Must map metrics to human-readable labels");
    });

    it("adheres to compact horizontal layout and amber color scheme", () => {
      assert.ok(content.includes("min-h-[44px]"), "Must set compact minimum height");
      assert.ok(content.includes("bg-amber-50/80"), "Must use subtle amber background");
      assert.ok(content.includes("border-amber-200"), "Must use subtle amber border");
    });
  });
});
