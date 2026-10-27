import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  evaluateHostGoodStanding,
  evaluateSuperhostRequirements,
  isExcludedHostCancellation,
} from "../lib/superhost/rules";

const period = {
  windowStart: new Date("2025-10-01T00:00:00.000Z"),
  windowEnd: new Date("2026-09-30T00:00:00.000Z"),
};

const passing = {
  completedReservationsCount: 10,
  completedNightsCount: 20,
  overallRating: 4.8,
  responseRatePercentage: 90,
  hostCancellationCount: 0,
  cancellationDenominator: 10,
  accountGoodStanding: true,
  accountStatus: "ACTIVE",
  assessmentPeriod: period,
  isListingOwner: true,
} as const;

function criterion(result: ReturnType<typeof evaluateSuperhostRequirements>, id: string) {
  const item = result.qualification.criteria.find((candidate) => candidate.id === id);
  assert.ok(item, `Expected ${id} criterion`);
  return item;
}

test("Phase 2: active account status is the approved good-standing predicate", () => {
  assert.deepEqual(evaluateHostGoodStanding("ACTIVE", false), {
    accountGoodStanding: true,
    status: "PASS",
    explanation: "Host account is active and eligible to host.",
  });
  assert.equal(evaluateHostGoodStanding("SUSPENDED", true).status, "FAIL");
  assert.equal(evaluateHostGoodStanding("INVITATION_PENDING", true).status, "FAIL");
  assert.equal(evaluateHostGoodStanding(null, true).status, "BLOCKED");
});

test("Phase 2: centralized result is explainable and fully eligible only when every criterion passes", () => {
  const result = evaluateSuperhostRequirements(passing);

  assert.equal(result.eligibleNow, true);
  assert.equal(result.qualification.eligibilityStatus, "ELIGIBLE");
  assert.deepEqual(result.qualification.assessmentPeriod, period);
  assert.equal(result.qualification.criteria.length, 6);
  assert.ok(result.qualification.criteria.every((item) => item.status === "PASS"));
  assert.deepEqual(result.qualification.missingInformation, []);
});

test("Phase 2: each mandatory criterion prevents qualification at its boundary", () => {
  assert.equal(criterion(evaluateSuperhostRequirements({ ...passing, isListingOwner: false }), "LISTING_OWNERSHIP").status, "FAIL");
  assert.equal(criterion(evaluateSuperhostRequirements({ ...passing, completedReservationsCount: 9, completedNightsCount: 99 }), "HOSTING_VOLUME").status, "FAIL");
  assert.equal(criterion(evaluateSuperhostRequirements({ ...passing, overallRating: 4.79 }), "RATING").status, "FAIL");
  assert.equal(criterion(evaluateSuperhostRequirements({ ...passing, responseRatePercentage: 89.99 }), "RESPONSE_RATE").status, "FAIL");
  assert.equal(criterion(evaluateSuperhostRequirements({ ...passing, hostCancellationCount: 1, cancellationDenominator: 100 }), "CANCELLATION_RATE").status, "FAIL");
  assert.equal(criterion(evaluateSuperhostRequirements({ ...passing, accountGoodStanding: false, accountStatus: "SUSPENDED" }), "GOOD_STANDING").status, "FAIL");

  const longStay = evaluateSuperhostRequirements({ ...passing, completedReservationsCount: 3, completedNightsCount: 100 });
  assert.equal(criterion(longStay, "HOSTING_VOLUME").status, "PASS");
});

test("Phase 2: insufficient response data remains a failure under the established response-rate behavior", () => {
  const result = evaluateSuperhostRequirements({ ...passing, responseRatePercentage: null });
  assert.equal(criterion(result, "RESPONSE_RATE").status, "FAIL");
  assert.equal(result.qualification.eligibilityStatus, "NOT_ELIGIBLE");
  assert.match(criterion(result, "RESPONSE_RATE").explanation, /qualifying guest inquiry/);
});

test("Phase 2: unverified cancellation exceptions block instead of granting eligibility", () => {
  assert.equal(isExcludedHostCancellation({ cancellation: { cancelledBy: "HOST", isExcluded: true } }), true);
  assert.equal(isExcludedHostCancellation({ cancellation: { cancelledBy: "HOST", isExcluded: false } }), false);

  const result = evaluateSuperhostRequirements({
    ...passing,
    cancellationExceptionVerificationState: "UNVERIFIED",
  });
  assert.equal(criterion(result, "CANCELLATION_RATE").status, "BLOCKED");
  assert.equal(result.qualification.eligibilityStatus, "CANNOT_DETERMINE");
  assert.equal(result.eligibleNow, false);
  assert.equal(result.qualification.unresolvedPolicyDependencies.length, 1);
});

test("Phase 2: service keeps host aggregation separate from listing-level Guest Favorite qualification", () => {
  const superhostService = fs.readFileSync(path.join(process.cwd(), "services/superhost.service.ts"), "utf8");
  const guestFavoriteService = fs.readFileSync(path.join(process.cwd(), "services/guest-favorite.service.ts"), "utf8");

  assert.match(superhostService, /where: \{ hostId, deletedAt: null \}/, "Superhost aggregates owned host listings");
  assert.match(superhostService, /qualification: requirements\.qualification/, "Superhost exposes the centralized result");
  assert.match(guestFavoriteService, /type GuestFavoriteProgress/, "Guest Favorite retains its separate listing evaluator");
  assert.doesNotMatch(guestFavoriteService, /evaluateSuperhostRequirements/);
});
