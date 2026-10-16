const QUARTER_START_MONTHS = [0, 3, 6, 9] as const;
export const SUPERHOST_REVIEW_WINDOW_DAYS = 14;

export interface SuperhostRequirementInput {
  completedReservationsCount: number;
  completedNightsCount: number;
  overallRating: number | null;
  responseRatePercentage: number | null;
  hostCancellationCount: number;
  cancellationDenominator: number;
  accountGoodStanding: boolean;
  isListingOwner?: boolean;
}

export const SUPERHOST_ASSESSMENT_WINDOW_DAYS = 7;

export function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function isQuarterlyEvaluationCheckpoint(value: Date): boolean {
  const day = startOfUtcDay(value);
  return day.getUTCDate() === 1 && QUARTER_START_MONTHS.includes(day.getUTCMonth() as (typeof QUARTER_START_MONTHS)[number]);
}

export function isQuarterlyAssessmentWindow(value: Date): boolean {
  const day = startOfUtcDay(value);
  return (
    day.getUTCDate() >= 1 &&
    day.getUTCDate() <= SUPERHOST_ASSESSMENT_WINDOW_DAYS &&
    QUARTER_START_MONTHS.includes(day.getUTCMonth() as (typeof QUARTER_START_MONTHS)[number])
  );
}

export function getQuarterlyCheckpointForDate(value: Date): Date {
  const day = startOfUtcDay(value);
  if (isQuarterlyEvaluationCheckpoint(day)) return day;
  if (isQuarterlyAssessmentWindow(day)) {
    return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), 1));
  }
  const year = day.getUTCFullYear();
  const candidates = [
    new Date(Date.UTC(year - 1, 9, 1)),
    ...QUARTER_START_MONTHS.map((m) => new Date(Date.UTC(year, m, 1))),
  ];
  return candidates.filter((c) => c.getTime() <= day.getTime()).pop()!;
}

export interface SuperhostEvaluationWindow {
  checkpoint: Date;
  assessmentStart: Date;
  assessmentEnd: Date;
  performanceStart: Date;
  performanceEnd: Date;
  windowStart: Date;
  windowEnd: Date;
}

export function getSuperhostEvaluationWindow(date = new Date()): SuperhostEvaluationWindow {
  const day = startOfUtcDay(date);
  const checkpoint = getQuarterlyCheckpointForDate(day);

  const assessmentStart = new Date(checkpoint);
  const assessmentEnd = new Date(checkpoint);
  assessmentEnd.setUTCDate(assessmentEnd.getUTCDate() + (SUPERHOST_ASSESSMENT_WINDOW_DAYS - 1));

  const performanceEnd = new Date(checkpoint);
  performanceEnd.setUTCDate(performanceEnd.getUTCDate() - 1);
  const performanceStart = new Date(performanceEnd);
  performanceStart.setUTCFullYear(performanceStart.getUTCFullYear() - 1);
  performanceStart.setUTCDate(performanceStart.getUTCDate() + 1);

  return {
    checkpoint,
    assessmentStart,
    assessmentEnd,
    performanceStart,
    performanceEnd,
    windowStart: performanceStart,
    windowEnd: performanceEnd,
  };
}

export function getNextQuarterlyEvaluationDate(value: Date): Date {
  const day = startOfUtcDay(value);
  const year = day.getUTCFullYear();
  const candidates = [
    ...QUARTER_START_MONTHS.map((month) => new Date(Date.UTC(year, month, 1))),
    new Date(Date.UTC(year + 1, 0, 1)),
  ];
  return candidates.find((candidate) => candidate.getTime() > day.getTime())!;
}

export function getLiveSuperhostWindow(asOf = new Date()): { windowStart: Date; windowEnd: Date } {
  const windowEnd = startOfUtcDay(asOf);
  const windowStart = new Date(windowEnd);
  windowStart.setUTCFullYear(windowStart.getUTCFullYear() - 1);
  windowStart.setUTCDate(windowStart.getUTCDate() + 1);
  return { windowStart, windowEnd };
}

