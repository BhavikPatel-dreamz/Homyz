import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { computeBookingStatus } from "@/lib/booking/booking-status";

const source = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), "utf8");

test("standard dashboard only presents an upcoming reservation while it remains confirmed in real time", () => {
  const now = new Date("2026-10-23T12:00:00.000Z");
  const completed = computeBookingStatus({
    dbStatus: "CONFIRMED",
    startDate: "2026-10-20",
    endDate: "2026-10-23",
    checkOutTime: "11:00",
    now,
  });
  const upcoming = computeBookingStatus({
    dbStatus: "CONFIRMED",
    startDate: "2026-10-24",
    endDate: "2026-10-27",
    checkOutTime: "11:00",
    now,
  });

  assert.equal(completed.status, "COMPLETED");
  assert.equal(upcoming.status, "CONFIRMED");

  const dashboardService = source("services/host-dashboard.service.ts");
  assert.match(dashboardService, /futureConfirmedBookings[\s\S]*?computeBookingStatus\([\s\S]*?\.status === "CONFIRMED"/);
});

test("standard dashboard preserves an honest unavailable state for payout and completed-stay averages", () => {
  const overview = source("components/host/dashboard/host-kpi-overview.tsx");
  const dashboardService = source("services/host-dashboard.service.ts");

  assert.match(overview, /hostPayoutCents === null \? "—"/);
  assert.match(overview, /No eligible completed stays/);
  assert.match(overview, /No completed stays/);
  assert.match(overview, /No payout method configured/);
  assert.doesNotMatch(overview, /Configured payout account/);
  assert.match(dashboardService, /hostPayoutCents: null/);
});

test("affected Standard reporting services and review APIs share the actor-scoped listing authorization", () => {
  for (const path of [
    "services/host-guest-insights.service.ts",
    "services/host-opportunities.service.ts",
    "services/host-reviews-insights.service.ts",
  ]) {
    assert.match(source(path), /accessibleHostListingWhere\(actor/);
  }

  const reviewsApi = source("app/api/v1/host/insights/reviews/route.ts");
  const reviewDetailApi = source("app/api/v1/host/insights/reviews/[reviewId]/route.ts");
  const reviewReplyApi = source("app/api/v1/host/insights/reviews/[reviewId]/reply/route.ts");
  assert.match(reviewsApi, /getReviewsOverview\(actor,/);
  assert.match(reviewsApi, /listHostReviews\(actor,/);
  assert.match(reviewDetailApi, /getHostReviewDetails\(actor,/);
  assert.match(reviewReplyApi, /replyToReview\(actor,/);
});

test("check-in engagement has a persisted event, forward-only eligibility boundary, and private dashboard response", () => {
  assert.match(source("app/api/v1/bookings/[id]/check-in-viewed/route.ts"), /recordCheckInViewed/);
  assert.match(source("services/host-guest-insights.service.ts"), /CHECKIN_INSTRUCTIONS_TRACKING_STARTED_AT/);
  assert.match(source("prisma/schema.prisma"), /checkInInstructionsViewedAt DateTime\?/);
  assert.match(source("prisma/migrations/20261022140000_add_checkin_instruction_view_tracking/migration.sql"), /checkInInstructionsViewedAt/);
  assert.match(source("app/api/v1/host/dashboard/route.ts"), /Cache-Control", "private, no-store/);
});
