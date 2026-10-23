import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Batch 1 records privacy-safe, deduplicated listing funnel events", () => {
  const schema = read("prisma/schema.prisma");
  const service = read("services/listing-analytics.service.ts");
  const route = read("app/api/v1/search/track/route.ts");
  const client = read("lib/analytics/listing-analytics.ts");

  assert.match(schema, /model ListingAnalyticsEvent/);
  assert.match(schema, /@@index\(\[listingId, eventType, occurredAt\]\)/);
  assert.match(service, /sessionHash/);
  assert.match(service, /dedupeKey/);
  assert.match(service, /isObviousBot/);
  assert.match(service, /ATTRIBUTION_WINDOW_MS/);
  assert.match(route, /recordListingAnalyticsEvent/);
  assert.match(client, /homyz_analytics_session/);
});

test("Batch 1 dashboard distinguishes booking activity from stay reporting", () => {
  const dashboard = read("services/host-dashboard.service.ts");
  const dashboardUi = read("components/host/dashboard/host-kpi-overview.tsx");

  assert.match(dashboard, /Booking activity uses the reservation creation timestamp/);
  assert.match(dashboard, /b\.createdAt >= startOfMonth/);
  assert.match(dashboard, /confirmedBookingsCount: allBookings\.filter\([\s\S]*booking\.createdAt/);
  assert.match(dashboard, /getCheckInTrackingStartDate/);
  assert.match(dashboard, /checkInInstructionsViewed/);
  assert.doesNotMatch(dashboardUi, /responseRatePercentage \?\? 0/);
});

test("Batch 1 dashboard avoids unused payment and refund relation payloads", () => {
  const dashboard = read("services/host-dashboard.service.ts");
  const bookingQuery = dashboard.slice(
    dashboard.indexOf("const allBookings = await prisma.booking.findMany"),
    dashboard.indexOf("// Six-month completed-stay analytics"),
  );

  assert.match(bookingQuery, /select: \{/);
  assert.doesNotMatch(bookingQuery, /payments:/);
  assert.doesNotMatch(bookingQuery, /refunds:/);
});
