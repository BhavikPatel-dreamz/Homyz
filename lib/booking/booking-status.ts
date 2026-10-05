import { differenceInBookingNights, parseBookingDate } from "@/lib/booking/booking-date";

export type ComputedBookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CURRENT_STAY"
  | "COMPLETED"
  | "CANCELLED"
  | "DECLINED"
  | "EXPIRED";

export function isUpcomingBookingStatus(status: string | null | undefined): boolean {
  const normalized = (status || "").toUpperCase();
  return normalized === "PENDING" || normalized === "PENDING_HOST_CONFIRMATION" || normalized === "CONFIRMED" || normalized === "CURRENT_STAY";
}

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
  const base = parseBookingDate(calendarDate);
  const [hour, minute] = parseTimeString(timeStr, defaultHour, defaultMinute);
  return new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), hour, minute, 0, 0));
}

/** Computes the total number of calendar nights between two dates. */
export function calculateCalendarNights(startDate: Date | string, endDate: Date | string): number {
  return differenceInBookingNights(startDate, endDate);
}

/** 30-day review period after checkout for completed stays. */
export const REVIEW_WINDOW_DAYS = 30;

/** Arrival info & access codes released 48 hours prior to check-in for confirmed guests. */
export const ARRIVAL_RELEASE_HOURS = 48;

import { isBookingRequestExpired } from "@/lib/booking/booking-expiry";

/**
 * Computes dynamic reservation status based on database status, metadata, and real-world date/time.
 * Guarantees that past stays (checkout in the past) resolve to COMPLETED, and expired/declined
 * requests resolve to their specific terminal statuses.
 */
