import { BookingStatus } from "@/generated/prisma/enums";

/**
 * Standardized Booking Lifecycle, Payment State, and Refund State Machine.
 *
 * Provides central, reusable domain logic to ensure financial correctness,
 * prevent invalid state transitions, and maintain data integrity across
 * Guest, Host, and Admin operations.
 */

export const BOOKING_LIFECYCLE_STATUSES = [
  "DRAFT",
  "PENDING",
  "CONFIRMED",
  "CURRENT_STAY",
  "COMPLETED",
  "CANCELLED",
  "DECLINED",
  "EXPIRED",
] as const;

export type BookingLifecycleStatus = (typeof BOOKING_LIFECYCLE_STATUSES)[number];

export const PAYMENT_LIFECYCLE_STATUSES = [
  "PENDING",
  "AUTHORIZED",
  "CAPTURED",
  "FAILED",
  "VOIDED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;

export type PaymentLifecycleStatus = (typeof PAYMENT_LIFECYCLE_STATUSES)[number];

export const REFUND_LIFECYCLE_STATUSES = [
  "NONE",
  "REQUESTED",
  "UNDER_REVIEW",
  "APPROVED",
  "PROCESSING",
  "SUCCEEDED",
  "FAILED",
  "REJECTED",
] as const;

export type RefundLifecycleStatus = (typeof REFUND_LIFECYCLE_STATUSES)[number];

/**
 * Permitted status transitions for reservations.
 * Keys represent current states; values represent permitted next states.
 */
export const ALLOWED_BOOKING_TRANSITIONS: Record<BookingLifecycleStatus, readonly BookingLifecycleStatus[]> = {
  DRAFT: ["PENDING", "CONFIRMED", "CANCELLED"],
  PENDING: ["CONFIRMED", "DECLINED", "EXPIRED", "CANCELLED"],
  CONFIRMED: ["CURRENT_STAY", "COMPLETED", "CANCELLED"],
  CURRENT_STAY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  DECLINED: [],
  EXPIRED: [],
};

/**
 * Permitted status transitions for payment authorizations and captures.
 */
export const ALLOWED_PAYMENT_TRANSITIONS: Record<PaymentLifecycleStatus, readonly PaymentLifecycleStatus[]> = {
  PENDING: ["AUTHORIZED", "CAPTURED", "FAILED", "VOIDED"],
  AUTHORIZED: ["CAPTURED", "VOIDED", "FAILED"],
  CAPTURED: ["PARTIALLY_REFUNDED", "REFUNDED"],
  PARTIALLY_REFUNDED: ["PARTIALLY_REFUNDED", "REFUNDED"],
  REFUNDED: [],
  VOIDED: [],
  FAILED: [],
};

/**
 * Validates whether a booking status transition is permitted by domain rules.
 */
export function validateBookingTransition(
  currentStatus: BookingLifecycleStatus | string,
  targetStatus: BookingLifecycleStatus | string,
): { valid: boolean; reason?: string } {
  const normCurrent = (currentStatus || "").toUpperCase() as BookingLifecycleStatus;
  const normTarget = (targetStatus || "").toUpperCase() as BookingLifecycleStatus;

  if (normCurrent === normTarget) {
    return { valid: true };
  }

  const allowedNext = ALLOWED_BOOKING_TRANSITIONS[normCurrent];
  if (!allowedNext) {
    return { valid: false, reason: `Unknown current booking status: "${currentStatus}"` };
  }

  if (!allowedNext.includes(normTarget)) {
    return {
      valid: false,
      reason: `Cannot transition booking from "${normCurrent}" to "${normTarget}". Terminal or invalid transition.`,
    };
  }

  return { valid: true };
}

/**
 * Validates whether a payment status transition is permitted.
 */
export function validatePaymentTransition(
  currentStatus: PaymentLifecycleStatus | string,
  targetStatus: PaymentLifecycleStatus | string,
): { valid: boolean; reason?: string } {
  const normCurrent = (currentStatus || "").toUpperCase() as PaymentLifecycleStatus;
  const normTarget = (targetStatus || "").toUpperCase() as PaymentLifecycleStatus;

  if (normCurrent === normTarget) {
    return { valid: true };
  }

  const allowedNext = ALLOWED_PAYMENT_TRANSITIONS[normCurrent];
  if (!allowedNext) {
    return { valid: false, reason: `Unknown current payment status: "${currentStatus}"` };
  }

  if (!allowedNext.includes(normTarget)) {
    return {
      valid: false,
      reason: `Cannot transition payment from "${normCurrent}" to "${normTarget}".`,
    };
  }

  return { valid: true };
}

/**
 * Validates whether a payment capture can be executed for a booking.
 * Enforces rule: Booking must be confirmed and payment authorized or pending.
 */
export function canCapturePayment(
  bookingStatus: BookingLifecycleStatus | string,
  paymentStatus: PaymentLifecycleStatus | string,
): { allowed: boolean; reason?: string } {
  const normBooking = (bookingStatus || "").toUpperCase();
  const normPayment = (paymentStatus || "").toUpperCase();

  if (normBooking !== "CONFIRMED") {
    return { allowed: false, reason: `Payment capture requires a confirmed reservation (current: ${normBooking}).` };
  }

  if (normPayment === "CAPTURED") {
    return { allowed: false, reason: "Payment is already captured. Duplicate capture rejected." };
  }

  if (normPayment !== "AUTHORIZED" && normPayment !== "PENDING") {
    return { allowed: false, reason: `Cannot capture payment with status: ${normPayment}.` };
  }

  return { allowed: true };
}

/**
 * Validates whether an authorization release / void can be executed.
 */
export function canReleasePaymentAuthorization(
  bookingStatus: BookingLifecycleStatus | string,
  paymentStatus: PaymentLifecycleStatus | string,
): { allowed: boolean; reason?: string } {
  const normBooking = (bookingStatus || "").toUpperCase();
  const normPayment = (paymentStatus || "").toUpperCase();

  if (normPayment !== "AUTHORIZED") {
    return { allowed: false, reason: `Only authorized payments can be released (current: ${normPayment}).` };
  }

  const validTerminalStates = ["CANCELLED", "DECLINED", "EXPIRED"];
  if (!validTerminalStates.includes(normBooking)) {
    return {
      allowed: false,
      reason: `Authorization can only be released for cancelled, declined, or expired bookings (current: ${normBooking}).`,
    };
  }

  return { allowed: true };
}

/**
 * Evaluates whether a refund can be initiated and verifies limits without float rounding.
 * All amounts must be non-negative integers in minor units (cents).
 */
export function validateRefundEligibility(params: {
  paymentStatus: PaymentLifecycleStatus | string;
  capturedAmount: number;
  alreadyRefundedAmount: number;
  requestedRefundAmount: number;
}): { eligible: boolean; maxRefundableAmount: number; reason?: string } {
  const { capturedAmount, alreadyRefundedAmount, requestedRefundAmount } = params;
  const normPayment = (params.paymentStatus || "").toUpperCase();

  if (normPayment !== "CAPTURED" && normPayment !== "PARTIALLY_REFUNDED") {
    return {
      eligible: false,
      maxRefundableAmount: 0,
      reason: `Refunds can only be issued against captured payments (current payment status: ${normPayment}).`,
    };
  }

  if (requestedRefundAmount <= 0) {
    return {
      eligible: false,
      maxRefundableAmount: Math.max(0, capturedAmount - alreadyRefundedAmount),
      reason: "Requested refund amount must be greater than zero.",
    };
  }

  const maxRefundable = Math.max(0, capturedAmount - alreadyRefundedAmount);
  if (requestedRefundAmount > maxRefundable) {
    return {
      eligible: false,
      maxRefundableAmount: maxRefundable,
      reason: `Requested refund amount (${requestedRefundAmount} cents) exceeds available captured balance (${maxRefundable} cents).`,
    };
  }

  return { eligible: true, maxRefundableAmount: maxRefundable };
}

/**
 * Sanitizes a listing or booking record before sending to administrative views.
 * Strictly strips sensitive private arrival secrets (smart lock codes, Wi-Fi passwords, lockbox codes).
 */
export function sanitizeListingSecrets<T extends Record<string, any>>(listing: T): Omit<T, "wifiPassword" | "doorCode" | "lockboxCode"> {
  if (!listing || typeof listing !== "object") return listing;
  const copy = { ...listing };
  delete (copy as any).wifiPassword;
  delete (copy as any).doorCode;
  delete (copy as any).lockboxCode;
  return copy;
}

