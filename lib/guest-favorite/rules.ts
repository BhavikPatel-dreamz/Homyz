export const GUEST_FAVORITE_CATEGORY_KEYS = [
  "cleanliness",
  "accuracy",
  "checkIn",
  "communication",
  "location",
  "value",
] as const;

export type GuestFavoriteCategoryKey = (typeof GUEST_FAVORITE_CATEGORY_KEYS)[number];

export type GuestFavoriteCategoryMetric = {
  average: number | null;
  reviewCount: number;
};

export type GuestFavoriteRequirementsInput = {
  publishedReviewCount: number;
  overallRating: number | null;
  categoryRatings: Record<GuestFavoriteCategoryKey, GuestFavoriteCategoryMetric>;
  totalBookings: number;
  hostCancellationCount: number;
};

/**
 * Transparent listing-level Guest Favorite rule. The product has no approved
 * weighted composite or quality-incident ledger, so this uses only supported
 * signals: review depth, overall score, consistently strong available category
 * ratings, and listing-specific cancellation reliability.
 */
export function evaluateGuestFavoriteRequirements(input: GuestFavoriteRequirementsInput) {
  const minimumReviewsMet = input.publishedReviewCount >= 5;
  const overallRatingMet = input.overallRating !== null && input.overallRating >= 4.9;
  const categoryEntries = GUEST_FAVORITE_CATEGORY_KEYS.map((key) => ({ key, ...input.categoryRatings[key] }));
  const categoriesWithRatings = categoryEntries.filter((category) => category.average !== null);
  const categoriesWithMeaningfulSamples = categoriesWithRatings.filter((category) => category.reviewCount >= 3);
  // Missing ratings remain unavailable rather than being treated as zeros. To
  // prevent a single isolated category from deciding the badge, at least three
  // categories need a meaningful sample; every recorded category must be 4.8+.
  const subratingCoverageMet = categoriesWithMeaningfulSamples.length >= 3;
  const subratingConsistencyMet =
    subratingCoverageMet && categoriesWithRatings.every((category) => category.average! >= 4.8);
  const reliabilityFailureRatePercentage = input.totalBookings > 0
    ? Math.round((input.hostCancellationCount / input.totalBookings) * 10000) / 100
    : 0;
  const reliabilityMet = input.totalBookings > 0 && reliabilityFailureRatePercentage <= 1;
  const failureReasons: string[] = [];
  if (!minimumReviewsMet) failureReasons.push("At least five published reviews are required.");
  if (!overallRatingMet) failureReasons.push("Overall rating must be at least 4.90.");
  if (!subratingCoverageMet) failureReasons.push("At least three subrating categories need three or more ratings.");
  else if (!subratingConsistencyMet) failureReasons.push("Every available subrating must average at least 4.80.");
  if (!reliabilityMet) failureReasons.push("Listing reliability must be at or below 1% host-caused failures.");
  return {
    minimumReviewsMet,
    overallRatingMet,
    subratingCoverageMet,
    subratingConsistencyMet,
    reliabilityFailureRatePercentage,
    reliabilityMet,
    eligibleNow: minimumReviewsMet && overallRatingMet && subratingConsistencyMet && reliabilityMet,
    failureReasons,
  };
}

export function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
