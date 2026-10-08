import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  evaluateSuperhostRequirements,
  getNextQuarterlyEvaluationDate,
  getQuarterlySuperhostWindow,
  getSuperhostReviewWindowExpiryCutoff,
  isNonExcludedHostCancellation,
  isQuarterlyEvaluationCheckpoint,
} from "../lib/superhost/rules";

const passing = {
  completedReservationsCount: 10,
  completedNightsCount: 20,
  overallRating: 4.8,
  responseRatePercentage: 90,
  hostCancellationCount: 0,
  cancellationDenominator: 10,
  accountGoodStanding: true,
};

test("Phase 6: documented volume, rating, response, and cancellation boundaries", () => {
  assert.equal(evaluateSuperhostRequirements(passing).eligibleNow, true, "10 reservations passes");
  assert.equal(evaluateSuperhostRequirements({ ...passing, completedReservationsCount: 9, completedNightsCount: 99 }).hostingVolumeMet, false, "9 / <100 fails volume");
  assert.equal(evaluateSuperhostRequirements({ ...passing, completedReservationsCount: 3, completedNightsCount: 100 }).hostingVolumeMet, true, "3 + 100 nights passes volume");
  assert.equal(evaluateSuperhostRequirements({ ...passing, completedReservationsCount: 2, completedNightsCount: 150 }).hostingVolumeMet, false, "2 + 150 nights fails volume");
  assert.equal(evaluateSuperhostRequirements({ ...passing, overallRating: 4.79 }).ratingMet, false);
  assert.equal(evaluateSuperhostRequirements(passing).ratingMet, true, "4.80 passes rating");
  assert.equal(evaluateSuperhostRequirements(passing).responseRateMet, true, "90% passes response");
  assert.equal(evaluateSuperhostRequirements({ ...passing, responseRatePercentage: 89.99 }).responseRateMet, false);
  assert.equal(evaluateSuperhostRequirements({ ...passing, hostCancellationCount: 9, cancellationDenominator: 1000 }).cancellationMet, true, "0.9% passes");
  assert.equal(evaluateSuperhostRequirements({ ...passing, hostCancellationCount: 1, cancellationDenominator: 100 }).cancellationMet, false, "1% fails strictly-less-than threshold");
  assert.equal(evaluateSuperhostRequirements({ ...passing, responseRatePercentage: null }).responseRateMet, false, "no inquiries cannot manufacture a passing rate");
});

test("Phase 6: quarterly dates and prior twelve-month evaluation window are deterministic", () => {
  const octoberCheckpoint = new Date("2026-10-01T12:00:00.000Z");
  assert.equal(isQuarterlyEvaluationCheckpoint(octoberCheckpoint), true);
  assert.equal(isQuarterlyEvaluationCheckpoint(new Date("2026-10-02T00:00:00.000Z")), false);
  const window = getQuarterlySuperhostWindow(octoberCheckpoint);
  assert.equal(window.windowStart.toISOString().slice(0, 10), "2025-10-01");
  assert.equal(window.windowEnd.toISOString().slice(0, 10), "2026-09-30");
  assert.equal(getNextQuarterlyEvaluationDate(octoberCheckpoint).toISOString().slice(0, 10), "2027-01-01");
  assert.equal(
    getSuperhostReviewWindowExpiryCutoff(octoberCheckpoint).toISOString().slice(0, 10),
    "2026-09-17",
    "a guest review without a reciprocal host review waits 14 days",
  );
});

