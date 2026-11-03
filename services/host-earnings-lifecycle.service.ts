import "server-only";

import { prisma } from "@/lib/db/prisma";
import { BookingStatus, PaymentProvider, PaymentStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { getPaymentPolicy } from "@/lib/booking/payment-policy";
import { extractStoredHostPayout } from "@/lib/booking/booking-financials";
import { isCompletedConfirmedBooking } from "@/lib/booking/booking-status";

export interface HostEarningsSnapshot {
  status: "EARNED" | "VOIDED";
  earnedAt: string;
  grossEarnings: number;
  platformFee: number;
  netEarnings: number;
  currency: string;
  source: "LIFECYCLE_COMPLETION" | "HISTORICAL_RECOVERY" | "RECONCILIATION";
  reconciledAt: string;
}

export interface BookingEarningsEvaluation {
  bookingId: string;
  isEligible: boolean;
  status:
    | "ELIGIBLE"
    | "ALREADY_RECOGNIZED"
    | "NOT_COMPLETED"
    | "NOT_CONFIRMED"
    | "BLOCKED_MISSING_SNAPSHOT"
    | "BLOCKED_PAYMENT_UNVERIFIED"
    | "CANCELLED_FULL_REFUND"
    | "ACTIVE_DISPUTE";
  grossEarnings: number;
  platformFee: number;
  netEarnings: number;
  currency: string;
  reason?: string;
  storedSnapshot: boolean;
  checkoutDate: Date;
}

export interface ReconciliationAuditResult {
  totalBookingsExamined: number;
  completedBookingsFound: number;
  alreadyRecognizedCount: number;
  eligibleToRecoverCount: number;
  blockedOrIneligibleCount: number;
  blockedBreakdown: Record<string, number>;
  earningsByCurrency: Record<
    string,
    {
      count: number;
      grossVolumeCents: number;
      platformFeeCents: number;
      netEarningsCents: number;
    }
  >;
  details: Array<{
    bookingId: string;
    hostId: string;
    status: string;
    currency: string;
    netEarnings: number;
    checkoutDate: string;
    actionProposed: string;
  }>;
  executed: boolean;
  recordsUpdated: number;
  recordsCreated: number;
}

/**
 * Authoritatively evaluates whether a booking qualifies for Host Earnings recognition.
 * Strictly checks:
 * 1. Booking status is CONFIRMED.
 * 2. Stay is genuinely completed (checkout in the past per configured checkout time).
 * 3. Immutable financial payout snapshot exists.
 * 4. Payment is verified per Homyz payment policy (online capture if required, deferred/mock allowed).
 * 5. Not voided by full cancellation or active dispute.
 */
export function evaluateBookingEarnings(
  booking: {
    id: string;
    status: string;
    startDate: Date;
    endDate: Date;
    checkOutTime?: string | null;
    propertyTimeZone?: string | null;
    totalPrice?: number | null;
    currency?: string;
    priceBreakdown?: unknown;
    payments?: Array<{ status: string; capturedAmount?: number | null }>;
    refunds?: Array<{ status: string; amount?: number }>;
    qualityIncidents?: Array<{ status: string }>;
    listing?: { checkInStart?: string | null; checkOutTime?: string | null };
  },
  now = new Date(),
): BookingEarningsEvaluation {
  const storedPayout = extractStoredHostPayout(booking as any);
  const snapshot =
    booking.priceBreakdown &&
    typeof booking.priceBreakdown === "object" &&
    !Array.isArray(booking.priceBreakdown)
      ? (booking.priceBreakdown as Record<string, any>)
      : null;

  const currency = storedPayout?.currency || booking.currency || "SAR";
  const checkoutDate = booking.endDate;

  if (!storedPayout) {
    return {
      bookingId: booking.id,
      isEligible: false,
      status: "BLOCKED_MISSING_SNAPSHOT",
      grossEarnings: 0,
      platformFee: 0,
      netEarnings: 0,
      currency,
      storedSnapshot: false,
      checkoutDate,
      reason: "Booking has no stored payout financial snapshot.",
    };
  }

  const grossEarnings =
    storedPayout.accommodationSubtotal +
    storedPayout.cleaningFee +
    storedPayout.extraGuestFee +
    storedPayout.petFee;
  const platformFee = storedPayout.hostServiceFee;
  let netEarnings = storedPayout.netHostPayout;

  // Check if already recognized
  const existingEarnings = snapshot?.hostEarnings as HostEarningsSnapshot | undefined;
  if (existingEarnings && existingEarnings.status === "EARNED") {
    return {
      bookingId: booking.id,
      isEligible: true,
      status: "ALREADY_RECOGNIZED",
      grossEarnings: existingEarnings.grossEarnings,
      platformFee: existingEarnings.platformFee,
      netEarnings: existingEarnings.netEarnings,
      currency: existingEarnings.currency,
      storedSnapshot: true,
      checkoutDate,
    };
  }

  // Must be CONFIRMED
  if (booking.status !== BookingStatus.CONFIRMED) {
    return {
      bookingId: booking.id,
      isEligible: false,
      status: "NOT_CONFIRMED",
      grossEarnings,
      platformFee,
      netEarnings: 0,
      currency,
      storedSnapshot: true,
      checkoutDate,
      reason: `Booking status is ${booking.status}, not CONFIRMED.`,
    };
  }

  // Stay must be completed
  const isCompleted = isCompletedConfirmedBooking({
    dbStatus: booking.status,
    startDate: booking.startDate,
    endDate: booking.endDate,
    checkOutTime: booking.checkOutTime,
    propertyTimeZone: booking.propertyTimeZone,
    now,
  });

  if (!isCompleted && booking.endDate > now) {
    return {
      bookingId: booking.id,
      isEligible: false,
      status: "NOT_COMPLETED",
      grossEarnings,
      platformFee,
      netEarnings,
      currency,
      storedSnapshot: true,
      checkoutDate,
      reason: "Reservation checkout date has not passed yet.",
    };
  }

  // Cancellation adjustments
  const cancellation = snapshot?.cancellation;
  if (cancellation) {
    if (typeof cancellation.hostPayoutRetained === "number") {
      netEarnings = Math.max(0, cancellation.hostPayoutRetained);
    }
    if (netEarnings === 0) {
      return {
        bookingId: booking.id,
        isEligible: false,
        status: "CANCELLED_FULL_REFUND",
        grossEarnings,
        platformFee,
        netEarnings: 0,
        currency,
        storedSnapshot: true,
        checkoutDate,
        reason: "Booking was cancelled with full guest refund.",
      };
    }
  }

  // Quality incidents / administrative disputes
  const qualityIncidents = booking.qualityIncidents || [];
  const hasOpenDispute = qualityIncidents.some(
    (qi) => qi.status === "PENDING" || qi.status === "CONFIRMED",
  );
  if (hasOpenDispute) {
    return {
      bookingId: booking.id,
      isEligible: false,
      status: "ACTIVE_DISPUTE",
      grossEarnings,
      platformFee,
      netEarnings,
      currency,
      storedSnapshot: true,
      checkoutDate,
      reason: "Reservation has an active quality dispute under investigation.",
    };
  }

  // Payment policy check
  const policy = getPaymentPolicy();
  const payments = booking.payments || [];
  const hasCapturedPayment = payments.some(
    (p) =>
      p.status === PaymentStatus.CAPTURED ||
      p.status === PaymentStatus.PARTIALLY_REFUNDED ||
      (p.capturedAmount && p.capturedAmount > 0),
  );

  if (policy.onlinePaymentRequired && !hasCapturedPayment) {
    return {
      bookingId: booking.id,
      isEligible: false,
      status: "BLOCKED_PAYMENT_UNVERIFIED",
      grossEarnings,
      platformFee,
      netEarnings,
      currency,
      storedSnapshot: true,
      checkoutDate,
      reason: "Online payment capture is required by policy but not recorded.",
    };
  }

  return {
    bookingId: booking.id,
    isEligible: true,
    status: "ELIGIBLE",
    grossEarnings,
    platformFee,
    netEarnings,
    currency,
    storedSnapshot: true,
    checkoutDate,
  };
}

/**
 * Idempotently recognizes host earnings for a single booking.
 * Writes immutable `hostEarnings` into `booking.priceBreakdown`,
 * sets `paymentStatus` to `CAPTURED`, and ensures a `BookingPayment` record exists.
 */
export async function recognizeBookingEarnings(
  bookingId: string,
  options: {
    source?: "LIFECYCLE_COMPLETION" | "HISTORICAL_RECOVERY" | "RECONCILIATION";
    now?: Date;
  } = {},
): Promise<{ success: boolean; evaluation: BookingEarningsEvaluation }> {
  const now = options.now || new Date();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      payments: true,
      refunds: true,
      qualityIncidents: true,
      listing: { select: { checkInStart: true, checkOutTime: true, hostId: true } },
    },
  });

  if (!booking) {
    throw new Error(`Booking ${bookingId} not found.`);
  }

  const evaluation = evaluateBookingEarnings(booking, now);

  if (!evaluation.isEligible || evaluation.status === "ALREADY_RECOGNIZED") {
    return { success: evaluation.status === "ALREADY_RECOGNIZED", evaluation };
  }

  const existingBreakdown =
    booking.priceBreakdown &&
    typeof booking.priceBreakdown === "object" &&
    !Array.isArray(booking.priceBreakdown)
      ? (booking.priceBreakdown as Record<string, any>)
      : {};

  const hostEarningsRecord: HostEarningsSnapshot = {
    status: "EARNED",
    earnedAt: booking.endDate.toISOString(),
    grossEarnings: evaluation.grossEarnings,
    platformFee: evaluation.platformFee,
    netEarnings: evaluation.netEarnings,
    currency: evaluation.currency,
    source: options.source || "LIFECYCLE_COMPLETION",
    reconciledAt: now.toISOString(),
  };

  const updatedPriceBreakdown = {
    ...existingBreakdown,
    paymentStatus: "CAPTURED",
    paymentMode: existingBreakdown.paymentMode || "DEFERRED",
    hostEarnings: hostEarningsRecord,
  } as unknown as Prisma.InputJsonValue;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // 1. Update booking priceBreakdown
    await tx.booking.update({
      where: { id: booking.id },
      data: { priceBreakdown: updatedPriceBreakdown },
    });

    // 2. Ensure BookingPayment record reflects captured state
    const existingPayment = booking.payments[0];
    if (existingPayment) {
      if (existingPayment.status !== PaymentStatus.CAPTURED) {
        await tx.bookingPayment.update({
          where: { id: existingPayment.id },
          data: {
            status: PaymentStatus.CAPTURED,
            capturedAmount: existingPayment.amount || booking.totalPrice || evaluation.grossEarnings,
            capturedAt: booking.endDate,
          },
        });
      }
    } else {
      await tx.bookingPayment.create({
        data: {
          bookingId: booking.id,
          provider: PaymentProvider.DEFERRED,
          status: PaymentStatus.CAPTURED,
          currency: evaluation.currency,
          amount: booking.totalPrice || evaluation.grossEarnings,
          capturedAmount: booking.totalPrice || evaluation.grossEarnings,
          capturedAt: booking.endDate,
          idempotencyKey: `earn_rec_${booking.id}`,
        },
      });
    }
  });

  return { success: true, evaluation };
}

