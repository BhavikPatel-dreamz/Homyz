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
import { extractStoredHostPayout, StoredHostPayout } from "@/lib/booking/booking-financials";
import { nanoid } from "nanoid";
import type { Prisma } from "@/generated/prisma/client";

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
  type: "REFUND_DEDUCTION" | "DISPUTE_CLAWBACK" | "DAMAGE_CLAIM_CREDIT" | "BONUS_CREDIT" | "MANUAL_CORRECTION";
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
  const bankName = SAUDI_BANK_CODES[bankCode] || "Saudi Licensed Commercial Bank";

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
export async function getHostPayoutMethods(hostId: string): Promise<HostPayoutMethod[]> {
  const user = await prisma.user.findUnique({
    where: { id: hostId },
    select: { personalInfo: true },
  });

  if (!user) {
    throw AppError.notFound(`User ${hostId} not found.`);
  }

  const info = (user.personalInfo as Record<string, any>) || {};
  const methods: HostPayoutMethod[] = Array.isArray(info.payoutMethods) ? info.payoutMethods : [];
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
  if (existingMethods.some((m) => m.ibanLast4 === last4 && m.bankCode === validation.bankCode)) {
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
    booking.priceBreakdown && typeof booking.priceBreakdown === "object" && !Array.isArray(booking.priceBreakdown)
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
  const scheduledPayoutDate = new Date(new Date(booking.startDate).getTime() + 24 * 60 * 60 * 1000);

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
          (r: any) => r.status === RefundStatus.PENDING || r.status === RefundStatus.PROCESSING,
        );

  // Active quality incidents / disputes
  const qualityIncidents = Array.isArray(booking.qualityIncidents) ? booking.qualityIncidents : [];
  const hasActiveQualityIncident =
    options.activeQualityIncidentsCount !== undefined
      ? options.activeQualityIncidentsCount > 0
      : qualityIncidents.some(
          (i: any) =>
            i.status === QualityIncidentStatus.PENDING || i.status === QualityIncidentStatus.CONFIRMED,
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
      reasonsIneligible.push(`Booking status is ${booking.status}, not CONFIRMED.`);
    }
  }

  if (!isPaymentCaptured) {
    reasonsIneligible.push("Guest payment has not been captured.");
  }

  if (hasStoredSnapshot && capturedAmount < netPayout) {
    reasonsIneligible.push(
      "Verified captured funds are lower than the stored host entitlement. Reconciliation is required before settlement.",
    );
  }

  const hasSucceededRefund = refunds.some((r: any) => r.status === RefundStatus.SUCCEEDED);
  if (hasSucceededRefund && !cancellation) {
    reasonsIneligible.push(
      "A completed refund exists without an explicit host-entitlement adjustment. Reconciliation is required before settlement.",
    );
  }

  if (now < scheduledPayoutDate) {
    reasonsIneligible.push("Scheduled payout date (check-in + 24h) has not arrived yet.");
  }

  if (holdDetails?.isHeld) {
    reasonsIneligible.push(`Administrative hold active: ${holdDetails.reason || holdDetails.holdType}`);
  }

  if (activeRefunds) {
    reasonsIneligible.push("Reservation has a refund request currently pending or processing.");
  }

  if (hasActiveQualityIncident) {
    reasonsIneligible.push("Reservation has an active quality incident / dispute under review.");
  }

  // Payout Method check
  const hostMethods = options.hostPayoutMethods || [];
  const hasVerifiedMethod = hostMethods.some((m) => m.status === "VERIFIED");
  if (options.hostPayoutMethods && !hasVerifiedMethod) {
    reasonsIneligible.push("Host has no verified default payout account configured.");
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
  } else if (!hasStoredSnapshot || hasSucceededRefund || capturedAmount < netPayout) {
    status = "REQUIRES_REVIEW";
  } else if (reasonsIneligible.length === 0) {
    status = "ELIGIBLE_SETTLEMENT";
  } else if (now < scheduledPayoutDate) {
    status = "SCHEDULED";
  } else {
    status = "ON_HOLD";
  }

  const isEligibleForSettlement = status === "ELIGIBLE_SETTLEMENT";

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
export async function getPayoutSummaryForAdmin(actor: AuthUser): Promise<AdminPayoutSummaryData> {
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
    const hostPayoutMethods: HostPayoutMethod[] = Array.isArray(b.listing.host?.personalInfo?.payoutMethods)
      ? b.listing.host.personalInfo.payoutMethods
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
  pagination: { page: number; limit: number; total: number; totalPages: number };
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
    const hostMethods: HostPayoutMethod[] = Array.isArray(b.listing.host?.personalInfo?.payoutMethods)
      ? b.listing.host.personalInfo.payoutMethods
      : [];
    const defaultMethod = hostMethods.find((m) => m.isDefault) || hostMethods[0];

    const calc = calculateBookingPayout(b, { now, hostPayoutMethods: hostMethods });

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
      payoutAccountMasked: defaultMethod ? defaultMethod.ibanMasked : "No account configured",
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

  const hostMethods: HostPayoutMethod[] = Array.isArray(booking.listing.host?.personalInfo?.payoutMethods)
    ? booking.listing.host.personalInfo.payoutMethods
    : [];
  const defaultMethod = hostMethods.find((m) => m.isDefault) || hostMethods[0];

  const calc = calculateBookingPayout(booking, { hostPayoutMethods: hostMethods });

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
    throw AppError.badRequest("A valid reason is mandatory to place a payout on hold.");
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
    (r: any) => r.status === RefundStatus.PENDING || r.status === RefundStatus.PROCESSING,
  );
  if (hasPendingRefund) {
    throw AppError.conflict("Cannot release hold: There is a pending refund request for this reservation.");
  }

  const hasActiveIncident = booking.qualityIncidents.some(
    (i: any) => i.status === QualityIncidentStatus.PENDING || i.status === QualityIncidentStatus.CONFIRMED,
  );
  if (hasActiveIncident) {
    throw AppError.conflict("Cannot release hold: There is an active quality incident under investigation.");
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
          host: { select: { id: true, name: true, email: true, personalInfo: true } },
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
    const hostMethods: HostPayoutMethod[] = Array.isArray(b.listing.host?.personalInfo?.payoutMethods)
      ? b.listing.host.personalInfo.payoutMethods
      : [];
    const defaultMethod = hostMethods.find((m) => m.isDefault && m.status === "VERIFIED") || hostMethods[0];

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
  upcomingPayouts: any[];
  completedPayouts: any[];
  adjustments: PayoutAdjustmentRecord[];
}

