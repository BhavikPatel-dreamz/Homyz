import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Host Earnings & Insights read homyz_display_currency cookie with SAR fallback", () => {
  const earningsPage = read("app/(protected)/host/earnings/page.tsx");
  const earningsApi = read("app/api/v1/host/earnings/route.ts");
  const insightsPage = read("app/(protected)/host/insights/page.tsx");
  const insightsApi = read("app/api/v1/host/insights/route.ts");
  const metricPage = read("app/(protected)/host/insights/stats/[metric]/page.tsx");
  const metricApi = read("app/api/v1/host/insights/stats/[metric]/route.ts");
  const reportsPage = read("app/(protected)/host/earnings/reports/page.tsx");

  assert.match(earningsPage, /homyz_display_currency/);
  assert.match(earningsPage, /"SAR"/);

  assert.match(earningsApi, /homyz_display_currency/);
  assert.match(earningsApi, /"SAR"/);

  assert.match(insightsPage, /homyz_display_currency/);
  assert.match(insightsPage, /"SAR"/);

  assert.match(insightsApi, /homyz_display_currency/);
  assert.match(insightsApi, /"SAR"/);

  assert.match(metricPage, /homyz_display_currency/);
  assert.match(metricPage, /"SAR"/);

  assert.match(metricApi, /homyz_display_currency/);
  assert.match(metricApi, /"SAR"/);

  assert.match(reportsPage, /homyz_display_currency/);
  assert.match(reportsPage, /"SAR"/);
});

test("Backend services avoid alphabetical AED trap and default to SAR or requested currency", () => {
  const payoutService = read("services/payout.service.ts");
  const dashboardService = read("services/host-dashboard.service.ts");
  const reportingService = read("services/host-reporting.service.ts");

  // Payout service should prefer SAR over totalsByCurrency[0]
  assert.match(payoutService, /totals\.has\("SAR"\)\s*\?\s*"SAR"/);

  // Host dashboard service should prefer requestedCurrency or SAR over availableCurrencies[0]
  assert.match(dashboardService, /requestedCurrency === "SAR" \|\| availableCurrencies\.includes\("SAR"\)/);

  // Host reporting service should prefer SAR over currencies[0]
  assert.match(reportingService, /currencies\.includes\("SAR"\)\s*\?\s*"SAR"/);
});

test("Client components subscribe to useCurrency() for real-time currency sync", () => {
  const earningsClient = read("app/(protected)/host/earnings/host-earnings-client.tsx");
  const insightsClient = read("app/(protected)/host/insights/host-insights-client.tsx");
  const metricClient = read("app/(protected)/host/insights/stats/[metric]/host-stat-metric-client.tsx");
  const transactionsClient = read("app/(protected)/host/earnings/host-transactions-client.tsx");

  assert.match(earningsClient, /useCurrency/);
  assert.match(earningsClient, /globalDisplayCurrency/);

  assert.match(insightsClient, /useCurrency/);
  assert.match(insightsClient, /globalDisplayCurrency/);

  assert.match(metricClient, /useCurrency/);
  assert.match(metricClient, /globalDisplayCurrency/);

  assert.match(transactionsClient, /useCurrency/);
  assert.match(transactionsClient, /globalDisplayCurrency/);
});

