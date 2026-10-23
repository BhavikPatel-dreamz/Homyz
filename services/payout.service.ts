import "server-only";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import {
  Role,
  BookingStatus,
  PaymentStatus,
  RefundStatus,
  QualityIncidentStatus,
} from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { assertRole } from "@/lib/permissions/authorize";
import { auditService } from "@/services/audit.service";
import { notificationService } from "@/services/notification.service";
import {
  extractStoredHostPayout,
  StoredHostPayout,
} from "@/lib/booking/booking-financials";
import { getPaymentPolicy } from "@/lib/booking/payment-policy";
import { nanoid } from "nanoid";
import type { Prisma } from "@/generated/prisma/client";
import { bookingDateKey } from "@/lib/booking/booking-date";
import {
  resolveTimeframeBounds,
  calculateDelta,
  type TimeframeGranularity,
} from "@/lib/dashboard/reporting-filter";

// ============================================================================
// Types & Interfaces
// ============================================================================

export type PayoutStatus =
  | "SCHEDULED"
  | "ELIGIBLE_SETTLEMENT"
  | "PROCESSING"
  | "PAID"
  | "ON_HOLD"
  | "FAILED"
  | "CANCELLED"
  | "REQUIRES_REVIEW";

export type HoldType =
  | "DISPUTE_HOLD"
  | "FRAUD_REVIEW"
  | "COMPLIANCE_HOLD"
  | "REFUND_HOLD"
  | "MANUAL_ADMIN_HOLD";

export interface HostPayoutMethod {
  id: string;
  accountHolderName: string;
  bankName: string;
  bankCode?: string;
  ibanMasked: string;
  ibanLast4: string;
  ibanFormatted?: string;
  routingCode?: string;
  currency: string;
  isDefault: boolean;
  status: "VERIFIED" | "PENDING_VERIFICATION" | "REJECTED";
  verifiedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AddPayoutMethodInput {
  accountHolderName: string;
  bankName: string;
  iban: string;
  routingCode?: string;
  currency?: string;
  isDefault?: boolean;
}

export interface PayoutHoldRecord {
  isHeld: boolean;
  holdType?: HoldType;
  reason?: string;
  heldBy?: string;
  heldAt?: string;
  releasedBy?: string;
  releasedAt?: string;
  releaseReason?: string;
}

export interface PayoutExecutionRecord {
  status: "PROCESSING" | "PAID" | "FAILED";
  settlementReference: string;
  amount: number;
  currency: string;
  payoutMethodMasked: string;
  executedAt: string;
  executedBy: string;
  idempotencyKey: string;
  channel: string;
  failureReason?: string;
}

export interface PayoutAdjustmentRecord {
  id: string;
  bookingId: string;
  type:
    | "REFUND_DEDUCTION"
    | "DISPUTE_CLAWBACK"
    | "DAMAGE_CLAIM_CREDIT"
    | "BONUS_CREDIT"
    | "MANUAL_CORRECTION";
  amount: number; // in cents
  currency: string;
  reason: string;
  status: "PENDING" | "DEDUCTED" | "FORGIVEN";
  createdAt: string;
  deductedFromBookingId?: string;
  deductedAt?: string;
}

export interface HostEarningsSummary {
  totalPaidVolume: number; // minor units (cents)
  totalPaidCount: number;
  eligibleSettlementVolume: number;
  eligibleSettlementCount: number;
  scheduledPendingVolume: number;
  scheduledPendingCount: number;
  onHoldVolume: number;
  onHoldCount: number;
  totalGrossVolume: number;
  totalPlatformCommission: number;
  pendingDeductionsVolume: number;
  currency: string;
}

export interface AdminPayoutSummaryData {
  totalPaidVolume: number;
  totalPaidCount: number;
  eligibleSettlementVolume: number;
  eligibleSettlementCount: number;
  scheduledPendingStayVolume: number;
  scheduledPendingStayCount: number;
  onHoldVolume: number;
  onHoldCount: number;
  platformCommissionVolume: number;
  payoutsRequiringReviewCount: number;
  currency: string;
}

export interface PayoutListItem {
  id: string;
  bookingId: string;
  startDate: string;
  endDate: string;
  scheduledPayoutDate: string;
  host: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
  listing: {
    id: string;
    title: string;
    city: string | null;
    photos: string[];
  };
  grossEarnings: number;
  platformFee: number;
  deductions: number;
  netPayout: number;
  currency: string;
  status: PayoutStatus;
  holdDetails?: PayoutHoldRecord | null;
  executionDetails?: PayoutExecutionRecord | null;
  payoutAccountMasked: string;
  settlementExecutionSupported: boolean;
  createdAt: string;
}

export interface PayoutListQuery {
  page?: number;
  limit?: number;
  tab?: string;
  status?: string;
  search?: string;
  hostId?: string;
  startDate?: string;
  endDate?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "checkOut" | "netPayout" | "createdAt" | "startDate" | "endDate";
  sortOrder?: "asc" | "desc";
}

// ============================================================================
// Saudi Bank Name Directory & IBAN Validation
// ============================================================================

const SAUDI_BANK_CODES: Record<string, string> = {
  "10": "Saudi National Bank (SNB / الأهلي)",
  "20": "Riyad Bank (بنك الرياض)",
  "80": "Al Rajhi Bank (مصرف الراجحي)",
  "05": "Alinma Bank (مصرف الإنماء)",
  "50": "Banque Saudi Fransi (البنك السعودي الفرنسي)",
  "45": "SAB (Saudi Awwal Bank / البنك السعودي الأول)",
  "15": "Bank AlJazira (بنك الجزيرة)",
  "65": "The Saudi Investment Bank (البنك السعودي للاستثمار)",
  "55": "Bank AlBilad (بنك البلاد)",
  "30": "Arab National Bank (البنك العربي الوطني)",
  "60": "Gulf International Bank (بنك الخليج الدولي)",
  "75": "Emirates NBD KSA (بنك الإمارات دبي الوطني)",
};

/**
 * Validates a Saudi Arabian IBAN format and mod-97 check digits.
 * Standard format: SA + 2 check digits + 2 bank code digits + 18 account digits (24 chars)
 */
export function validateSaudiIban(rawIban: string): {
  valid: boolean;
  error?: string;
  cleanIban?: string;
  bankCode?: string;
  bankName?: string;
  formatted?: string;
} {
  const clean = rawIban.replace(/[\s\-_]/g, "").toUpperCase();

  if (!clean.startsWith("SA")) {
    return { valid: false, error: "Saudi IBAN must start with 'SA'." };
  }

  if (clean.length !== 24) {
    return {
      valid: false,
      error: `Saudi IBAN must be exactly 24 characters (current: ${clean.length}).`,
    };
  }

  const ibanRegex = /^SA\d{2}[0-9A-Z]{20}$/;
  if (!ibanRegex.test(clean)) {
    return { valid: false, error: "Saudi IBAN contains invalid characters." };
  }

  // Mod-97 check
  // Move the first 4 characters to the end: SAxx -> at end
  const rearranged = clean.slice(4) + clean.slice(0, 4);

  // Replace each letter with two digits (A=10, ..., Z=35)
  let numericString = "";
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0);
    if (code >= 65 && code <= 90) {
      numericString += (code - 55).toString();
    } else {
      numericString += ch;
    }
  }

  // Divide the numeric string by 97 using modular arithmetic on chunks
  let remainder = 0;
  for (let i = 0; i < numericString.length; i += 7) {
    const chunk = remainder.toString() + numericString.slice(i, i + 7);
    remainder = Number(chunk) % 97;
  }

  if (remainder !== 1) {
    return { valid: false, error: "Invalid IBAN checksum digits." };
  }

  const bankCode = clean.slice(4, 6);
  const bankName =
    SAUDI_BANK_CODES[bankCode] || "Saudi Licensed Commercial Bank";

  // Formatted in 4-character blocks: SA03 8000 0000 0000 0000 0000
  const formatted = clean.replace(/(.{4})/g, "$1 ").trim();

  return {
    valid: true,
    cleanIban: clean,
    bankCode,
    bankName,
    formatted,
  };
}

/**
 * Mask an IBAN for safe display.
 * Example: SA03 8000 0000 0000 0000 1234 -> "SA03 **** **** **** **** 1234"
 */
export function maskIban(iban: string): string {
  const clean = iban.replace(/[\s\-_]/g, "").toUpperCase();
  if (clean.length < 8) return "SA** ****";
  const start = clean.slice(0, 4);
  const end = clean.slice(-4);
  return `${start} **** **** **** **** ${end}`;
}

// ============================================================================
// Helper: Sanitize Listing
// ============================================================================

function sanitizeListing(listing: any) {
  if (!listing) return null;
  const { doorCode, wifiPassword, lockboxCode, ...safe } = listing;
  return safe;
}

// ============================================================================
// Host Payout Methods Management (Phase 13)
// ============================================================================

/**
 * Retrieves all registered payout methods for a host.
 */
export async function getHostPayoutMethods(
  hostId: string,
): Promise<HostPayoutMethod[]> {
  const user = await prisma.user.findUnique({
    where: { id: hostId },
    select: { personalInfo: true },
  });

  if (!user) {
    throw AppError.notFound(`User ${hostId} not found.`);
  }

  const info = (user.personalInfo as Record<string, any>) || {};
  const methods: HostPayoutMethod[] = Array.isArray(info.payoutMethods)
    ? info.payoutMethods
    : [];
  return methods;
}

/**
 * Adds a new Saudi IBAN payout method for a host.
 */
