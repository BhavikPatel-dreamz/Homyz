import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { ReviewDirection, ReviewStatus, StayEliteQualificationStatus, StayEliteTierCode } from "@/generated/prisma/enums";
import {
  evaluateStayEliteTier,
  isTierPromotionEnabled,
  STAYELITE_TIER_DEFINITIONS,
  type TierEvaluationInput,
} from "@/services/stayelite-tier.service";

const approvedPolicy = { completionApproved: true, ratingEligibilityApproved: true, referralConversionApproved: true };
const base = (): TierEvaluationInput => ({
  guestId: "guest-1", registeredActive: true, bookings: [], reviews: [], referrals: [], policy: approvedPolicy,
});

function stays(count: number) {
  return Array.from({ length: count }, (_, index) => ({ id: `booking-${index + 1}`, qualificationPolicyVersion: "approved-v1" }));
}

function hostRatings(count: number, rating = 5) {
  return Array.from({ length: count }, (_, index) => ({
    id: `host-rating-${index + 1}`, bookingId: `booking-${index + 1}`, rating,
    authorId: `host-${index + 1}`, targetUserId: "guest-1", direction: ReviewDirection.HOST_TO_GUEST,
    status: ReviewStatus.PUBLISHED, bookingGuestId: "guest-1", bookingHostId: `host-${index + 1}`,
  }));
}

function guestReview(bookingId = "booking-1") {
  return {
    id: `guest-review-${bookingId}`, bookingId, rating: 5, authorId: "guest-1", targetUserId: "host-1",
    direction: ReviewDirection.GUEST_TO_PROPERTY, status: ReviewStatus.PUBLISHED,
    bookingGuestId: "guest-1", bookingHostId: "host-1",
  };
}

function referrals(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `referral-${index + 1}`, inviterId: "guest-1", referredUserId: `referred-${index + 1}`,
    qualifyingBookingId: `referral-booking-${index + 1}`, bookingGuestId: `referred-${index + 1}`,
    qualifyingStay: true,
  }));
}

test("Traveler requires registration, qualified stay, and a published guest-to-property review", () => {
  assert.equal(evaluateStayEliteTier(base()).evaluatedTier, null, "registration alone cannot qualify");
  const withoutReview = evaluateStayEliteTier({ ...base(), bookings: stays(1) });
  assert.equal(withoutReview.evaluatedTier, null);
  const traveler = evaluateStayEliteTier({ ...base(), bookings: stays(1), reviews: [guestReview()] });
  assert.equal(traveler.evaluatedTier, StayEliteTierCode.TRAVELER);
  assert.equal(traveler.qualificationStatus, StayEliteQualificationStatus.QUALIFIED);
  assert.equal(traveler.benefits[0]?.active, false);
});

test("Ambassador ANDs all cumulative requirements and uses host-to-guest ratings only", () => {
  const common = { ...base(), bookings: stays(15), reviews: [...hostRatings(10, 5), guestReview()] };
  assert.equal(evaluateStayEliteTier({ ...common, referrals: referrals(4) }).evaluatedTier, StayEliteTierCode.TRAVELER);
  const ambassador = evaluateStayEliteTier({ ...common, referrals: referrals(5) });
  assert.equal(ambassador.evaluatedTier, StayEliteTierCode.AMBASSADOR);
  assert.equal(ambassador.eligibleReviewCount, 10);
  assert.equal(ambassador.averageGuestRating, 5);
  const wrongDirection = evaluateStayEliteTier({ ...common, reviews: Array.from({ length: 10 }, (_, index) => guestReview(`booking-${index + 1}`)), referrals: referrals(5) });
  assert.equal(wrongDirection.evaluatedTier, StayEliteTierCode.TRAVELER, "property reviews never establish guest reputation");
});

test("Icon requires 25 stays, ten ratings, and ten distinct qualified referrals; duplicates do not inflate counts", () => {
  const exactFourPointEight = hostRatings(10).map((review, index) => ({ ...review, rating: index < 8 ? 5 : 4 }));
  const nineReferrals = evaluateStayEliteTier({ ...base(), bookings: stays(25), reviews: [...exactFourPointEight, guestReview()], referrals: referrals(9) });
  assert.equal(nineReferrals.evaluatedTier, StayEliteTierCode.AMBASSADOR);
  const icon = evaluateStayEliteTier({ ...base(), bookings: stays(25), reviews: [...exactFourPointEight, guestReview()], referrals: [...referrals(10), ...referrals(1)] });
  assert.equal(icon.evaluatedTier, StayEliteTierCode.ICON);
  assert.equal(icon.qualifyingReferralCount, 10);
  assert.equal(icon.completedQualifyingStayCount, 25);
});

test("unapproved completion, rating, referral and downgrade policies preserve calculation but block transition", () => {
  const blocked = evaluateStayEliteTier({ ...base(), policy: {}, bookings: stays(25), reviews: [...hostRatings(10, 5), guestReview()], referrals: referrals(10) });
  assert.equal(blocked.evaluatedTier, StayEliteTierCode.ICON);
  assert.equal(blocked.qualificationStatus, StayEliteQualificationStatus.POLICY_BLOCKED);
  assert.deepEqual(blocked.policyBlockers, ["DEC-001", "DEC-004", "DEC-007"]);
  assert.equal(blocked.proposedTransition?.disposition, "BLOCKED");
});

test("promotion activation is disabled unless the server explicitly enables it", () => {
  assert.equal(isTierPromotionEnabled(), false);
});

test("schema, migration and API keep memberships database-backed and owner-safe", () => {
  const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20261028150000_add_stayelite_tier_membership/migration.sql");
  const meRoute = read("app/api/v1/loyalty/me/route.ts");
  const service = read("services/stayelite-tier.service.ts");
  assert.match(schema, /model StayEliteMembership/);
  assert.match(schema, /userId\s+String\s+@unique/);
  assert.match(schema, /model StayEliteTierHistory/);
  assert.match(migration, /StayEliteMembership_userId_key/);
  assert.match(migration, /StayEliteTierEvaluation_idempotencyKey_key/);
  assert.match(meRoute, /requireApiAuth/);
  assert.ok(!/export const (POST|PATCH|PUT|DELETE)/.test(meRoute));
  assert.match(service, /hasPermission\(input\.actor, PERMISSIONS\.GUESTS_EDIT\)/);
  assert.equal(STAYELITE_TIER_DEFINITIONS.length, 3);
});
