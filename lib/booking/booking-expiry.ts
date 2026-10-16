import { compareBookingDates } from "@/lib/booking/booking-date";

/**
 * Authoritative Request-to-Book response deadline and expiry policy.
 * Centralizes the 24-hour response window, countdown math, and hold lifecycle.
 */

export const REQUEST_TO_BOOK_RESPONSE_HOURS = 24;
export const REQUEST_EXPIRY_MS = REQUEST_TO_BOOK_RESPONSE_HOURS * 60 * 60 * 1000;

/** Urgent threshold: host has fewer than 6 hours remaining to respond. */
export const EXPIRY_URGENT_HOURS = 6;
export const EXPIRY_URGENT_MS = EXPIRY_URGENT_HOURS * 60 * 60 * 1000;

/** Computes the exact server-authoritative expiry timestamp for a booking request. */
export function getAuthoritativeExpiryDate(createdAt: Date | string): Date {
  const created = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  return new Date(created.getTime() + REQUEST_EXPIRY_MS);
}

/** Computes the rolling threshold date; pending bookings created on or before this are expired. */
export function getExpiryThresholdDate(now: Date = new Date()): Date {
  return new Date(now.getTime() - REQUEST_EXPIRY_MS);
}

/** Determines whether a pending request has exceeded its 24-hour deadline or stay end date. */
export function isBookingRequestExpired(
  createdAt: Date | string,
  now: Date = new Date(),
  endDate?: Date | string,
): boolean {
  const expiresAt = getAuthoritativeExpiryDate(createdAt);
  if (now.getTime() >= expiresAt.getTime()) {
    return true;
  }
  if (endDate) {
    if (compareBookingDates(endDate, now) <= 0) {
      return true;
    }
  }
  return false;
}

export interface ExpiryTimeRemaining {
  totalMs: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
  isUrgent: boolean;
}

/** Calculates the exact duration remaining until request expiry. */
export function getTimeRemaining(createdAt: Date | string, now: Date = new Date()): ExpiryTimeRemaining {
  const expiresAt = getAuthoritativeExpiryDate(createdAt);
  const diffMs = expiresAt.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      totalMs: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isExpired: true,
      isUrgent: false,
    };
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  return {
    totalMs: diffMs,
    hours,
    minutes,
    seconds,
    isExpired: false,
    isUrgent: diffMs <= EXPIRY_URGENT_MS,
  };
}

/** Formats a countdown label for display in host and guest pending request UI. */
export function formatExpiryCountdown(
  createdAt: Date | string,
  now: Date = new Date(),
): { text: string; isExpired: boolean; isUrgent: boolean; hours: number; minutes: number } {
  const remaining = getTimeRemaining(createdAt, now);

  if (remaining.isExpired) {
    return {
      text: "Request expired",
      isExpired: true,
      isUrgent: false,
      hours: 0,
      minutes: 0,
    };
  }

  if (remaining.hours === 0 && remaining.minutes === 0) {
    return {
      text: "Respond within < 1m",
      isExpired: false,
      isUrgent: true,
      hours: 0,
      minutes: 0,
    };
  }

  if (remaining.hours === 0) {
    return {
      text: `Respond within ${remaining.minutes}m`,
      isExpired: false,
      isUrgent: true,
      hours: 0,
      minutes: remaining.minutes,
    };
  }

  return {
    text: `Respond within ${remaining.hours}h ${remaining.minutes}m`,
    isExpired: false,
    isUrgent: remaining.isUrgent,
    hours: remaining.hours,
    minutes: remaining.minutes,
  };
}

/**
 * Checks whether a booking currently asserts an active hold on listing inventory.
 * - CONFIRMED bookings always assert an active hold.
 * - PENDING bookings assert an active hold ONLY IF they have not expired.
 * - CANCELLED, REJECTED, and EXPIRED bookings do not assert a hold.
 */
export function isHoldActive(
  booking: {
    status: string;
    createdAt: Date | string;
    endDate?: Date | string;
  },
  now: Date = new Date(),
): boolean {
  const statusUpper = (booking.status || "").toUpperCase();
  if (statusUpper === "CONFIRMED") {
    return true;
  }
  if (statusUpper === "PENDING") {
    return !isBookingRequestExpired(booking.createdAt, now, booking.endDate);
  }
  return false;
}