export async function addHostPayoutMethod(
  hostId: string,
  input: AddPayoutMethodInput,
): Promise<HostPayoutMethod> {
  if (!input.accountHolderName?.trim()) {
    throw AppError.badRequest("Account holder name is required.");
  }
  if (!input.bankName?.trim()) {
    throw AppError.badRequest("Bank name is required.");
  }

  const validation = validateSaudiIban(input.iban);
  if (!validation.valid || !validation.cleanIban) {
    throw AppError.badRequest(validation.error || "Invalid Saudi IBAN.");
  }

  const user = await prisma.user.findUnique({
    where: { id: hostId },
    select: { id: true, name: true, personalInfo: true },
  });

  if (!user) throw AppError.notFound(`User ${hostId} not found.`);

  const info = (user.personalInfo as Record<string, any>) || {};
  const existingMethods: HostPayoutMethod[] = Array.isArray(info.payoutMethods)
    ? [...info.payoutMethods]
    : [];

  const masked = maskIban(validation.cleanIban);
  const last4 = validation.cleanIban.slice(-4);

  // Check if identical IBAN already registered
  if (
    existingMethods.some(
      (m) => m.ibanLast4 === last4 && m.bankCode === validation.bankCode,
    )
  ) {
    throw AppError.conflict("This payout account is already registered.");
  }

  const isFirstMethod = existingMethods.length === 0;
  const isDefault = input.isDefault ?? isFirstMethod;

  if (isDefault) {
    for (const m of existingMethods) {
      m.isDefault = false;
    }
  }

  const now = new Date().toISOString();
  // If host identity is already verified, payout method is marked VERIFIED; otherwise PENDING_VERIFICATION
  const isIdentityVerified = info.identityStatus === "VERIFIED";

  const newMethod: HostPayoutMethod = {
    id: `pm_${nanoid(12)}`,
    accountHolderName: input.accountHolderName.trim(),
    bankName: input.bankName.trim() || validation.bankName || "Commercial Bank",
    bankCode: validation.bankCode,
    ibanMasked: masked,
    ibanLast4: last4,
    ibanFormatted: validation.formatted,
    routingCode: input.routingCode?.trim() || undefined,
    currency: input.currency?.toUpperCase() || "SAR",
    isDefault,
    status: isIdentityVerified ? "VERIFIED" : "PENDING_VERIFICATION",
    verifiedAt: isIdentityVerified ? now : undefined,
    createdAt: now,
    updatedAt: now,
  };

  existingMethods.push(newMethod);

  await prisma.user.update({
    where: { id: hostId },
    data: {
      personalInfo: {
        ...info,
        payoutMethods: existingMethods,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return newMethod;
}

/**
 * Sets a specific payout method as the default method for a host.
 */
export async function setDefaultPayoutMethod(
  hostId: string,
  methodId: string,
): Promise<HostPayoutMethod[]> {
  const user = await prisma.user.findUnique({
    where: { id: hostId },
    select: { personalInfo: true },
  });

  if (!user) throw AppError.notFound(`User ${hostId} not found.`);

  const info = (user.personalInfo as Record<string, any>) || {};
  const existingMethods: HostPayoutMethod[] = Array.isArray(info.payoutMethods)
    ? [...info.payoutMethods]
    : [];

  const target = existingMethods.find((m) => m.id === methodId);
  if (!target) {
    throw AppError.notFound(`Payout method ${methodId} not found.`);
  }

  const updatedMethods = existingMethods.map((m) => ({
    ...m,
    isDefault: m.id === methodId,
    updatedAt: new Date().toISOString(),
  }));

  await prisma.user.update({
    where: { id: hostId },
    data: {
      personalInfo: {
        ...info,
        payoutMethods: updatedMethods,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return updatedMethods;
}

/**
 * Deletes a payout method from a host's account.
 */
export async function deleteHostPayoutMethod(
  hostId: string,
  methodId: string,
): Promise<HostPayoutMethod[]> {
  const user = await prisma.user.findUnique({
    where: { id: hostId },
    select: { personalInfo: true },
  });

  if (!user) throw AppError.notFound(`User ${hostId} not found.`);

  const info = (user.personalInfo as Record<string, any>) || {};
  const existingMethods: HostPayoutMethod[] = Array.isArray(info.payoutMethods)
    ? [...info.payoutMethods]
    : [];

  const remaining = existingMethods.filter((m) => m.id !== methodId);
  if (remaining.length === existingMethods.length) {
    throw AppError.notFound(`Payout method ${methodId} not found.`);
  }

  // If deleted method was default, make the first remaining method default
  if (remaining.length > 0 && !remaining.some((m) => m.isDefault)) {
    remaining[0].isDefault = true;
  }

  await prisma.user.update({
    where: { id: hostId },
    data: {
      personalInfo: {
        ...info,
        payoutMethods: remaining,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return remaining;
}

/**
 * Admin action to verify or reject a host payout method.
 */
export async function verifyHostPayoutMethod(
  actor: AuthUser,
  hostId: string,
  methodId: string,
  status: "VERIFIED" | "REJECTED",
  reason?: string,
): Promise<HostPayoutMethod> {
  assertRole(actor, [Role.ADMIN]);

  const user = await prisma.user.findUnique({
    where: { id: hostId },
    select: { id: true, email: true, personalInfo: true },
  });

  if (!user) throw AppError.notFound(`User ${hostId} not found.`);

  const info = (user.personalInfo as Record<string, any>) || {};
  const existingMethods: HostPayoutMethod[] = Array.isArray(info.payoutMethods)
    ? [...info.payoutMethods]
    : [];

  const target = existingMethods.find((m) => m.id === methodId);
  if (!target) throw AppError.notFound(`Payout method ${methodId} not found.`);

  const now = new Date().toISOString();
  target.status = status;
  target.updatedAt = now;
  if (status === "VERIFIED") {
    target.verifiedAt = now;
    target.rejectionReason = undefined;
  } else {
    target.rejectionReason = reason || "Account details could not be verified.";
  }

  await prisma.user.update({
    where: { id: hostId },
    data: {
      personalInfo: {
        ...info,
        payoutMethods: existingMethods,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "HOST_PAYOUT_METHOD_VERIFIED",
    resourceType: "USER",
    resourceId: hostId,
    description: `Payout method ${methodId} (${target.ibanMasked}) status updated to ${status} by admin.`,
    status: "SUCCESS",
    metadata: {
      methodId,
      status,
      reason,
      hostEmail: user.email,
    },
  });

  return target;
}

// ============================================================================
// Authoritative Earnings & Payout State Calculator (Phases 14 & 15)
// ============================================================================

export interface BookingPayoutCalculation {
  bookingId: string;
  startDate: Date;
  endDate: Date;
  scheduledPayoutDate: Date;
  grossEarnings: number;
  platformFee: number;
  deductions: number;
  netPayout: number;
  currency: string;
  status: PayoutStatus;
  holdDetails: PayoutHoldRecord | null;
  executionDetails: PayoutExecutionRecord | null;
  hasStoredSnapshot: boolean;
  isEligibleForSettlement: boolean;
  reasonsIneligible: string[];
}

/**
 * Calculates authoritative Host earnings and evaluates payout state for a single reservation.
 * Respects immutable price breakdown snapshot, cancellations, active quality incidents,
 * pending refunds, and administrative holds.
 */
export function calculateBookingPayout(
  booking: any,
  options: {
    now?: Date;
    hostPayoutMethods?: HostPayoutMethod[];
    activeQualityIncidentsCount?: number;
    activeRefundsCount?: number;
    hostServiceFeePercentage?: number;
  } = {},
): BookingPayoutCalculation {
  const now = options.now || new Date();
  const snapshot =
    booking.priceBreakdown &&
    typeof booking.priceBreakdown === "object" &&
    !Array.isArray(booking.priceBreakdown)
      ? (booking.priceBreakdown as Record<string, any>)
      : null;

  const storedPayout = extractStoredHostPayout(booking);

  // Compute gross earnings and host service fee
  let grossEarnings = 0;
  let platformFee = 0;
  let netPayout = 0;
  let currency = booking.currency || "SAR";
  let hasStoredSnapshot = false;

  if (storedPayout) {
    hasStoredSnapshot = true;
    grossEarnings =
      storedPayout.accommodationSubtotal +
      storedPayout.extraGuestFee +
      storedPayout.petFee +
      storedPayout.cleaningFee;
    platformFee = storedPayout.hostServiceFee;
    netPayout = storedPayout.netHostPayout;
    currency = storedPayout.currency || currency;
  } else {
    // A booking total is a guest charge, not evidence of a host entitlement.
    // Legacy rows without the immutable payout snapshot must be reviewed rather
    // than assigned an invented commission rate or an estimated payable value.
    hasStoredSnapshot = false;
  }

  // Handle Cancellation adjustments
  const cancellation = snapshot?.cancellation;
  if (booking.status === BookingStatus.CANCELLED || cancellation) {
    if (typeof cancellation?.hostPayoutRetained === "number") {
      netPayout = Math.max(0, cancellation.hostPayoutRetained);
    } else if (booking.status === BookingStatus.CANCELLED) {
      netPayout = 0;
    }
  }

  // Read administrative hold record if present
  const holdDetails: PayoutHoldRecord | null =
    snapshot?.payoutHold && typeof snapshot.payoutHold === "object"
      ? (snapshot.payoutHold as PayoutHoldRecord)
      : null;

  // Read execution record if already processed
  const executionDetails: PayoutExecutionRecord | null =
    snapshot?.payoutExecution && typeof snapshot.payoutExecution === "object"
      ? (snapshot.payoutExecution as PayoutExecutionRecord)
      : null;

  // Scheduled payout date: default 24 hours after check-in
  const scheduledPayoutDate = new Date(
    new Date(booking.startDate).getTime() + 24 * 60 * 60 * 1000,
  );

  // Payment captured check
  const payments = Array.isArray(booking.payments) ? booking.payments : [];
  const capturedPayment = payments.find(
    (p: any) =>
      p.status === PaymentStatus.CAPTURED ||
      p.status === PaymentStatus.PARTIALLY_REFUNDED ||
      (p.capturedAmount && p.capturedAmount > 0),
  );
  const capturedAmount = payments.reduce(
    (total: number, payment: any) => total + (payment.capturedAmount || 0),
    0,
  );
  const isPaymentCaptured = Boolean(capturedPayment);

  // Active refunds
  const refunds = Array.isArray(booking.refunds) ? booking.refunds : [];
  const activeRefunds =
    options.activeRefundsCount !== undefined
      ? options.activeRefundsCount > 0
      : refunds.some(
          (r: any) =>
            r.status === RefundStatus.PENDING ||
            r.status === RefundStatus.PROCESSING,
        );

  // Active quality incidents / disputes
  const qualityIncidents = Array.isArray(booking.qualityIncidents)
    ? booking.qualityIncidents
    : [];
  const hasActiveQualityIncident =
    options.activeQualityIncidentsCount !== undefined
      ? options.activeQualityIncidentsCount > 0
      : qualityIncidents.some(
          (i: any) =>
            i.status === QualityIncidentStatus.PENDING ||
            i.status === QualityIncidentStatus.CONFIRMED,
        );

  const reasonsIneligible: string[] = [];

  if (booking.status !== BookingStatus.CONFIRMED) {
    if (booking.status === BookingStatus.CANCELLED) {
      if (netPayout === 0) {
        return {
          bookingId: booking.id,
          startDate: booking.startDate,
          endDate: booking.endDate,
          scheduledPayoutDate,
          grossEarnings,
          platformFee,
          deductions: 0,
          netPayout: 0,
          currency,
          status: "CANCELLED",
          holdDetails,
          executionDetails,
          hasStoredSnapshot,
          isEligibleForSettlement: false,
          reasonsIneligible: ["Booking cancelled with full refund."],
        };
      }
    } else {
      reasonsIneligible.push(
        `Booking status is ${booking.status}, not CONFIRMED.`,
      );
    }
  }

  // Payment verification logic per Homyz payment policy & lifecycle recognition
  const policy = getPaymentPolicy();
  const isDeferredOrMockPolicy =
    !policy.onlinePaymentRequired ||
    snapshot?.paymentMode === "DEFERRED" ||
    snapshot?.paymentMode === "MOCK";
  const hasRecognizedHostEarnings = Boolean(
    snapshot?.hostEarnings &&
      typeof snapshot.hostEarnings === "object" &&
      (snapshot.hostEarnings as Record<string, any>).status === "EARNED",
  );
  const isBookingPaymentRecordedPaid =
    booking.paymentStatus === "PAID" ||
    booking.paymentStatus === "AUTHORIZED" ||
    booking.paymentStatus === "CAPTURED";
  const paymentSatisfied =
    isPaymentCaptured ||
    hasRecognizedHostEarnings ||
    isDeferredOrMockPolicy ||
    isBookingPaymentRecordedPaid;

  if (!paymentSatisfied) {
    reasonsIneligible.push("Guest payment has not been captured.");
  }

  if (hasStoredSnapshot && !paymentSatisfied && capturedAmount < netPayout) {
    reasonsIneligible.push(
      "Verified captured funds are lower than the stored host entitlement. Reconciliation is required before settlement.",
    );
  }

  const hasSucceededRefund = refunds.some(
    (r: any) => r.status === RefundStatus.SUCCEEDED,
  );
  if (hasSucceededRefund && !cancellation) {
    reasonsIneligible.push(
      "A completed refund exists without an explicit host-entitlement adjustment. Reconciliation is required before settlement.",
    );
  }

  if (now < scheduledPayoutDate) {
    reasonsIneligible.push(
      "Scheduled payout date (check-in + 24h) has not arrived yet.",
    );
  }

  if (holdDetails?.isHeld) {
    reasonsIneligible.push(
      `Administrative hold active: ${holdDetails.reason || holdDetails.holdType}`,
    );
  }

  if (activeRefunds) {
    reasonsIneligible.push(
      "Reservation has a refund request currently pending or processing.",
    );
  }

  if (hasActiveQualityIncident) {
    reasonsIneligible.push(
      "Reservation has an active quality incident / dispute under review.",
    );
  }

  // Payout Method check
  const hostMethods = options.hostPayoutMethods || [];
  const hasVerifiedMethod = hostMethods.some((m) => m.status === "VERIFIED");
  if (options.hostPayoutMethods && !hasVerifiedMethod) {
    reasonsIneligible.push(
      "Host has no verified default payout account configured.",
    );
  }

  // Status determination
  let status: PayoutStatus = "SCHEDULED";

  if (executionDetails?.status === "PAID") {
    status = "PAID";
  } else if (executionDetails?.status === "PROCESSING") {
    status = "PROCESSING";
  } else if (executionDetails?.status === "FAILED") {
    status = "FAILED";
  } else if (holdDetails?.isHeld || activeRefunds || hasActiveQualityIncident) {
    status = "ON_HOLD";
  } else if (
    !hasStoredSnapshot ||
    (hasSucceededRefund && !cancellation) ||
    (!paymentSatisfied && capturedAmount < netPayout)
  ) {
    status = "REQUIRES_REVIEW";
  } else if (now < scheduledPayoutDate) {
    status = "SCHEDULED";
  } else {
    // Scheduled payout date (check-in + 24h) has passed, verified snapshot exists, payment satisfied, no holds/disputes
    status = "ELIGIBLE_SETTLEMENT";
  }

  const isEligibleForSettlement =
    status === "ELIGIBLE_SETTLEMENT" &&
    (options.hostPayoutMethods !== undefined ? hasVerifiedMethod : true);

  return {
    bookingId: booking.id,
    startDate: booking.startDate,
    endDate: booking.endDate,
    scheduledPayoutDate,
    grossEarnings,
    platformFee,
    deductions: 0,
    netPayout,
    currency,
    status,
    holdDetails,
    executionDetails,
    hasStoredSnapshot,
    isEligibleForSettlement,
    reasonsIneligible,
  };
}

// ============================================================================
// Admin Payout Management Operations (Phase 17.1)
// ============================================================================

/**
 * Returns KPI aggregate summary for Host Payout tracking (Admin).
 * Provides the required 8 summary metrics.
 */
export async function getPayoutSummaryForAdmin(
  actor: AuthUser,
): Promise<AdminPayoutSummaryData> {
  assertRole(actor, [Role.ADMIN]);

  const now = new Date();

  // Load all confirmed bookings with payments, refunds, and quality incidents
  const bookings = await prisma.booking.findMany({
    where: {
      status: BookingStatus.CONFIRMED,
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
      status: true,
      totalPrice: true,
      cleaningFee: true,
      currency: true,
      priceBreakdown: true,
      refunds: { select: { id: true, status: true, amount: true } },
      payments: { select: { id: true, status: true, capturedAmount: true } },
      qualityIncidents: { select: { id: true, status: true } },
      listing: { select: { host: { select: { personalInfo: true } } } },
    },
  });

  let totalPaidVolume = 0;
  let totalPaidCount = 0;
  let eligibleSettlementVolume = 0;
  let eligibleSettlementCount = 0;
  let scheduledPendingStayVolume = 0;
  let scheduledPendingStayCount = 0;
  let onHoldVolume = 0;
  let onHoldCount = 0;
  let platformCommissionVolume = 0;
  let payoutsRequiringReviewCount = 0;

  for (const b of bookings) {
    const hostPersonalInfo = b.listing.host?.personalInfo as Record<string, any> | null | undefined;
    const hostPayoutMethods: HostPayoutMethod[] = Array.isArray(
      hostPersonalInfo?.payoutMethods,
    )
      ? (hostPersonalInfo!.payoutMethods as HostPayoutMethod[])
      : [];
    const calc = calculateBookingPayout(b, { now, hostPayoutMethods });

    platformCommissionVolume += calc.platformFee;

    if (calc.status === "PAID") {
      totalPaidVolume += calc.netPayout;
      totalPaidCount++;
    } else if (calc.status === "ELIGIBLE_SETTLEMENT") {
      eligibleSettlementVolume += calc.netPayout;
      eligibleSettlementCount++;
    } else if (calc.status === "SCHEDULED") {
      scheduledPendingStayVolume += calc.netPayout;
      scheduledPendingStayCount++;
    } else if (calc.status === "ON_HOLD") {
      onHoldVolume += calc.netPayout;
      onHoldCount++;
    } else if (calc.status === "REQUIRES_REVIEW") {
      payoutsRequiringReviewCount++;
    }
  }

  return {
    totalPaidVolume,
    totalPaidCount,
    eligibleSettlementVolume,
    eligibleSettlementCount,
    scheduledPendingStayVolume,
    scheduledPendingStayCount,
    onHoldVolume,
    onHoldCount,
    platformCommissionVolume,
    payoutsRequiringReviewCount,
    currency: "SAR",
  };
}

/**
 * Lists paginated Host Payout tracking records with full filter support.
 */
export async function listHostPayoutsForAdmin(
  actor: AuthUser,
  query: PayoutListQuery,
): Promise<{
  payouts: PayoutListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}> {
  assertRole(actor, [Role.ADMIN]);

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const now = new Date();

  const where: any = {
    status: BookingStatus.CONFIRMED,
  };

  if (query.hostId) {
    where.listing = { hostId: query.hostId };
  }

  if (query.search?.trim()) {
    const term = query.search.trim();
    where.OR = [
      { id: { contains: term, mode: "insensitive" } },
      { listing: { title: { contains: term, mode: "insensitive" } } },
      { listing: { host: { name: { contains: term, mode: "insensitive" } } } },
      { listing: { host: { email: { contains: term, mode: "insensitive" } } } },
    ];
  }

  const from = query.startDate || query.dateFrom;
  const to = query.endDate || query.dateTo;
  if (from || to) {
    where.startDate = {};
    if (from) where.startDate.gte = new Date(from);
    if (to) where.startDate.lte = new Date(to);
  }

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip,
      take: limit,
      orderBy: { startDate: "desc" },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            city: true,
            photos: true,
            host: {
              select: {
                id: true,
                name: true,
                email: true,
                image: true,
                personalInfo: true,
              },
            },
          },
        },
        refunds: { select: { id: true, status: true, amount: true } },
        payments: { select: { id: true, status: true, capturedAmount: true } },
        qualityIncidents: { select: { id: true, status: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  const payouts: PayoutListItem[] = bookings.map((b: any) => {
    const hostMethods: HostPayoutMethod[] = Array.isArray(
      b.listing.host?.personalInfo?.payoutMethods,
    )
      ? b.listing.host.personalInfo.payoutMethods
      : [];
    const defaultMethod =
      hostMethods.find((m) => m.isDefault) || hostMethods[0];

    const calc = calculateBookingPayout(b, {
      now,
      hostPayoutMethods: hostMethods,
    });

    return {
      id: `po_${b.id}`,
      bookingId: b.id,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString(),
      scheduledPayoutDate: calc.scheduledPayoutDate.toISOString(),
      host: {
        id: b.listing.host?.id || "",
        name: b.listing.host?.name || "Host",
        email: b.listing.host?.email || "",
        image: b.listing.host?.image || null,
      },
      listing: sanitizeListing(b.listing),
      grossEarnings: calc.grossEarnings,
      platformFee: calc.platformFee,
      deductions: calc.deductions,
      netPayout: calc.netPayout,
      currency: calc.currency,
      status: calc.status,
      holdDetails: calc.holdDetails,
      executionDetails: calc.executionDetails,
      payoutAccountMasked: defaultMethod
        ? defaultMethod.ibanMasked
        : "No account configured",
      // Moyasar is an acquiring gateway and has no host-transfer API. A CSV
      // export is a preparation step, never proof that a bank transfer occurred.
      settlementExecutionSupported: false,
      createdAt: b.createdAt.toISOString(),
    };
  });

  // If status query filter is applied, filter in memory if needed
  let filtered = payouts;
  if (query.status && query.status !== "ALL") {
    filtered = payouts.filter((p) => p.status === query.status);
  } else if (query.tab && query.tab !== "ALL" && query.tab !== "all") {
    filtered = payouts.filter((p) => p.status === query.tab?.toUpperCase());
  }

  return {
    payouts: filtered,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Returns detailed view of a Host Payout for a single reservation.
 */
export async function getHostPayoutDetailsForAdmin(
  actor: AuthUser,
  bookingId: string,
): Promise<any> {
  assertRole(actor, [Role.ADMIN]);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      listing: {
        select: {
          id: true,
          title: true,
          city: true,
          country: true,
          photos: true,
          host: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              personalInfo: true,
            },
          },
        },
      },
      payments: true,
      refunds: true,
      qualityIncidents: true,
    },
  });

  if (!booking) throw AppError.notFound(`Booking ${bookingId} not found.`);

  const hostPersonalInfo = booking.listing.host?.personalInfo as Record<string, any> | null | undefined;
  const hostMethods: HostPayoutMethod[] = Array.isArray(
    hostPersonalInfo?.payoutMethods,
  )
    ? (hostPersonalInfo!.payoutMethods as HostPayoutMethod[])
    : [];
  const defaultMethod = hostMethods.find((m) => m.isDefault) || hostMethods[0];

  const calc = calculateBookingPayout(booking, {
    hostPayoutMethods: hostMethods,
  });

  // Fetch audit history for booking
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      resourceType: "BOOKING",
      resourceId: booking.id,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return {
    payoutId: `po_${booking.id}`,
    bookingId: booking.id,
    startDate: booking.startDate,
    endDate: booking.endDate,
    scheduledPayoutDate: calc.scheduledPayoutDate,
    status: calc.status,
    isEligibleForSettlement: calc.isEligibleForSettlement,
    reasonsIneligible: calc.reasonsIneligible,
    host: booking.listing.host,
    payoutMethod: defaultMethod || null,
    listing: sanitizeListing(booking.listing),
    breakdown: {
      grossEarnings: calc.grossEarnings,
      platformCommission: calc.platformFee,
      deductions: calc.deductions,
      netHostPayout: calc.netPayout,
      currency: calc.currency,
      hasStoredSnapshot: calc.hasStoredSnapshot,
    },
    holdDetails: calc.holdDetails,
    executionDetails: calc.executionDetails,
    payments: booking.payments,
    refunds: booking.refunds,
    qualityIncidents: booking.qualityIncidents,
    auditLogs: auditLogs.map((l: any) => ({
      id: l.id,
      action: l.action,
      description: l.description,
      actorEmail: l.actorEmail,
      createdAt: l.createdAt.toISOString(),
      metadata: l.metadata,
    })),
    settlementNotice:
      "Authoritative platform calculation based on confirmed stay and verified payment capture. Actual disbursement relies on corporate banking SARIE execution.",
  };
}

/**
 * Places an administrative hold on a payout.
 */
export async function holdPayout(
  actor: AuthUser,
  bookingId: string,
  input: { holdType: HoldType; reason: string },
): Promise<any> {
  assertRole(actor, [Role.ADMIN]);

  if (!input.reason?.trim()) {
    throw AppError.badRequest(
      "A valid reason is mandatory to place a payout on hold.",
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, priceBreakdown: true, status: true },
  });

  if (!booking) throw AppError.notFound(`Booking ${bookingId} not found.`);

  const snapshot = (booking.priceBreakdown as Record<string, any>) || {};

  const holdRecord: PayoutHoldRecord = {
    isHeld: true,
    holdType: input.holdType,
    reason: input.reason.trim(),
    heldBy: actor.email || actor.id,
    heldAt: new Date().toISOString(),
  };

  const updatedBreakdown = {
    ...snapshot,
    payoutHold: holdRecord,
  };

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      priceBreakdown: updatedBreakdown as unknown as Prisma.InputJsonValue,
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "HOST_PAYOUT_HELD",
    resourceType: "BOOKING",
    resourceId: bookingId,
    description: `Payout placed on hold (${input.holdType}): ${input.reason}`,
    status: "SUCCESS",
    metadata: {
      bookingId,
      holdType: input.holdType,
      reason: input.reason,
    },
  });

  return { success: true, bookingId, holdDetails: holdRecord };
}

/**
 * Releases an administrative hold from a payout.
 */
export async function releasePayout(
  actor: AuthUser,
  bookingId: string,
  input: { reason: string },
): Promise<any> {
  assertRole(actor, [Role.ADMIN]);

  if (!input.reason?.trim()) {
    throw AppError.badRequest("A valid reason is required to release a hold.");
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      refunds: true,
      qualityIncidents: true,
    },
  });

  if (!booking) throw AppError.notFound(`Booking ${bookingId} not found.`);

  // Validate no open active dispute blocks release
  const hasPendingRefund = booking.refunds.some(
    (r: any) =>
      r.status === RefundStatus.PENDING || r.status === RefundStatus.PROCESSING,
  );
  if (hasPendingRefund) {
    throw AppError.conflict(
      "Cannot release hold: There is a pending refund request for this reservation.",
    );
  }

  const hasActiveIncident = booking.qualityIncidents.some(
    (i: any) =>
      i.status === QualityIncidentStatus.PENDING ||
      i.status === QualityIncidentStatus.CONFIRMED,
  );
  if (hasActiveIncident) {
    throw AppError.conflict(
      "Cannot release hold: There is an active quality incident under investigation.",
    );
  }

  const snapshot = (booking.priceBreakdown as Record<string, any>) || {};

  const releaseRecord: PayoutHoldRecord = {
    isHeld: false,
    reason: input.reason.trim(),
    releasedBy: actor.email || actor.id,
    releasedAt: new Date().toISOString(),
    releaseReason: input.reason.trim(),
  };

  const updatedBreakdown = {
    ...snapshot,
    payoutHold: releaseRecord,
  };

  await prisma.booking.update({
    where: { id: bookingId },
    data: {
      priceBreakdown: updatedBreakdown as unknown as Prisma.InputJsonValue,
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "HOST_PAYOUT_RELEASED",
    resourceType: "BOOKING",
    resourceId: bookingId,
    description: `Payout hold released: ${input.reason}`,
    status: "SUCCESS",
    metadata: {
      bookingId,
      reason: input.reason,
    },
  });

  return { success: true, bookingId, holdDetails: releaseRecord };
}

/**
 * Host-bank transfer execution is intentionally unavailable until an approved
 * disbursement provider and its status-verification integration are configured.
 * A typed reference entered by an admin is not settlement evidence.
 */
export async function processPayoutSettlement(
  actor: AuthUser,
  bookingId: string,
  input: {
    idempotencyKey?: string;
    settlementReference?: string;
    channel?: string;
  } = {},
): Promise<any> {
  assertRole(actor, [Role.ADMIN]);
  void bookingId;
  void input;
  throw AppError.serviceUnavailable(
    "Host payout execution is not configured. Exporting a bank batch does not settle a payout; record payment only after an approved bank-confirmation integration is available.",
  );
}

/**
 * Generates batch corporate banking SARIE export CSV for all eligible payouts.
 */
export async function exportBatchSettlementCSV(
  actor: AuthUser,
  bookingIds?: string[],
): Promise<string> {
  assertRole(actor, [Role.ADMIN]);

  const where: any = {
    status: BookingStatus.CONFIRMED,
  };

  if (bookingIds && bookingIds.length > 0) {
    where.id = { in: bookingIds };
  }

  const bookings = await prisma.booking.findMany({
    where,
    include: {
      payments: true,
      refunds: true,
      qualityIncidents: true,
      listing: {
        include: {
          host: {
            select: { id: true, name: true, email: true, personalInfo: true },
          },
        },
      },
    },
  });

  const headers = [
    "Booking Reference",
    "Beneficiary Name",
    "Beneficiary IBAN",
    "Bank Name",
    "Amount SAR",
    "Currency",
    "Scheduled Date",
    "Property Title",
    "Status",
  ];

  const rows: string[][] = [];

  for (const b of bookings) {
    const hostPersonalInfo = b.listing.host?.personalInfo as Record<string, any> | null | undefined;
    const hostMethods: HostPayoutMethod[] = Array.isArray(
      hostPersonalInfo?.payoutMethods,
    )
      ? (hostPersonalInfo!.payoutMethods as HostPayoutMethod[])
      : [];
    const defaultMethod =
      hostMethods.find((m) => m.isDefault && m.status === "VERIFIED") ||
      hostMethods[0];

    const calc = calculateBookingPayout(b, { hostPayoutMethods: hostMethods });

    if (calc.status === "ELIGIBLE_SETTLEMENT") {
      rows.push([
        `"${b.id}"`,
        `"${defaultMethod?.accountHolderName || b.listing.host?.name || "Host"}"`,
        `"${defaultMethod?.ibanFormatted || defaultMethod?.ibanMasked || "MISSING_IBAN"}"`,
        `"${defaultMethod?.bankName || "Commercial Bank"}"`,
        `"${(calc.netPayout / 100).toFixed(2)}"`,
        `"${calc.currency}"`,
        `"${calc.scheduledPayoutDate.toISOString().slice(0, 10)}"`,
        `"${(b.listing.title || "").replace(/"/g, '""')}"`,
        `"${calc.status}"`,
      ]);
    }
  }

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

// ============================================================================
// Host Earnings Overview & Reporting (Phase 17.2)
// ============================================================================

export interface HostEarningsDetails {
  summary: HostEarningsSummary;
  payoutMethods: HostPayoutMethod[];
  upcomingPayouts: HostEarningsPayoutPreview[];
  completedPayouts: HostEarningsPayoutPreview[];
  adjustments: PayoutAdjustmentRecord[];
  reporting?: HostEarningsReportingData;
}

export interface HostEarningsPayoutPreview {
  bookingId: string;
  listingId: string;
  listingTitle: string;
  listingPhoto: string | null;
  guestName: string;
  startDate: string;
  endDate: string;
  scheduledPayoutDate: string;
  grossEarnings: number;
  platformFee: number;
  deductions: number;
  netPayout: number;
  currency: string;
  status: PayoutStatus;
  executionDetails: PayoutExecutionRecord | null;
  holdDetails: PayoutHoldRecord | null;
}

export interface HostEarningsOverviewQuery {
  listingId?: string;
  /** 1-12, interpreted with year as a UTC calendar month. */
  month?: number;
  year?: number;
  /** Native settlement currency. No FX conversion is performed for reporting. */
  currency?: string;
  /** Used only by the existing downloadable statement, never by the overview UI. */
  includeAllPayouts?: boolean;
  /** Advanced Timeframe Options */
  timeframe?: TimeframeGranularity;
  date?: string;
  weekStart?: string;
  quarter?: number;
  startDate?: string;
  endDate?: string;
  /** Period Comparison Options */
  compareEnabled?: boolean;
  compareTimeframe?: TimeframeGranularity;
  compareStartDate?: string;
  compareEndDate?: string;
  compareMonth?: number;
  compareYear?: number;
  compareQuarter?: number;
}

export type HostEarningsTransactionKind = "upcoming" | "paid";

export interface HostEarningsTransactionQuery {
  kind: HostEarningsTransactionKind;
  page?: number;
  limit?: number;
  listingId?: string;
  search?: string;
  datePreset?:
    | "all"
    | "this_month"
    | "last_month"
    | "last_30_days"
    | "next_30_days"
    | "next_60_days"
    | "next_90_days"
    | "this_year"
    | "custom";
  startDate?: string;
  endDate?: string;
  currency?: string;
  payoutStatus?: PayoutStatus;
  sort?: "date_desc" | "date_asc" | "amount_desc" | "amount_asc";
  earningsType?: "reservation";
  includeAll?: boolean;
}

export interface HostEarningsTransactionResult {
  transactions: HostEarningsPayoutPreview[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  totalsByCurrency: Array<{ currency: string; amount: number }>;
  listings: Array<{ id: string; title: string }>;
  dateBasis: "SCHEDULED_PAYOUT_DATE" | "EXECUTED_AT";
  filters: Required<Pick<HostEarningsTransactionQuery, "kind">> &
    Omit<HostEarningsTransactionQuery, "kind">;
}

export interface HostEarningsTransactionDetails {
  transaction: HostEarningsPayoutPreview;
  reservation: {
    id: string;
    confirmationCode: string;
    listingTitle: string;
    listingPhoto: string | null;
    guestName: string;
    guestImage: string | null;
    startDate: string;
    endDate: string;
    nights: number;
    guests: number;
    status: string;
    reservationTotal: number | null;
    currency: string;
  };
  breakdown: {
    accommodationSubtotal: number | null;
    cleaningFee: number | null;
    extraGuestFee: number | null;
    petFee: number | null;
    grossReservationEarnings: number;
    hostServiceFee: number;
    taxesWithheld: number;
    recordedAdjustments: number;
    netHostEarnings: number;
    payoutAmount: number;
    currency: string;
    snapshotAvailable: boolean;
  };
  payout: {
    reference: string | null;
    status: PayoutStatus;
    methodMasked: string | null;
    scheduledFor: string | null;
    executedAt: string | null;
    failureReason: string | null;
    holdReason: string | null;
  };
  refunds: Array<{
    id: string;
    amount: number;
    currency: string;
    status: string;
    reason: string | null;
    reference: string | null;
    processedAt: string | null;
    succeededAt: string | null;
    createdAt: string;
  }>;
  adjustments: Array<{
    id: string;
    type: string;
    amount: number;
    currency: string;
    reason: string;
    status: string;
    createdAt: string;
    deductedAt: string | null;
  }>;
  timeline: Array<{
    id: string;
    label: string;
    detail: string | null;
    at: string;
    state: "complete" | "pending" | "attention";
  }>;
}

export interface EarningsCurrencyTotals {
  currency: string;
  monthlyRecognized: number;
  upcomingPayout: number;
  ytdGross: number;
  ytdAdjustments: number;
  ytdPlatformFee: number;
  ytdTaxesWithheld: number;
  ytdNet: number;
}

export interface EarningsListingItem {
  id: string;
  title: string;
  photo?: string | null;
  city?: string | null;
  country?: string | null;
  status?: string | null;
}

export interface EarningsComparisonData {
  enabled: boolean;
  periodLabel: string;
  timeframe: string;
  startDateKey: string;
  endDateKey: string;
  netEarnings: number;
  grossEarnings: number;
  completedStaysCount: number;
  deltaEarnings: number;
  deltaPercentage: number | null;
  deltaDirection: "increase" | "decrease" | "neutral";
  chartPoints: Array<{ key: string; label: string; amount: number }>;
}

export interface HostEarningsChartPropertyItem {
  listingId: string;
  title: string;
  amount: number;
  netEarnings: number;
  grossEarnings: number;
  count: number;
}

export interface HostEarningsChartPoint {
  key: string;
  label: string;
  fullLabel?: string;
  startDateKey?: string;
  endDateKey?: string;
  amount: number;
  netEarnings: number;
  grossEarnings: number;
  platformFee: number;
  refunds: number;
  adjustments: number;
  completedStaysCount: number;
  propertyBreakdown: HostEarningsChartPropertyItem[];
  secondaryAmount?: number;
  secondaryGrossEarnings?: number;
  secondaryStaysCount?: number;
}

export interface HostEarningsReportingData {
  timeframe?: TimeframeGranularity;
  timeframeLabel?: string;
  startDateKey?: string;
  endDateKey?: string;
  selectedMonth: number;
  selectedYear: number;
  monthLabel: string;
  selectedListingId: string | null;
  selectedCurrency: string | null;
  listings: Array<EarningsListingItem>;
  currencies: string[];
  totalsByCurrency: EarningsCurrencyTotals[];
  chart: {
    currency: string | null;
    timeframe?: TimeframeGranularity;
    points?: Array<HostEarningsChartPoint>;
    daily: Array<{ key: string; label: string; amount: number }>;
    monthly: Array<{ month: number; label: string; amount: number }>;
  };
  comparison?: EarningsComparisonData | null;
  reports: Array<{
    year: number;
    month: number;
    label: string;
    currency: string;
    amount: number;
  }>;
  dataBasis: "COMPLETED_STAY_NET_HOST_PAYOUT";
  unavailableSnapshotCount: number;
}

const earningsBookingInclude = {
  listing: { select: { id: true, title: true, photos: true } },
  payments: { select: { id: true, status: true, capturedAmount: true } },
  refunds: { select: { id: true, status: true, amount: true } },
  qualityIncidents: { select: { id: true, status: true } },
  user: { select: { id: true, name: true } },
} as const;

function positiveAdjustmentAmount(adjustment: PayoutAdjustmentRecord) {
  return adjustment.type === "DAMAGE_CLAIM_CREDIT" ||
    adjustment.type === "BONUS_CREDIT"
    ? adjustment.amount
    : -adjustment.amount;
}

function monthBounds(year: number, monthIndex: number) {
  return {
    start: new Date(Date.UTC(year, monthIndex, 1)),
    end: new Date(Date.UTC(year, monthIndex + 1, 0, 23, 59, 59, 999)),
  };
}

/**
 * The booking's charge currency is not necessarily the currency in which the
 * host was settled. Every host-facing currency filter must therefore be
 * compared with the immutable payout snapshot after it has been loaded.
 */
function normalizeSettlementCurrency(value?: string): string | null {
  const currency = value?.trim().toUpperCase();
  if (!currency) return null;
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw AppError.badRequest("Currency must be a three-letter ISO code.");
  }
  return currency;
}

function toPayoutPreview(
  booking: any,
  calculation: BookingPayoutCalculation,
): HostEarningsPayoutPreview {
  return {
    bookingId: booking.id,
    listingId: booking.listingId,
    listingTitle: booking.listing.title,
    listingPhoto: booking.listing.photos?.[0] || null,
    guestName: booking.user?.name || "Guest",
    startDate: booking.startDate.toISOString(),
    endDate: booking.endDate.toISOString(),
    scheduledPayoutDate: calculation.scheduledPayoutDate.toISOString(),
    grossEarnings: calculation.grossEarnings,
    platformFee: calculation.platformFee,
    deductions: calculation.deductions,
    netPayout: calculation.netPayout,
    currency: calculation.currency,
    status: calculation.status,
    executionDetails: calculation.executionDetails,
    holdDetails: calculation.holdDetails,
  };
}

function transactionDateRange(query: HostEarningsTransactionQuery, now: Date) {
  const preset = query.datePreset || "all";
  if (preset === "all") return null;
  const monthStart = (offset: number) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const monthEnd = (offset: number) =>
    new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth() + offset + 1,
        0,
        23,
        59,
        59,
        999,
      ),
    );
  if (preset === "this_month")
    return { start: monthStart(0), end: monthEnd(0) };
  if (preset === "last_month")
    return { start: monthStart(-1), end: monthEnd(-1) };
  if (preset === "last_30_days")
    return {
      start: new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000),
      end: now,
    };
  if (preset === "next_30_days")
    return {
      start: now,
      end: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    };
  if (preset === "next_60_days")
    return {
      start: now,
      end: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000),
    };
  if (preset === "next_90_days")
    return {
      start: now,
      end: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000),
    };
  if (preset === "this_year")
    return { start: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), end: now };
  if (preset === "custom") {
    if (!query.startDate || !query.endDate) {
      throw AppError.badRequest(
        "A custom transaction range requires both a start and end date.",
      );
    }
    const start = new Date(`${query.startDate}T00:00:00.000Z`);
    const end = new Date(`${query.endDate}T23:59:59.999Z`);
    if (
      !Number.isNaN(start.getTime()) &&
      !Number.isNaN(end.getTime()) &&
      start <= end
    )
      return { start, end };
    throw AppError.badRequest("Invalid custom transaction date range.");
  }
  return null;
}

/** Payout execution is immutable booking financial data: a confirmed booking is never classified as paid by inference. */
export async function listHostEarningsTransactions(
  hostId: string,
  input: HostEarningsTransactionQuery,
): Promise<HostEarningsTransactionResult> {
  const page = Math.max(1, Math.floor(Number(input.page) || 1));
  const limit = Math.min(
    50,
    Math.max(10, Math.floor(Number(input.limit) || 20)),
  );
  const now = new Date();
  const listings = await prisma.listing.findMany({
    where: { hostId },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
  });
  if (
    input.listingId &&
    !listings.some((listing: { id: string }) => listing.id === input.listingId)
  ) {
    throw AppError.forbidden(
      "Listing not found or access denied for this host",
    );
  }
  const listingIds = input.listingId
    ? [input.listingId]
    : listings.map((listing: { id: string }) => listing.id);
  const search = input.search?.trim().slice(0, 120);
  const settlementCurrency = normalizeSettlementCurrency(input.currency);
  const dateRange = transactionDateRange(input, now);
  const candidateWhere: Prisma.BookingWhereInput = {
    listingId: { in: listingIds },
    status: BookingStatus.CONFIRMED,
    ...(search
      ? {
          OR: [
            { id: { contains: search, mode: "insensitive" } },
            { listing: { title: { contains: search, mode: "insensitive" } } },
            { user: { name: { contains: search, mode: "insensitive" } } },
            {
              priceBreakdown: {
                path: ["payoutExecution", "settlementReference"],
                string_contains: search,
              },
            },
          ],
        }
      : {}),
    ...(input.kind === "paid"
      ? {
          priceBreakdown: {
            path: ["payoutExecution", "status"],
            equals: "PAID",
          },
        }
      : {}),
  };
  // This narrows upcoming scans with the indexed reservation date. The final
  // date test uses the authoritative scheduled/executed financial date.
  if (dateRange && input.kind === "upcoming") {
    candidateWhere.startDate = {
      // Scheduled payout is check-in + 24h, so reserve a one-day offset while
      // retaining the final exact scheduled-date comparison below.
      gte: new Date(dateRange.start.getTime() - 24 * 60 * 60 * 1000),
      lte: new Date(dateRange.end.getTime() - 24 * 60 * 60 * 1000),
    };
  }
  const candidates = await prisma.booking.findMany({
    where: candidateWhere,
    include: earningsBookingInclude,
    orderBy:
      input.kind === "upcoming" ? { startDate: "asc" } : { endDate: "desc" },
  });
  type TransactionBooking = { id: string } & Record<string, unknown>;
  type TransactionRow = {
    booking: TransactionBooking;
    calculation: BookingPayoutCalculation;
  };
  const rows: TransactionRow[] = candidates
    .map((booking: TransactionBooking): TransactionRow => ({
      booking,
      calculation: calculateBookingPayout(booking, { now }),
    }))
    .filter(({ calculation }: TransactionRow) => calculation.hasStoredSnapshot)
    .filter(
      ({ calculation }: TransactionRow) =>
        !settlementCurrency || calculation.currency === settlementCurrency,
    )
    .filter(({ calculation }: TransactionRow) =>
      input.kind === "paid"
        ? calculation.status === "PAID"
        : ["SCHEDULED", "ELIGIBLE_SETTLEMENT", "PROCESSING"].includes(
            calculation.status,
          ),
    )
    .filter(
      ({ calculation }: TransactionRow) =>
        !input.payoutStatus || calculation.status === input.payoutStatus,
    )
    .filter(({ calculation }: TransactionRow) => {
      if (!dateRange) return true;
      const date =
        input.kind === "paid"
          ? calculation.executionDetails?.executedAt
          : calculation.scheduledPayoutDate;
      return (
        !!date &&
        new Date(date) >= dateRange.start &&
        new Date(date) <= dateRange.end
      );
    })
    .sort((a: TransactionRow, b: TransactionRow) => {
      const aDate =
        input.kind === "paid"
          ? a.calculation.executionDetails?.executedAt
          : a.calculation.scheduledPayoutDate;
      const bDate =
        input.kind === "paid"
          ? b.calculation.executionDetails?.executedAt
          : b.calculation.scheduledPayoutDate;
      const difference =
        new Date(aDate || 0).getTime() - new Date(bDate || 0).getTime();
      if (input.sort === "amount_desc")
        return (
          b.calculation.netPayout - a.calculation.netPayout ||
          a.booking.id.localeCompare(b.booking.id)
        );
      if (input.sort === "amount_asc")
        return (
          a.calculation.netPayout - b.calculation.netPayout ||
          a.booking.id.localeCompare(b.booking.id)
        );
      if (input.sort === "date_asc")
        return difference || a.booking.id.localeCompare(b.booking.id);
      return (
        (input.kind === "paid" ? -difference : difference) ||
        a.booking.id.localeCompare(b.booking.id)
      );
    });
  const totalMap = new Map<string, number>();
  for (const { calculation } of rows)
    totalMap.set(
      calculation.currency,
      (totalMap.get(calculation.currency) || 0) + calculation.netPayout,
    );
  const total = rows.length;
  return {
    transactions: (input.includeAll
      ? rows
      : rows.slice((page - 1) * limit, page * limit)
    ).map(({ booking, calculation }: TransactionRow) =>
      toPayoutPreview(booking, calculation),
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
    totalsByCurrency: Array.from(totalMap, ([currency, amount]) => ({
      currency,
      amount,
    })).sort((a, b) => a.currency.localeCompare(b.currency)),
    listings,
    dateBasis: input.kind === "paid" ? "EXECUTED_AT" : "SCHEDULED_PAYOUT_DATE",
    filters: { ...input, kind: input.kind, page, limit },
  };
}

/** Loads a single immutable booking transaction after verifying host ownership. */
export async function getHostEarningsTransactionDetails(
  hostId: string,
  transactionId: string,
): Promise<HostEarningsTransactionDetails> {
  const [host, booking] = await Promise.all([
    prisma.user.findUnique({
      where: { id: hostId },
      select: { personalInfo: true },
    }),
    prisma.booking.findFirst({
      where: { id: transactionId, listing: { hostId } },
      select: {
        id: true,
        listingId: true,
        status: true,
        startDate: true,
        endDate: true,
        guests: true,
        totalPrice: true,
        currency: true,
        priceBreakdown: true,
        createdAt: true,
        listing: { select: { title: true, photos: true } },
        user: { select: { name: true, image: true } },
        payments: {
          select: {
            id: true,
            status: true,
            capturedAmount: true,
            authorizedAt: true,
            capturedAt: true,
            failedAt: true,
            failureReason: true,
          },
        },
        refunds: {
          select: {
            id: true,
            amount: true,
            currency: true,
            status: true,
            reason: true,
            refundReference: true,
            processedAt: true,
            succeededAt: true,
            createdAt: true,
          },
        },
        qualityIncidents: {
          select: { id: true, status: true, createdAt: true },
        },
      },
    }),
  ]);
  if (!host) throw AppError.notFound("Host not found.");
  if (!booking) throw AppError.notFound("Transaction not found.");
  const personalInfo = host.personalInfo as Record<string, unknown> | null;
  const methods: HostPayoutMethod[] = Array.isArray(personalInfo?.payoutMethods)
    ? (personalInfo.payoutMethods as HostPayoutMethod[])
    : [];
  const allAdjustments: PayoutAdjustmentRecord[] = Array.isArray(
    personalInfo?.payoutAdjustments,
  )
    ? (personalInfo.payoutAdjustments as PayoutAdjustmentRecord[])
    : [];
  const calculation = calculateBookingPayout(booking, {
    hostPayoutMethods: methods,
  });
  const stored = extractStoredHostPayout(booking);
  const adjustments = allAdjustments.filter(
    (item) => item.bookingId === booking.id && item.status === "DEDUCTED",
  );
  const adjustmentAmount = adjustments.reduce(
    (sum, item) => sum + positiveAdjustmentAmount(item),
    0,
  );
  const timeline: HostEarningsTransactionDetails["timeline"] = [
    {
      id: "reservation",
      label: "Reservation recorded",
      detail: booking.status,
      at: booking.createdAt.toISOString(),
      state: "complete",
    },
  ];
  for (const payment of booking.payments) {
    if (payment.authorizedAt)
      timeline.push({
        id: "authorized-" + payment.id,
        label: "Payment authorized",
        detail: null,
        at: payment.authorizedAt.toISOString(),
        state: "complete",
      });
    if (payment.capturedAt)
      timeline.push({
        id: "captured-" + payment.id,
        label: "Payment captured",
        detail: null,
        at: payment.capturedAt.toISOString(),
        state: "complete",
      });
    if (payment.failedAt)
      timeline.push({
        id: "payment-failed-" + payment.id,
        label: "Payment failed",
        detail: payment.failureReason || null,
        at: payment.failedAt.toISOString(),
        state: "attention",
      });
  }
  if (calculation.holdDetails?.heldAt)
    timeline.push({
      id: "payout-hold",
      label: "Payout on hold",
      detail:
        calculation.holdDetails.reason ||
        calculation.holdDetails.holdType ||
        null,
      at: calculation.holdDetails.heldAt,
      state: "attention",
    });
  if (calculation.executionDetails?.executedAt)
    timeline.push({
      id: "payout-executed",
      label:
        calculation.executionDetails.status === "PAID"
          ? "Payout paid"
          : calculation.executionDetails.status,
      detail: calculation.executionDetails.settlementReference,
      at: calculation.executionDetails.executedAt,
      state:
        calculation.executionDetails.status === "PAID"
          ? "complete"
          : "attention",
    });
  for (const refund of booking.refunds) {
    const at = refund.succeededAt || refund.processedAt || refund.createdAt;
    timeline.push({
      id: "refund-" + refund.id,
      label: "Refund " + refund.status.toLowerCase().replaceAll("_", " "),
      detail: refund.reason || null,
      at: at.toISOString(),
      state: refund.status === "SUCCEEDED" ? "complete" : "pending",
    });
  }
  for (const incident of booking.qualityIncidents)
    if (incident.status !== QualityIncidentStatus.RESOLVED)
      timeline.push({
        id: "review-" + incident.id,
        label: "Payout review",
        detail: incident.status.replaceAll("_", " "),
        at: incident.createdAt.toISOString(),
        state: "attention",
      });
  timeline.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
  return {
    transaction: toPayoutPreview(booking, calculation),
    reservation: {
      id: booking.id,
      confirmationCode: booking.id,
      listingTitle: booking.listing.title,
      listingPhoto: booking.listing.photos[0] || null,
      guestName: booking.user?.name || "Guest",
      guestImage: booking.user?.image || null,
      startDate: booking.startDate.toISOString(),
      endDate: booking.endDate.toISOString(),
      nights: Math.max(
        0,
        Math.round(
          (booking.endDate.getTime() - booking.startDate.getTime()) / 86400000,
        ),
      ),
      guests: booking.guests,
      status: booking.status,
      reservationTotal: booking.totalPrice,
      currency: calculation.currency,
    },
    breakdown: {
      accommodationSubtotal: stored?.accommodationSubtotal ?? null,
      cleaningFee: stored?.cleaningFee ?? null,
      extraGuestFee: stored?.extraGuestFee ?? null,
      petFee: stored?.petFee ?? null,
      grossReservationEarnings: calculation.grossEarnings,
      hostServiceFee: calculation.platformFee,
      taxesWithheld: stored?.taxesCollectedForHost ?? 0,
      recordedAdjustments: adjustmentAmount,
      netHostEarnings: calculation.netPayout + adjustmentAmount,
      payoutAmount: calculation.netPayout,
      currency: calculation.currency,
      snapshotAvailable: calculation.hasStoredSnapshot,
    },
    payout: {
      reference: calculation.executionDetails?.settlementReference || null,
      status: calculation.status,
      methodMasked: calculation.executionDetails?.payoutMethodMasked || null,
      scheduledFor: calculation.scheduledPayoutDate.toISOString(),
      executedAt: calculation.executionDetails?.executedAt || null,
      failureReason: calculation.executionDetails?.failureReason || null,
      holdReason: calculation.holdDetails?.reason || null,
    },
    refunds: booking.refunds.map(
      (item: {
        id: string;
        amount: number;
        currency: string;
        status: string;
        reason: string | null;
        refundReference: string | null;
        processedAt: Date | null;
        succeededAt: Date | null;
        createdAt: Date;
      }) => ({
        id: item.id,
        amount: item.amount,
        currency: item.currency,
        status: item.status,
        reason: item.reason,
        reference: item.refundReference,
        processedAt: item.processedAt?.toISOString() || null,
        succeededAt: item.succeededAt?.toISOString() || null,
        createdAt: item.createdAt.toISOString(),
      }),
    ),
    adjustments: adjustments.map((item) => ({
      id: item.id,
      type: item.type,
      amount: positiveAdjustmentAmount(item),
      currency: item.currency,
      reason: item.reason,
      status: item.status,
      createdAt: item.createdAt,
      deductedAt: item.deductedAt || null,
    })),
    timeline,
  };
}

/**
 * Returns comprehensive earnings, upcoming payouts, and configured accounts for a host.
 */
export async function getHostEarningsOverview(
  hostId: string,
  query: HostEarningsOverviewQuery = {},
): Promise<HostEarningsDetails> {
  const user = await prisma.user.findUnique({
    where: { id: hostId },
    select: { personalInfo: true },
  });

  if (!user) throw AppError.notFound(`Host ${hostId} not found.`);

  const info = (user.personalInfo as Record<string, any>) || {};
  const payoutMethods: HostPayoutMethod[] = Array.isArray(info.payoutMethods)
    ? info.payoutMethods
    : [];
  const adjustments: PayoutAdjustmentRecord[] = Array.isArray(
    info.payoutAdjustments,
  )
    ? info.payoutAdjustments
    : [];

  // Validate the listing before applying it. This keeps the query scoped to the
  // authenticated host even when URL state is manually changed.
  const listings = await prisma.listing.findMany({
    where: { hostId },
    select: {
      id: true,
      title: true,
      photos: true,
      city: true,
      country: true,
      status: true,
      published: true,
    },
    orderBy: { title: "asc" },
  });
  if (
    query.listingId &&
    !listings.some((listing: { id: string }) => listing.id === query.listingId)
  ) {
    throw AppError.forbidden(
      "Listing not found or access denied for this host",
    );
  }
  const selectedListingId = query.listingId || null;
  const scopedListingIds = selectedListingId
    ? [selectedListingId]
    : listings.map((listing: { id: string }) => listing.id);

  const listingItems: EarningsListingItem[] = listings.map((l) => ({
    id: l.id,
    title: l.title,
    photo: Array.isArray(l.photos) && l.photos[0] ? String(l.photos[0]) : null,
    city: l.city || null,
    country: l.country || null,
    status: l.status || (l.published ? "PUBLISHED" : "DRAFT"),
  }));

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const selectedYear =
    Number.isInteger(query.year) &&
    query.year! >= 2000 &&
    query.year! <= currentYear + 1
      ? query.year!
      : currentYear;
  const selectedMonth =
    Number.isInteger(query.month) && query.month! >= 1 && query.month! <= 12
      ? query.month! - 1
      : now.getUTCMonth();
  const selectedMonthBounds = monthBounds(selectedYear, selectedMonth);

  // Resolve timeframe bounds (Daily, Weekly, Monthly, Quarterly, Yearly, Custom)
  const timeframeBounds = resolveTimeframeBounds({
    timeframe: query.timeframe,
    date: query.date,
    weekStart: query.weekStart,
    month: query.month,
    year: query.year,
    quarter: query.quarter,
    startDate: query.startDate,
    endDate: query.endDate,
  }, now);

  const hasComparison = Boolean(
    query.compareEnabled ||
    query.compareStartDate ||
    query.compareMonth ||
    query.compareQuarter ||
    query.compareYear
  );

  const compBounds = resolveTimeframeBounds({
    timeframe: query.compareTimeframe || timeframeBounds.timeframe,
    startDate: query.compareStartDate,
    endDate: query.compareEndDate,
    month: query.compareMonth,
    year: query.compareYear,
    quarter: query.compareQuarter,
  }, now);

  if (!query.compareStartDate && !query.compareMonth && !query.compareQuarter && !query.compareYear) {
    compBounds.startDate = timeframeBounds.comparisonStartDate;
    compBounds.endDate = timeframeBounds.comparisonEndDate;
    compBounds.startDateKey = timeframeBounds.comparisonStartDateKey;
    compBounds.endDateKey = timeframeBounds.comparisonEndDateKey;
    compBounds.label = timeframeBounds.comparisonLabel;
  }

  const ytdEnd =
    selectedYear === currentYear
      ? now
      : new Date(Date.UTC(selectedYear, 11, 31, 23, 59, 59, 999));
  const yearStart = new Date(Date.UTC(selectedYear, 0, 1));
  const reportingCurrency = normalizeSettlementCurrency(query.currency);
  const bookingScope = {
    listingId: { in: scopedListingIds },
    status: { in: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED] },
  };

  const minQueryStart = new Date(Math.min(
    yearStart.getTime(),
    timeframeBounds.startDate.getTime(),
    hasComparison ? compBounds.startDate.getTime() : yearStart.getTime()
  ));
  const maxQueryEnd = new Date(Math.max(
    ytdEnd.getTime(),
    timeframeBounds.endDate.getTime(),
    hasComparison ? compBounds.endDate.getTime() : ytdEnd.getTime()
  ));

  // Reporting only loads the relevant date window (plus two small independent previews)
  // instead of materialising a host's entire booking history.
  const payoutPreviewTake = query.includeAllPayouts ? undefined : 60;
  const [reportingBookings, upcomingBookings, recentBookings] =
    await Promise.all([
      prisma.booking.findMany({
        where: { ...bookingScope, endDate: { gte: minQueryStart, lte: maxQueryEnd } },
        include: earningsBookingInclude,
        orderBy: { endDate: "asc" },
      }),
      prisma.booking.findMany({
        where: {
          ...bookingScope,
          status: BookingStatus.CONFIRMED,
          ...(query.includeAllPayouts
            ? {}
            : {
                startDate: {
                  gte: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000),
                },
              }),
        },
        include: earningsBookingInclude,
        orderBy: { startDate: "asc" },
        take: payoutPreviewTake,
      }),
      prisma.booking.findMany({
        where: {
          ...bookingScope,
          status: BookingStatus.CONFIRMED,
          endDate: { lte: now },
        },
        include: earningsBookingInclude,
        orderBy: { endDate: "desc" },
        take: payoutPreviewTake,
      }),
    ]);

  let totalPaidVolume = 0;
  let totalPaidCount = 0;
  let eligibleSettlementVolume = 0;
  let eligibleSettlementCount = 0;
  let scheduledPendingVolume = 0;
  let scheduledPendingCount = 0;
  const onHoldVolume = 0;
  const onHoldCount = 0;
  let totalGrossVolume = 0;
  let totalPlatformCommission = 0;

  const upcomingPayouts: HostEarningsPayoutPreview[] = [];
  const completedPayouts: HostEarningsPayoutPreview[] = [];
  const daily = Array.from(
    { length: selectedMonthBounds.end.getUTCDate() },
    (_, index) => ({
      key: `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(index + 1).padStart(2, "0")}`,
      label: String(index + 1),
      amount: 0,
    }),
  );
  const monthly = Array.from({ length: 12 }, (_, index) => ({
    month: index + 1,
    label: new Intl.DateTimeFormat("en-US", {
      month: "short",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(selectedYear, index, 1))),
    amount: 0,
  }));

  // Construct active timeframe points with complete financial metadata
  const activePoints: HostEarningsChartPoint[] = [];

  const makeChartPoint = (
    key: string,
    label: string,
    fullLabel: string,
    startDateKey: string,
    endDateKey: string,
  ): HostEarningsChartPoint => ({
    key,
    label,
    fullLabel,
    startDateKey,
    endDateKey,
    amount: 0,
    netEarnings: 0,
    grossEarnings: 0,
    platformFee: 0,
    refunds: 0,
    adjustments: 0,
    completedStaysCount: 0,
    propertyBreakdown: [],
    secondaryAmount: 0,
    secondaryGrossEarnings: 0,
    secondaryStaysCount: 0,
  });

  if (timeframeBounds.timeframe === "daily") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(timeframeBounds.startDate.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = bookingDateKey(d);
      const lbl = d.toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
      const full = d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
      activePoints.push(makeChartPoint(dateKey, lbl, full, dateKey, dateKey));
    }
  } else if (timeframeBounds.timeframe === "weekly") {
    const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    for (let i = 0; i < 7; i++) {
      const d = new Date(timeframeBounds.startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const dateKey = bookingDateKey(d);
      const lbl = `${dayNames[i]} ${d.getUTCDate()}`;
      const full = d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
      activePoints.push(makeChartPoint(dateKey, lbl, full, dateKey, dateKey));
    }
  } else if (timeframeBounds.timeframe === "quarterly") {
    const startM = timeframeBounds.startDate.getUTCMonth();
    const qYear = timeframeBounds.startDate.getUTCFullYear();
    for (let i = 0; i < 3; i++) {
      const mIdx = startM + i;
      const dStart = new Date(Date.UTC(qYear, mIdx, 1));
      const dEnd = new Date(Date.UTC(qYear, mIdx + 1, 0));
      const lbl = dStart.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
      const full = dStart.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
      activePoints.push(makeChartPoint(
        `${qYear}-${String(mIdx + 1).padStart(2, "0")}`,
        lbl,
        full,
        bookingDateKey(dStart),
        bookingDateKey(dEnd),
      ));
    }
  } else if (timeframeBounds.timeframe === "yearly") {
    const yYear = timeframeBounds.startDate.getUTCFullYear();
    for (let i = 0; i < 12; i++) {
      const dStart = new Date(Date.UTC(yYear, i, 1));
      const dEnd = new Date(Date.UTC(yYear, i + 1, 0));
      const lbl = dStart.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
      const full = dStart.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
      activePoints.push(makeChartPoint(
        `${yYear}-${String(i + 1).padStart(2, "0")}`,
        lbl,
        full,
        bookingDateKey(dStart),
        bookingDateKey(dEnd),
      ));
    }
  } else if (timeframeBounds.timeframe === "custom") {
    const diffDays = timeframeBounds.durationDays;
    if (diffDays <= 31) {
      for (let i = 0; i < diffDays; i++) {
        const d = new Date(timeframeBounds.startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dateKey = bookingDateKey(d);
        const lbl = d.toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
        const full = d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
        activePoints.push(makeChartPoint(dateKey, lbl, full, dateKey, dateKey));
      }
    } else {
      const numSteps = Math.min(12, Math.max(4, Math.ceil(diffDays / 30)));
      const stepDays = Math.max(1, Math.floor(diffDays / numSteps));
      for (let i = 0; i < numSteps; i++) {
        const dStart = new Date(timeframeBounds.startDate.getTime() + i * stepDays * 24 * 60 * 60 * 1000);
        const isLast = i === numSteps - 1;
        const dEnd = isLast
          ? timeframeBounds.endDate
          : new Date(timeframeBounds.startDate.getTime() + ((i + 1) * stepDays - 1) * 24 * 60 * 60 * 1000);
        const lbl = dStart.toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
        const full = `${dStart.toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" })} – ${dEnd.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}`;
        activePoints.push(makeChartPoint(
          bookingDateKey(dStart),
          lbl,
          full,
          bookingDateKey(dStart),
          bookingDateKey(dEnd),
        ));
      }
    }
  } else {
    // Default monthly: one bucket per day of the selected month
    const mYear = selectedMonthBounds.start.getUTCFullYear();
    const mMonth = selectedMonthBounds.start.getUTCMonth();
    const totalDays = selectedMonthBounds.end.getUTCDate();
    for (let i = 1; i <= totalDays; i++) {
      const d = new Date(Date.UTC(mYear, mMonth, i));
      const dateKey = bookingDateKey(d);
      const lbl = String(i);
      const full = d.toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
      activePoints.push(makeChartPoint(dateKey, lbl, full, dateKey, dateKey));
    }
  }

  const findActivePoint = (date: Date): HostEarningsChartPoint | undefined => {
    if (
      timeframeBounds.timeframe === "daily" ||
      timeframeBounds.timeframe === "weekly" ||
      (timeframeBounds.timeframe === "custom" && timeframeBounds.durationDays <= 31)
    ) {
      const bKey = bookingDateKey(date);
      return activePoints.find((p) => p.key === bKey);
    }
    if (timeframeBounds.timeframe === "quarterly") {
      const startM = timeframeBounds.startDate.getUTCMonth();
      const mIdx = date.getUTCMonth() - startM;
      return activePoints[mIdx];
    }
    if (timeframeBounds.timeframe === "yearly") {
      const mIdx = date.getUTCMonth();
      return activePoints[mIdx];
    }
    if (timeframeBounds.timeframe === "monthly") {
      const dayIdx = date.getUTCDate() - 1;
      return activePoints[dayIdx];
    }
    const progress =
      timeframeBounds.durationDays > 0
        ? (date.getTime() - timeframeBounds.startDate.getTime()) /
          (timeframeBounds.endDate.getTime() - timeframeBounds.startDate.getTime())
        : 0;
    const idx = Math.min(
      activePoints.length - 1,
      Math.max(0, Math.floor(progress * activePoints.length)),
    );
    return activePoints[idx];
  };

  const findCompActivePoint = (date: Date): HostEarningsChartPoint | undefined => {
    if (timeframeBounds.timeframe === "monthly") {
      const dayIdx = date.getUTCDate() - 1;
      return activePoints[dayIdx];
    }
    if (timeframeBounds.timeframe === "yearly") {
      const mIdx = date.getUTCMonth();
      return activePoints[mIdx];
    }
    if (timeframeBounds.timeframe === "quarterly") {
      const compStartM = compBounds.startDate.getUTCMonth();
      const mIdx = date.getUTCMonth() - compStartM;
      return activePoints[mIdx];
    }
    if (timeframeBounds.timeframe === "weekly") {
      const dayOffset = Math.floor(
        (date.getTime() - compBounds.startDate.getTime()) / (24 * 60 * 60 * 1000),
      );
      return activePoints[dayOffset];
    }
    const progress =
      compBounds.durationDays > 0
        ? (date.getTime() - compBounds.startDate.getTime()) /
          (compBounds.endDate.getTime() - compBounds.startDate.getTime())
        : 0;
    const idx = Math.min(
      activePoints.length - 1,
      Math.max(0, Math.floor(progress * activePoints.length)),
    );
    return activePoints[idx];
  };

  const totals = new Map<string, EarningsCurrencyTotals>();
  let unavailableSnapshotCount = 0;
  let compNetEarnings = 0;
  let compGrossEarnings = 0;
  let compCompletedStaysCount = 0;

  const getTotals = (currency: string) => {
    const existing = totals.get(currency);
    if (existing) return existing;
    const next: EarningsCurrencyTotals = {
      currency,
      monthlyRecognized: 0,
      upcomingPayout: 0,
      ytdGross: 0,
      ytdAdjustments: 0,
      ytdPlatformFee: 0,
      ytdTaxesWithheld: 0,
      ytdNet: 0,
    };
    totals.set(currency, next);
    return next;
  };

  for (const b of reportingBookings) {
    const calc = calculateBookingPayout(b, {
      now,
      hostPayoutMethods: payoutMethods,
    });

    if (!calc.hasStoredSnapshot) {
      unavailableSnapshotCount++;
      continue;
    }
    if (reportingCurrency && calc.currency !== reportingCurrency) continue;
    const isRecognized =
      b.endDate <= now &&
      (calc.status === "PAID" || calc.status === "ELIGIBLE_SETTLEMENT");
    if (!isRecognized) continue;
    const bucket = getTotals(calc.currency);
    bucket.ytdGross += calc.grossEarnings;
    bucket.ytdPlatformFee += calc.platformFee;
    bucket.ytdNet += calc.netPayout;
    totalGrossVolume += calc.grossEarnings;
    totalPlatformCommission += calc.platformFee;
    if (calc.status === "PAID") {
      totalPaidVolume += calc.netPayout;
      totalPaidCount++;
    } else {
      eligibleSettlementVolume += calc.netPayout;
      eligibleSettlementCount++;
    }

    // Recognize in active timeframe
    if (
      b.endDate >= timeframeBounds.startDate &&
      b.endDate <= timeframeBounds.endDate
    ) {
      bucket.monthlyRecognized += calc.netPayout;
    }
  }

  for (const b of upcomingBookings) {
    const calc = calculateBookingPayout(b, {
      now,
      hostPayoutMethods: payoutMethods,
    });
    if (
      !calc.hasStoredSnapshot ||
      !["SCHEDULED", "ELIGIBLE_SETTLEMENT", "PROCESSING"].includes(calc.status)
    )
      continue;
    if (reportingCurrency && calc.currency !== reportingCurrency) continue;
    const item = toPayoutPreview(b, calc);
    upcomingPayouts.push(item);
    getTotals(calc.currency).upcomingPayout += calc.netPayout;
    if (calc.status === "SCHEDULED") {
      scheduledPendingVolume += calc.netPayout;
      scheduledPendingCount++;
    }
  }

  for (const b of recentBookings) {
    const calc = calculateBookingPayout(b, {
      now,
      hostPayoutMethods: payoutMethods,
    });
    if (calc.status !== "PAID") continue;
    if (reportingCurrency && calc.currency !== reportingCurrency) continue;
    completedPayouts.push(toPayoutPreview(b, calc));
  }

  // Calculate pending deductions
  const pendingDeductionsVolume = adjustments
    .filter((a) => a.status === "PENDING")
    .reduce((sum, a) => sum + a.amount, 0);

  for (const adjustment of adjustments) {
    const createdAt = new Date(adjustment.createdAt);
    if (
      adjustment.status !== "DEDUCTED" ||
      createdAt < yearStart ||
      createdAt > ytdEnd
    )
      continue;
    if (
      reportingCurrency &&
      adjustment.currency.toUpperCase() !== reportingCurrency
    )
      continue;
    getTotals(adjustment.currency).ytdAdjustments +=
      positiveAdjustmentAmount(adjustment);
  }

  const totalsByCurrency = Array.from(totals.values()).sort((a, b) =>
    a.currency.localeCompare(b.currency),
  );
  const preferredDefault =
    reportingCurrency && totals.has(reportingCurrency)
      ? reportingCurrency
      : totals.has("SAR")
        ? "SAR"
        : totalsByCurrency[0]?.currency || "SAR";
  const chartCurrency =
    reportingCurrency || preferredDefault;
  // A chart is always one native currency. Build the displayed series from
  // chartCurrency rather than silently adding unlike currencies.
  for (const point of daily) point.amount = 0;
  for (const point of monthly) point.amount = 0;
  for (const point of activePoints) {
    point.amount = 0;
    point.netEarnings = 0;
    point.grossEarnings = 0;
    point.platformFee = 0;
    point.refunds = 0;
    point.adjustments = 0;
    point.completedStaysCount = 0;
    point.propertyBreakdown = [];
    point.secondaryAmount = 0;
    point.secondaryGrossEarnings = 0;
    point.secondaryStaysCount = 0;
  }

  for (const b of reportingBookings) {
    const calc = calculateBookingPayout(b, {
      now,
      hostPayoutMethods: payoutMethods,
    });
    if (
      calc.currency !== chartCurrency ||
      !calc.hasStoredSnapshot ||
      b.endDate > now ||
      !["PAID", "ELIGIBLE_SETTLEMENT"].includes(calc.status)
    )
      continue;

    // Primary timeframe accumulation
    if (
      b.endDate >= timeframeBounds.startDate &&
      b.endDate <= timeframeBounds.endDate
    ) {
      const pt = findActivePoint(b.endDate);
      if (pt) {
        pt.amount += calc.netPayout;
        pt.netEarnings += calc.netPayout;
        pt.grossEarnings += calc.grossEarnings;
        pt.platformFee += calc.platformFee;
        pt.completedStaysCount += 1;
        const refundSum = Array.isArray(b.refunds)
          ? b.refunds.reduce(
              (sum: number, r: { amount?: number | null }) => sum + (r.amount || 0),
              0,
            )
          : 0;
        pt.refunds += refundSum;
        pt.adjustments += calc.deductions;

        if (b.listing) {
          const existingProp = pt.propertyBreakdown.find(
            (p) => p.listingId === b.listing.id,
          );
          if (existingProp) {
            existingProp.netEarnings += calc.netPayout;
            existingProp.amount += calc.netPayout;
            existingProp.grossEarnings += calc.grossEarnings;
            existingProp.count += 1;
          } else {
            pt.propertyBreakdown.push({
              listingId: b.listing.id,
              title: b.listing.title,
              netEarnings: calc.netPayout,
              amount: calc.netPayout,
              grossEarnings: calc.grossEarnings,
              count: 1,
            });
          }
        }
      }

      if (
        b.endDate >= selectedMonthBounds.start &&
        b.endDate <= selectedMonthBounds.end
      ) {
        daily[b.endDate.getUTCDate() - 1].amount += calc.netPayout;
      }
      if (b.endDate.getUTCFullYear() === selectedYear) {
        monthly[b.endDate.getUTCMonth()].amount += calc.netPayout;
      }
    }

    // Comparison interval accumulation
    if (
      hasComparison &&
      b.endDate >= compBounds.startDate &&
      b.endDate <= compBounds.endDate
    ) {
      compNetEarnings += calc.netPayout;
      compGrossEarnings += calc.grossEarnings;
      compCompletedStaysCount++;

      const compPt = findCompActivePoint(b.endDate);
      if (compPt) {
        compPt.secondaryAmount = (compPt.secondaryAmount || 0) + calc.netPayout;
        compPt.secondaryGrossEarnings =
          (compPt.secondaryGrossEarnings || 0) + calc.grossEarnings;
        compPt.secondaryStaysCount = (compPt.secondaryStaysCount || 0) + 1;
      }
    }
  }

  const reports = monthly
    .map((point) => ({
      year: selectedYear,
      month: point.month,
      label: `${point.label} ${selectedYear}`,
      currency: chartCurrency || "SAR",
      amount: point.amount,
    }))
    .filter((point) => point.amount > 0)
    .reverse()
    .slice(0, 3);

  const selectedBucket = totals.get(chartCurrency) || { monthlyRecognized: 0 };
  const primaryTimeframeNet = selectedBucket.monthlyRecognized;
  const deltaInfo = calculateDelta(primaryTimeframeNet, compNetEarnings);

  const comparisonData: EarningsComparisonData | null = hasComparison
    ? {
        enabled: true,
        periodLabel: compBounds.label,
        timeframe: compBounds.timeframe,
        startDateKey: compBounds.startDateKey,
        endDateKey: compBounds.endDateKey,
        netEarnings: compNetEarnings,
        grossEarnings: compGrossEarnings,
        completedStaysCount: compCompletedStaysCount,
        deltaEarnings: primaryTimeframeNet - compNetEarnings,
        deltaPercentage: deltaInfo.deltaPercentage,
        deltaDirection: deltaInfo.deltaDirection,
        chartPoints: activePoints.map((p) => ({
          key: p.key,
          label: p.label,
          amount: p.secondaryAmount || 0,
        })),
      }
    : null;

  return {
    summary: {
      totalPaidVolume,
      totalPaidCount,
      eligibleSettlementVolume,
      eligibleSettlementCount,
      scheduledPendingVolume,
      scheduledPendingCount,
      onHoldVolume,
      onHoldCount,
      totalGrossVolume,
      totalPlatformCommission,
      pendingDeductionsVolume,
      currency: "SAR",
    },
    payoutMethods,
    upcomingPayouts: query.includeAllPayouts
      ? upcomingPayouts
      : upcomingPayouts.slice(0, 4),
    completedPayouts: query.includeAllPayouts
      ? completedPayouts
      : completedPayouts.slice(0, 4),
    adjustments,
    reporting: {
      timeframe: timeframeBounds.timeframe,
      timeframeLabel: timeframeBounds.label,
      startDateKey: timeframeBounds.startDateKey,
      endDateKey: timeframeBounds.endDateKey,
      selectedMonth: selectedMonth + 1,
      selectedYear,
      monthLabel: timeframeBounds.label,
      selectedListingId,
      selectedCurrency: chartCurrency,
      listings: listingItems,
      currencies: totalsByCurrency.map((total) => total.currency),
      totalsByCurrency,
      chart: {
        currency: chartCurrency,
        timeframe: timeframeBounds.timeframe,
        points: activePoints,
        daily,
        monthly,
      },
      comparison: comparisonData,
      reports,
      dataBasis: "COMPLETED_STAY_NET_HOST_PAYOUT",
      unavailableSnapshotCount,
    },
  };
}

// ============================================================================
// Post-Payout Adjustments & Ledger (Phase 18)
// ============================================================================

/**
 * Records a post-payout refund clawback or dispute adjustment on a host account.
 */
export async function recordPayoutAdjustment(input: {
  hostId: string;
  bookingId: string;
  type:
    | "REFUND_DEDUCTION"
    | "DISPUTE_CLAWBACK"
    | "DAMAGE_CLAIM_CREDIT"
    | "BONUS_CREDIT"
    | "MANUAL_CORRECTION";
  amount: number;
  currency?: string;
  reason: string;
}): Promise<PayoutAdjustmentRecord> {
  const user = await prisma.user.findUnique({
    where: { id: input.hostId },
    select: { personalInfo: true },
  });

  if (!user) throw AppError.notFound(`Host ${input.hostId} not found.`);

  const info = (user.personalInfo as Record<string, any>) || {};
  const existing: PayoutAdjustmentRecord[] = Array.isArray(
    info.payoutAdjustments,
  )
    ? [...info.payoutAdjustments]
    : [];

  const record: PayoutAdjustmentRecord = {
    id: `adj_${nanoid(12)}`,
    bookingId: input.bookingId,
    type: input.type,
    amount: input.amount,
    currency: input.currency || "SAR",
    reason: input.reason,
    status: "PENDING",
    createdAt: new Date().toISOString(),
  };

  existing.push(record);

  await prisma.user.update({
    where: { id: input.hostId },
    data: {
      personalInfo: {
        ...info,
        payoutAdjustments: existing,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return record;
}

export const payoutService = {
  validateSaudiIban,
  maskIban,
  getHostPayoutMethods,
  addHostPayoutMethod,
  setDefaultPayoutMethod,
  deleteHostPayoutMethod,
  verifyHostPayoutMethod,
  calculateBookingPayout,
  getPayoutSummaryForAdmin,
  listHostPayoutsForAdmin,
  getHostPayoutDetailsForAdmin,
  holdPayout,
  releasePayout,
  processPayoutSettlement,
  exportBatchSettlementCSV,
  getHostEarningsOverview,
  listHostEarningsTransactions,
  getHostEarningsTransactionDetails,
  recordPayoutAdjustment,
};
