import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  evaluateSuperhostRequirements,
  getNextQuarterlyEvaluationDate,
  getQuarterlySuperhostWindow,
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
});

test("Phase 6: official badge, idempotency, and ownership are wired to persisted backend paths", () => {
  const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
  const engine = read("services/superhost.service.ts");
  const schema = read("prisma/schema.prisma");
  const listingService = read("services/listing.service.ts");

  assert.match(engine, /where: \{ hostId, deletedAt: null \}/, "co-host assignments are excluded from owner scope");
  assert.match(engine, /calculateHostResponseMetrics\(hostId, 12, asOf\)/, "checkpoint evaluations pin the messaging window");
  assert.match(engine, /hostId_evaluationDate/, "quarterly history upsert is idempotent");
  assert.match(engine, /isQuarterlyEvaluationCheckpoint/, "status changes are checkpoint guarded");
  assert.match(schema, /model SuperhostEvaluation/);
  assert.match(schema, /isSuperhost\s+Boolean\s+@default\(false\)/);
  assert.doesNotMatch(listingService, /hasVerifiedSuperhostFlag/, "profile JSON cannot award a badge");
});
