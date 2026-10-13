import "server-only";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { assertRole } from "@/lib/permissions/authorize";
import { Role, BookingStatus, PaymentStatus, RefundStatus, PaymentProvider, NotificationType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { getPaymentPolicy } from "@/lib/booking/payment-policy";
import {
  calculateRefundEligibility,
  type RefundCalculationResult,
} from "@/lib/refund/policy-engine";
import { notificationService } from "./notification.service";
import { auditService } from "./audit.service";
import { invalidateBookingCache } from "@/lib/redis/invalidation";
import { sanitizeListingSecrets } from "@/lib/booking/booking-lifecycle";
import { nanoid } from "nanoid";

export interface CreateRefundRequestInput {
  bookingId: string;
  amount: number; // minor units / cents
  reason: string;
  refundType?: "FULL" | "PARTIAL";
  notes?: string;
  idempotencyKey?: string;
}

export interface AdminRefundListOptions {
  page?: number;
  limit?: number;
  tab?: "all" | "pending" | "approved" | "processing" | "completed" | "failed" | "rejected" | string;
  status?: string;
  refundType?: string;
  search?: string;
  minAmount?: number;
  maxAmount?: number;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: "createdAt" | "amount" | "succeededAt";
  sortOrder?: "asc" | "desc";
}

export interface AdminRefundSummary {
  totalRequests: number;
  pendingReview: number;
  approved: number;
  processing: number;
  succeeded: number;
  failed: number;
  rejected: number;
  totalRefundedAmount: number; // in cents
  currency: string;
}

/**
 * The refund-management pages can be deployed ahead of the BookingRefund
 * migration. Treat that schema state as an empty refund history so admins can
 * still reach the page while the database deployment catches up.
 */
function isMissingBookingRefundTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    meta?: { table?: unknown; cause?: unknown };
  };
  const detail = [candidate.message, candidate.meta?.table, candidate.meta?.cause]
    .filter(Boolean)
    .join(" ");
  return candidate.code === "P2021" || /BookingRefund/i.test(detail);
}

/**
 * Ensures a booking has a valid BookingPayment record to track captured balances.
 * Creates a canonical payment row for confirmed bookings if one does not exist.
 */
async function ensureBookingPayment(
  tx: Prisma.TransactionClient,
  booking: any,
): Promise<any> {
  let payment = await tx.bookingPayment.findFirst({
    where: { bookingId: booking.id },
    orderBy: { createdAt: "desc" },
  });

  const paymentPolicy = getPaymentPolicy();
  // Never invent captured funds for a deferred or live-provider booking. A
  // mock payment row is permitted only in the explicit sandbox/mock mode.
  if (
    !payment &&
    paymentPolicy.paymentMode === "MOCK" &&
    (booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.CANCELLED)
  ) {
    const total = booking.totalPrice ?? 0;
    payment = await tx.bookingPayment.create({
      data: {
        bookingId: booking.id,
        provider: PaymentProvider.MOCK,
        providerPaymentId: `pay_${nanoid(12)}`,
        status: PaymentStatus.CAPTURED,
        currency: booking.currency || "SAR",
        amount: total,
        capturedAmount: total,
        refundedAmount: 0,
        capturedAt: booking.createdAt,
      },
    });
  }

  return payment;
}

/**
 * Calculates a read-only refund quote without mutating any database records.
 */
