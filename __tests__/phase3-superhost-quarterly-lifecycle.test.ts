import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { resolveSuperhostLifecycleTransition } from "../lib/superhost/lifecycle";
import { evaluateSuperhostRequirements } from "../lib/superhost/rules";

const checkpoint = new Date("2026-10-01T00:00:00.000Z");
const qualifiedAt = new Date("2026-07-01T00:00:00.000Z");
const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Phase 3: first qualification, renewal, and confirmed failure use deterministic lifecycle transitions", () => {
  const firstQualification = resolveSuperhostLifecycleTransition({
    previousOfficialStatus: false,
    previousQualifiedAt: null,
    eligibilityStatus: "ELIGIBLE",
    eligibleNow: true,
    checkpoint,
  });
  assert.deepEqual(firstQualification, {
    appliesOfficialStatus: true,
    officialStatus: true,
    qualifiedAt: checkpoint,
  });

  const renewal = resolveSuperhostLifecycleTransition({
    previousOfficialStatus: true,
    previousQualifiedAt: qualifiedAt,
    eligibilityStatus: "ELIGIBLE",
    eligibleNow: true,
    checkpoint,
  });
  assert.deepEqual(renewal, {
    appliesOfficialStatus: true,
    officialStatus: true,
    qualifiedAt,
  });

  const confirmedFailure = resolveSuperhostLifecycleTransition({
    previousOfficialStatus: true,
    previousQualifiedAt: qualifiedAt,
    eligibilityStatus: "NOT_ELIGIBLE",
    eligibleNow: false,
    checkpoint,
  });
  assert.deepEqual(confirmedFailure, {
    appliesOfficialStatus: true,
    officialStatus: false,
    qualifiedAt: null,
  });
});

test("Phase 3: a blocked assessment never grants or revokes an existing badge", () => {
  const preserved = resolveSuperhostLifecycleTransition({
    previousOfficialStatus: true,
    previousQualifiedAt: qualifiedAt,
    eligibilityStatus: "CANNOT_DETERMINE",
    eligibleNow: false,
    checkpoint,
  });
  assert.deepEqual(preserved, {
    appliesOfficialStatus: false,
    officialStatus: true,
    qualifiedAt,
  });

  const blockedQualification = evaluateSuperhostRequirements({
    completedReservationsCount: 10,
    completedNightsCount: 10,
    overallRating: 4.9,
    responseRatePercentage: 95,
    hostCancellationCount: 0,
    cancellationDenominator: 10,
    accountGoodStanding: true,
    accountStatus: "ACTIVE",
    cancellationExceptionVerificationState: "UNVERIFIED",
  });
  assert.equal(blockedQualification.qualification.eligibilityStatus, "CANNOT_DETERMINE");
  assert.equal(blockedQualification.eligibleNow, false);
});

test("Phase 3: immutable history, transaction boundaries, and concurrent reruns are guarded", () => {
  const service = read("services/superhost.service.ts");
  const schema = read("prisma/schema.prisma");

  assert.match(schema, /@@unique\(\[hostId, evaluationDate\]\)/, "only one history row exists per host and quarter");
  assert.match(service, /prisma\.\$transaction/, "history and status write are atomic");
  assert.match(service, /superhostEvaluation\.findUnique/, "ordinary reruns use existing immutable history");
  assert.match(service, /if \(existing\) return \{ history: existing, finalized: false \}/, "completed histories are not overwritten");
  assert.match(service, /code !== "P2002"/, "simultaneous unique-key conflicts are handled as idempotent reruns");
  assert.match(service, /if \(!existing\) throw error/, "only the expected concurrent assessment conflict is recovered");
  assert.match(service, /resolveSuperhostLifecycleTransition/, "the persisted badge transition uses the centralized lifecycle policy");
  assert.match(service, /qualification\.eligibilityStatus/, "blocked status is considered before a badge transition");
});

test("Phase 3: scheduler, protected execution, admin retry, and failure isolation reuse existing infrastructure", () => {
  const internalRoute = read("app/api/internal/superhost/evaluations/route.ts");
  const timer = read("deploy/homyz-superhost-evaluation.timer");
  const script = read("scripts/deploy/run-superhost-evaluation.sh");
  const adminRoute = read("app/api/v1/admin/superhost/evaluations/route.ts");
  const service = read("services/superhost.service.ts");

  assert.match(internalRoute, /SUPERHOST_EVALUATION_CRON_SECRET/);
  assert.match(timer, /OnCalendar=\*-(?:01,04,07,10-01|01,4,7,10-01)/);
  assert.match(script, /--retry 2/);
  assert.match(adminRoute, /requireApiPermission\(req, PERMISSIONS\.HOSTS_VIEW\)/);
  assert.match(adminRoute, /requireApiPermission\(req, PERMISSIONS\.HOSTS_EDIT\)/);
  assert.match(adminRoute, /evaluateHostAtQuarterlyCheckpoint/);
  assert.match(adminRoute, /runQuarterlySuperhostEvaluation/);
  assert.match(service, /Promise\.all\(/, "each batch can isolate host failures");
  assert.match(service, /Quarterly evaluation failed for host/);
  assert.match(service, /Quarterly evaluation completed/);
});

test("Phase 3: Superhost remains host-level and independent of Guest Favorite", () => {
  const superhostService = read("services/superhost.service.ts");
  const guestFavoriteService = read("services/guest-favorite.service.ts");

  assert.match(superhostService, /where: \{ hostId, deletedAt: null \}/, "owner listings are aggregated at host level");
  assert.match(superhostService, /hostingType === "HOME"/, "co-host-only/non-home activity is excluded");
  assert.doesNotMatch(superhostService, /evaluateGuestFavoriteRequirements/);
  assert.doesNotMatch(guestFavoriteService, /evaluateSuperhostRequirements/);
});
