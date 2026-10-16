import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  evaluateGuestFavoriteRequirements,
  GUEST_FAVORITE_CATEGORY_KEYS,
} from "../lib/guest-favorite/rules";

const strongCategories = Object.fromEntries(
  GUEST_FAVORITE_CATEGORY_KEYS.map((key) => [key, { average: 4.9, reviewCount: 5 }]),
) as Parameters<typeof evaluateGuestFavoriteRequirements>[0]["categoryRatings"];

const passing = {
  publishedReviewCount: 5,
  overallRating: 4.9,
  categoryRatings: strongCategories,
  totalBookings: 100,
  hostCancellationCount: 0,
};

test("Phase 7: review depth, quality signals, and null subratings are evaluated deterministically", () => {
  assert.equal(evaluateGuestFavoriteRequirements({ ...passing, publishedReviewCount: 4 }).minimumReviewsMet, false);
  assert.equal(evaluateGuestFavoriteRequirements(passing).eligibleNow, true);
  assert.equal(evaluateGuestFavoriteRequirements({ ...passing, overallRating: 4.89 }).overallRatingMet, false);
  const nullCategory = { ...strongCategories, value: { average: null, reviewCount: 0 } };
  assert.equal(evaluateGuestFavoriteRequirements({ ...passing, categoryRatings: nullCategory }).eligibleNow, true, "missing data is not treated as zero");
  const isolated = Object.fromEntries(GUEST_FAVORITE_CATEGORY_KEYS.map((key) => [key, { average: null, reviewCount: 0 }])) as typeof strongCategories;
  isolated.cleanliness = { average: 5, reviewCount: 5 };
  assert.equal(evaluateGuestFavoriteRequirements({ ...passing, categoryRatings: isolated }).subratingCoverageMet, false, "one category cannot qualify a listing");
});

test("Phase 7: listing reliability counts only host cancellations and enforces <=1%", () => {
  assert.equal(evaluateGuestFavoriteRequirements({ ...passing, hostCancellationCount: 1, totalBookings: 100 }).reliabilityMet, true);
  assert.equal(evaluateGuestFavoriteRequirements({ ...passing, hostCancellationCount: 2, totalBookings: 100 }).reliabilityMet, false);
  assert.equal(evaluateGuestFavoriteRequirements({ ...passing, hostCancellationCount: 0, totalBookings: 1 }).reliabilityFailureRatePercentage, 0, "guest cancellations do not enter the numerator");
});

test("Phase 7: persistence, daily idempotency, and public badge source are wired", () => {
  const read = (relativePath: string) => fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
  const service = read("services/guest-favorite.service.ts");
  const schema = read("prisma/schema.prisma");
  const listingService = read("services/listing.service.ts");
  const homepage = read("services/homepage.service.ts");

  assert.match(schema, /model GuestFavoriteEvaluation/);
  assert.match(schema, /isGuestFavorite\s+Boolean\s+@default\(false\)/);
  assert.match(service, /listingId_evaluationDate/, "daily evaluation history is idempotent");
  assert.match(service, /qualityIncidentDataStatus: "DATA_UNAVAILABLE"/);
  assert.match(service, /status: ListingStatus\.ACTIVE/, "daily job evaluates public active listings only");
  assert.match(listingService, /qualificationService\.isGuestFavorite\(listing\)/);
  assert.match(homepage, /qualificationService\.isGuestFavorite\(listing\)/);
});
