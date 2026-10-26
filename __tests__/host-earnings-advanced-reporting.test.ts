import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  resolveTimeframeBounds,
  resolveComparisonPeriod,
  calculateDelta,
} from "@/lib/dashboard/reporting-filter";

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("1. Earnings header removes settlement currency dropdown and payout methods button", () => {
  const earningsClient = read("app/(protected)/host/earnings/host-earnings-client.tsx");

  // In the top bar header, neither Settlement currency select nor Payout methods button is present
  assert.doesNotMatch(
    earningsClient,
    /<label className="[^"]*">\s*Settlement currency/i,
    "Settlement currency dropdown should be removed from Earnings header",
  );
  assert.doesNotMatch(
    earningsClient,
    /<header[\s\S]*?<button[^>]*>\s*Payout methods\s*<\/button>[\s\S]*?<\/header>/i,
    "Payout methods button should be removed from Earnings main header",
  );

  // PropertySelector and DatePeriodPicker and Compare Periods button are present in header
  assert.match(earningsClient, /<PropertySelector/);
  assert.match(earningsClient, /<DatePeriodPicker/);
  assert.match(earningsClient, /Compare Periods/);
});

test("2. Timeframe resolution correctly handles Daily, Weekly, Monthly, Quarterly, Yearly, and Custom", () => {
  const refDate = new Date(Date.UTC(2026, 9, 22, 12, 0, 0)); // Oct 22, 2026 (Thursday)

  // Daily
  const daily = resolveTimeframeBounds({ timeframe: "daily", date: "2026-10-22" }, refDate);
  assert.equal(daily.timeframe, "daily");
  assert.equal(daily.startDateKey, "2026-10-22");
  assert.equal(daily.endDateKey, "2026-10-22");
  assert.equal(daily.comparisonStartDateKey, "2026-10-21");
  assert.equal(daily.comparisonEndDateKey, "2026-10-21");
  assert.equal(daily.durationDays, 1);

  // Weekly (Monday Oct 19 to Sunday Oct 25)
  const weekly = resolveTimeframeBounds({ timeframe: "weekly", date: "2026-10-22" }, refDate);
  assert.equal(weekly.timeframe, "weekly");
  assert.equal(weekly.startDateKey, "2026-10-19");
  assert.equal(weekly.endDateKey, "2026-10-25");
  assert.equal(weekly.comparisonStartDateKey, "2026-10-12");
  assert.equal(weekly.comparisonEndDateKey, "2026-10-18");
  assert.equal(weekly.durationDays, 7);

  // Monthly (October 2026)
  const monthly = resolveTimeframeBounds({ timeframe: "monthly", month: 10, year: 2026 }, refDate);
  assert.equal(monthly.timeframe, "monthly");
  assert.equal(monthly.startDateKey, "2026-10-01");
  // The selected current month is comparable only through the configured as-of
  // date; it must not silently use a complete prior month.
  assert.equal(monthly.endDateKey, "2026-10-22");
  assert.equal(monthly.comparisonStartDateKey, "2026-09-01");
  assert.equal(monthly.comparisonEndDateKey, "2026-09-22");
  assert.equal(monthly.durationDays, 22);

  // Quarterly (Q4 2026 -> Oct 1 to Dec 31)
  const quarterly = resolveTimeframeBounds({ timeframe: "quarterly", quarter: 4, year: 2026 }, refDate);
  assert.equal(quarterly.timeframe, "quarterly");
  assert.equal(quarterly.startDateKey, "2026-10-01");
  assert.equal(quarterly.endDateKey, "2026-12-31");
  assert.equal(quarterly.comparisonStartDateKey, "2026-07-01");
  assert.equal(quarterly.comparisonEndDateKey, "2026-09-30");

  // Yearly (2026 -> Jan 1 to Dec 31)
  const yearly = resolveTimeframeBounds({ timeframe: "yearly", year: 2026 }, refDate);
  assert.equal(yearly.timeframe, "yearly");
  assert.equal(yearly.startDateKey, "2026-01-01");
  assert.equal(yearly.endDateKey, "2026-12-31");
  assert.equal(yearly.comparisonStartDateKey, "2025-01-01");
  assert.equal(yearly.comparisonEndDateKey, "2025-12-31");

  // Custom (2026-10-05 to 2026-10-15)
  const custom = resolveTimeframeBounds({ timeframe: "custom", startDate: "2026-10-05", endDate: "2026-10-15" }, refDate);
  assert.equal(custom.timeframe, "custom");
  assert.equal(custom.startDateKey, "2026-10-05");
  assert.equal(custom.endDateKey, "2026-10-15");
  assert.equal(custom.durationDays, 11);
});

