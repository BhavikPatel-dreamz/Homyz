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
  /**
   * The canonical account lifecycle state, when the evaluator has it.  The
   * boolean remains for backwards-compatible callers of the shared helper.
   */
  accountStatus?: string | null;
  /**
   * An excluded host cancellation can only be ignored when its exception has
   * an approved, auditable source.  No such workflow exists yet, so the
   * service passes UNVERIFIED whenever it encounters legacy excluded data.
   */
  cancellationExceptionVerificationState?: "VERIFIED" | "UNVERIFIED";
  assessmentPeriod?: SuperhostAssessmentPeriod;
  isListingOwner?: boolean;
}

export type SuperhostCriterionStatus = "PASS" | "FAIL" | "BLOCKED";
export type SuperhostEligibilityStatus = "ELIGIBLE" | "NOT_ELIGIBLE" | "CANNOT_DETERMINE";

export interface SuperhostAssessmentPeriod {
  windowStart: Date;
  windowEnd: Date;
}

export interface SuperhostQualificationCriterion {
  id: "LISTING_OWNERSHIP" | "HOSTING_VOLUME" | "RATING" | "RESPONSE_RATE" | "CANCELLATION_RATE" | "GOOD_STANDING";
  actualValue: boolean | number | string | null | Record<string, number | boolean>;
  requiredThreshold: string;
  status: SuperhostCriterionStatus;
  explanation: string;
}

