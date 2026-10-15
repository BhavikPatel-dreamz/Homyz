import { getEffectiveDateTime, REVIEW_WINDOW_DAYS } from "./booking-status";

export type ReviewEligibilityStatus =
  | "ELIGIBLE"
  | "ALREADY_SUBMITTED"
  | "WINDOW_EXPIRED"
  | "NOT_COMPLETED"
  | "NOT_AUTHORIZED";

export interface ReviewEligibilityResult {
  eligible: boolean;
  canReview: boolean;
  status: ReviewEligibilityStatus;
  reason: string | null;
  checkoutAt: Date;
  reviewDeadline: Date;
  hasExistingReview: boolean;
  reciprocalSubmitted: boolean;
}

/**
 * Computes the 14-day review deadline after checkout.
 */
export function computeReviewDeadline(
  endDate: Date | string,
  checkOutTime?: string | null,
): Date {
  const checkoutAt = getEffectiveDateTime(endDate, checkOutTime, 11, 0);
  return new Date(checkoutAt.getTime() + REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Validates eligibility for a guest-to-property review.
 */
export function evaluateGuestReviewEligibility(input: {
  isGuest: boolean;
  bookingStatus: string;
  endDate: Date | string;
  checkOutTime?: string | null;
  hasGuestReview: boolean;
  hasHostReview?: boolean;
  now?: Date;
}): ReviewEligibilityResult {
  const now = input.now ?? new Date();
  const checkoutAt = getEffectiveDateTime(input.endDate, input.checkOutTime, 11, 0);
  const reviewDeadline = computeReviewDeadline(input.endDate, input.checkOutTime);

  if (!input.isGuest) {
    return {
      eligible: false,
      canReview: false,
      status: "NOT_AUTHORIZED",
      reason: "Only the reservation guest can submit a property review.",
      checkoutAt,
      reviewDeadline,
      hasExistingReview: input.hasGuestReview,
      reciprocalSubmitted: Boolean(input.hasHostReview),
    };
  }

  if (input.bookingStatus.toUpperCase() !== "CONFIRMED" || now.getTime() < checkoutAt.getTime()) {
    return {
      eligible: false,
      canReview: false,
      status: "NOT_COMPLETED",
      reason: "Reviews are available after checkout of a confirmed reservation.",
      checkoutAt,
      reviewDeadline,
      hasExistingReview: input.hasGuestReview,
      reciprocalSubmitted: Boolean(input.hasHostReview),
    };
  }

  if (input.hasGuestReview) {
    return {
      eligible: false,
      canReview: false,
      status: "ALREADY_SUBMITTED",
      reason: "You have already reviewed this stay.",
      checkoutAt,
      reviewDeadline,
      hasExistingReview: true,
      reciprocalSubmitted: Boolean(input.hasHostReview),
    };
  }

  if (now.getTime() > reviewDeadline.getTime()) {
    return {
      eligible: false,
      canReview: false,
      status: "WINDOW_EXPIRED",
      reason: `The ${REVIEW_WINDOW_DAYS}-day review period for this reservation has expired.`,
      checkoutAt,
      reviewDeadline,
      hasExistingReview: false,
      reciprocalSubmitted: Boolean(input.hasHostReview),
    };
  }

  return {
    eligible: true,
    canReview: true,
    status: "ELIGIBLE",
    reason: null,
    checkoutAt,
    reviewDeadline,
    hasExistingReview: false,
    reciprocalSubmitted: Boolean(input.hasHostReview),
  };
}

/**
 * Validates eligibility for a host-to-guest review.
 */
export function evaluateHostReviewEligibility(input: {
  isHost: boolean;
  bookingStatus: string;
  endDate: Date | string;
  checkOutTime?: string | null;
  hasHostReview: boolean;
  hasGuestReview?: boolean;
  now?: Date;
}): ReviewEligibilityResult {
  const now = input.now ?? new Date();
  const checkoutAt = getEffectiveDateTime(input.endDate, input.checkOutTime, 11, 0);
  const reviewDeadline = computeReviewDeadline(input.endDate, input.checkOutTime);

  if (!input.isHost) {
    return {
      eligible: false,
      canReview: false,
      status: "NOT_AUTHORIZED",
      reason: "Only the primary host or assigned co-host can review the guest.",
      checkoutAt,
      reviewDeadline,
      hasExistingReview: input.hasHostReview,
      reciprocalSubmitted: Boolean(input.hasGuestReview),
    };
  }

  if (input.bookingStatus.toUpperCase() !== "CONFIRMED" || now.getTime() < checkoutAt.getTime()) {
    return {
      eligible: false,
      canReview: false,
      status: "NOT_COMPLETED",
      reason: "Reviews are available after checkout of a confirmed reservation.",
      checkoutAt,
      reviewDeadline,
      hasExistingReview: input.hasHostReview,
      reciprocalSubmitted: Boolean(input.hasGuestReview),
    };
  }

  if (input.hasHostReview) {
    return {
      eligible: false,
      canReview: false,
      status: "ALREADY_SUBMITTED",
      reason: "A host review has already been submitted for this reservation.",
      checkoutAt,
      reviewDeadline,
      hasExistingReview: true,
      reciprocalSubmitted: Boolean(input.hasGuestReview),
    };
  }

  if (now.getTime() > reviewDeadline.getTime()) {
    return {
      eligible: false,
      canReview: false,
      status: "WINDOW_EXPIRED",
      reason: `The ${REVIEW_WINDOW_DAYS}-day review period has expired.`,
      checkoutAt,
      reviewDeadline,
      hasExistingReview: false,
      reciprocalSubmitted: Boolean(input.hasGuestReview),
    };
  }

  return {
    eligible: true,
    canReview: true,
    status: "ELIGIBLE",
    reason: null,
    checkoutAt,
    reviewDeadline,
    hasExistingReview: false,
    reciprocalSubmitted: Boolean(input.hasGuestReview),
  };
}

