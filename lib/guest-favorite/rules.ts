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

/**
 * Internal Product Configuration for Guest Favorite Evaluation.
 *
 * NOTE ON SOURCE SPECIFICATION VS. IMPLEMENTATION PARAMETERS:
 * - Direct Criteria Document Requirements:
 *   1. Minimum 5 published guest reviews.
 *   2. Overall rating approximately 4.9+.
 *   3. Subratings across key categories (Cleanliness, Accuracy, Check-in,
 *      Communication, Location, Value) must be consistently high.
 *   4. Reliability: (host_cancellations + quality_issues) / total_bookings <= 1%.
 *
 * - The parameters below represent INTERNAL IMPLEMENTATION CONFIGURATION
 *   calibrated to fulfill the document's qualitative criteria (e.g. composite
 *   qualification for listings slightly below 4.90, coverage samples, and
 *   subrating consistency floors). They are centralized here as adjustable parameters
 *   and must not be presented as fixed external third-party specification constants.
 */
export const GUEST_FAVORITE_INTERNAL_CONFIG = {
  /** Hard document requirement: at least 5 completed/published guest reviews. */
  MIN_PUBLISHED_REVIEWS: 5,

  /** Standard overall rating target (~4.9+). */
  STANDARD_RATING_TARGET: 4.90,

  /**
   * Floor for composite qualification when other signals are exceptionally strong.
   * Listings with overall rating between 4.85 and 4.90 may qualify when review depth,
   * subratings, and cancellation reliability are exemplary.
   */
  COMPOSITE_RATING_FLOOR: 4.85,

  /**
   * Elevated review depth required for composite qualification when overall rating
   * is slightly below 4.90 (e.g. 10+ published reviews).
   */
  COMPOSITE_MIN_REVIEWS: 10,

  /**
   * High-tier average across populated subratings required for composite qualification
   * when overall rating is slightly below 4.90.
   */
  COMPOSITE_HIGH_SUBRATING_FLOOR: 4.90,

  /** Internal implementation baseline for individual category average consistency. */
  SUBRATING_CONSISTENCY_FLOOR: 4.80,

  /** Internal implementation baseline for minimum ratings per category sample. */
  CATEGORY_MIN_REVIEW_COUNT: 3,

  /** Internal implementation baseline for minimum categories with meaningful samples. */
  MIN_CATEGORY_COVERAGE_COUNT: 3,

  /** Document requirement: maximum permitted reliability failure rate (1.0%). */
  MAX_RELIABILITY_FAILURE_RATE_PERCENTAGE: 1.0,
} as const;

export type GuestFavoriteRequirementsInput = {
  publishedReviewCount: number;
  overallRating: number | null;
  categoryRatings: Record<GuestFavoriteCategoryKey, GuestFavoriteCategoryMetric>;
  totalBookings: number;
  hostCancellationCount: number;
  /**
   * Optional quality incident count.
   * - `null` or `undefined`: indicates property-level support/quality incident tracking
   *   is DATA_UNAVAILABLE. Reliability evaluation is partial (evaluating host cancellations only).
   * - `number`: confirmed quality incidents recorded for this listing.
   */
  qualityIncidentCount?: number | null;
};

