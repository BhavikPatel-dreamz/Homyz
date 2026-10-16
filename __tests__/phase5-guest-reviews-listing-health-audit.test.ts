import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

const dashboardService = read("services/host-dashboard.service.ts");
const messagingService = read("services/messaging.service.ts");
const dashboardUi = read("components/host/dashboard/host-kpi-overview.tsx");

test("Phase 5: guest analytics use completed stays and coarse location only", () => {
  assert.match(dashboardService, /statusDetail\.status === "COMPLETED"[\s\S]*completedGuestStaysCount\+\+/);
  assert.match(dashboardService, /const city = typeof address\?\.city === "string"/);
  assert.match(dashboardService, /staysWithoutRecordedOriginCount\+\+/);
  assert.match(dashboardService, /guestBookingCounts\.set\(b\.userId/);
  assert.match(dashboardService, /count >= 2/);
  assert.match(dashboardService, /guestOrigins/);
});

test("Phase 5: published reviews provide rating breakdown, trend, and recent reviews", () => {
  assert.match(dashboardService, /status: "PUBLISHED" as const/);
  assert.match(dashboardService, /ratingDistribution/);
  assert.match(dashboardService, /cleanlinessRating/);
  assert.match(dashboardService, /reviewTrendMap/);
  assert.match(dashboardService, /take: 5/);
  assert.match(dashboardService, /recentReviews: recentReviews\.map/);
  assert.match(dashboardUi, /Reviews and ratings/);
});

test("Phase 5: no inquiries are not represented as a perfect response rate", () => {
  assert.match(messagingService, /responseRatePercentage: number \| null/);
  assert.match(messagingService, /:\s*null;/);
  assert.match(messagingService, /m\.senderId === conv\.guestId/);
  assert.match(dashboardUi, /No inquiries yet/);
});

test("Phase 5: listing health is a deterministic checklist, not an opaque score", () => {
  assert.match(dashboardService, /const checks = \[/);
  assert.match(dashboardService, /at least one photo/);
  assert.match(dashboardService, /a nightly price/);
  assert.match(dashboardService, /check-in instructions/);
  assert.match(dashboardService, /missingFields/);
  assert.match(dashboardUi, /Listing health/);
});

