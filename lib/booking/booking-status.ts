export type ComputedBookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CURRENT_STAY"
  | "COMPLETED"
  | "CANCELLED"
  | "DECLINED"
  | "EXPIRED";

export interface BookingStatusDetails {
  status: ComputedBookingStatus;
  label: string;
  badgeLabel: string;
  badgeClass: string;
  headline: string;
  description: string;
  isUpcoming: boolean;
  isCurrent: boolean;
  isCompleted: boolean;
  isCancelled: boolean;
  isPending: boolean;
  isDeclinedOrExpired: boolean;
}

export interface BookingAvailableActions {
  canCancel: boolean;
  cancelDisabledReason?: string;
  canModify: boolean;
  modifyDisabledReason?: string;
  canReview: boolean;
  reviewDisabledReason?: string;
  hasReviewed: boolean;
  reviewId?: string | null;
  canContactHost: boolean;
  canViewReceipt: boolean;
  canBookAgain: boolean;
  canViewListing: boolean;
  canGetHelp: boolean;
  isArrivalInfoReleased: boolean;
  arrivalReleaseDateTime: Date;
}

/** Parses standard 24-hour ("15:00") or 12-hour ("3:00 PM") time strings into [hours, minutes]. */
export function parseTimeString(timeStr?: string | null, defaultHour = 15, defaultMinute = 0): [number, number] {
  if (!timeStr || typeof timeStr !== "string") return [defaultHour, defaultMinute];
  const trimmed = timeStr.trim();
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = parseInt(match12[2], 10);
    const meridiem = match12[3].toUpperCase();
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
    return [hour, minute];
  }
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return [parseInt(match24[1], 10), parseInt(match24[2], 10)];
  }
  return [defaultHour, defaultMinute];
}

/** Combines calendar date with local time string in UTC to prevent timezone skew. */
export function getEffectiveDateTime(
  calendarDate: Date | string,
  timeStr?: string | null,
  defaultHour = 15,
  defaultMinute = 0,
): Date {
  const base = new Date(calendarDate);
  const [hour, minute] = parseTimeString(timeStr, defaultHour, defaultMinute);
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hour, minute, 0, 0));
}

/** Computes the total number of calendar nights between two dates. */
export function calculateCalendarNights(startDate: Date | string, endDate: Date | string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.max(0, Math.round((endUtc - startUtc) / 86_400_000));
}

/** 30-day review period after checkout for completed stays. */
export const REVIEW_WINDOW_DAYS = 30;

/** Arrival info & access codes released 48 hours prior to check-in for confirmed guests. */
export const ARRIVAL_RELEASE_HOURS = 48;

/**
 * Computes dynamic reservation status based on database status and real-world date/time.
 * Guarantees that past stays (checkout in the past) resolve to COMPLETED.
 */
export function computeBookingStatus(opts: {
  dbStatus: string;
  startDate: Date | string;
  endDate: Date | string;
  checkInStart?: string | null;
  checkOutTime?: string | null;
  now?: Date;
}): BookingStatusDetails {
  const now = opts.now ?? new Date();
  const checkinDateTime = getEffectiveDateTime(opts.startDate, opts.checkInStart, 15, 0);
  const checkoutDateTime = getEffectiveDateTime(opts.endDate, opts.checkOutTime, 11, 0);

  const dbStatusUpper = (opts.dbStatus || "").toUpperCase();

  // 1. Explicitly cancelled bookings
  if (dbStatusUpper === "CANCELLED") {
    return {
      status: "CANCELLED",
      label: "Cancelled",
      badgeLabel: "Cancelled",
      badgeClass: "bg-red-50 text-red-700 border border-red-200",
      headline: "Reservation cancelled",
      description: "This reservation was cancelled. Check below for cancellation terms, refund status, and invoice.",
      isUpcoming: false,
      isCurrent: false,
      isCompleted: false,
      isCancelled: true,
      isPending: false,
      isDeclinedOrExpired: false,
    };
  }

  // 2. Explicitly declined requests
  if (dbStatusUpper === "DECLINED") {
    return {
      status: "DECLINED",
      label: "Declined",
      badgeLabel: "Declined",
      badgeClass: "bg-zinc-100 text-zinc-600 border border-zinc-200",
      headline: "Request declined",
      description: "The host was unable to accommodate this reservation request.",
      isUpcoming: false,
      isCurrent: false,
      isCompleted: false,
      isCancelled: false,
      isPending: false,
      isDeclinedOrExpired: true,
    };
  }

  // 3. Completed stays: current time is after checkout
  if (now.getTime() >= checkoutDateTime.getTime()) {
    return {
      status: "COMPLETED",
      label: "Completed",
      badgeLabel: "Past stay",
      badgeClass: "bg-zinc-100 text-zinc-700 border border-zinc-200",
      headline: "Past stay",
      description: "Hope you enjoyed your stay! You can view your receipt, contact your host, write a review, or book again.",
      isUpcoming: false,
      isCurrent: false,
      isCompleted: true,
      isCancelled: false,
      isPending: false,
      isDeclinedOrExpired: false,
    };
  }

  // 4. Current stay: current time is between check-in and checkout
  if (now.getTime() >= checkinDateTime.getTime()) {
    return {
      status: "CURRENT_STAY",
      label: "Currently staying",
      badgeLabel: "Current stay",
      badgeClass: "bg-blue-50 text-blue-800 border border-blue-200",
      headline: "Enjoy your stay!",
      description: "You are currently staying at this property. Wi-Fi credentials, access details, and host assistance are available below.",
      isUpcoming: false,
      isCurrent: true,
      isCompleted: false,
      isCancelled: false,
      isPending: false,
      isDeclinedOrExpired: false,
    };
  }

  // 5. Pending confirmation (future start date awaiting approval)
  if (dbStatusUpper === "PENDING") {
    return {
      status: "PENDING",
      label: "Pending confirmation",
      badgeLabel: "Pending",
      badgeClass: "bg-amber-50 text-amber-900 border border-amber-200",
      headline: "Awaiting host confirmation",
      description: "Your reservation request has been submitted to the host. You will receive an immediate notification once confirmed.",
      isUpcoming: true,
      isCurrent: false,
      isCompleted: false,
      isCancelled: false,
      isPending: true,
      isDeclinedOrExpired: false,
    };
  }

  // 6. Confirmed upcoming stay
  return {
    status: "CONFIRMED",
    label: "Confirmed",
    badgeLabel: "Upcoming",
    badgeClass: "bg-emerald-50 text-emerald-800 border border-emerald-200",
    headline: "You're all set for your trip!",
    description: "Your reservation is confirmed. Arrival instructions and property directions are prepared for your arrival.",
    isUpcoming: true,
    isCurrent: false,
    isCompleted: false,
    isCancelled: false,
    isPending: false,
    isDeclinedOrExpired: false,
  };
}

