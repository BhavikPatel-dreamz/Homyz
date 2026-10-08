import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  evaluateGuestFavoriteRequirements,
  type GuestFavoriteCategoryKey,
  type GuestFavoriteCategoryMetric,
} from "../lib/guest-favorite/rules";

function categoryRatings(
  communication: GuestFavoriteCategoryMetric,
): Record<GuestFavoriteCategoryKey, GuestFavoriteCategoryMetric> {
  const strong = { average: 5, reviewCount: 5 };
  return {
    cleanliness: strong,
    accuracy: strong,
    checkIn: strong,
    communication,
    location: strong,
    value: strong,
  };
}

function evaluateCommunication(communication: GuestFavoriteCategoryMetric) {
  return evaluateGuestFavoriteRequirements({
    publishedReviewCount: 5,
    overallRating: 5,
    categoryRatings: categoryRatings(communication),
    totalBookings: 5,
    hostCancellationCount: 0,
    qualityIncidentCount: 0,
  });
}

test("a listing's published guest communication ratings participate in the existing subrating floor", () => {
  assert.equal(evaluateCommunication({ average: 5, reviewCount: 5 }).eligibleNow, true);

  const weakCommunication = evaluateCommunication({ average: 4.75, reviewCount: 5 });
  assert.equal(weakCommunication.eligibleNow, false);
  assert.equal(weakCommunication.subratingConsistencyMet, false);
});

test("communication remains listing-scoped and missing data is never treated as a perfect rating", () => {
  const listingA = evaluateCommunication({ average: 5, reviewCount: 5 });
  const listingB = evaluateCommunication({ average: 4.5, reviewCount: 5 });
  assert.equal(listingA.eligibleNow, true);
  assert.equal(listingB.eligibleNow, false);

  const unavailable = evaluateCommunication({ average: null, reviewCount: 0 });
  assert.equal(unavailable.subratingCoverageMet, true);
  assert.equal(unavailable.subratingConsistencyMet, true);
  assert.equal(categoryRatings({ average: null, reviewCount: 0 }).communication.average, null);
  assert.equal(categoryRatings({ average: null, reviewCount: 0 }).communication.reviewCount, 0);
});

test("the evaluator only reads published guest-to-property reviews and is triggered by review lifecycle changes", () => {
  const guestFavoriteService = fs.readFileSync(
    path.join(process.cwd(), "services/guest-favorite.service.ts"),
    "utf8",
  );
  const reviewService = fs.readFileSync(
    path.join(process.cwd(), "services/review.service.ts"),
    "utf8",
  );
  const schema = fs.readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");

  assert.match(guestFavoriteService, /status: "PUBLISHED" as const/);
  assert.match(guestFavoriteService, /booking:\s*\{[\s\S]*?is:\s*\{[\s\S]*?status: BookingStatus\.CONFIRMED/);
  assert.match(guestFavoriteService, /communicationRating: true/);
  assert.match(guestFavoriteService, /communication: "communicationRating"/);
  assert.equal(
    [...reviewService.matchAll(/await triggerGuestFavoriteReevaluation\(review\.listingId\)/g)].length,
    2,
    "creating or deleting a guest property review must re-evaluate its listing",
  );
  assert.match(schema, /model HostGuestReview[\s\S]*communicationRating/);
  assert.match(schema, /model Review[\s\S]*communicationRating Int\?/);
});
