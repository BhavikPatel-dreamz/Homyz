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

export type CancellationInitiator = "GUEST" | "HOST" | "ADMIN" | "UNKNOWN";

export interface ResolvedCancellationDetails {
  isCancellation: boolean;
  cancelledBy: CancellationInitiator;
  cancelledAt: string | null;
  reason: string | null;
  notes: string | null;
  adminId: string | null;
  adminEmail: string | null;
  guestRefundAmount: number | null;
  hostPayoutRetained: number | null;
  requiresAttention: boolean;
  paymentStatus: string;
  refundStatus: string;
}

/**
 * Authoritative check if a database booking record represents a genuine cancellation.
 * Excludes rejected booking requests (rejection.rejectedBy === "HOST") and expired requests.
 */
export function isAuthoritativeCancellation(booking: {
  status: string;
  priceBreakdown?: unknown;
}): boolean {
  const normStatus = (booking.status || "").toUpperCase();
  if (normStatus !== "CANCELLED") return false;

  const pb = (booking.priceBreakdown && typeof booking.priceBreakdown === "object" && !Array.isArray(booking.priceBreakdown))
    ? (booking.priceBreakdown as Record<string, any>)
    : {};

  // If explicit cancellation object exists, it is a genuine cancellation
  if (pb.cancellation && typeof pb.cancellation === "object") {
    return true;
  }

  // If rejection object or expiredAt exists without cancellation object, it is a rejected/expired request, NOT a cancellation
  if (pb.rejection || pb.expiredAt) {
    return false;
  }

  // Historical or direct cancellation
  return true;
}

/**
 * Resolves authoritative cancellation details and financial states from a booking record.
 */
export function resolveCancellationDetails(booking: {
  id: string;
  status: string;
  priceBreakdown?: unknown;
  updatedAt?: Date | string;
  createdAt?: Date | string;
  payments?: Array<{ id: string; status: string; amount: number; provider?: string | null }>;
  refunds?: Array<{ id: string; status: string; amount: number; reason?: string | null }>;
}): ResolvedCancellationDetails {
  const isCancellation = isAuthoritativeCancellation(booking);
  const pb = (booking.priceBreakdown && typeof booking.priceBreakdown === "object" && !Array.isArray(booking.priceBreakdown))
    ? (booking.priceBreakdown as Record<string, any>)
    : {};

  const rawCancel = pb.cancellation && typeof pb.cancellation === "object" ? pb.cancellation : null;

  let cancelledBy: CancellationInitiator = "UNKNOWN";
  if (rawCancel?.cancelledBy) {
    const rawUpper = String(rawCancel.cancelledBy).toUpperCase();
    if (rawUpper === "GUEST") cancelledBy = "GUEST";
    else if (rawUpper === "HOST") cancelledBy = "HOST";
    else if (rawUpper === "ADMIN") cancelledBy = "ADMIN";
  }

  const cancelledAt = rawCancel?.cancelledAt
    ? String(rawCancel.cancelledAt)
    : booking.updatedAt
    ? (typeof booking.updatedAt === "string" ? booking.updatedAt : booking.updatedAt.toISOString())
    : null;

  const reason = rawCancel?.reason ? String(rawCancel.reason).trim() : null;
  const notes = rawCancel?.notes ? String(rawCancel.notes).trim() : null;
  const adminId = rawCancel?.adminId ? String(rawCancel.adminId) : null;
  const adminEmail = rawCancel?.adminEmail ? String(rawCancel.adminEmail) : null;
  const guestRefundAmount = typeof rawCancel?.guestRefundAmount === "number" ? rawCancel.guestRefundAmount : null;
  const hostPayoutRetained = typeof rawCancel?.hostPayoutRetained === "number" ? rawCancel.hostPayoutRetained : null;

  // Resolve payment status
  const primaryPayment = booking.payments && booking.payments.length > 0 ? booking.payments[0] : null;
  const paymentStatus = primaryPayment?.status || pb.paymentStatus || (isCancellation ? "COMPLETED" : "PENDING");

  // Resolve refund status
  const primaryRefund = booking.refunds && booking.refunds.length > 0 ? booking.refunds[0] : null;
  let refundStatus = "N/A";
  if (primaryRefund?.status) {
    refundStatus = primaryRefund.status;
  } else if (guestRefundAmount === 0) {
    refundStatus = "NO_REFUND_DUE";
  } else if (typeof guestRefundAmount === "number" && guestRefundAmount > 0) {
    refundStatus = "SUCCEEDED"; // Automatic policy refund completed upon cancellation
  }

  const hasFinancialIssues =
    (booking.payments || []).some(
      (p) => (p.status || "").toUpperCase() === "FAILED" || (p.status || "").toUpperCase() === "VOIDED",
    ) ||
    (booking.refunds || []).some(
      (r) => (r.status || "").toUpperCase() === "PENDING" || (r.status || "").toUpperCase() === "PROCESSING" || (r.status || "").toUpperCase() === "FAILED",
    );

  const requiresAttention = Boolean(rawCancel?.requiresAttention) || hasFinancialIssues;

  return {
    isCancellation,
    cancelledBy,
    cancelledAt,
    reason,
    notes,
    adminId,
    adminEmail,
    guestRefundAmount,
    hostPayoutRetained,
    requiresAttention,
    paymentStatus,
    refundStatus,
  };
}


