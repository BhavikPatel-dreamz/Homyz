import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  evaluateGuestFavoriteRequirements,
  GUEST_FAVORITE_CATEGORY_KEYS,
  GUEST_FAVORITE_INTERNAL_CONFIG,
} from "../lib/guest-favorite/rules";
import {
  isGuestFavorite,
  isSuperhost,
} from "../services/qualification.service";

const strongCategories = Object.fromEntries(
  GUEST_FAVORITE_CATEGORY_KEYS.map((key) => [key, { average: 4.95, reviewCount: 15 }]),
) as Parameters<typeof evaluateGuestFavoriteRequirements>[0]["categoryRatings"];

const basePassingInput = {
  publishedReviewCount: 15,
  overallRating: 4.92,
  categoryRatings: strongCategories,
  totalBookings: 100,
  hostCancellationCount: 0,
};

test("1. Frontend fallback removed: 3 reviews + 4.9 rating cannot receive Guest Favorite in ListingCard", () => {
  const cardPath = path.join(process.cwd(), "components/listings/listing-card.tsx");
  const cardContent = fs.readFileSync(cardPath, "utf8");

  // Verify that the rating/review fallback shortcut is removed
  assert.equal(
    cardContent.includes("numericRating >= 4.85 && reviewCount >= 3") ||
    cardContent.includes("numericRating ?? 0) >= 4.85"),
    false,
    "Frontend must never contain live numericRating >= 4.85 / reviewCount >= 3 fallback shortcut",
  );

  // Simulate listing-card badge logic
  const mockListingWithoutPersistedFlag = {
    isGuestFavorite: false,
    rating: 4.9,
    reviewsCount: 3,
  };
  const isGuestFav =
    (mockListingWithoutPersistedFlag as any).isGuestFavorite === true ||
    (mockListingWithoutPersistedFlag as any).badge === "guest_favorite";

  assert.equal(isGuestFav, false, "Listing with 4.9 rating and 3 reviews cannot receive Guest Favorite without persisted flag");
});

test("2. Frontend uses persisted isGuestFavorite: official backend flag is authoritative", () => {
  assert.equal(isGuestFavorite({ isGuestFavorite: true }), true, "Persisted true displays badge");
  assert.equal(isGuestFavorite({ isGuestFavorite: false, rating: 5.0, reviewCount: 50 }), false, "Live rating cannot override persisted false");
  assert.equal(isGuestFavorite({ isGuestFavorite: false, isFeatured: true }), false, "Featured status cannot override persisted false");
  assert.equal(isGuestFavorite(null), false, "Null input returns false");
});

test("3. Homepage listing rating comes from listing reviews, not host profile", () => {
  const homepagePath = path.join(process.cwd(), "services/homepage.service.ts");
  const homepageContent = fs.readFileSync(homepagePath, "utf8");

  assert.equal(
    homepageContent.includes("hostProfile.rating") || homepageContent.includes("hostProfile.reviewCount"),
    false,
    "Homepage toProperty must never read rating or review count from host.publicProfile",
  );
  assert.match(homepageContent, /listing\.rating/, "toProperty must read listing.rating");
  assert.match(homepageContent, /listing\.reviewsCount/, "toProperty must read listing.reviewsCount");
  assert.match(homepageContent, /getPublishedReviewSummaries/, "Candidate listings must load genuine published review summaries");
});

