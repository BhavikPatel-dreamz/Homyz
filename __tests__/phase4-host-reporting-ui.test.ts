import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

test("Dashboard, Earnings, Insights, and core advanced reports use one reporting layout contract", () => {
  const sharedLayout = source("components/host/dashboard/host-reporting-layout.ts");
  assert.match(sharedLayout, /HOST_REPORTING_CONTAINER_CLASS/);
  assert.match(sharedLayout, /max-w-7xl/);

  for (const path of [
    "app/(protected)/host/dashboard/page.tsx",
    "app/(protected)/host/earnings/page.tsx",
    "app/(protected)/host/insights/page.tsx",
    "app/(protected)/host/earnings/analytics/page.tsx",
    "app/(protected)/host/insights/stats/booking-analytics/page.tsx",
  ]) {
    assert.match(source(path), /HOST_REPORTING_CONTAINER_CLASS/);
    assert.match(source(path), /HOST_REPORTING_MAIN_CLASS/);
  }
});

test("Insights filters and drilldowns preserve context with accessible navigation", () => {
  const header = source("components/host/insights/insights-header.tsx");
  const tabs = source("components/host/insights/insights-tab-nav.tsx");
  const bookingAnalytics = source("app/(protected)/host/insights/stats/booking-analytics/host-booking-analytics-client.tsx");
  const listingPerformance = source("app/(protected)/host/insights/listing-performance/host-listing-performance-client.tsx");

  assert.match(header, /PropertySelector/);
  assert.match(header, /Insights reporting period/);
  assert.match(tabs, /role="tablist"/);
  assert.match(tabs, /aria-selected/);
  assert.match(tabs, /focus-visible:outline/);
  assert.match(bookingAnalytics, /aria-label="Breadcrumb"/);
  assert.match(bookingAnalytics, /const statsHref = scoped/);
  assert.match(listingPerformance, /const statsHref/);
  assert.match(listingPerformance, /Insights · Stats/);
});

test("reporting shells retain responsive loading geometry instead of a full-page flash", () => {
  for (const path of [
    "app/(protected)/host/dashboard/loading.tsx",
    "app/(protected)/host/earnings/loading.tsx",
    "app/(protected)/host/insights/loading.tsx",
  ]) {
    const shell = source(path);
    assert.match(shell, /HOST_REPORTING_CONTAINER_CLASS/);
    assert.match(shell, /animate-pulse|HostDashboardOverviewSkeleton/);
  }
});
