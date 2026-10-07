import { getEffectiveDateTime, REVIEW_WINDOW_DAYS } from "./booking-status";

export type HostReviewEligibilityStatus =
  | "REVIEW_PENDING"
  | "REVIEW_SUBMITTED"
  | "REVIEW_WINDOW_EXPIRED"
  | "NOT_ELIGIBLE";

export type HostReviewEligibility = {
  eligible: boolean;
  status: HostReviewEligibilityStatus;
  reason: string | null;
  reviewDeadline: Date | null;
  reviewSubmitted: boolean;
};

/**
 * Central server-side policy for host-to-guest review eligibility. The caller
 * must derive `isAuthorizedHost` from its scoped booking query; never from a
 * client-supplied listing or host ID.
 */
export function getHostReviewEligibility(input: {
  isAuthorizedHost: boolean;
  bookingStatus: string;
  endDate: Date | string;
  checkOutTime?: string | null;
  hasHostReview: boolean;
  now?: Date;
}): HostReviewEligibility {
  const now = input.now ?? new Date();
  const checkoutAt = getEffectiveDateTime(input.endDate, input.checkOutTime, 11, 0);
  const reviewDeadline = new Date(
    checkoutAt.getTime() + REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  );

  if (!input.isAuthorizedHost) {
    return {
      eligible: false,
      status: "NOT_ELIGIBLE",
      reason: "This reservation is not managed by the current host.",
      reviewDeadline: null,
      reviewSubmitted: false,
    };
  }

  // In this application COMPLETED is derived from a confirmed reservation
  // whose checkout time has passed; it is not a persisted BookingStatus enum.
  if (input.bookingStatus.toUpperCase() !== "CONFIRMED" || now < checkoutAt) {
    return {
      eligible: false,
      status: "NOT_ELIGIBLE",
      reason: "Reviews are available after a confirmed stay has completed.",
      reviewDeadline,
      reviewSubmitted: false,
    };
  }

  if (input.hasHostReview) {
    return {
      eligible: false,
      status: "REVIEW_SUBMITTED",
      reason: "A host review has already been submitted for this stay.",
      reviewDeadline,
      reviewSubmitted: true,
    };
  }

  if (now > reviewDeadline) {
    return {
      eligible: false,
      status: "REVIEW_WINDOW_EXPIRED",
      reason: `The ${REVIEW_WINDOW_DAYS}-day review window has expired.`,
      reviewDeadline,
      reviewSubmitted: false,
    };
  }

  return {
    eligible: true,
    status: "REVIEW_PENDING",
    reason: null,
    reviewDeadline,
    reviewSubmitted: false,
  };
}