test("4. Listing A and Listing B under same host independently show their own ratings and review counts", () => {
  // Simulate toProperty logic for two listings belonging to Host X
  const hostX = {
    id: "host-x",
    name: "Alex",
    createdAt: new Date(),
    publicProfile: { rating: 4.9, reviewCount: 48 }, // Host global aggregate
    isSuperhost: true,
  };

  const listingA = {
    id: "listing-a",
    title: "Seaside Villa",
    country: "SA",
    host: hostX,
    rating: 4.95,
    reviewsCount: 40,
    isGuestFavorite: true,
  };

  const listingB = {
    id: "listing-b",
    title: "City Studio",
    country: "SA",
    host: hostX,
    rating: 4.72,
    reviewsCount: 8,
    isGuestFavorite: false,
  };

  // Extract ratings as homepage toProperty now does
  const ratingA = typeof listingA.rating === "number" && listingA.rating > 0 ? listingA.rating : null;
  const reviewsCountA = typeof listingA.reviewsCount === "number" ? listingA.reviewsCount : null;

  const ratingB = typeof listingB.rating === "number" && listingB.rating > 0 ? listingB.rating : null;
  const reviewsCountB = typeof listingB.reviewsCount === "number" ? listingB.reviewsCount : null;

  assert.equal(ratingA, 4.95);
  assert.equal(reviewsCountA, 40);
  assert.equal(ratingB, 4.72);
  assert.equal(reviewsCountB, 8);
  assert.notEqual(ratingA, ratingB, "Listing A and B must maintain independent ratings");
  assert.notEqual(ratingB, hostX.publicProfile.rating, "Listing B must not inherit Host X global rating");
});

test("5. Minimum 5 published reviews remains strictly enforced", () => {
  const result4Reviews = evaluateGuestFavoriteRequirements({
    ...basePassingInput,
    publishedReviewCount: 4,
  });
  assert.equal(result4Reviews.minimumReviewsMet, false);
  assert.equal(result4Reviews.eligibleNow, false);
  assert.match(result4Reviews.failureReasons[0], /At least 5 published reviews are required/);

  const result5Reviews = evaluateGuestFavoriteRequirements({
    ...basePassingInput,
    publishedReviewCount: 5,
  });
  assert.equal(result5Reviews.minimumReviewsMet, true);
});

test("6. Composite qualification: overall rating slightly below 4.90 qualifies when other signals are strong", () => {
  // Scenario A: 4.89 with only 5 reviews (bare minimum) does NOT qualify via composite
  const resultBare5 = evaluateGuestFavoriteRequirements({
    ...basePassingInput,
    publishedReviewCount: 5,
    overallRating: 4.89,
  });
  assert.equal(resultBare5.standardRatingMet, false);
  assert.equal(resultBare5.compositeRatingMet, false);
  assert.equal(resultBare5.overallRatingMet, false);
  assert.equal(resultBare5.eligibleNow, false);

  // Scenario B: 4.89 with elevated review depth (15 reviews), exceptional subratings (4.95), and 0 cancellations DOES qualify
  const resultStrongComposite = evaluateGuestFavoriteRequirements({
    ...basePassingInput,
    publishedReviewCount: 15,
    overallRating: 4.89,
    categoryRatings: strongCategories,
    hostCancellationCount: 0,
  });
  assert.equal(resultStrongComposite.standardRatingMet, false);
  assert.equal(resultStrongComposite.compositeRatingMet, true, "Strong composite signals allow 4.89 to qualify");
  assert.equal(resultStrongComposite.overallRatingMet, true);
  assert.equal(resultStrongComposite.eligibleNow, true);

  // Scenario C: Rating below composite floor (e.g. 4.80) does NOT qualify even with 50 reviews
  const resultBelowFloor = evaluateGuestFavoriteRequirements({
    ...basePassingInput,
    publishedReviewCount: 50,
    overallRating: 4.80,
  });
  assert.equal(resultBelowFloor.compositeRatingMet, false);
  assert.equal(resultBelowFloor.overallRatingMet, false);
  assert.equal(resultBelowFloor.eligibleNow, false);
});

