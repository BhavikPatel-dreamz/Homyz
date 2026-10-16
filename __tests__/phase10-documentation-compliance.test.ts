import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  evaluateGuestFavoriteRequirements,
  GUEST_FAVORITE_CATEGORY_KEYS,
} from "../lib/guest-favorite/rules";
import { evaluateSuperhostRequirements } from "../lib/superhost/rules";

const strongCategories = Object.fromEntries(
  GUEST_FAVORITE_CATEGORY_KEYS.map((key) => [key, { average: 5, reviewCount: 10 }]),
) as Parameters<typeof evaluateGuestFavoriteRequirements>[0]["categoryRatings"];

test("Phase 10: documented percentage boundaries use unrounded qualification inputs", () => {
  const guestFavoriteBase = {
    publishedReviewCount: 10,
    overallRating: 5,
    categoryRatings: strongCategories,
    qualityIncidentCount: 0,
  };
  assert.equal(
    evaluateGuestFavoriteRequirements({ ...guestFavoriteBase, totalBookings: 100, hostCancellationCount: 1 }).reliabilityMet,
    true,
    "Guest Favorite permits exactly 1%",
  );
  assert.equal(
    evaluateGuestFavoriteRequirements({ ...guestFavoriteBase, totalBookings: 199, hostCancellationCount: 2 }).reliabilityMet,
    false,
    "Guest Favorite rejects 1.005%; it must not round down to 1%",
  );

  const superhostBase = {
    completedReservationsCount: 10,
    completedNightsCount: 20,
    overallRating: 5,
    responseRatePercentage: 90,
    accountGoodStanding: true,
  };
  assert.equal(
    evaluateSuperhostRequirements({ ...superhostBase, hostCancellationCount: 1, cancellationDenominator: 101 }).cancellationMet,
    true,
    "Superhost permits 0.990...%",
  );
  assert.equal(
    evaluateSuperhostRequirements({ ...superhostBase, hostCancellationCount: 2, cancellationDenominator: 199 }).cancellationMet,
    false,
    "Superhost rejects 1.005%; its limit is strictly below 1%",
  );
});

test("Phase 10: current-status DTOs are batch-refreshed for Recently Viewed without internal diagnostics", () => {
  const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
  const endpoint = read("app/api/v1/listings/cards/route.ts");
  const listingService = read("services/listing.service.ts");
  const home = read("components/home/home-view.tsx");

  assert.match(endpoint, /getPublicCardsByIds/);
  assert.match(listingService, /select: publicListingCardSelect/);
  assert.match(listingService, /getPublishedReviewSummaries/);
  assert.match(home, /currentRecentBadges === null/);
  assert.match(home, /isGuestFavorite: card\.isGuestFavorite === true/);
  assert.match(home, /isSuperhost: card\.isSuperhost === true/);
  assert.doesNotMatch(endpoint, /failureReasons|qualityIncident|responseRate|cancellation/);
});

test("Phase 10: schedulers authenticate with timing-safe secret checks", () => {
  const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
  for (const route of [
    "app/api/internal/guest-favorite/evaluations/route.ts",
    "app/api/internal/superhost/evaluations/route.ts",
  ]) {
    const code = read(route);
    assert.match(code, /timingSafeEqual/);
    assert.match(code, /hasValidCronAuthorization/);
    assert.match(code, /status: 401/);
  }
});
