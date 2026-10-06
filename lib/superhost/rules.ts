const QUARTER_START_MONTHS = [0, 3, 6, 9] as const;

export interface SuperhostRequirementInput {
  completedReservationsCount: number;
  completedNightsCount: number;
  overallRating: number | null;
  responseRatePercentage: number | null;
  hostCancellationCount: number;
  cancellationDenominator: number;
  accountGoodStanding: boolean;
}

export function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

export function isQuarterlyEvaluationCheckpoint(value: Date): boolean {
  const day = startOfUtcDay(value);
  return day.getUTCDate() === 1 && QUARTER_START_MONTHS.includes(day.getUTCMonth() as (typeof QUARTER_START_MONTHS)[number]);
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
  if (!isQuarterlyEvaluationCheckpoint(evaluationDate)) {
    throw new Error("Superhost evaluations may only run on January 1, April 1, July 1, or October 1.");
  }
  const windowEnd = new Date(startOfUtcDay(evaluationDate));
  windowEnd.setUTCDate(windowEnd.getUTCDate() - 1);
  const windowStart = new Date(windowEnd);
  windowStart.setUTCFullYear(windowStart.getUTCFullYear() - 1);
  windowStart.setUTCDate(windowStart.getUTCDate() + 1);
  return { windowStart, windowEnd };
}

export function evaluateSuperhostRequirements(input: SuperhostRequirementInput) {
  const reservationPathMet = input.completedReservationsCount >= 10;
  const longStayPathMet = input.completedReservationsCount >= 3 && input.completedNightsCount >= 100;
  const hostingVolumeMet = reservationPathMet || longStayPathMet;
  const ratingMet = input.overallRating !== null && input.overallRating >= 4.8;
  const responseRateMet = input.responseRatePercentage !== null && input.responseRatePercentage >= 90;
  const hostCancellationRatePercentage = input.cancellationDenominator > 0
    ? Math.round((input.hostCancellationCount / input.cancellationDenominator) * 10000) / 100
    : 0;
  const cancellationMet = hostCancellationRatePercentage < 1;
  const failureReasons: string[] = [];
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
    reservationPathMet,
    longStayPathMet,
    hostingVolumeMet,
    ratingMet,
    responseRateMet,
    hostCancellationRatePercentage,
    cancellationMet,
    eligibleNow: hostingVolumeMet && ratingMet && responseRateMet && cancellationMet && input.accountGoodStanding,
    failureReasons,
  };
}