test("2b. Explicit Earnings comparison periods preserve UTC calendar boundaries", () => {
  const refDate = new Date(Date.UTC(2026, 9, 26, 12, 0, 0));
  const october = resolveTimeframeBounds({ timeframe: "monthly", month: 10, year: 2026 }, refDate);
  const priorPeriod = resolveComparisonPeriod(october, "prior_period");
  assert.deepEqual(priorPeriod, {
    startDateKey: "2026-09-01",
    endDateKey: "2026-09-26",
    label: "Sep 1, 2026 – Sep 26, 2026",
  });

  const priorYear = resolveComparisonPeriod(october, "prior_year");
  assert.equal(priorYear.startDateKey, "2025-10-01");
  assert.equal(priorYear.endDateKey, "2025-10-26");

  const custom = resolveTimeframeBounds({ timeframe: "custom", startDate: "2026-10-10", endDate: "2026-10-20" }, refDate);
  assert.deepEqual(resolveComparisonPeriod(custom, "prior_period"), {
    startDateKey: "2026-09-29",
    endDateKey: "2026-10-09",
    label: "Sep 29, 2026 – Oct 9, 2026",
  });

  const leapPrimary = resolveTimeframeBounds({ timeframe: "daily", date: "2024-02-29" }, refDate);
  const leapPriorYear = resolveComparisonPeriod(leapPrimary, "prior_year");
  assert.equal(leapPriorYear.startDateKey, "2023-02-28");
  assert.equal(leapPriorYear.endDateKey, "2023-02-28");
});

test("3. Period comparison delta calculation is mathematically safe with zero baselines", () => {
  // Normal increase
  const inc = calculateDelta(15000, 10000);
  assert.equal(inc.delta, 5000);
  assert.equal(inc.deltaPercentage, 50);
  assert.equal(inc.deltaDirection, "increase");

  // Normal decrease
  const dec = calculateDelta(8000, 10000);
  assert.equal(dec.delta, -2000);
  assert.equal(dec.deltaPercentage, -20);
  assert.equal(dec.deltaDirection, "decrease");

  // Both zero
  const zeroBoth = calculateDelta(0, 0);
  assert.equal(zeroBoth.delta, 0);
  assert.equal(zeroBoth.deltaPercentage, 0);
  assert.equal(zeroBoth.deltaDirection, "neutral");

  // Previous was zero (no division by zero error)
  const zeroPrev = calculateDelta(5000, 0);
  assert.equal(zeroPrev.delta, 5000);
  assert.equal(zeroPrev.deltaPercentage, null);
  assert.equal(zeroPrev.deltaDirection, "increase");
});

test("4. Earnings layout renders visual chart ABOVE numerical KPI cards", () => {
  const earningsClient = read("app/(protected)/host/earnings/host-earnings-client.tsx");

  const chartSectionIdx = earningsClient.indexOf("Section B: Main Earnings Chart");
  const kpiSectionIdx = earningsClient.indexOf("Section C: Earnings Numerical KPI Cards");

  assert.ok(chartSectionIdx !== -1, "Section B chart must be present");
  assert.ok(kpiSectionIdx !== -1, "Section C KPI cards must be present");
  assert.ok(
    chartSectionIdx < kpiSectionIdx,
    "Main Earnings Chart must be rendered ABOVE the numerical KPI cards",
  );
});

test("5. Insights Stats layout renders Hosting Performance chart ABOVE key hosting metrics cards", () => {
  const statsTab = read("components/host/insights/insights-stats-tab.tsx");

  const chartIdx = statsTab.indexOf("Hosting Performance");
  const cardsIdx = statsTab.indexOf("Key hosting metrics");

  assert.ok(chartIdx !== -1, "Hosting Performance chart must be present");
  assert.ok(cardsIdx !== -1, "Key hosting metrics cards must be present");
  assert.ok(
    chartIdx < cardsIdx,
    "Hosting Performance chart must appear ABOVE the Key hosting metrics cards",
  );
});