export function getQuarterlySuperhostWindow(evaluationDate: Date): { windowStart: Date; windowEnd: Date } {
  if (!isQuarterlyEvaluationCheckpoint(evaluationDate) && !isQuarterlyAssessmentWindow(evaluationDate)) {
    throw new Error("Superhost evaluations may only run on January 1, April 1, July 1, or October 1.");
  }
  const window = getSuperhostEvaluationWindow(evaluationDate);
  return { windowStart: window.performanceStart, windowEnd: window.performanceEnd };
}

/**
 * A guest property review becomes eligible for Superhost rating calculations
 * once the reciprocal host review exists or this review-window deadline has
 * passed. The evaluator uses this cutoff with the existing booking data; it
 * does not create a second review publication mechanism.
 */
export function getSuperhostReviewWindowExpiryCutoff(asOf = new Date()): Date {
  const cutoff = new Date(asOf);
  cutoff.setUTCDate(cutoff.getUTCDate() - SUPERHOST_REVIEW_WINDOW_DAYS);
  return cutoff;
}

export function isNonExcludedHostCancellation(priceBreakdown: unknown): boolean {
  if (!priceBreakdown || typeof priceBreakdown !== "object" || Array.isArray(priceBreakdown)) return false;
  const cancellation = (priceBreakdown as Record<string, unknown>).cancellation;
  if (!cancellation || typeof cancellation !== "object" || Array.isArray(cancellation)) return false;
  const details = cancellation as Record<string, unknown>;
  return details.cancelledBy === "HOST" && details.isExcluded !== true;
}

export function evaluateSuperhostRequirements(input: SuperhostRequirementInput) {
  const isListingOwner = input.isListingOwner ?? true;
  const reservationPathMet = input.completedReservationsCount >= 10;
  const longStayPathMet = input.completedReservationsCount >= 3 && input.completedNightsCount >= 100;
  const hostingVolumeMet = reservationPathMet || longStayPathMet;
  const ratingMet = input.overallRating !== null && input.overallRating >= 4.8;
  const responseRateMet = input.responseRatePercentage !== null && input.responseRatePercentage >= 90;
  const rawHostCancellationRatePercentage = input.cancellationDenominator > 0
    // Do not round before applying the documented strict < 1% boundary. For
    // example, 1/101 is below 1% even though it displays as 0.99%, while a
    // rate slightly above 1% must never be rounded down to a passing value.
    ? (input.hostCancellationCount / input.cancellationDenominator) * 100
    : 0;
  const cancellationMet = rawHostCancellationRatePercentage < 1;
  // Keep the existing persisted/display metric stable; the raw value above is
  // deliberately used only for the qualification boundary.
  const hostCancellationRatePercentage = Math.round(rawHostCancellationRatePercentage * 100) / 100;
  const failureReasons: string[] = [];
  if (!isListingOwner) failureReasons.push("Host must be a listing owner to qualify for Superhost.");
  if (!hostingVolumeMet) failureReasons.push("Hosting volume requirement is not met.");
  if (!ratingMet) failureReasons.push("A published review average of at least 4.80 is required.");
  if (!responseRateMet) failureReasons.push(
    input.responseRatePercentage === null
      ? "Response rate is unavailable until there is a qualifying guest inquiry."
      : "Response rate must be at least 90%.",
  );
  if (!cancellationMet) failureReasons.push("Host cancellation rate must remain below 1%.");
  if (!input.accountGoodStanding) failureReasons.push("Host account is not in active standing.");
  return {
    isListingOwner,
    isListingOwnerMet: isListingOwner,
    reservationPathMet,
    longStayPathMet,
    hostingVolumeMet,
    ratingMet,
    responseRateMet,
    hostCancellationRatePercentage,
    cancellationMet,
    accountGoodStanding: input.accountGoodStanding,
    accountStandingMet: input.accountGoodStanding,
    eligibleNow: isListingOwner && hostingVolumeMet && ratingMet && responseRateMet && cancellationMet && input.accountGoodStanding,
    failureReasons,
  };
}