/** Computes permissible actions based on dynamic status and business rules. */
export function getBookingAvailableActions(opts: {
  statusDetails: BookingStatusDetails;
  startDate: Date | string;
  endDate: Date | string;
  checkInStart?: string | null;
  checkOutTime?: string | null;
  hasReview: boolean;
  reviewId?: string | null;
  isNonRefundable?: boolean;
  now?: Date;
}): BookingAvailableActions {
  const now = opts.now ?? new Date();
  const checkinDateTime = getEffectiveDateTime(opts.startDate, opts.checkInStart, 15, 0);
  const checkoutDateTime = getEffectiveDateTime(opts.endDate, opts.checkOutTime, 11, 0);

  const { status, isCompleted, isCancelled, isCurrent } = opts.statusDetails;

  // Arrival info release time: 48h before check-in
  const arrivalReleaseDateTime = new Date(checkinDateTime.getTime() - ARRIVAL_RELEASE_HOURS * 60 * 60 * 1000);
  const isArrivalInfoReleased =
    (status === "CONFIRMED" || status === "CURRENT_STAY" || status === "COMPLETED") &&
    now.getTime() >= arrivalReleaseDateTime.getTime();

  // Review logic
  const reviewWindowClosesAt = new Date(checkoutDateTime.getTime() + REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const isReviewPeriodExpired = now.getTime() > reviewWindowClosesAt.getTime();

  let canReview = false;
  let reviewDisabledReason: string | undefined;

  if (isCompleted) {
    if (opts.hasReview) {
      canReview = false;
      reviewDisabledReason = "You have already reviewed this stay.";
    } else if (isReviewPeriodExpired) {
      canReview = false;
      reviewDisabledReason = `The ${REVIEW_WINDOW_DAYS}-day review period for this reservation has expired.`;
    } else {
      canReview = true;
    }
  } else if (isCancelled) {
    reviewDisabledReason = "Reviews are not available for cancelled reservations.";
  } else if (isCurrent) {
    reviewDisabledReason = "Reviews become available after checkout.";
  } else {
    reviewDisabledReason = "Reviews become available after your stay has completed.";
  }

  // Cancellation logic
  let canCancel = false;
  let cancelDisabledReason: string | undefined;

  if (isCancelled) {
    cancelDisabledReason = "This reservation has already been cancelled.";
  } else if (isCompleted) {
    cancelDisabledReason = "This reservation can no longer be cancelled because the stay has ended.";
  } else if (isCurrent) {
    cancelDisabledReason = "Reservations cannot be cancelled after the check-in time has passed.";
  } else if (now.getTime() >= checkinDateTime.getTime()) {
    cancelDisabledReason = "Reservations cannot be cancelled after check-in has started.";
  } else {
    canCancel = true;
  }

  // Modification logic (dates / guests)
  let canModify = false;
  let modifyDisabledReason: string | undefined;

  if (isCancelled) {
    modifyDisabledReason = "Cancelled reservations cannot be modified.";
  } else if (isCompleted) {
    modifyDisabledReason = "Completed stays cannot be modified.";
  } else if (isCurrent) {
    modifyDisabledReason = "Stays currently in progress cannot be modified online. Please message your host.";
  } else if (status === "PENDING") {
    modifyDisabledReason = "Pending requests cannot be modified. You may withdraw and submit a new request.";
  } else if (now.getTime() >= checkinDateTime.getTime()) {
    modifyDisabledReason = "Modifications are not permitted after check-in has started.";
  } else {
    canModify = true;
  }

  return {
    canCancel,
    cancelDisabledReason,
    canModify,
    modifyDisabledReason,
    canReview,
    reviewDisabledReason,
    hasReviewed: opts.hasReview,
    reviewId: opts.reviewId,
    canContactHost: true,
    canViewReceipt: status !== "DECLINED" && status !== "EXPIRED",
    canBookAgain: isCompleted || isCancelled,
    canViewListing: true,
    canGetHelp: true,
    isArrivalInfoReleased,
    arrivalReleaseDateTime,
  };
}