async function getRefundQuote(
  actor: AuthUser,
  bookingId: string,
  options: {
    discretionaryAmount?: number;
    discretionaryReason?: string;
  } = {},
): Promise<RefundCalculationResult> {
  assertRole(actor, [Role.ADMIN]);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          city: true,
          checkInStart: true,
          cancellationPolicy: true,
          longTermCancellationPolicy: true,
        },
      },
      payments: {
        where: {
          status: { in: [PaymentStatus.CAPTURED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED] },
        },
      },
      refunds: {
        where: {
          status: { in: [RefundStatus.PENDING, RefundStatus.PROCESSING, RefundStatus.SUCCEEDED] },
        },
      },
    },
  });

  if (!booking) {
    throw AppError.notFound(`Booking ${bookingId} not found`);
  }

  const breakdown = (booking.priceBreakdown as Record<string, any>) || {};
  const cancellation = breakdown.cancellation || {};

  // Financial components in cents
  const totalPrice = booking.totalPrice ?? 0;
  const nights = typeof breakdown.nights === "number" ? breakdown.nights : Math.max(1, Math.ceil((booking.endDate.getTime() - booking.startDate.getTime()) / (86400 * 1000)));
  const cleaningFee = booking.cleaningFee ?? (typeof breakdown.cleaningFee === "number" ? breakdown.cleaningFee : 0);
  const serviceFee = typeof breakdown.serviceFee === "number" ? breakdown.serviceFee : (typeof breakdown.guestServiceFee === "number" ? breakdown.guestServiceFee : 0);
  const taxes = typeof breakdown.taxTotal === "number" ? breakdown.taxTotal : 0;
  const accommodationTotal = typeof breakdown.nightlySubtotal === "number" ? breakdown.nightlySubtotal : (totalPrice - cleaningFee - serviceFee - taxes);

  // Determine captured & refunded balances
  let capturedAmount = 0;
  let alreadyRefundedAmount = 0;
  let pendingRefundReservedAmount = 0;

  if (booking.payments.length > 0) {
    for (const p of booking.payments) {
      capturedAmount += p.capturedAmount;
      alreadyRefundedAmount += p.refundedAmount;
    }
  } else if (booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.CANCELLED) {
    // If no payment record exists yet, the booking total is the baseline captured amount
    capturedAmount = totalPrice;
  }

  for (const r of booking.refunds) {
    if (r.status === RefundStatus.PENDING || r.status === RefundStatus.PROCESSING) {
      pendingRefundReservedAmount += r.amount;
    }
  }

  // Initiator determination
  const cancellationActor =
    cancellation.cancelledBy === "HOST" ? "HOST"
    : cancellation.cancelledBy === "ADMIN" ? "ADMIN"
    : "GUEST";

  return calculateRefundEligibility({
    bookingId: booking.id,
    cancellationActor,
    effectiveCancellationTime: cancellation.cancelledAt ? new Date(cancellation.cancelledAt) : new Date(),
    policyIdSnapshot: breakdown.cancellationPolicySnapshot || booking.cancellationPolicy || booking.listing.cancellationPolicy,
    policyVersion: "v1",
    isNonRefundable: Boolean(booking.isNonRefundable),
    nights,
    checkInDate: booking.startDate,
    checkInTimeStr: booking.listing.checkInStart,
    totalPrice,
    accommodationTotal,
    cleaningFee,
    serviceFee,
    taxes,
    currency: booking.currency || "SAR",
    capturedAmount,
    alreadyRefundedAmount,
    pendingRefundReservedAmount,
    discretionaryAdjustmentAmount: options.discretionaryAmount,
    discretionaryReason: options.discretionaryReason,
  });
}

/**
 * Creates an authorized refund request for a booking.
 */
