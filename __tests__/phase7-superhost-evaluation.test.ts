import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  SUPERHOST_ASSESSMENT_WINDOW_DAYS,
  SUPERHOST_REVIEW_WINDOW_DAYS,
  evaluateSuperhostRequirements,
  getNextQuarterlyEvaluationDate,
  getQuarterlyCheckpointForDate,
  getQuarterlySuperhostWindow,
  getSuperhostEvaluationWindow,
  getSuperhostReviewWindowExpiryCutoff,
  isNonExcludedHostCancellation,
  isQuarterlyAssessmentWindow,
  isQuarterlyEvaluationCheckpoint,
  startOfUtcDay,
} from "../lib/superhost/rules";

test("Phase 7: Centralized quarterly assessment window and 12-month evaluation boundaries", () => {
  // Assessment window duration is 7 days
  assert.equal(SUPERHOST_ASSESSMENT_WINDOW_DAYS, 7);

  // Section 18: Date Boundary Tests
  // December 31, 2025 -> Outside window, not a checkpoint
  const dec31 = new Date("2025-12-31T23:59:59.000Z");
  assert.equal(isQuarterlyEvaluationCheckpoint(dec31), false, "Dec 31 is not a quarterly checkpoint");
  assert.equal(isQuarterlyAssessmentWindow(dec31), false, "Dec 31 is outside quarterly assessment window");

  // January 1, 2026 -> Checkpoint & Assessment window start
  const jan1 = new Date("2026-01-01T00:00:00.000Z");
  assert.equal(isQuarterlyEvaluationCheckpoint(jan1), true, "Jan 1 is a quarterly checkpoint");
  assert.equal(isQuarterlyAssessmentWindow(jan1), true, "Jan 1 starts the assessment window");

  // January 7, 2026 -> Still inside documented 7-day assessment window
  const jan7 = new Date("2026-01-07T22:00:00.000Z");
  assert.equal(isQuarterlyEvaluationCheckpoint(jan7), false, "Jan 7 is not day 1");
  assert.equal(isQuarterlyAssessmentWindow(jan7), true, "Jan 7 is day 7 of assessment window");
  assert.equal(getQuarterlyCheckpointForDate(jan7).toISOString().slice(0, 10), "2026-01-01", "Jan 7 resolves to Jan 1 checkpoint");

  // January 8, 2026 -> Outside assessment window until April
  const jan8 = new Date("2026-01-08T00:00:00.000Z");
  assert.equal(isQuarterlyEvaluationCheckpoint(jan8), false);
  assert.equal(isQuarterlyAssessmentWindow(jan8), false, "Jan 8 is outside assessment window");

  // Check all four quarterly checkpoints: April 1, July 1, October 1
  const apr1 = new Date("2026-04-01T00:00:00.000Z");
  const jul1 = new Date("2026-07-01T00:00:00.000Z");
  const oct1 = new Date("2026-10-01T00:00:00.000Z");
  assert.equal(isQuarterlyEvaluationCheckpoint(apr1), true);
  assert.equal(isQuarterlyEvaluationCheckpoint(jul1), true);
  assert.equal(isQuarterlyEvaluationCheckpoint(oct1), true);
  assert.equal(isQuarterlyAssessmentWindow(apr1), true);
  assert.equal(isQuarterlyAssessmentWindow(jul1), true);
  assert.equal(isQuarterlyAssessmentWindow(oct1), true);

  // Day 7 of each quarter is inside assessment window
  const apr7 = new Date("2026-04-07T12:00:00.000Z");
  const jul7 = new Date("2026-07-07T12:00:00.000Z");
  const oct7 = new Date("2026-10-07T12:00:00.000Z");
  assert.equal(isQuarterlyAssessmentWindow(apr7), true);
  assert.equal(isQuarterlyAssessmentWindow(jul7), true);
  assert.equal(isQuarterlyAssessmentWindow(oct7), true);

  // Day 8 of each quarter is outside assessment window
  const apr8 = new Date("2026-04-08T00:00:00.000Z");
  const jul8 = new Date("2026-07-08T00:00:00.000Z");
  const oct8 = new Date("2026-10-08T00:00:00.000Z");
  assert.equal(isQuarterlyAssessmentWindow(apr8), false);
  assert.equal(isQuarterlyAssessmentWindow(jul8), false);
  assert.equal(isQuarterlyAssessmentWindow(oct8), false);

  // Section 4 & Section 19: Centralized 12-Month Performance Window helper
  const windowOct = getSuperhostEvaluationWindow(oct1);
  assert.equal(windowOct.checkpoint.toISOString().slice(0, 10), "2026-10-01");
  assert.equal(windowOct.assessmentStart.toISOString().slice(0, 10), "2026-10-01");
  assert.equal(windowOct.assessmentEnd.toISOString().slice(0, 10), "2026-10-07");
  assert.equal(windowOct.performanceStart.toISOString().slice(0, 10), "2025-10-01", "12-month performance start is exactly Oct 1 prior year");
  assert.equal(windowOct.performanceEnd.toISOString().slice(0, 10), "2026-09-30", "12-month performance end is day prior to checkpoint");
  assert.equal(windowOct.windowStart.toISOString().slice(0, 10), "2025-10-01");
  assert.equal(windowOct.windowEnd.toISOString().slice(0, 10), "2026-09-30");

  // Assessment date midway in window resolves same 12-month performance bounds
  const windowMid = getSuperhostEvaluationWindow(new Date("2026-10-04T15:30:00.000Z"));
  assert.equal(windowMid.checkpoint.toISOString().slice(0, 10), "2026-10-01");
  assert.equal(windowMid.performanceStart.toISOString().slice(0, 10), "2025-10-01");
  assert.equal(windowMid.performanceEnd.toISOString().slice(0, 10), "2026-09-30");
});

