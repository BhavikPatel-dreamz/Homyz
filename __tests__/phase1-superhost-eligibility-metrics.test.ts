import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  calculateHostResponseMetricsFromConversations,
} from "../lib/messaging/response-metrics";
import {
  evaluateSuperhostRequirements,
  getQuarterlySuperhostWindow,
  isNonExcludedHostCancellation,
} from "../lib/superhost/rules";

const at = (value: string) => new Date(value);

test("Phase 1: Superhost rating trusts the authoritative published-review release state", () => {
  const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
  const superhost = read("services/superhost.service.ts");
  const reviews = read("services/review.service.ts");

  // Reciprocal submissions at day 7 and day 13 publish immediately in the one
  // authoritative review service, so a PUBLISHED guest review is eligible
  // without a second checkout-age check in Superhost.
  assert.match(reviews, /shouldPublishImmediately = Boolean\(reciprocalReview\)/);
  assert.match(reviews, /initialStatus = shouldPublishImmediately \? ReviewStatus\.PUBLISHED : ReviewStatus\.PRIVATE/);
  assert.match(superhost, /status: ReviewStatus\.PUBLISHED/);
  assert.doesNotMatch(superhost, /reviewWindowExpiryCutoff/);

  // A guest-only review remains PRIVATE before expiry and is therefore absent
  // from the Superhost aggregate; the existing deadline publisher releases it
  // exactly when reviewDeadline <= now.
  assert.match(reviews, /reviewDeadline: \{ lte: now \}/);
  assert.match(reviews, /status: ReviewStatus\.PRIVATE/);
  assert.match(reviews, /data: \{[\s\S]*?status: ReviewStatus\.PUBLISHED/);

  // The schema enforces one guest review and one host review per booking.
  const schema = read("prisma/schema.prisma");
  assert.match(schema, /@@unique\(\[bookingId, direction\]\)/);
});

test("Phase 1: Superhost rating uses completed owned-stay boundaries", () => {
  const window = getQuarterlySuperhostWindow(at("2026-10-01T00:00:00.000Z"));
  assert.equal(window.windowStart.toISOString().slice(0, 10), "2025-10-01");
  assert.equal(window.windowEnd.toISOString().slice(0, 10), "2026-09-30");

  const source = fs.readFileSync(path.join(process.cwd(), "services/superhost.service.ts"), "utf8");
  assert.match(source, /where: \{ hostId, deletedAt: null \}/, "only owned listings are selected");
  assert.match(source, /hostingType === "HOME"/, "experience and service listings are excluded");
  assert.match(source, /endDate: \{ gte: window\.windowStart, lte: window\.windowEnd \}/);

  const multiListingVolume = evaluateSuperhostRequirements({
    completedReservationsCount: 10,
    completedNightsCount: 100,
    overallRating: 4.8,
    responseRatePercentage: 90,
    hostCancellationCount: 0,
    cancellationDenominator: 10,
    accountGoodStanding: true,
    isListingOwner: true,
  });
  assert.equal(multiListingVolume.hostingVolumeMet, true);
  assert.equal(multiListingVolume.eligibleNow, true);

  const coHostOnly = evaluateSuperhostRequirements({
    completedReservationsCount: 10,
    completedNightsCount: 100,
    overallRating: 4.8,
    responseRatePercentage: 90,
    hostCancellationCount: 0,
    cancellationDenominator: 10,
    accountGoodStanding: true,
    isListingOwner: false,
  });
  assert.equal(coHostOnly.eligibleNow, false);
});

test("Phase 1: established response reducer excludes system events and preserves the exact 24-hour edge", () => {
  const hostId = "host-1";
  const guestId = "guest-1";
  const start = at("2026-09-01T10:00:00.000Z");

  const metrics = calculateHostResponseMetricsFromConversations(hostId, [
    {
      guestId,
      messages: [
        { senderId: null, type: "SYSTEM", createdAt: start },
        { senderId: guestId, type: "TEXT", createdAt: start },
        { senderId: guestId, type: "TEXT", createdAt: at("2026-09-01T10:05:00.000Z") },
        { senderId: hostId, type: "TEXT", createdAt: at("2026-09-02T10:00:00.000Z") },
      ],
    },
    {
      guestId: "guest-2",
      messages: [
        { senderId: "guest-2", type: "TEXT", createdAt: start },
        { senderId: hostId, type: "TEXT", createdAt: at("2026-09-02T10:00:00.001Z") },
      ],
    },
  ]);

  assert.equal(metrics.totalGuestInquiries, 2, "one established inquiry is counted per conversation");
  assert.equal(metrics.respondedCount, 2);
  assert.equal(metrics.respondedWithin24hCount, 1, "exactly 24 hours passes; one millisecond later fails");
  assert.equal(metrics.responseRatePercentage, 50);
});

test("Phase 1: host cancellation exclusion cannot be self-supplied by the host cancellation service", () => {
  const bookingService = fs.readFileSync(path.join(process.cwd(), "services/booking.service.ts"), "utf8");
  const hostCancellation = bookingService.match(/async function cancelBookingByHost\([\s\S]*?\n}\n\nasync function listForAdminDashboard/);
  assert.ok(hostCancellation);
  assert.doesNotMatch(hostCancellation![0], /isExcluded = false/, "host cancellation no longer accepts an exclusion argument");
  assert.match(hostCancellation![0], /isExcluded: false/, "ordinary host cancellation is never self-excluded");

  assert.equal(isNonExcludedHostCancellation({ cancellation: { cancelledBy: "GUEST" } }), false);
  assert.equal(isNonExcludedHostCancellation({ cancellation: { cancelledBy: "ADMIN" } }), false);
  assert.equal(isNonExcludedHostCancellation({ cancellation: { cancelledBy: "HOST", isExcluded: false } }), true);
  assert.equal(isNonExcludedHostCancellation({ cancellation: { cancelledBy: "HOST", isExcluded: true } }), false);
});
