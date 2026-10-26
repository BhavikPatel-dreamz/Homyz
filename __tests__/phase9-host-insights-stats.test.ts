import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Phase 9 stats routes, components, and APIs exist", () => {
  // Nested metric detail page and client
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/(protected)/host/insights/stats/[metric]/page.tsx")));
  assert.ok(
    fs.existsSync(
      path.join(process.cwd(), "app/(protected)/host/insights/stats/[metric]/host-stat-metric-client.tsx"),
    ),
  );

  // Stats tab component
  assert.ok(fs.existsSync(path.join(process.cwd(), "components/host/insights/insights-stats-tab.tsx")));

  // Dedicated stats insights service
  assert.ok(fs.existsSync(path.join(process.cwd(), "services/host-stats-insights.service.ts")));

  // APIs
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/host/insights/stats/route.ts")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/host/insights/stats/[metric]/route.ts")));
});

test("Host Stats Insights Service supports all required primary metrics and calculations", () => {
  const service = read("services/host-stats-insights.service.ts");

  // Overview and detail methods
  assert.match(service, /getStatsOverview\(/);
  assert.match(service, /getMetricDetail\(/);

  // Supported metrics list
  assert.match(service, /"earnings"/);
  assert.match(service, /"views"/);
  assert.match(service, /"bookings"/);
  assert.match(service, /"occupancy"/);
  assert.match(service, /"rates"/);
  assert.match(service, /"conversion"/);
  assert.match(service, /"response-rate"/);
  assert.match(service, /"cancellations"/);
  assert.match(service, /"stay-length"/);

  // Reconciliation with Host Dashboard and Earnings
  assert.match(service, /import \{[\s\S]*?getHostDashboardData[\s\S]*?\} from "@\/services\/host-dashboard\.service"/);
  assert.match(service, /deltaPercentage/);
  assert.match(service, /propertyBreakdown/);
});

test("Stats Main Screen renders complete Airbnb-style performance overview with detail navigation", () => {
  const tab = read("components/host/insights/insights-stats-tab.tsx");
  const overviewStart = tab.indexOf("const quickStatsCards");
  const overviewEnd = tab.indexOf("const detailCards");
  const performanceOverview = tab.slice(overviewStart, overviewEnd);

  // Key hosting metrics header
  assert.match(tab, /Key hosting metrics/);

  // The prominent overview is performance-focused; ratings and earnings stay
  // contextual below it rather than duplicating the general dashboard KPIs.
  for (const label of ["Occupancy", "Bookings", "Average stay", "Response rate", "Listing views", "Booking conversion"]) {
    assert.match(performanceOverview, new RegExp(`label: "${label}"`));
  }
  assert.doesNotMatch(performanceOverview, /Overall rating|Net earnings/);

  // Metric card deep links
  assert.match(tab, /href: "\/host\/insights\/stats\/response-rate"/);
  assert.match(tab, /href: "\/host\/insights\/stats\/earnings"/);
  assert.match(tab, /href: "\/host\/insights\/(?:stats\/views|listing-performance)"/);
  assert.match(tab, /href: "\/host\/insights\/stats\/bookings"/);
  assert.match(tab, /href: "\/host\/insights\/stats\/occupancy"/);
  assert.match(tab, /href: "\/host\/insights\/stats\/rates"/);
  assert.match(tab, /href: "\/host\/insights\/stats\/stay-length"/);
  assert.match(tab, /href: "\/host\/insights\/stats\/cancellations"/);
  assert.match(tab, /href: "\/host\/insights\/(?:stats\/conversion|listing-performance)"/);

  // Integrity disclosure preserved
  assert.match(tab, /Impression & Funnel Tracking Notice/);
  assert.match(tab, /Listing Page Views:/);
  assert.match(tab, /Conversion Rate:/);
});

test("Metric detail screen renders comparisons, charts, property breakdowns, and cross-navigation", () => {
  const page = read("app/(protected)/host/insights/stats/[metric]/page.tsx");
  assert.match(page, /requirePageRole\(\[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(page, /hostStatsInsightsService\.getMetricDetail/);

  const client = read("app/(protected)/host/insights/stats/[metric]/host-stat-metric-client.tsx");
  assert.match(client, /Back to Stats/);
  assert.match(client, /const statsHref/);
  assert.match(client, /params\.set\("tab", "stats"\)/);
  assert.match(client, /Historical Performance Trend/);
  assert.match(client, /Property-level breakdown/);
  assert.match(client, /Supporting data & calculation context/);
  assert.match(client, /data\.action\.href/);
});

test("Stats APIs enforce authentication and Role authorization", () => {
  const statsApi = read("app/api/v1/host/insights/stats/route.ts");
  assert.match(statsApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);

  const metricApi = read("app/api/v1/host/insights/stats/[metric]/route.ts");
  assert.match(metricApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(metricApi, /hostStatsInsightsService\.getMetricDetail/);
});

test("Stats preserve data integrity where historical series are not instrumented", () => {
  const service = read("services/host-stats-insights.service.ts");
  const tab = read("components/host/insights/insights-stats-tab.tsx");
  assert.match(service, /Historical and per-property occupancy series are not yet stored/);
  assert.match(service, /Historical and per-property response series are not stored/);
  assert.match(tab, /viewsTelemetry/);
  assert.match(tab, /analyticsLimitations/);
});