export function evaluateGuestFavoriteRequirements(input: GuestFavoriteRequirementsInput) {
  // 1. Minimum published reviews (hard document requirement: >= 5)
  const minimumReviewsMet = input.publishedReviewCount >= GUEST_FAVORITE_INTERNAL_CONFIG.MIN_PUBLISHED_REVIEWS;

  // 2. Subrating category analysis
  const categoryEntries = GUEST_FAVORITE_CATEGORY_KEYS.map((key) => ({ key, ...input.categoryRatings[key] }));
  const categoriesWithRatings = categoryEntries.filter((category) => category.average !== null);
  const categoriesWithMeaningfulSamples = categoriesWithRatings.filter(
    (category) => category.reviewCount >= GUEST_FAVORITE_INTERNAL_CONFIG.CATEGORY_MIN_REVIEW_COUNT,
  );

  // Missing ratings remain unavailable rather than treated as zero.
  // Coverage ensures at least 3 categories have a meaningful sample.
  const subratingCoverageMet =
    categoriesWithMeaningfulSamples.length >= GUEST_FAVORITE_INTERNAL_CONFIG.MIN_CATEGORY_COVERAGE_COUNT;
  const subratingConsistencyMet =
    subratingCoverageMet &&
    categoriesWithRatings.every(
      (category) => category.average! >= GUEST_FAVORITE_INTERNAL_CONFIG.SUBRATING_CONSISTENCY_FLOOR,
    );

  const averageSubrating =
    categoriesWithRatings.length > 0
      ? categoriesWithRatings.reduce((sum, c) => sum + c.average!, 0) / categoriesWithRatings.length
      : 0;

  // 3. Overall rating evaluation (Target ~4.9+ with composite scoring model)
  // 3. Overall rating evaluation (Target ~4.9+ with composite scoring model)
  // Hard cutoff at 4.90 is avoided: listings slightly below 4.90 (>= 4.85) can qualify if
  // other signals (review depth >= 10, subratings >= 4.90, zero host cancellations & quality issues) are exceptionally strong.
  const standardRatingMet =
    input.overallRating !== null && input.overallRating >= GUEST_FAVORITE_INTERNAL_CONFIG.STANDARD_RATING_TARGET;

  const inCompositeBand =
    input.overallRating !== null &&
    input.overallRating >= GUEST_FAVORITE_INTERNAL_CONFIG.COMPOSITE_RATING_FLOOR &&
    input.overallRating < GUEST_FAVORITE_INTERNAL_CONFIG.STANDARD_RATING_TARGET;

  // 4. Reliability & Quality Incidents
  // Distinctly tracks whether quality incident data is available or uninstrumented.
  const qualityIncidentDataStatus: "DATA_UNAVAILABLE" | "AVAILABLE" =
    typeof input.qualityIncidentCount === "number" ? "AVAILABLE" : "DATA_UNAVAILABLE";
  const confirmedQualityIncidents =
    typeof input.qualityIncidentCount === "number" ? input.qualityIncidentCount : 0;
  const totalFailures = input.hostCancellationCount + confirmedQualityIncidents;
  const reliabilityStatus: "FULL" | "PARTIAL" =
    qualityIncidentDataStatus === "AVAILABLE" ? "FULL" : "PARTIAL";

  const compositeSignalsStrong =
    inCompositeBand &&
    input.publishedReviewCount >= GUEST_FAVORITE_INTERNAL_CONFIG.COMPOSITE_MIN_REVIEWS &&
    subratingConsistencyMet &&
    averageSubrating >= GUEST_FAVORITE_INTERNAL_CONFIG.COMPOSITE_HIGH_SUBRATING_FLOOR &&
    totalFailures === 0;

  const compositeRatingMet = inCompositeBand && compositeSignalsStrong;
  const overallRatingMet = standardRatingMet || compositeRatingMet;

  let reliabilityFailureRatePercentage = 0;
  let reliabilityMet = false;

  if (input.totalBookings > 0) {
    // Preserve the raw ratio for qualification. Rounding before comparison can
    // incorrectly turn a rate just above the documented <= 1% limit into 1%.
    // Callers that display this internal diagnostic can round it for display.
    reliabilityFailureRatePercentage = (totalFailures / input.totalBookings) * 100;
    reliabilityMet =
      reliabilityFailureRatePercentage <= GUEST_FAVORITE_INTERNAL_CONFIG.MAX_RELIABILITY_FAILURE_RATE_PERCENTAGE;
  } else {
    // Zero booking records edge case:
    // If failures exist despite 0 qualifying bookings, fail immediately.
    if (totalFailures > 0) {
      reliabilityFailureRatePercentage = 100;
      reliabilityMet = false;
    } else if (input.publishedReviewCount >= GUEST_FAVORITE_INTERNAL_CONFIG.MIN_PUBLISHED_REVIEWS) {
      // Historical/migrated reviews present without corresponding Booking rows:
      // Stay history is proven by >= 5 published reviews with 0 host cancellations on record.
      reliabilityFailureRatePercentage = 0;
      reliabilityMet = true;
    } else {
      reliabilityFailureRatePercentage = 0;
      reliabilityMet = false;
    }
  }

  // 5. Failure reason diagnostic messages
  const failureReasons: string[] = [];
  if (!minimumReviewsMet) {
    failureReasons.push(
      `At least ${GUEST_FAVORITE_INTERNAL_CONFIG.MIN_PUBLISHED_REVIEWS} published reviews are required.`,
    );
  }
  if (!overallRatingMet) {
    if (inCompositeBand) {
      failureReasons.push(
        `Overall rating (${input.overallRating?.toFixed(2)}) is below 4.90 and does not meet composite strength thresholds (requires >= ${GUEST_FAVORITE_INTERNAL_CONFIG.COMPOSITE_MIN_REVIEWS} reviews and >= ${GUEST_FAVORITE_INTERNAL_CONFIG.COMPOSITE_HIGH_SUBRATING_FLOOR.toFixed(2)} subrating average).`,
      );
    } else {
      failureReasons.push(
        `Overall rating must be approximately 4.90+ (minimum composite floor is ${GUEST_FAVORITE_INTERNAL_CONFIG.COMPOSITE_RATING_FLOOR.toFixed(2)}).`,
      );
    }
  }
  if (!subratingCoverageMet) {
    failureReasons.push(
      `At least ${GUEST_FAVORITE_INTERNAL_CONFIG.MIN_CATEGORY_COVERAGE_COUNT} subrating categories need ${GUEST_FAVORITE_INTERNAL_CONFIG.CATEGORY_MIN_REVIEW_COUNT} or more ratings.`,
    );
  } else if (!subratingConsistencyMet) {
    failureReasons.push(
      `Every available subrating must average at least ${GUEST_FAVORITE_INTERNAL_CONFIG.SUBRATING_CONSISTENCY_FLOOR.toFixed(2)}.`,
    );
  }
  if (!reliabilityMet) {
    failureReasons.push(
      `Listing reliability must be at or below ${GUEST_FAVORITE_INTERNAL_CONFIG.MAX_RELIABILITY_FAILURE_RATE_PERCENTAGE}% host-caused failures.`,
    );
  }

  return {
    minimumReviewsMet,
    overallRatingMet,
    standardRatingMet,
    compositeRatingMet,
    subratingCoverageMet,
    subratingConsistencyMet,
    reliabilityFailureRatePercentage,
    reliabilityMet,
    reliabilityStatus,
    qualityIncidentDataStatus,
    qualityIncidentCount: typeof input.qualityIncidentCount === "number" ? input.qualityIncidentCount : null,
    qualityIncidentMessage:
      qualityIncidentDataStatus === "AVAILABLE"
        ? `${confirmedQualityIncidents} confirmed quality incidents recorded.`
        : "Property-level support/quality incident tracking is not currently instrumented. Reliability evaluation is partial (evaluating host cancellations only).",
    eligibleNow: minimumReviewsMet && overallRatingMet && subratingConsistencyMet && reliabilityMet,
    failureReasons,
  };
}

export function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
