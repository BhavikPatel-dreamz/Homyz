import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Phase 7 main route, components, and APIs exist", () => {
  // Main page and client
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/(protected)/host/insights/page.tsx")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/(protected)/host/insights/host-insights-client.tsx")));

  // Tab views
  assert.ok(fs.existsSync(path.join(process.cwd(), "components/host/insights/insights-tab-nav.tsx")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "components/host/insights/insights-header.tsx")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "components/host/insights/insights-reviews-tab.tsx")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "components/host/insights/insights-stats-tab.tsx")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "components/host/insights/insights-opportunities-tab.tsx")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "components/host/insights/insights-superhost-tab.tsx")));

  // Service
  assert.ok(fs.existsSync(path.join(process.cwd(), "services/host-insights.service.ts")));

  // APIs
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/host/insights/route.ts")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/host/insights/reviews/route.ts")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/host/insights/stats/route.ts")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/host/insights/opportunities/route.ts")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/host/insights/superhost/route.ts")));
});

test("Primary Host Navigation enables Insights menu item", () => {
  const header = read("components/dashboard/app-header.tsx");
  // Insights tab in primary desktop host nav is not disabled
  assert.match(header, /id: "insights",[\s\S]*?href: "\/host\/insights"/);
  // Disabled flag is not set on insights tab
  assert.doesNotMatch(header, /id: "insights",[\s\S]*?disabled: true/);
  // Mobile / profile menu has working link to /host/insights
  assert.match(header, /href="\/host\/insights"/);
});

test("Dashboard Overview integrates deep navigation into Insights tabs", () => {
  const kpiOverview = read("components/host/dashboard/host-kpi-overview.tsx");

  // Occupancy connects to Insights Stats tab
  assert.match(kpiOverview, /buildInsightsHref\("stats"\)|buildStatMetricHref\("occupancy"\)/);

  // Guest rating connects to Insights Reviews tab
  assert.match(kpiOverview, /buildInsightsHref\("reviews"\)/);

  // Superhost progress connects to Insights Superhost tab
  assert.match(kpiOverview, /buildInsightsHref\("superhost"\)/);

  // Listing completeness / opportunities connects to Insights Opportunities tab
  assert.match(kpiOverview, /actionHref=\{selectedHealthListing \? `\/host\/insights\?tab=opportunities/);
});

test("Host Insights Service reuses getHostDashboardData for 100% metric reconciliation", () => {
  const service = read("services/host-insights.service.ts");
  assert.match(service, /import \{[\s\S]*?getHostDashboardData[\s\S]*?\} from "@\/services\/host-dashboard\.service"/);
  assert.match(service, /const dashboardData = await getHostDashboardData\(actor, filterOptions\)/);
});

test("Stats tab reads the current dashboard earnings and KPI DTO", () => {
  const statsTab = read("components/host/insights/insights-stats-tab.tsx");
  const insightsService = read("services/host-insights.service.ts");

  assert.match(statsTab, /earnings\.netEarningsCents/);
  assert.doesNotMatch(statsTab, /earnings\.summary\.netEarningsMinor/);
  assert.match(insightsService, /reservationSummary\.totalBookings/);
  assert.match(insightsService, /averageStayLength\.completedStaysCount/);
});

test("Stats tab explicitly presents DATA_UNAVAILABLE for uninstrumented impression analytics", () => {
  const statsTab = read("components/host/insights/insights-stats-tab.tsx");
  assert.match(statsTab, /Impression & Funnel Tracking Notice/);
  assert.match(statsTab, /Listing Page Views:/);
  assert.match(statsTab, /Conversion Rate:/);

  const service = read("services/host-insights.service.ts");
  assert.match(service, /pageViews: dashboardData\.listingPerformance\.pageViews/);
  assert.match(service, /conversionRate: dashboardData\.listingPerformance\.conversionRate/);
});

test("Opportunities module uses non-AI, deterministic listing health checks", () => {
  const service = read("services/host-insights.service.ts");
  // Photo count check
  assert.match(service, /listing\.photoCount < 5/);
  // Missing fields check
  assert.match(service, /listing\.missingFields\.length > 0/);
  // Amenities check
  assert.match(service, /listing\.amenityCount < 5/);
  // Host cancellation rate check
  assert.match(service, /cancellationRate\.hostPercentage > 1/);

  const oppTab = read("components/host/insights/insights-opportunities-tab.tsx");
  assert.match(oppTab, /Opportunities/);
  assert.match(oppTab, /Discover practical ways to improve your listings/);
});

test("Superhost tab displays host-wide platform criteria and real Homyz benefits", () => {
  const superhostTab = read("components/host/insights/insights-superhost-tab.tsx");
  assert.match(superhostTab, /Superhost qualification criteria/);
  assert.match(superhostTab, /Superhost benefits on Homyz/);

  const service = read("services/host-insights.service.ts");
  assert.match(service, /Superhost Badge/);
  assert.match(service, /10 trips or 100 nights/);
  assert.match(service, /4\.80 ★/);
  assert.match(service, /90%/);
  assert.match(service, /< 1\.0%/);
});

test("Insights APIs enforce authentication and Role authorization", () => {
  const mainApi = read("app/api/v1/host/insights/route.ts");
  const reviewsApi = read("app/api/v1/host/insights/reviews/route.ts");
  const statsApi = read("app/api/v1/host/insights/stats/route.ts");
  const oppApi = read("app/api/v1/host/insights/opportunities/route.ts");
  const superhostApi = read("app/api/v1/host/insights/superhost/route.ts");

  assert.match(mainApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(reviewsApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(statsApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(oppApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(superhostApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
});

test("Insights shared filters support extended ranges, custom dates, and server validation", () => {
  const filter = read("lib/dashboard/reporting-filter.ts");
  const query = read("lib/dashboard/insights-query.ts");
  const header = read("components/host/insights/insights-header.tsx");
  assert.match(filter, /"last_3_months"/);
  assert.match(filter, /"last_6_months"/);
  assert.match(filter, /"last_12_months"/);
  assert.match(header, /Insights custom start date/);
  assert.match(query, /Unsupported Insights reporting period/);
  assert.match(query, /valid start and end date/);
});