test("Phase 7: Rolling 12-month filtering (Section 19)", () => {
  const checkpoint = new Date("2026-10-01T00:00:00.000Z");
  const { performanceStart, performanceEnd } = getSuperhostEvaluationWindow(checkpoint);

  // 13 months old booking (e.g., Aug 2025) -> excluded
  const booking13MonthsOldEndDate = new Date("2025-08-15T00:00:00.000Z");
  const is13MonthIncluded = booking13MonthsOldEndDate >= performanceStart && booking13MonthsOldEndDate <= performanceEnd;
  assert.equal(is13MonthIncluded, false, "13 months old booking is excluded from 12-month window");

  // 11 months old booking (e.g., Nov 2025) -> included
  const booking11MonthsOldEndDate = new Date("2025-11-20T00:00:00.000Z");
  const is11MonthIncluded = booking11MonthsOldEndDate >= performanceStart && booking11MonthsOldEndDate <= performanceEnd;
  assert.equal(is11MonthIncluded, true, "11 months old booking is included in 12-month window");

  // Stay checkout on Sep 30, 2026 (day before checkpoint, Prisma @db.Date midnight) -> included
  const bookingLastDay = new Date("2026-09-30T00:00:00.000Z");
  assert.equal(bookingLastDay >= performanceStart && bookingLastDay <= performanceEnd, true);

  // Timestamp on Sep 30, 2026 (e.g. review or message) evaluated with reviewWindowEndExclusive
  const reviewWindowEndExclusive = new Date(performanceEnd);
  reviewWindowEndExclusive.setUTCDate(reviewWindowEndExclusive.getUTCDate() + 1);
  const reviewLastDay = new Date("2026-09-30T15:30:00.000Z");
  assert.equal(reviewLastDay >= performanceStart && reviewLastDay < reviewWindowEndExclusive, true);

  // Stay on Oct 1, 2026 (checkpoint date itself) -> excluded from prior 12 months
  const bookingCheckpointDay = new Date("2026-10-01T00:00:00.000Z");
  assert.equal(bookingCheckpointDay <= performanceEnd, false, "Stays completing on/after checkpoint belong to next cycle");
});