async function createRefundRequest(
  actor: AuthUser,
  input: CreateRefundRequestInput,
): Promise<any> {
  assertRole(actor, [Role.ADMIN]);

  const { bookingId, amount, reason, notes, idempotencyKey } = input;

  if (!reason || !reason.trim()) {
    throw AppError.badRequest("A valid refund request reason is required.");
  }

  if (amount <= 0 || !Number.isInteger(amount)) {
    throw AppError.badRequest("Refund amount must be a positive integer in minor units (cents).");
  }

  // Idempotency check
  if (idempotencyKey) {
    const existing = await prisma.bookingRefund.findUnique({
      where: { idempotencyKey },
    });
    if (existing) {
      return existing;
    }
  }

  const result = await prisma.$transaction(async (tx: any) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      include: {
        payments: true,
        refunds: true,
        listing: { select: { title: true, hostId: true } },
      },
    });

    if (!booking) throw AppError.notFound("Booking not found");

    const payment = await ensureBookingPayment(tx, booking);
    if (!payment) {
      throw AppError.badRequest("No verified captured payment exists for this reservation to refund against.");
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payment.id}))`;
    const lockedPayment = await tx.bookingPayment.findUnique({ where: { id: payment.id } });
    if (!lockedPayment) throw AppError.notFound("Associated payment record not found.");
    if (idempotencyKey) {
      const existing = await tx.bookingRefund.findUnique({ where: { idempotencyKey } });
      if (existing) return { refund: existing, booking };
    }
    if (
      lockedPayment.status !== PaymentStatus.CAPTURED &&
      lockedPayment.status !== PaymentStatus.PARTIALLY_REFUNDED &&
      lockedPayment.status !== PaymentStatus.REFUNDED
    ) {
      throw AppError.badRequest("Refunds require a captured payment.");
    }

    // Verify balance
    const captured = lockedPayment.capturedAmount;
    const alreadyRefunded = lockedPayment.refundedAmount;
    const existingRefunds = await tx.bookingRefund.findMany({
      where: {
        paymentId: lockedPayment.id,
        status: { in: [RefundStatus.PENDING, RefundStatus.PROCESSING] },
      },
      select: { amount: true },
    });
    const pendingReserved = existingRefunds
      .filter((r: any) => r.status === RefundStatus.PENDING || r.status === RefundStatus.PROCESSING)
      .reduce((acc: number, r: any) => acc + r.amount, 0);

    const availableBalance = Math.max(0, captured - (alreadyRefunded + pendingReserved));
    if (amount > availableBalance) {
      throw AppError.badRequest(
        `Requested refund amount (${amount} cents) exceeds available captured balance (${availableBalance} cents).`,
      );
    }

    const refundReference = `REF-${nanoid(8).toUpperCase()}`;
    const refundType = amount >= captured ? "FULL" : "PARTIAL";

    const refund = await tx.bookingRefund.create({
      data: {
        bookingId: booking.id,
        paymentId: lockedPayment.id,
        refundReference,
        idempotencyKey: idempotencyKey || `idem_${nanoid(16)}`,
        status: RefundStatus.PENDING,
        currency: lockedPayment.currency || "SAR",
        amount,
        reason: reason.trim(),
        adminNotes: notes?.trim() || null,
        requestedById: actor.id,
        metadata: {
          refundType,
          requestedByEmail: actor.email,
          capturedAmountSnapshot: captured,
          remainingBalanceSnapshot: availableBalance - amount,
        },
      },
    });

    return { refund, booking };
  });

  // Audit Log
  try {
    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "REFUND_REQUESTED",
      resourceType: "BOOKING",
      resourceId: input.bookingId,
      description: `Refund request created for ${(amount / 100).toFixed(2)} ${result.refund.currency}: "${reason.trim()}".`,
      status: "SUCCESS",
      metadata: {
        refundId: result.refund.id,
        refundReference: result.refund.refundReference,
        amount,
        currency: result.refund.currency,
        reason: reason.trim(),
      },
    });
  } catch (err) {
    console.warn("[refund.service] Failed to record audit log for refund request:", err);
  }

  return result.refund;
}

/**
 * Lists refund requests for the Admin Refund Management dashboard.
 */
async function listRefundsForAdmin(
  actor: AuthUser,
  opts: AdminRefundListOptions = {},
) {
  assertRole(actor, [Role.ADMIN]);

  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const skip = (page - 1) * limit;
  const take = limit;

  const where: Prisma.BookingRefundWhereInput = {};

  const tabLower = (opts.tab || "").toLowerCase();
  if (tabLower === "pending") {
    where.status = RefundStatus.PENDING;
    where.approvedById = null;
  } else if (tabLower === "approved") {
    where.status = RefundStatus.PENDING;
    where.approvedById = { not: null };
  } else if (tabLower === "processing") {
    where.status = RefundStatus.PROCESSING;
  } else if (tabLower === "completed") {
    where.status = RefundStatus.SUCCEEDED;
  } else if (tabLower === "failed") {
    where.status = RefundStatus.FAILED;
  } else if (tabLower === "rejected") {
    where.status = RefundStatus.REJECTED;
  } else if (opts.status && opts.status !== "ALL") {
    where.status = opts.status as RefundStatus;
  }

  if (opts.search && opts.search.trim()) {
    const q = opts.search.trim();
    where.OR = [
      { id: { contains: q, mode: "insensitive" } },
      { refundReference: { contains: q, mode: "insensitive" } },
      { bookingId: { contains: q, mode: "insensitive" } },
      { booking: { submissionId: { contains: q, mode: "insensitive" } } },
      { booking: { user: { name: { contains: q, mode: "insensitive" } } } },
      { booking: { user: { email: { contains: q, mode: "insensitive" } } } },
      { booking: { listing: { title: { contains: q, mode: "insensitive" } } } },
    ];
  }

  if (opts.minAmount !== undefined || opts.maxAmount !== undefined) {
    where.amount = {
      ...(opts.minAmount !== undefined ? { gte: opts.minAmount } : {}),
      ...(opts.maxAmount !== undefined ? { lte: opts.maxAmount } : {}),
    };
  }

  if (opts.dateFrom || opts.dateTo) {
    where.createdAt = {
      ...(opts.dateFrom ? { gte: new Date(opts.dateFrom) } : {}),
      ...(opts.dateTo ? { lte: new Date(opts.dateTo) } : {}),
    };
  }

  const orderBy: Prisma.BookingRefundOrderByWithRelationInput[] = [];
  const sortOrder = opts.sortOrder === "asc" ? "asc" : "desc";
  const sortBy = opts.sortBy ?? "createdAt";

  if (sortBy === "amount") orderBy.push({ amount: sortOrder });
  else if (sortBy === "succeededAt") orderBy.push({ succeededAt: sortOrder });
  else orderBy.push({ createdAt: sortOrder });
  orderBy.push({ id: "desc" });

  const fetchRefunds = () => Promise.all([
    prisma.bookingRefund.findMany({
      where,
      skip,
      take,
      orderBy,
      include: {
        booking: {
          select: {
            id: true,
            submissionId: true,
            status: true,
            startDate: true,
            endDate: true,
            totalPrice: true,
            currency: true,
            user: { select: { id: true, name: true, email: true, image: true } },
            listing: { select: { id: true, title: true, photos: true, city: true, host: { select: { id: true, name: true, email: true } } } },
          },
        },
        payment: {
          select: {
            id: true,
            provider: true,
            status: true,
            amount: true,
            capturedAmount: true,
            refundedAmount: true,
          },
        },
      },
    }),
    prisma.bookingRefund.count({ where }),
  ]);
  let refundResult: Awaited<ReturnType<typeof fetchRefunds>>;
  try {
    refundResult = await fetchRefunds();
  } catch (error) {
    if (!isMissingBookingRefundTable(error)) throw error;
    return {
      refunds: [],
      pagination: { total: 0, page, limit, totalPages: 1 },
    };
  }
  const [refunds, total] = refundResult;

  const items = refunds.map((r: any) => {
    const meta = (r.metadata as Record<string, any>) || {};
    const refundType = meta.refundType || (r.payment && r.amount >= r.payment.capturedAmount ? "FULL" : "PARTIAL");

    return {
      id: r.id,
      refundReference: r.refundReference,
      bookingId: r.bookingId,
      paymentId: r.paymentId,
      status: r.status,
      isApproved: r.approvedById !== null,
      amount: r.amount,
      currency: r.currency,
      refundType,
      reason: r.reason,
      adminNotes: r.adminNotes,
      requestedById: r.requestedById,
      approvedById: r.approvedById,
      processedAt: r.processedAt?.toISOString() || null,
      succeededAt: r.succeededAt?.toISOString() || null,
      failedAt: r.failedAt?.toISOString() || null,
      failureReason: r.failureReason,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      booking: {
        id: r.booking.id,
        submissionId: r.booking.submissionId,
        status: r.booking.status,
        startDate: r.booking.startDate.toISOString(),
        endDate: r.booking.endDate.toISOString(),
        totalPrice: r.booking.totalPrice,
        currency: r.booking.currency,
        user: r.booking.user,
        listing: {
          ...r.booking.listing,
          photos: sanitizeListingSecrets(r.booking.listing).photos || [],
        },
      },
      payment: r.payment,
    };
  });

  return {
    refunds: items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

/**
 * Computes 8 aggregate KPI metrics for Refund Management.
 */
async function getRefundSummaryForAdmin(actor: AuthUser): Promise<AdminRefundSummary> {
  assertRole(actor, [Role.ADMIN]);

  try {
    const [
      totalRequests,
      pendingReview,
      approved,
      processing,
      succeeded,
      failed,
      rejected,
      succeededAgg,
    ] = await Promise.all([
      prisma.bookingRefund.count(),
      prisma.bookingRefund.count({ where: { status: RefundStatus.PENDING, approvedById: null } }),
      prisma.bookingRefund.count({ where: { status: RefundStatus.PENDING, approvedById: { not: null } } }),
      prisma.bookingRefund.count({ where: { status: RefundStatus.PROCESSING } }),
      prisma.bookingRefund.count({ where: { status: RefundStatus.SUCCEEDED } }),
      prisma.bookingRefund.count({ where: { status: RefundStatus.FAILED } }),
      prisma.bookingRefund.count({ where: { status: RefundStatus.REJECTED } }),
      prisma.bookingRefund.aggregate({
        where: { status: RefundStatus.SUCCEEDED, currency: "SAR" },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalRequests,
      pendingReview,
      approved,
      processing,
      succeeded,
      failed,
      rejected,
      totalRefundedAmount: succeededAgg._sum.amount ?? 0,
      currency: "SAR",
    };
  } catch (error) {
    if (!isMissingBookingRefundTable(error)) throw error;
    return {
      totalRequests: 0,
      pendingReview: 0,
      approved: 0,
      processing: 0,
      succeeded: 0,
      failed: 0,
      rejected: 0,
      totalRefundedAmount: 0,
      currency: "SAR",
    };
  }
}

/**
 * Returns detailed view of a refund request with booking, payment, and audit history.
 */
async function getRefundDetailsForAdmin(actor: AuthUser, refundId: string): Promise<any> {
  assertRole(actor, [Role.ADMIN]);

  const refund = await prisma.bookingRefund.findUnique({
    where: { id: refundId },
    include: {
      booking: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true, phone: true } },
          listing: {
            select: {
              id: true,
              title: true,
              city: true,
              country: true,
              photos: true,
              cancellationPolicy: true,
              host: { select: { id: true, name: true, email: true, image: true } },
            },
          },
          payments: true,
          refunds: true,
        },
      },
      payment: true,
    },
  });

  if (!refund) throw AppError.notFound(`Refund ${refundId} not found`);

  // Fetch audit events
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      resourceType: "BOOKING",
      resourceId: refund.bookingId,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const payment = refund.payment;
  const capturedAmount = payment?.capturedAmount ?? refund.booking.totalPrice ?? 0;
  const alreadyRefunded = payment?.refundedAmount ?? 0;
  const remainingRefundableBalance = Math.max(0, capturedAmount - alreadyRefunded);

  const meta = (refund.metadata as Record<string, any>) || {};

  return {
    refund: {
      ...refund,
      refundType: meta.refundType || (refund.amount >= capturedAmount ? "FULL" : "PARTIAL"),
      capturedAmountSnapshot: capturedAmount,
      remainingRefundableBalance,
    },
    booking: {
      ...refund.booking,
      listing: sanitizeListingSecrets(refund.booking.listing),
    },
    payment,
    auditLogs: auditLogs.map((l: any) => ({
      id: l.id,
      action: l.action,
      description: l.description,
      actorEmail: l.actorEmail,
      createdAt: l.createdAt.toISOString(),
      metadata: l.metadata,
    })),
  };
}

/**
 * Approves a pending refund request.
 */
async function approveRefund(
  actor: AuthUser,
  refundId: string,
  notes?: string,
): Promise<any> {
  assertRole(actor, [Role.ADMIN]);

  const refund = await prisma.bookingRefund.findUnique({
    where: { id: refundId },
    include: { payment: true, booking: true },
  });

  if (!refund) throw AppError.notFound("Refund not found");

  if (refund.status !== RefundStatus.PENDING) {
    throw AppError.badRequest(`Only pending refunds can be approved (current status: ${refund.status}).`);
  }

  // Segregation of duties: optional check if requester is same admin
  if (refund.requestedById === actor.id && process.env.ENFORCE_STRICT_DUAL_APPROVAL === "true") {
    throw AppError.forbidden("An administrator cannot approve their own refund request. A secondary admin review is required.");
  }

  const updated = await prisma.bookingRefund.update({
    where: { id: refundId },
    data: {
      approvedById: actor.id,
      adminNotes: notes?.trim() || refund.adminNotes,
      metadata: {
        ...((refund.metadata as Record<string, any>) || {}),
        approvedAt: new Date().toISOString(),
        approvedByEmail: actor.email,
      },
    },
  });

  // Audit Log
  try {
    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "REFUND_APPROVED",
      resourceType: "BOOKING",
      resourceId: refund.bookingId,
      description: `Refund ${refund.refundReference || refund.id} for ${(refund.amount / 100).toFixed(2)} ${refund.currency} was approved by administrator.`,
      status: "SUCCESS",
      metadata: {
        refundId: refund.id,
        refundReference: refund.refundReference,
        approvedAmount: refund.amount,
        notes: notes?.trim() || null,
      },
    });
  } catch (err) {
    console.warn("[refund.service] Failed to record audit log for refund approval:", err);
  }

  return updated;
}

/**
 * Rejects a refund request with a mandatory reason.
 */
async function rejectRefund(
  actor: AuthUser,
  refundId: string,
  reason: string,
): Promise<any> {
  assertRole(actor, [Role.ADMIN]);

  if (!reason || !reason.trim()) {
    throw AppError.badRequest("A rejection reason is required.");
  }

  const refund = await prisma.bookingRefund.findUnique({
    where: { id: refundId },
    include: { booking: true },
  });

  if (!refund) throw AppError.notFound("Refund not found");

  if (refund.status === RefundStatus.SUCCEEDED) {
    throw AppError.conflict("Cannot reject a refund that has already succeeded.");
  }

  const updated = await prisma.bookingRefund.update({
    where: { id: refundId },
    data: {
      status: RefundStatus.REJECTED,
      failureReason: reason.trim(),
      metadata: {
        ...((refund.metadata as Record<string, any>) || {}),
        rejectedAt: new Date().toISOString(),
        rejectedByEmail: actor.email,
        rejectionReason: reason.trim(),
      },
    },
  });

  // Audit Log
  try {
    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "REFUND_REJECTED",
      resourceType: "BOOKING",
      resourceId: refund.bookingId,
      description: `Refund ${refund.refundReference || refund.id} was rejected: "${reason.trim()}".`,
      status: "SUCCESS",
      metadata: {
        refundId: refund.id,
        refundReference: refund.refundReference,
        rejectionReason: reason.trim(),
      },
    });
  } catch (err) {
    console.warn("[refund.service] Failed to record audit log for refund rejection:", err);
  }

  return updated;
}

/**
 * Processes a refund through the gateway integration.
 * In MOCK/sandbox mode: safely simulates provider success and balance updates.
 * In DEFERRED mode (no active gateway): blocks execution and documents the requirement.
 */
async function processRefund(
  actor: AuthUser,
  refundId: string,
  idempotencyKey?: string,
): Promise<any> {
  assertRole(actor, [Role.ADMIN]);

  const policy = getPaymentPolicy();

  const refund = await prisma.bookingRefund.findUnique({
    where: { id: refundId },
    include: {
      payment: true,
      booking: {
        include: { listing: { select: { title: true } } },
      },
    },
  });

  if (!refund) throw AppError.notFound("Refund not found");

  if (refund.status === RefundStatus.SUCCEEDED) {
    return refund;
  }

  // There is no live provider adapter in this codebase. Refuse to write a
  // success state for deferred or live modes; MOCK is sandbox-only and remains
  // explicitly labelled in the resulting payment/refund records.
  if (policy.paymentMode !== "MOCK") {
    throw AppError.serviceUnavailable(
      "Refund execution is unavailable until a verified payment-provider adapter is configured. Local financial records were not changed.",
    );
  }

  const now = new Date();

  const processed = await prisma.$transaction(async (tx: any) => {
    const lockedRefund = await tx.bookingRefund.findUnique({
      where: { id: refund.id },
    });
    if (!lockedRefund) throw AppError.notFound("Refund not found");
    if (lockedRefund.status === RefundStatus.SUCCEEDED) {
      return { updatedRefund: lockedRefund, payment: null, booking: refund.booking, alreadyProcessed: true };
    }
    if (lockedRefund.status !== RefundStatus.PENDING || !lockedRefund.approvedById) {
      throw AppError.conflict("Only an approved pending refund can be processed.");
    }

    const payment = await tx.bookingPayment.findUnique({ where: { id: lockedRefund.paymentId || "" } });

    if (!payment) {
      throw AppError.notFound("Associated payment record not found.");
    }

    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${payment.id}))`;
    const lockedPayment = await tx.bookingPayment.findUnique({ where: { id: payment.id } });
    if (!lockedPayment) throw AppError.notFound("Associated payment record not found.");
    if (
      lockedPayment.provider !== PaymentProvider.MOCK ||
      (lockedPayment.status !== PaymentStatus.CAPTURED && lockedPayment.status !== PaymentStatus.PARTIALLY_REFUNDED)
    ) {
      throw AppError.badRequest("Refunds require a verified captured sandbox payment.");
    }

    const available = lockedPayment.capturedAmount - lockedPayment.refundedAmount;
    if (lockedRefund.amount > available) {
      throw AppError.badRequest(
        `Refund amount (${lockedRefund.amount} cents) exceeds remaining captured balance (${available} cents).`,
      );
    }

    const nextRefundedAmount = lockedPayment.refundedAmount + lockedRefund.amount;
    const nextPaymentStatus =
      nextRefundedAmount >= lockedPayment.capturedAmount
        ? PaymentStatus.REFUNDED
        : PaymentStatus.PARTIALLY_REFUNDED;

    const providerRefundId = `rfnd_${nanoid(14)}`;

    // Update payment balances
    await tx.bookingPayment.update({
      where: { id: lockedPayment.id },
      data: {
        refundedAmount: nextRefundedAmount,
        status: nextPaymentStatus,
      },
    });

    // Update refund transaction to SUCCEEDED
    const updatedRefund = await tx.bookingRefund.update({
      where: { id: lockedRefund.id },
      data: {
        status: RefundStatus.SUCCEEDED,
        providerRefundId,
        processedAt: now,
        succeededAt: now,
        metadata: {
          ...((lockedRefund.metadata as Record<string, any>) || {}),
          processedByEmail: actor.email,
          providerRefundId,
          processingIdempotencyKey: idempotencyKey ?? null,
          settlementStatus: "SETTLED",
        },
      },
    });

    return { updatedRefund, payment: lockedPayment, booking: refund.booking, alreadyProcessed: false };
  });

  if (processed.alreadyProcessed) return processed.updatedRefund;

  await invalidateBookingCache(processed.booking.id, processed.booking.userId, "");

  // Audit Log
  try {
    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "REFUND_PROCESSED",
      resourceType: "BOOKING",
      resourceId: processed.booking.id,
      description: `Refund ${processed.updatedRefund.refundReference} for ${(refund.amount / 100).toFixed(2)} ${refund.currency} was successfully processed.`,
      status: "SUCCESS",
      metadata: {
        refundId: processed.updatedRefund.id,
        refundReference: processed.updatedRefund.refundReference,
        providerRefundId: processed.updatedRefund.providerRefundId,
        amount: refund.amount,
        currency: refund.currency,
      },
    });
  } catch (err) {
    console.warn("[refund.service] Failed to record audit log for processed refund:", err);
  }

  // Send Notification to Guest
  try {
    await notificationService.create({
      userId: processed.booking.userId,
      type: NotificationType.BOOKING,
      title: `Refund Processed: ${processed.booking.listing.title}`,
      message: `A refund of ${(refund.amount / 100).toFixed(2)} ${refund.currency} has been processed for your reservation.`,
      entityId: processed.booking.id,
      entityType: "booking",
      link: "/profile/tab/past",
      metadata: {
        bookingId: processed.booking.id,
        refundId: processed.updatedRefund.id,
        amount: refund.amount,
        currency: refund.currency,
      },
    });
  } catch (err) {
    console.warn("[refund.service] Failed to create refund notification for guest:", err);
  }

  return processed.updatedRefund;
}

export const refundService = {
  getRefundQuote,
  createRefundRequest,
  listRefundsForAdmin,
  getRefundSummaryForAdmin,
  getRefundDetailsForAdmin,
  approveRefund,
  rejectRefund,
  processRefund,
};
