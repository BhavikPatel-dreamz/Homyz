import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Phase 10 guest insight routes, components, and APIs exist", () => {
  // Main guest insights page and client
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/(protected)/host/insights/stats/guests/page.tsx")));
  assert.ok(
    fs.existsSync(
      path.join(process.cwd(), "app/(protected)/host/insights/stats/guests/host-guest-insights-client.tsx"),
    ),
  );

  // Nested detail screens
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/(protected)/host/insights/stats/guests/origins/page.tsx")));
  assert.ok(
    fs.existsSync(
      path.join(process.cwd(), "app/(protected)/host/insights/stats/guests/origins/host-guest-origins-client.tsx"),
    ),
  );
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/(protected)/host/insights/stats/guests/returning/page.tsx")));
  assert.ok(
    fs.existsSync(
      path.join(process.cwd(), "app/(protected)/host/insights/stats/guests/returning/host-returning-guests-client.tsx"),
    ),
  );
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/(protected)/host/insights/stats/guests/check-in/page.tsx")));
  assert.ok(
    fs.existsSync(
      path.join(process.cwd(), "app/(protected)/host/insights/stats/guests/check-in/host-checkin-engagement-client.tsx"),
    ),
  );

  // Dedicated guest insights service
  assert.ok(fs.existsSync(path.join(process.cwd(), "services/host-guest-insights.service.ts")));

  // APIs
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/host/insights/guests/route.ts")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/host/insights/guests/origins/route.ts")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/host/insights/guests/returning/route.ts")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/host/insights/guests/check-in/route.ts")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/bookings/[id]/check-in-viewed/route.ts")));
});

test("Host Guest Insights Service aggregates real guest data and reconciles with Dashboard", () => {
  const service = read("services/host-guest-insights.service.ts");

  // Reconciles with getHostDashboardData
  assert.match(service, /import \{[\s\S]*?getHostDashboardData[\s\S]*?\} from "@\/services\/host-dashboard\.service"/);
  assert.match(service, /getGuestInsightsOverview\(/);
  assert.match(service, /recordCheckInViewed\(/);

  // Origins and city aggregation
  assert.match(service, /topCities/);
  assert.match(service, /sharePercentage/);

  // Returning guest calculations
  assert.match(service, /returningGuests/);
  assert.match(service, /firstTimeGuests/);
  assert.match(service, /repeatStayBreakdown/);

  // Check-in tracking
  assert.match(service, /checkInEngagement/);
  assert.match(service, /eligibleReservationsCount/);
  assert.match(service, /viewedPercentage/);
});

test("Guest Insights UI implements Airbnb-style summary, origin rankings, cohort charts, and check-in engagement", () => {
  const client = read("app/(protected)/host/insights/stats/guests/host-guest-insights-client.tsx");

  // Page header
  assert.match(client, /Guest Insights/);
  assert.match(client, /Understand where your guests come from/);

  // 5 Summary metrics
  assert.match(client, /Total Unique Guests/);
  assert.match(client, /Origin Countries/);
  assert.match(client, /Returning Guests/);
  assert.match(client, /Average Rating/);
  assert.match(client, /Check-in Viewed/);

  // Deep links to nested detail screens
  assert.match(client, /withCurrentFilters\("\/host\/insights\/stats\/guests\/origins"\)/);
  assert.match(client, /withCurrentFilters\("\/host\/insights\/stats\/guests\/returning"\)/);
  assert.match(client, /withCurrentFilters\("\/host\/insights\/stats\/guests\/check-in"\)/);
  assert.match(client, /withCurrentFilters\("\/host\/insights\?tab=reviews"\)/);
});

test("Dashboard Integration connects widgets to deep Insights detail screens", () => {
  const dashboard = read("components/host/dashboard/host-kpi-overview.tsx");

  assert.match(dashboard, /href="\/host\/insights\/stats\/guests\/origins"/);
  assert.match(dashboard, /href="\/host\/insights\/stats\/guests\/returning"/);
  assert.match(dashboard, /href="\/host\/insights\?tab=reviews"/);
  assert.match(dashboard, /href="\/host\/insights\/stats\/guests\/check-in"/);
});

test("Guest APIs enforce authentication and Role authorization", () => {
  const guestsApi = read("app/api/v1/host/insights/guests/route.ts");
  assert.match(guestsApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);

  const originsApi = read("app/api/v1/host/insights/guests/origins/route.ts");
  assert.match(originsApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);

  const returningApi = read("app/api/v1/host/insights/guests/returning/route.ts");
  assert.match(returningApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);

  const checkinApi = read("app/api/v1/host/insights/guests/check-in/route.ts");
  assert.match(checkinApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);

  const checkinViewedApi = read("app/api/v1/bookings/[id]/check-in-viewed/route.ts");
  assert.match(checkinViewedApi, /requireApiAuth\(req\)/);
  assert.match(checkinViewedApi, /booking\.userId !== actor\.id/);
});

test("Guest metrics use durable events, validated filters, and real cohorts", () => {
  const service = read("services/host-guest-insights.service.ts");
  const schema = read("prisma/schema.prisma");
  const guestsApi = read("app/api/v1/host/insights/guests/route.ts");

  assert.match(schema, /checkInInstructionsViewedAt\s+DateTime\?/);
  assert.match(service, /checkInInstructionsViewedAt: new Date\(\)/);
  assert.doesNotMatch(service, /CHECKIN_VIEW_NS|getCache|setCache/);
  assert.match(service, /guestStayCounts/);
  assert.doesNotMatch(service, /returningGuests \* 0\.75|estReturning/);
  assert.match(guestsApi, /parseInsightsReportingFilters/);
});