test("6. PropertySelector, DatePeriodPicker, and PeriodComparisonModal components exist and export cleanly", () => {
  assert.ok(fs.existsSync(path.join(process.cwd(), "components/host/reporting/property-selector.tsx")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "components/host/reporting/date-period-picker.tsx")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "components/host/reporting/period-comparison-modal.tsx")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "components/host/reporting/earnings-interactive-chart.tsx")));

  const propSel = read("components/host/reporting/property-selector.tsx");
  assert.match(propSel, /export function PropertySelector/);
  assert.match(propSel, /All listings/);
  assert.match(propSel, /Search property/);

  const datePicker = read("components/host/reporting/date-period-picker.tsx");
  assert.match(datePicker, /export function DatePeriodPicker/);
  assert.match(datePicker, /daily/);
  assert.match(datePicker, /weekly/);
  assert.match(datePicker, /monthly/);
  assert.match(datePicker, /quarterly/);
  assert.match(datePicker, /yearly/);
  assert.match(datePicker, /custom/);

  const compModal = read("components/host/reporting/period-comparison-modal.tsx");
  assert.match(compModal, /export function PeriodComparisonModal/);
  assert.match(compModal, /Compare Reporting Periods/);
});

test("7. Payout service supports timeframe querying and returns comparison payload", () => {
  const service = read("services/payout.service.ts");
  assert.match(service, /timeframeBounds/);
  assert.match(service, /compBounds/);
  assert.match(service, /comparisonData/);
  assert.match(service, /activePoints/);
});

test("8. Backend time-series chart points populate unconditionally for requested currency and reconcile with KPI", () => {
  const service = read("services/payout.service.ts");

  // Chart point structure has full metadata
  assert.match(service, /export interface HostEarningsChartPoint/);
  assert.match(service, /netEarnings:\s*number/);
  assert.match(service, /grossEarnings:\s*number/);
  assert.match(service, /platformFee:\s*number/);
  assert.match(service, /completedStaysCount:\s*number/);
  assert.match(service, /propertyBreakdown:\s*HostEarningsChartPropertyItem\[\]/);

  // activePoints must be populated unconditionally for chartCurrency (no if (!reportingCurrency && chartCurrency) trap)
  assert.doesNotMatch(
    service,
    /if\s*\(\s*!reportingCurrency\s*&&\s*chartCurrency\s*\)/,
    "chart population must not be conditionally skipped when reportingCurrency is provided",
  );

  // Both pt.netEarnings and pt.amount are populated alongside pt.grossEarnings
  assert.match(service, /pt\.netEarnings\s*\+=\s*calc\.netPayout/);
  assert.match(service, /pt\.grossEarnings\s*\+=\s*calc\.grossEarnings/);
  assert.match(service, /pt\.platformFee\s*\+=\s*calc\.platformFee/);
  assert.match(service, /pt\.completedStaysCount\s*\+=\s*1/);
});

test("9. Earnings interactive chart provides metric selector (Net, Gross, Fees), Y-axis ticks, and gridlines", () => {
  const chartCode = read("components/host/reporting/earnings-interactive-chart.tsx");

  // Recharts chart library integration
  assert.match(chartCode, /ResponsiveContainer/);
  assert.match(chartCode, /BarChart/);
  assert.match(chartCode, /CartesianGrid/);

  // Metric selector tabs
  assert.match(chartCode, /Net Earnings/);
  assert.match(chartCode, /Gross Earnings/);
  assert.match(chartCode, /Service Fees/);

  // Y-axis compact formatting
  assert.match(chartCode, /fmtCompact/);
  assert.match(chartCode, /yTicks/);
});

test("10. Earnings interactive chart implements floating rich tooltip and clickable bar details panel with View Transactions", () => {
  const chartCode = read("components/host/reporting/earnings-interactive-chart.tsx");

  // Floating rich tooltip with all financial fields
  assert.match(chartCode, /Net Host Earnings:/);
  assert.match(chartCode, /grossLabel/);
  assert.match(chartCode, /Host Service Fees:/);
  assert.match(chartCode, /Completed Stays:/);

  // Clickable period details panel below chart
  assert.match(chartCode, /Period Earnings Breakdown/);
  assert.match(chartCode, /View Transactions/);
  assert.match(chartCode, /host\/earnings\/paid\?datePreset=custom/);
  assert.match(chartCode, /Earnings by Property/);
});