export interface SuperhostQualificationResult {
  assessmentPeriod: SuperhostAssessmentPeriod | null;
  criteria: SuperhostQualificationCriterion[];
  eligibilityStatus: SuperhostEligibilityStatus;
  missingInformation: string[];
  unresolvedPolicyDependencies: string[];
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

/**
 * Exclusion itself is not proof of an approved Superhost exception.  This
 * helper lets the centralized engine stop safely until a policy-owned,
 * auditable exception workflow exists.
 */
export function isExcludedHostCancellation(priceBreakdown: unknown): boolean {
  if (!priceBreakdown || typeof priceBreakdown !== "object" || Array.isArray(priceBreakdown)) return false;
  const cancellation = (priceBreakdown as Record<string, unknown>).cancellation;
  if (!cancellation || typeof cancellation !== "object" || Array.isArray(cancellation)) return false;
  const details = cancellation as Record<string, unknown>;
  return details.cancelledBy === "HOST" && details.isExcluded === true;
}

export function evaluateHostGoodStanding(
  accountStatus: string | null | undefined,
  fallbackGoodStanding: boolean,
): Pick<SuperhostQualificationCriterion, "status" | "explanation"> & { accountGoodStanding: boolean } {
  if (accountStatus === undefined) {
    return fallbackGoodStanding
      ? {
          accountGoodStanding: true,
          status: "PASS",
          explanation: "Host account is active and eligible to host.",
        }
      : {
          accountGoodStanding: false,
          status: "FAIL",
          explanation: "Host account is not in active standing.",
        };
  }

  switch (accountStatus) {
    case "ACTIVE":
      return {
        accountGoodStanding: true,
        status: "PASS",
        explanation: "Host account is active and eligible to host.",
      };
    case "SUSPENDED":
      return {
        accountGoodStanding: false,
        status: "FAIL",
        explanation: "Host account is suspended and cannot qualify for Superhost.",
      };
    case "INVITATION_PENDING":
      return {
        accountGoodStanding: false,
        status: "FAIL",
        explanation: "Host account activation is incomplete and cannot qualify for Superhost.",
      };
    default:
      return {
        accountGoodStanding: false,
        status: "BLOCKED",
        explanation: "Host account standing cannot be verified from the authoritative account status.",
      };
  }
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
  const cancellationExceptionVerificationState = input.cancellationExceptionVerificationState ?? "VERIFIED";
  const cancellationMet = cancellationExceptionVerificationState === "VERIFIED" && rawHostCancellationRatePercentage < 1;
  // Keep the existing persisted/display metric stable; the raw value above is
  // deliberately used only for the qualification boundary.
  const hostCancellationRatePercentage = Math.round(rawHostCancellationRatePercentage * 100) / 100;
  const goodStanding = evaluateHostGoodStanding(input.accountStatus, input.accountGoodStanding);
  const criteria: SuperhostQualificationCriterion[] = [
    {
      id: "LISTING_OWNERSHIP",
      actualValue: isListingOwner,
      requiredThreshold: "At least one eligible owned HOME listing",
      status: isListingOwner ? "PASS" : "FAIL",
      explanation: isListingOwner
        ? "Host owns at least one eligible HOME listing."
        : "Host must be a listing owner to qualify for Superhost.",
    },
    {
      id: "HOSTING_VOLUME",
      actualValue: { completedReservationsCount: input.completedReservationsCount, completedNightsCount: input.completedNightsCount },
      requiredThreshold: "At least 10 completed reservations, or 3 completed reservations and 100 completed nights",
      status: hostingVolumeMet ? "PASS" : "FAIL",
      explanation: hostingVolumeMet
        ? "Hosting volume requirement is met."
        : "Hosting volume requirement is not met.",
    },
    {
      id: "RATING",
      actualValue: input.overallRating,
      requiredThreshold: "Published review average of at least 4.80",
      status: ratingMet ? "PASS" : "FAIL",
      explanation: ratingMet
        ? "Published review average meets the 4.80 requirement."
        : "A published review average of at least 4.80 is required.",
    },
    {
      id: "RESPONSE_RATE",
      actualValue: input.responseRatePercentage,
      requiredThreshold: "At least 90% of qualifying guest inquiries answered within 24 hours",
      status: responseRateMet ? "PASS" : "FAIL",
      explanation: responseRateMet
        ? "Response rate meets the 90% requirement."
        : input.responseRatePercentage === null
          ? "Response rate is unavailable until there is a qualifying guest inquiry."
          : "Response rate must be at least 90%.",
    },
    {
      id: "CANCELLATION_RATE",
      actualValue: hostCancellationRatePercentage,
      requiredThreshold: "Host cancellation rate below 1%",
      status: cancellationExceptionVerificationState === "UNVERIFIED"
        ? "BLOCKED"
        : cancellationMet ? "PASS" : "FAIL",
      explanation: cancellationExceptionVerificationState === "UNVERIFIED"
        ? "A host cancellation is marked excluded, but no approved Superhost exception source can verify that exclusion."
        : cancellationMet
          ? "Host cancellation rate remains below 1%."
          : "Host cancellation rate must remain below 1%.",
    },
    {
      id: "GOOD_STANDING",
      actualValue: input.accountStatus ?? input.accountGoodStanding,
      requiredThreshold: "Active Homyz host account",
      status: goodStanding.status,
      explanation: goodStanding.explanation,
    },
  ];

  const missingInformation: string[] = [];
  const unresolvedPolicyDependencies: string[] = [];
  if (cancellationExceptionVerificationState === "UNVERIFIED") {
    const dependency = "Approved Superhost cancellation-exception provenance is not available for an excluded host cancellation.";
    missingInformation.push(dependency);
    unresolvedPolicyDependencies.push(dependency);
  }
  if (goodStanding.status === "BLOCKED") {
    missingInformation.push("Authoritative host account status is unavailable or unrecognized.");
  }

  const failureReasons: string[] = [];
  if (!isListingOwner) failureReasons.push("Host must be a listing owner to qualify for Superhost.");
  if (!hostingVolumeMet) failureReasons.push("Hosting volume requirement is not met.");
  if (!ratingMet) failureReasons.push("A published review average of at least 4.80 is required.");
  if (!responseRateMet) failureReasons.push(
    input.responseRatePercentage === null
      ? "Response rate is unavailable until there is a qualifying guest inquiry."
      : "Response rate must be at least 90%.",
  );
  if (cancellationExceptionVerificationState === "UNVERIFIED") {
    failureReasons.push("Host cancellation exception cannot be verified.");
  } else if (!cancellationMet) failureReasons.push("Host cancellation rate must remain below 1%.");
  if (goodStanding.status === "FAIL") failureReasons.push(goodStanding.explanation);
  if (goodStanding.status === "BLOCKED") failureReasons.push("Host account standing cannot be verified.");
  const hasBlockedCriterion = criteria.some((criterion) => criterion.status === "BLOCKED");
  const eligibleNow = !hasBlockedCriterion && criteria.every((criterion) => criterion.status === "PASS");
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
    accountGoodStanding: goodStanding.accountGoodStanding,
    accountStandingMet: goodStanding.status === "PASS",
    eligibleNow,
    failureReasons,
    qualification: {
      assessmentPeriod: input.assessmentPeriod ?? null,
      criteria,
      eligibilityStatus: hasBlockedCriterion ? "CANNOT_DETERMINE" : eligibleNow ? "ELIGIBLE" : "NOT_ELIGIBLE",
      missingInformation,
      unresolvedPolicyDependencies,
    } satisfies SuperhostQualificationResult,
  };
}