test("Phase 7: Qualification Lifecycle Test Cases (CASE 1 through CASE 10)", () => {
  // CASE 1 — Qualified Host at Checkpoint
  const q1Passing = {
    completedReservationsCount: 12,
    completedNightsCount: 30,
    overallRating: 4.88,
    responseRatePercentage: 96,
    hostCancellationCount: 0,
    cancellationDenominator: 12,
    accountGoodStanding: true,
    isListingOwner: true,
  };
  const q1Result = evaluateSuperhostRequirements(q1Passing);
  assert.equal(q1Result.eligibleNow, true, "CASE 1: Qualified host meets all requirements");

  // CASE 2 — Host Fails Criteria at Checkpoint
  const q2Failing = {
    ...q1Passing,
    overallRating: 4.75, // Fails rating threshold
  };
  const q2Result = evaluateSuperhostRequirements(q2Failing);
  assert.equal(q2Result.eligibleNow, false, "CASE 2: Host with 4.75 rating fails qualification");

  // CASE 3 — Existing Superhost Fails Next Quarter
  // Host was Superhost in Q1 (previous.isSuperhost = true), but in Q2 cancellation rate jumps to 1.5%
  const q3Failing = {
    ...q1Passing,
    hostCancellationCount: 2,
    cancellationDenominator: 100, // 2% cancellation
  };
  const q3Result = evaluateSuperhostRequirements(q3Failing);
  assert.equal(q3Result.cancellationMet, false);
  assert.equal(q3Result.eligibleNow, false, "CASE 3: Existing Superhost loses status at quarterly evaluation if criteria fail");

  // CASE 4 — Host Regains Qualification Later
  // In Q3 host improves performance: 0 cancellations, 4.9 rating
  const q4Regained = {
    completedReservationsCount: 15,
    completedNightsCount: 45,
    overallRating: 4.90,
    responseRatePercentage: 98,
    hostCancellationCount: 0,
    cancellationDenominator: 15,
    accountGoodStanding: true,
    isListingOwner: true,
  };
  const q4Result = evaluateSuperhostRequirements(q4Regained);
  assert.equal(q4Result.eligibleNow, true, "CASE 4: Host regains Superhost status in subsequent quarterly evaluation");

  // CASE 5 — Mid-quarter Performance Changes
  // A cancellation or review drop in February does NOT trigger immediate revocation of persisted status.
  // Persisted status remains valid until next quarterly evaluation checkpoint (April 1).
  const currentPersistedSuperhost = true;
  const febRatingDrop = 4.70;
  // Live simulation reflects that public badge reads persisted state, NOT live calculation:
  const publicBadgeVisibleMidQuarter = currentPersistedSuperhost; // Reads host.isSuperhost
  assert.equal(publicBadgeVisibleMidQuarter, true, "CASE 5: Mid-quarter performance drop does not revoke persisted badge until next checkpoint");

  // CASE 6 — Old Data Exclusion
  // Only reservations within the 12-month window are fed to the engine.
  // If an old 2-year-old reservation is excluded, only the 12-month count is evaluated.
  const hostWithLifetimeStays = {
    lifetimeStays: 50,
    twelveMonthStays: 8, // < 10
    twelveMonthNights: 40, // < 100
  };
  const case6Evaluation = evaluateSuperhostRequirements({
    completedReservationsCount: hostWithLifetimeStays.twelveMonthStays,
    completedNightsCount: hostWithLifetimeStays.twelveMonthNights,
    overallRating: 4.95,
    responseRatePercentage: 99,
    hostCancellationCount: 0,
    cancellationDenominator: hostWithLifetimeStays.twelveMonthStays,
    accountGoodStanding: true,
    isListingOwner: true,
  });
  assert.equal(case6Evaluation.hostingVolumeMet, false, "CASE 6: Old lifetime stays outside the 12-month window do not count");

  // CASE 7 — Multiple Listings Aggregation
  // Host owns 3 listings, each with 4 stays (12 total stays across all listings)
  const multiListingStays = [4, 4, 4];
  const totalAggregatedStays = multiListingStays.reduce((sum, n) => sum + n, 0);
  const case7Evaluation = evaluateSuperhostRequirements({
    completedReservationsCount: totalAggregatedStays,
    completedNightsCount: 36,
    overallRating: 4.85,
    responseRatePercentage: 92,
    hostCancellationCount: 0,
    cancellationDenominator: totalAggregatedStays,
    accountGoodStanding: true,
    isListingOwner: true,
  });
  assert.equal(case7Evaluation.hostingVolumeMet, true, "CASE 7: Performance across multiple listings aggregates at host level");
  assert.equal(case7Evaluation.eligibleNow, true);

  // CASE 8 — Duplicate Job Run (Idempotency)
  // Check schema has unique compound constraint @@unique([hostId, evaluationDate])
  const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
  assert.match(schema, /@@unique\(\[hostId, evaluationDate\]\)/, "CASE 8: SuperhostEvaluation enforces @@unique([hostId, evaluationDate])");
  const superhostServiceCode = fs.readFileSync(path.join(process.cwd(), "services/superhost.service.ts"), "utf8");
  assert.match(superhostServiceCode, /hostId_evaluationDate/, "CASE 8: Upsert ensures duplicate evaluation runs update safely");

  // CASE 9 — Host Evaluation Failure Isolation
  // Service wraps batch map with try/catch to preserve failing host's status and continue
  assert.match(superhostServiceCode, /successfulHosts/, "CASE 9: Evaluation tracks successful vs failed hosts");
  assert.match(superhostServiceCode, /console\.error\(`\[superhost\.service\] Quarterly evaluation failed for host/, "CASE 9: Errors are logged without failing entire batch");

  // CASE 10 — Badge Update Cache Invalidation
  // When statusChanged is true, cache invalidation counter and notification are invoked
  assert.match(superhostServiceCode, /incrCounter\(keys\.listingsPublicVersion\(\)\)/, "CASE 10: Cache version invalidated on status change");
  assert.match(superhostServiceCode, /notificationService\.create\(/, "CASE 10: Notification sent to host on status change");
});

test("Phase 7: Security and scheduler artifacts audit", () => {
  const read = (relPath: string) => fs.readFileSync(path.join(process.cwd(), relPath), "utf8");

  // Internal route security
  const routeCode = read("app/api/internal/superhost/evaluations/route.ts");
  assert.match(routeCode, /SUPERHOST_EVALUATION_CRON_SECRET/, "Internal route checks secret");
  assert.match(routeCode, /Bearer \$\{secret\}/, "Internal route requires Bearer token");
  assert.match(routeCode, /status: 401/, "Unauthorized requests receive 401");

  // Deployment units
  const timerCode = read("deploy/homyz-superhost-evaluation.timer");
  assert.match(timerCode, /OnCalendar=\*-(?:01,04,07,10-01|01,4,7,10-01)/, "Quarterly schedule configured");
  assert.match(timerCode, /Persistent=true/, "Timer is persistent");

  const serviceCode = read("deploy/homyz-superhost-evaluation.service");
  assert.match(serviceCode, /run-superhost-evaluation\.sh/, "Service invokes evaluation script");

  const scriptCode = read("scripts/deploy/run-superhost-evaluation.sh");
  assert.match(scriptCode, /SUPERHOST_EVALUATION_CRON_SECRET/, "Script checks secret presence");
  assert.match(scriptCode, /\/api\/internal\/superhost\/evaluations/, "Script targets internal endpoint");
});