test("Phase 6: official badge, idempotency, and ownership are wired to persisted backend paths", () => {
  const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
  const engine = read("services/superhost.service.ts");
  const schema = read("prisma/schema.prisma");
  const listingService = read("services/listing.service.ts");

  assert.match(engine, /where: \{ hostId, deletedAt: null \}/, "co-host assignments are excluded from owner scope");
  assert.match(engine, /calculateHostResponseMetrics\(hostId, \{/, "checkpoint evaluations pin the messaging window");
  assert.match(engine, /windowEndExclusive: reviewWindowEndExclusive/, "messages share the evaluator's date boundary");
  assert.match(engine, /hostGuestReview: \{ isNot: null \}/, "reciprocal host reviews release guest ratings for Superhost");
  assert.match(engine, /endDate: \{ lte: reviewWindowExpiryCutoff \}/, "guest ratings release after the existing 14-day review window");
  assert.match(engine, /hostId_evaluationDate/, "quarterly history upsert is idempotent");
  assert.match(engine, /isQuarterlyEvaluationCheckpoint/, "status changes are checkpoint guarded");
  assert.match(schema, /model SuperhostEvaluation/);
  assert.match(schema, /isSuperhost\s+Boolean\s+@default\(false\)/);
  assert.doesNotMatch(listingService, /hasVerifiedSuperhostFlag/, "profile JSON cannot award a badge");
});

test("Phase 6: Data accuracy specifications (CASE 1 through CASE 14)", () => {
  // CASE 1: 10 completed reservations, rating 4.9, response 95%, cancellation 0% -> Pass
  const case1 = evaluateSuperhostRequirements({
    completedReservationsCount: 10,
    completedNightsCount: 25,
    overallRating: 4.9,
    responseRatePercentage: 95,
    hostCancellationCount: 0,
    cancellationDenominator: 10,
    accountGoodStanding: true,
    isListingOwner: true,
  });
  assert.equal(case1.eligibleNow, true, "CASE 1: Host with 10 stays, 4.9 rating, 95% response, 0% cancel qualifies");

  // CASE 2: 9 completed reservations, 80 nights -> Hosting volume fails
  const case2 = evaluateSuperhostRequirements({
    completedReservationsCount: 9,
    completedNightsCount: 80,
    overallRating: 4.9,
    responseRatePercentage: 95,
    hostCancellationCount: 0,
    cancellationDenominator: 9,
    accountGoodStanding: true,
    isListingOwner: true,
  });
  assert.equal(case2.hostingVolumeMet, false, "CASE 2: 9 reservations and 80 nights fails volume");
  assert.equal(case2.eligibleNow, false, "CASE 2 fails overall qualification");

  // CASE 3: 3 reservations, 100 nights -> Hosting volume passes
  const case3 = evaluateSuperhostRequirements({
    completedReservationsCount: 3,
    completedNightsCount: 100,
    overallRating: 4.9,
    responseRatePercentage: 95,
    hostCancellationCount: 0,
    cancellationDenominator: 3,
    accountGoodStanding: true,
    isListingOwner: true,
  });
  assert.equal(case3.hostingVolumeMet, true, "CASE 3: 3 reservations and 100 nights passes volume");
  assert.equal(case3.longStayPathMet, true, "CASE 3: longStayPathMet is true");

  // CASE 4: 3 reservations, 99 nights -> Hosting volume fails unless reservation count independently >= 10
  const case4 = evaluateSuperhostRequirements({
    completedReservationsCount: 3,
    completedNightsCount: 99,
    overallRating: 4.9,
    responseRatePercentage: 95,
    hostCancellationCount: 0,
    cancellationDenominator: 3,
    accountGoodStanding: true,
    isListingOwner: true,
  });
  assert.equal(case4.hostingVolumeMet, false, "CASE 4: 3 reservations and 99 nights fails volume");
  assert.equal(case4.longStayPathMet, false, "CASE 4: longStayPathMet is false");

  // CASE 5: Rating = 4.79 -> Fail
  const case5 = evaluateSuperhostRequirements({
    completedReservationsCount: 10,
    completedNightsCount: 20,
    overallRating: 4.79,
    responseRatePercentage: 90,
    hostCancellationCount: 0,
    cancellationDenominator: 10,
    accountGoodStanding: true,
    isListingOwner: true,
  });
  assert.equal(case5.ratingMet, false, "CASE 5: Rating of 4.79 fails requirement");
  assert.equal(case5.eligibleNow, false, "CASE 5 fails overall qualification");

  // CASE 6: Rating = 4.80 -> Pass
  const case6 = evaluateSuperhostRequirements({
    completedReservationsCount: 10,
    completedNightsCount: 20,
    overallRating: 4.80,
    responseRatePercentage: 90,
    hostCancellationCount: 0,
    cancellationDenominator: 10,
    accountGoodStanding: true,
    isListingOwner: true,
  });
  assert.equal(case6.ratingMet, true, "CASE 6: Rating of 4.80 passes requirement");

  // CASE 7: Response rate = 89% -> Fail
  const case7 = evaluateSuperhostRequirements({
    completedReservationsCount: 10,
    completedNightsCount: 20,
    overallRating: 4.85,
    responseRatePercentage: 89,
    hostCancellationCount: 0,
    cancellationDenominator: 10,
    accountGoodStanding: true,
    isListingOwner: true,
  });
  assert.equal(case7.responseRateMet, false, "CASE 7: Response rate of 89% fails requirement");
  assert.equal(case7.eligibleNow, false, "CASE 7 fails overall qualification");

  // CASE 8: Response rate = 90% -> Pass
  const case8 = evaluateSuperhostRequirements({
    completedReservationsCount: 10,
    completedNightsCount: 20,
    overallRating: 4.85,
    responseRatePercentage: 90,
    hostCancellationCount: 0,
    cancellationDenominator: 10,
    accountGoodStanding: true,
    isListingOwner: true,
  });
  assert.equal(case8.responseRateMet, true, "CASE 8: Response rate of 90% passes requirement");

  // CASE 9: Cancellation rate = 0.9% -> Pass
  const case9 = evaluateSuperhostRequirements({
    completedReservationsCount: 991,
    completedNightsCount: 1000,
    overallRating: 4.9,
    responseRatePercentage: 95,
    hostCancellationCount: 9,
    cancellationDenominator: 1000, // 9 / 1000 = 0.9%
    accountGoodStanding: true,
    isListingOwner: true,
  });
  assert.equal(case9.hostCancellationRatePercentage, 0.9, "CASE 9: Rate is 0.9%");
  assert.equal(case9.cancellationMet, true, "CASE 9: Cancellation rate 0.9% passes requirement");

  // CASE 10: Cancellation rate = 1.0% -> Fail because document requires strictly < 1%
  const case10 = evaluateSuperhostRequirements({
    completedReservationsCount: 99,
    completedNightsCount: 100,
    overallRating: 4.9,
    responseRatePercentage: 95,
    hostCancellationCount: 1,
    cancellationDenominator: 100, // 1 / 100 = 1.0%
    accountGoodStanding: true,
    isListingOwner: true,
  });
  assert.equal(case10.hostCancellationRatePercentage, 1.0, "CASE 10: Rate is 1.0%");
  assert.equal(case10.cancellationMet, false, "CASE 10: Cancellation rate 1.0% fails (< 1% requirement)");
  assert.equal(case10.eligibleNow, false, "CASE 10 fails overall qualification");

  // CASE 11: Guest cancellations only -> Do not count as host cancellations
  const guestCancellationBreakdown = {
    cancellation: { cancelledBy: "GUEST", isExcluded: false },
  };
  const isHostCancelFromGuest = isNonExcludedHostCancellation(guestCancellationBreakdown);
  assert.equal(isHostCancelFromGuest, false, "CASE 11: Guest cancellations must not count as host cancellations");

  // CASE 12: Approved disruptive-event cancellation -> Excluded where exception system marks valid
  const excludedDisruptiveCancellation = {
    cancellation: { cancelledBy: "HOST", isExcluded: true, reason: "Major disruptive event" },
  };
  const isHostCancelFromExcluded = isNonExcludedHostCancellation(excludedDisruptiveCancellation);
  assert.equal(isHostCancelFromExcluded, false, "CASE 12: Approved disruptive event / exception cancellations are excluded");

  const nonExcludedHostCancellation = {
    cancellation: { cancelledBy: "HOST", isExcluded: false, reason: "Host personal reason" },
  };
  assert.equal(isNonExcludedHostCancellation(nonExcludedHostCancellation), true, "CASE 12: Non-excluded host cancellation counts");

  // CASE 13: Co-host only -> Not eligible for Superhost evaluation
  const case13 = evaluateSuperhostRequirements({
    completedReservationsCount: 10,
    completedNightsCount: 30,
    overallRating: 4.9,
    responseRatePercentage: 95,
    hostCancellationCount: 0,
    cancellationDenominator: 10,
    accountGoodStanding: true,
    isListingOwner: false,
  });
  assert.equal(case13.isListingOwner, false, "CASE 13: Not listing owner");
  assert.equal(case13.eligibleNow, false, "CASE 13: Co-host only is not eligible for Superhost");
  assert.equal(case13.failureReasons.some((r) => r.includes("listing owner")), true, "CASE 13: Reports listing owner failure reason");

  // CASE 14: Host owns multiple listings -> Performance aggregates at host level
  // Listing A: 6 completed stays, 40 nights
  // Listing B: 4 completed stays, 60 nights
  // Neither listing alone has 10 stays, but aggregated: 10 stays, 100 nights -> qualifies
  const listingAStays = 6;
  const listingBStays = 4;
  const aggregatedStays = listingAStays + listingBStays;
  const listingANights = 40;
  const listingBNights = 60;
  const aggregatedNights = listingANights + listingBNights;

  // Single listing evaluation would fail volume:
  const listingAAlone = evaluateSuperhostRequirements({
    completedReservationsCount: listingAStays,
    completedNightsCount: listingANights,
    overallRating: 4.85,
    responseRatePercentage: 95,
    hostCancellationCount: 0,
    cancellationDenominator: listingAStays,
    accountGoodStanding: true,
    isListingOwner: true,
  });
  assert.equal(listingAAlone.hostingVolumeMet, false, "CASE 14: Listing A alone does not satisfy volume");

  // Aggregated host-level evaluation passes:
  const aggregatedHost = evaluateSuperhostRequirements({
    completedReservationsCount: aggregatedStays,
    completedNightsCount: aggregatedNights,
    overallRating: 4.85,
    responseRatePercentage: 95,
    hostCancellationCount: 0,
    cancellationDenominator: aggregatedStays,
    accountGoodStanding: true,
    isListingOwner: true,
  });
  assert.equal(aggregatedHost.hostingVolumeMet, true, "CASE 14: Multi-listing host aggregated stays (10) satisfies volume");
  assert.equal(aggregatedHost.eligibleNow, true, "CASE 14: Multi-listing host qualifies at host level");
});