/**
 * Returns comprehensive earnings, upcoming payouts, and configured accounts for a host.
 */
export async function getHostEarningsOverview(
  hostId: string,
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
  const adjustments: PayoutAdjustmentRecord[] = Array.isArray(info.payoutAdjustments)
    ? info.payoutAdjustments
    : [];

  const bookings = await prisma.booking.findMany({
    where: {
      listing: { hostId },
      status: { in: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED] },
    },
    include: {
      listing: { select: { id: true, title: true, photos: true } },
      payments: { select: { id: true, status: true, capturedAmount: true } },
      refunds: { select: { id: true, status: true, amount: true } },
      qualityIncidents: { select: { id: true, status: true } },
      user: { select: { id: true, name: true, image: true } },
    },
    orderBy: { startDate: "desc" },
  });

  let totalPaidVolume = 0;
  let totalPaidCount = 0;
  let eligibleSettlementVolume = 0;
  let eligibleSettlementCount = 0;
  let scheduledPendingVolume = 0;
  let scheduledPendingCount = 0;
  let onHoldVolume = 0;
  let onHoldCount = 0;
  let totalGrossVolume = 0;
  let totalPlatformCommission = 0;

  const upcomingPayouts: any[] = [];
  const completedPayouts: any[] = [];

  const now = new Date();

  for (const b of bookings) {
    const calc = calculateBookingPayout(b, { now, hostPayoutMethods: payoutMethods });

    if (calc.status === "CANCELLED" && calc.netPayout === 0) {
      continue;
    }

    totalGrossVolume += calc.grossEarnings;
    totalPlatformCommission += calc.platformFee;

    const item = {
      bookingId: b.id,
      listingTitle: b.listing.title,
      guestName: b.user?.name || "Guest",
      startDate: b.startDate,
      endDate: b.endDate,
      scheduledPayoutDate: calc.scheduledPayoutDate,
      grossEarnings: calc.grossEarnings,
      platformFee: calc.platformFee,
      netPayout: calc.netPayout,
      currency: calc.currency,
      status: calc.status,
      executionDetails: calc.executionDetails,
      holdDetails: calc.holdDetails,
    };

    if (calc.status === "PAID") {
      totalPaidVolume += calc.netPayout;
      totalPaidCount++;
      completedPayouts.push(item);
    } else {
      if (calc.status === "ELIGIBLE_SETTLEMENT") {
        eligibleSettlementVolume += calc.netPayout;
        eligibleSettlementCount++;
      } else if (calc.status === "SCHEDULED") {
        scheduledPendingVolume += calc.netPayout;
        scheduledPendingCount++;
      } else if (calc.status === "ON_HOLD") {
        onHoldVolume += calc.netPayout;
        onHoldCount++;
      }
      upcomingPayouts.push(item);
    }
  }

  // Calculate pending deductions
  const pendingDeductionsVolume = adjustments
    .filter((a) => a.status === "PENDING")
    .reduce((sum, a) => sum + a.amount, 0);

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
    upcomingPayouts,
    completedPayouts,
    adjustments,
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
  type: "REFUND_DEDUCTION" | "DISPUTE_CLAWBACK" | "DAMAGE_CLAIM_CREDIT" | "BONUS_CREDIT" | "MANUAL_CORRECTION";
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
  const existing: PayoutAdjustmentRecord[] = Array.isArray(info.payoutAdjustments)
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
  recordPayoutAdjustment,
};