export function computeBookingStatus(opts: {
  dbStatus: string;
  startDate: Date | string;
  endDate: Date | string;
  checkInStart?: string | null;
  checkOutTime?: string | null;
  now?: Date;
  createdAt?: Date | string;
  isExpired?: boolean;
  rejectionReason?: string | null;
  rejectionBy?: string | null;
}): BookingStatusDetails {
  const now = opts.now ?? new Date();
  const checkinDateTime = getEffectiveDateTime(opts.startDate, opts.checkInStart, 15, 0);
  const checkoutDateTime = getEffectiveDateTime(opts.endDate, opts.checkOutTime, 11, 0);

  const dbStatusUpper = (opts.dbStatus || "").toUpperCase();

  // 1. Explicitly EXPIRED requests (or CANCELLED due to system expiry)
  const isExplicitlyExpired =
    dbStatusUpper === "EXPIRED" ||
    opts.isExpired === true ||
    (dbStatusUpper === "CANCELLED" && (opts.rejectionReason === "EXPIRED" || opts.rejectionBy === "SYSTEM"));

  if (isExplicitlyExpired) {
    return {
      status: "EXPIRED",
      label: "Expired",
      badgeLabel: "Expired",
      badgeClass: "bg-zinc-100 text-zinc-600 border border-zinc-200",
      headline: "Request expired",
      description: "This booking request was not confirmed within the 24-hour response window and has expired.",
      isUpcoming: false,
      isCurrent: false,
      isCompleted: false,
      isCancelled: true,
      isPending: false,
      isDeclinedOrExpired: true,
    };
  }

  // 2. Explicitly DECLINED requests (or CANCELLED due to host decline)
  const isExplicitlyDeclined =
    dbStatusUpper === "DECLINED" ||
    (dbStatusUpper === "CANCELLED" && (opts.rejectionBy === "HOST" || (opts.rejectionReason && opts.rejectionReason !== "EXPIRED")));

  if (isExplicitlyDeclined) {
    const reasonText = opts.rejectionReason?.trim();
    return {
      status: "DECLINED",
      label: "Declined",
      badgeLabel: "Declined",
      badgeClass: "bg-zinc-100 text-zinc-600 border border-zinc-200",
      headline: "Request declined",
      description: reasonText
        ? `The host declined this booking request: "${reasonText}"`
        : "The host was unable to accommodate this reservation request.",
      isUpcoming: false,
      isCurrent: false,
      isCompleted: false,
      isCancelled: true,
      isPending: false,
      isDeclinedOrExpired: true,
    };
  }

  // 3. Explicitly cancelled bookings
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

  // 4. Pending confirmation (future start date awaiting approval)
  if (dbStatusUpper === "PENDING") {
    const hasExpiredByTime = opts.createdAt ? isBookingRequestExpired(opts.createdAt, now, opts.endDate) : false;
    if (hasExpiredByTime) {
      return {
        status: "EXPIRED",
        label: "Expired",
        badgeLabel: "Expired",
        badgeClass: "bg-zinc-100 text-zinc-600 border border-zinc-200",
        headline: "Request expired",
        description: "This booking request was not confirmed within the 24-hour response window and has expired.",
        isUpcoming: false,
        isCurrent: false,
        isCompleted: false,
        isCancelled: true,
        isPending: false,
        isDeclinedOrExpired: true,
      };
    }

    return {
      status: "PENDING",
      label: "Pending confirmation",
      badgeLabel: "Pending host approval",
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

  // 5. Completed stays: current time is after checkout
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

  // 6. Current stay: current time is between check-in and checkout
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

  // 7. Confirmed upcoming stay
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

  if (status === "EXPIRED") {
    cancelDisabledReason = "This reservation request has already expired.";
  } else if (status === "DECLINED") {
    cancelDisabledReason = "This reservation request was declined.";
  } else if (isCancelled) {
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

  if (status === "EXPIRED") {
    modifyDisabledReason = "Expired requests cannot be modified.";
  } else if (status === "DECLINED") {
    modifyDisabledReason = "Declined requests cannot be modified.";
  } else if (isCancelled) {
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

export interface BookingStatusPresentation {
  status: ComputedBookingStatus;
  label: string;
  badgeLabel: string;
  badgeClass: string;
  description: string;
  headline: string;
  allowedActions: {
    canCancel: boolean;
    canModify: boolean;
    canContactHost: boolean;
    canViewReceipt: boolean;
    canAcceptOrReject: boolean;
  };
}

/**
 * Centralized presenter for booking status across guest and host surfaces.
 * Returns consistent badges, user-friendly labels, and context explanations.
 */
export function getBookingStatusPresentation(statusInput: ComputedBookingStatus | string): BookingStatusPresentation {
  const s = (statusInput || "PENDING").toUpperCase() as ComputedBookingStatus;

  switch (s) {
    case "CONFIRMED":
    case "CURRENT_STAY":
      return {
        status: s,
        label: s === "CURRENT_STAY" ? "Stay in progress" : "Confirmed",
        badgeLabel: "Confirmed",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
        headline: "Your booking is confirmed",
        description: "Your reservation is confirmed. You are ready to pack your bags and enjoy your stay.",
        allowedActions: {
          canCancel: true,
          canModify: s !== "CURRENT_STAY",
          canContactHost: true,
          canViewReceipt: true,
          canAcceptOrReject: false,
        },
      };

    case "COMPLETED":
      return {
        status: "COMPLETED",
        label: "Completed",
        badgeLabel: "Completed",
        badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-200",
        headline: "Past stay completed",
        description: "We hope you had a wonderful trip! You can write a review or book this property again.",
        allowedActions: {
          canCancel: false,
          canModify: false,
          canContactHost: true,
          canViewReceipt: true,
          canAcceptOrReject: false,
        },
      };

    case "DECLINED":
      return {
        status: "DECLINED",
        label: "Request declined",
        badgeLabel: "Declined",
        badgeClass: "bg-rose-100 text-rose-800 border-rose-200",
        headline: "The host declined this request",
        description: "The host was unable to accept your request. Any held dates have been released, and no payment was charged.",
        allowedActions: {
          canCancel: false,
          canModify: false,
          canContactHost: true,
          canViewReceipt: false,
          canAcceptOrReject: false,
        },
      };

    case "EXPIRED":
      return {
        status: "EXPIRED",
        label: "Request expired",
        badgeLabel: "Expired",
        badgeClass: "bg-slate-100 text-slate-700 border-slate-300",
        headline: "The host did not respond in time",
        description: "The 24-hour response deadline passed without a response from the host. Held dates have been released, and no payment was collected.",
        allowedActions: {
          canCancel: false,
          canModify: false,
          canContactHost: true,
          canViewReceipt: false,
          canAcceptOrReject: false,
        },
      };

    case "CANCELLED":
      return {
        status: "CANCELLED",
        label: "Reservation cancelled",
        badgeLabel: "Cancelled",
        badgeClass: "bg-red-100 text-red-800 border-red-200",
        headline: "Reservation cancelled",
        description: "This reservation was cancelled. Date holds have been released according to the cancellation policy.",
        allowedActions: {
          canCancel: false,
          canModify: false,
          canContactHost: true,
          canViewReceipt: false,
          canAcceptOrReject: false,
        },
      };

    case "PENDING":
    default:
      return {
        status: "PENDING",
        label: "Waiting for host confirmation",
        badgeLabel: "Pending host approval",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-200",
        headline: "The host is reviewing your request",
        description: "Your reservation request has been submitted. The host has 24 hours to confirm or decline.",
        allowedActions: {
          canCancel: true,
          canModify: false,
          canContactHost: true,
          canViewReceipt: false,
          canAcceptOrReject: true,
        },
      };
  }
}

export interface BookingStatusTimelineEvent {
  id: string;
  type:
    | "REQUEST_CREATED"
    | "WAITING_FOR_HOST"
    | "HOST_ACCEPTED"
    | "HOST_REJECTED"
    | "REQUEST_EXPIRED"
    | "BOOKING_CONFIRMED"
    | "BOOKING_CANCELLED";
  title: string;
  description: string;
  timestamp: string | null;
  state: "completed" | "current" | "upcoming" | "terminal_declined" | "terminal_expired" | "terminal_cancelled";
  actor?: string | null;
}

type BookingTimelineBreakdown = {
  expiresAt?: Date | string | null;
  expiredAt?: Date | string | null;
  acceptance?: { acceptedAt?: Date | string | null; acceptedBy?: string | null };
  rejection?: { rejectedAt?: Date | string | null; rejectedBy?: string | null; reason?: string | null };
  cancellation?: { cancelledAt?: Date | string | null; cancelledBy?: string | null; reason?: string | null };
};

/**
 * Builds a chronological, truthful status timeline based strictly on actual booking events and timestamps.
 * Does NOT invent synthetic historical events that never occurred.
 */
export function getBookingStatusTimeline(opts: {
  createdAt: Date | string;
  updatedAt?: Date | string | null;
  statusDetails: BookingStatusDetails;
  priceBreakdown?: unknown;
}): BookingStatusTimelineEvent[] {
  const events: BookingStatusTimelineEvent[] = [];
  const createdAtIso = new Date(opts.createdAt).toISOString();
  const breakdown: BookingTimelineBreakdown = opts.priceBreakdown && typeof opts.priceBreakdown === "object"
    ? opts.priceBreakdown as BookingTimelineBreakdown
    : {};
  const status = opts.statusDetails.status;

  // 1. Initial Request Event (Always occurred)
  events.push({
    id: "req-created",
    type: "REQUEST_CREATED",
    title: "Booking requested",
    description: "Request submitted and dates held for host review.",
    timestamp: createdAtIso,
    state: "completed",
    actor: "guest",
  });

  // 2. Subsequent Lifecycle Event
  if (status === "PENDING") {
    const expiresAt = breakdown.expiresAt ? new Date(breakdown.expiresAt).toISOString() : null;
    events.push({
      id: "req-waiting",
      type: "WAITING_FOR_HOST",
      title: "Waiting for host confirmation",
      description: "The host has 24 hours to review and accept your booking.",
      timestamp: expiresAt,
      state: "current",
      actor: "host",
    });
  } else if (status === "CONFIRMED" || status === "CURRENT_STAY" || status === "COMPLETED") {
    const acceptedAt = breakdown.acceptance?.acceptedAt
      ? new Date(breakdown.acceptance.acceptedAt).toISOString()
      : opts.updatedAt
        ? new Date(opts.updatedAt).toISOString()
        : createdAtIso;

    events.push({
      id: "req-accepted",
      type: "HOST_ACCEPTED",
      title: "Host accepted & booking confirmed",
      description: "Your reservation is confirmed. Payment is deferred until provider configuration.",
      timestamp: acceptedAt,
      state: "completed",
      actor: breakdown.acceptance?.acceptedBy || "host",
    });
  } else if (status === "DECLINED") {
    const rejectedAt = breakdown.rejection?.rejectedAt
      ? new Date(breakdown.rejection.rejectedAt).toISOString()
      : opts.updatedAt
        ? new Date(opts.updatedAt).toISOString()
        : createdAtIso;
    const reason = breakdown.rejection?.reason;

    events.push({
      id: "req-declined",
      type: "HOST_REJECTED",
      title: "Host declined request",
      description: reason ? `Declined: "${reason}"` : "The host declined this booking request. Date holds have been released.",
      timestamp: rejectedAt,
      state: "terminal_declined",
      actor: breakdown.rejection?.rejectedBy || "host",
    });
  } else if (status === "EXPIRED") {
    const recordedExpiry = breakdown.expiredAt || breakdown.rejection?.rejectedAt;
    const expiredAt = recordedExpiry
      ? new Date(recordedExpiry).toISOString()
      : breakdown.expiresAt
        ? new Date(breakdown.expiresAt).toISOString()
        : opts.updatedAt
          ? new Date(opts.updatedAt).toISOString()
          : createdAtIso;

    events.push({
      id: "req-expired",
      type: "REQUEST_EXPIRED",
      title: "Request expired",
      description: "The host did not respond within the 24-hour deadline. Date holds have been released.",
      timestamp: expiredAt,
      state: "terminal_expired",
      actor: "system",
    });
  } else if (status === "CANCELLED") {
    const cancelledAt = breakdown.cancellation?.cancelledAt
      ? new Date(breakdown.cancellation.cancelledAt).toISOString()
      : opts.updatedAt
        ? new Date(opts.updatedAt).toISOString()
        : createdAtIso;
    const reason = breakdown.cancellation?.reason;

    events.push({
      id: "req-cancelled",
      type: "BOOKING_CANCELLED",
      title: "Reservation cancelled",
      description: reason || "This reservation was cancelled. Calendar dates have been released.",
      timestamp: cancelledAt,
      state: "terminal_cancelled",
      actor: breakdown.cancellation?.cancelledBy || "guest",
    });
  }

  return events;
}