/**
 * Historical recovery & ongoing reconciliation mechanism.
 * In `dryRun: true` mode: audits and inspects without modifying any database records.
 * In `dryRun: false` mode: idempotently applies earnings recognition to all eligible bookings.
 */
export async function reconcileHistoricalBookings(options: {
  dryRun?: boolean;
  hostId?: string;
  bookingId?: string;
  now?: Date;
} = {}): Promise<ReconciliationAuditResult> {
  const now = options.now || new Date();
  const dryRun = options.dryRun ?? true;

  const whereClause: Prisma.BookingWhereInput = {
    ...(options.bookingId ? { id: options.bookingId } : {}),
    ...(options.hostId ? { listing: { hostId: options.hostId } } : {}),
  };

  const bookings = await prisma.booking.findMany({
    where: whereClause,
    include: {
      payments: true,
      refunds: true,
      qualityIncidents: true,
      listing: { select: { id: true, title: true, hostId: true, checkInStart: true, checkOutTime: true } },
    },
    orderBy: { endDate: "asc" },
  });

  let completedBookingsFound = 0;
  let alreadyRecognizedCount = 0;
  let eligibleToRecoverCount = 0;
  let blockedOrIneligibleCount = 0;
  const blockedBreakdown: Record<string, number> = {};
  const earningsByCurrency: ReconciliationAuditResult["earningsByCurrency"] = {};
  const details: ReconciliationAuditResult["details"] = [];
  const eligibleBookingsToUpdate: string[] = [];

  for (const b of bookings) {
    const isPast = b.endDate <= now;
    if (b.status === BookingStatus.CONFIRMED && isPast) {
      completedBookingsFound++;
    }

    const evaluation = evaluateBookingEarnings(b, now);

    if (evaluation.status === "ALREADY_RECOGNIZED") {
      alreadyRecognizedCount++;
      const curr = evaluation.currency;
      if (!earningsByCurrency[curr]) {
        earningsByCurrency[curr] = { count: 0, grossVolumeCents: 0, platformFeeCents: 0, netEarningsCents: 0 };
      }
      earningsByCurrency[curr].count++;
      earningsByCurrency[curr].grossVolumeCents += evaluation.grossEarnings;
      earningsByCurrency[curr].platformFeeCents += evaluation.platformFee;
      earningsByCurrency[curr].netEarningsCents += evaluation.netEarnings;

      details.push({
        bookingId: b.id,
        hostId: b.listing.hostId,
        status: evaluation.status,
        currency: evaluation.currency,
        netEarnings: evaluation.netEarnings,
        checkoutDate: b.endDate.toISOString().slice(0, 10),
        actionProposed: "None (Already recognized)",
      });
      continue;
    }

    if (evaluation.isEligible && evaluation.status === "ELIGIBLE") {
      eligibleToRecoverCount++;
      const curr = evaluation.currency;
      if (!earningsByCurrency[curr]) {
        earningsByCurrency[curr] = { count: 0, grossVolumeCents: 0, platformFeeCents: 0, netEarningsCents: 0 };
      }
      earningsByCurrency[curr].count++;
      earningsByCurrency[curr].grossVolumeCents += evaluation.grossEarnings;
      earningsByCurrency[curr].platformFeeCents += evaluation.platformFee;
      earningsByCurrency[curr].netEarningsCents += evaluation.netEarnings;

      eligibleBookingsToUpdate.push(b.id);

      details.push({
        bookingId: b.id,
        hostId: b.listing.hostId,
        status: evaluation.status,
        currency: evaluation.currency,
        netEarnings: evaluation.netEarnings,
        checkoutDate: b.endDate.toISOString().slice(0, 10),
        actionProposed: dryRun ? "PROPOSED: Recognize host earnings & verify payment" : "RECOGNIZED",
      });
      continue;
    }

    // Ineligible or blocked
    blockedOrIneligibleCount++;
    blockedBreakdown[evaluation.status] = (blockedBreakdown[evaluation.status] || 0) + 1;

    details.push({
      bookingId: b.id,
      hostId: b.listing.hostId,
      status: evaluation.status,
      currency: evaluation.currency,
      netEarnings: evaluation.netEarnings,
      checkoutDate: b.endDate.toISOString().slice(0, 10),
      actionProposed: `BLOCKED: ${evaluation.reason || evaluation.status}`,
    });
  }

  let recordsUpdated = 0;
  let recordsCreated = 0;

  if (!dryRun && eligibleBookingsToUpdate.length > 0) {
    for (const id of eligibleBookingsToUpdate) {
      const res = await recognizeBookingEarnings(id, {
        source: "HISTORICAL_RECOVERY",
        now,
      });
      if (res.success) {
        recordsUpdated++;
      }
    }
  }

  return {
    totalBookingsExamined: bookings.length,
    completedBookingsFound,
    alreadyRecognizedCount,
    eligibleToRecoverCount,
    blockedOrIneligibleCount,
    blockedBreakdown,
    earningsByCurrency,
    details,
    executed: !dryRun,
    recordsUpdated,
    recordsCreated,
  };
}

/**
 * Background reconciliation job handler.
 * Safely processes completed stays that have passed checkout but are not yet marked earned.
 */
export async function runHostEarningsReconciliationJob(options: {
  hostId?: string;
  bookingId?: string;
  dryRun?: boolean;
  now?: Date;
} = {}): Promise<{
  processedCount: number;
  errorsCount: number;
  recordsUpdated: number;
  totalBookingsExamined: number;
  eligibleToRecoverCount: number;
}> {
  const result = await reconcileHistoricalBookings({
    hostId: options.hostId,
    bookingId: options.bookingId,
    dryRun: options.dryRun ?? false,
    now: options.now ?? new Date(),
  });

  return {
    processedCount: result.recordsUpdated,
    errorsCount: 0,
    recordsUpdated: result.recordsUpdated,
    totalBookingsExamined: result.totalBookingsExamined,
    eligibleToRecoverCount: result.eligibleToRecoverCount,
  };
}