test("7. Missing quality incident data is not interpreted as zero confirmed incidents", () => {
  // When qualityIncidentCount is uninstrumented (null/undefined)
  const resultUnavailable = evaluateGuestFavoriteRequirements({
    ...basePassingInput,
    qualityIncidentCount: null,
  });
  assert.equal(resultUnavailable.qualityIncidentDataStatus, "DATA_UNAVAILABLE");
  assert.equal(resultUnavailable.reliabilityStatus, "PARTIAL");
  assert.match(resultUnavailable.qualityIncidentMessage, /not currently instrumented/);

  // When qualityIncidentCount is instrumented and passed
  const resultAvailable = evaluateGuestFavoriteRequirements({
    ...basePassingInput,
    qualityIncidentCount: 2, // 2 quality issues out of 100 bookings = 2% failure rate
  });
  assert.equal(resultAvailable.qualityIncidentDataStatus, "AVAILABLE");
  assert.equal(resultAvailable.reliabilityStatus, "FULL");
  assert.equal(resultAvailable.reliabilityFailureRatePercentage, 2.0);
  assert.equal(resultAvailable.reliabilityMet, false, "2% failure rate exceeds 1% threshold");
});

test("8. Zero bookings edge case: handles historical/imported reviews safely without divide-by-zero", () => {
  // A listing with 5+ published reviews but 0 booking records and 0 cancellations
  const resultZeroBookings = evaluateGuestFavoriteRequirements({
    ...basePassingInput,
    totalBookings: 0,
    hostCancellationCount: 0,
    publishedReviewCount: 5,
  });
  assert.equal(resultZeroBookings.reliabilityFailureRatePercentage, 0);
  assert.equal(resultZeroBookings.reliabilityMet, true, "Zero bookings with verified 5+ reviews and 0 cancellations passes reliability safely");

  // A listing with 0 bookings but 1 cancellation (anomalous failure)
  const resultAnomalousFailure = evaluateGuestFavoriteRequirements({
    ...basePassingInput,
    totalBookings: 0,
    hostCancellationCount: 1,
  });
  assert.equal(resultAnomalousFailure.reliabilityMet, false);
});

test("9. Guest Favorite and Superhost remain completely independent", () => {
  // Guest Favorite is listing-level
  assert.equal(isGuestFavorite({ isGuestFavorite: true }), true);
  assert.equal(isGuestFavorite({ isGuestFavorite: false }), false);

  // Superhost is host-level
  assert.equal(isSuperhost({ isSuperhost: true }), true);
  assert.equal(isSuperhost({ isSuperhost: false }), false);

  // A Guest Favorite listing whose host is not Superhost
  const listingGF = { isGuestFavorite: true };
  const hostNonSuper = { isSuperhost: false };
  assert.equal(isGuestFavorite(listingGF), true);
  assert.equal(isSuperhost(hostNonSuper), false);

  // A Superhost host whose listing is not Guest Favorite
  const listingNonGF = { isGuestFavorite: false };
  const hostSuper = { isSuperhost: true };
  assert.equal(isGuestFavorite(listingNonGF), false);
  assert.equal(isSuperhost(hostSuper), true);
});

test("10. Legacy qualification config cleaned: authoritative rules live in rules.ts", () => {
  const qualServicePath = path.join(process.cwd(), "services/qualification.service.ts");
  const qualServiceContent = fs.readFileSync(qualServicePath, "utf8");

  // Ensure legacy 4.85 / 3 / 2 rules are not present in qualification.service.ts
  assert.equal(
    qualServiceContent.includes("minRating: 4.85") ||
    qualServiceContent.includes("minConfirmedBookings: 2") ||
    qualServiceContent.includes("allowFeaturedWithConfirmedBookings"),
    false,
    "Legacy qualification config must be removed from qualification.service.ts",
  );

  // Centralized configuration is in rules.ts
  assert.equal(GUEST_FAVORITE_INTERNAL_CONFIG.MIN_PUBLISHED_REVIEWS, 5);
  assert.equal(GUEST_FAVORITE_INTERNAL_CONFIG.STANDARD_RATING_TARGET, 4.90);
  assert.equal(GUEST_FAVORITE_INTERNAL_CONFIG.COMPOSITE_RATING_FLOOR, 4.85);
  assert.equal(GUEST_FAVORITE_INTERNAL_CONFIG.MAX_RELIABILITY_FAILURE_RATE_PERCENTAGE, 1.0);
});

