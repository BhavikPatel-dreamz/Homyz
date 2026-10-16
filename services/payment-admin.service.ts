import "server-only";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { Role, PaymentStatus, PaymentProvider, RefundStatus, BookingStatus } from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { assertRole } from "@/lib/permissions/authorize";
import { auditService } from "@/services/audit.service";
import { getPaymentPolicy } from "@/lib/booking/payment-policy";
import { extractStoredHostPayout, isStoredBookingPayoutEligible } from "@/lib/booking/booking-financials";
import { moyasarAdapter } from "@/lib/payment/moyasar-adapter";
import { payoutService } from "@/services/payout.service";

export interface PaymentListQuery {
  page?: number;
  limit?: number;
  tab?: string;
  search?: string;
  status?: string;
  provider?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: "createdAt" | "amount" | "capturedAmount";
  sortOrder?: "asc" | "desc";
}

export interface PaymentSummaryData {
  totalCapturedVolume: number; // in minor units / cents
  totalCapturedCount: number;
  authorizedVolume: number;
  authorizedCount: number;
  refundedVolume: number;
  netCapturedVolume: number;
  failedVolume: number;
  pendingCount: number;
  successfulCount: number;
  failedCount: number;
  partiallyRefundedCount: number;
  fullyRefundedCount: number;
  requiresAttentionCount: number;
  currency: string;
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
  sortBy?: "checkOut" | "netPayout" | "createdAt" | "endDate";
  sortOrder?: "asc" | "desc";
}

export interface PayoutSummaryData {
  totalPaidVolume: number;
  totalPaidCount: number;
  totalVerifiedPayoutVolume: number; // in cents
  totalVerifiedPayoutCount: number;
  pendingStayVolume: number;
  pendingStayCount: number;
  eligibleSettlementVolume: number;
  eligibleSettlementCount: number;
  onHoldVolume: number;
  onHoldCount: number;
  platformCommissionVolume: number;
  payoutsRequiringReviewCount: number;
  currency: string;
}

function sanitizeListing(listing: any) {
  if (!listing) return null;
  const { doorCode, wifiPassword, lockboxCode, ...safeListing } = listing;
  return safeListing;
}

function isMissingBookingPaymentTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as {
    code?: unknown;
    message?: unknown;
    meta?: { table?: unknown; cause?: unknown };
  };
  const detail = [candidate.message, candidate.meta?.table, candidate.meta?.cause]
    .filter(Boolean)
    .join(" ");
  return candidate.code === "P2021" || /BookingPayment/i.test(detail);
}

/**
 * Returns KPI aggregate summary for payment transactions.
 */
export async function getPaymentSummaryForAdmin(actor: AuthUser): Promise<PaymentSummaryData> {
  assertRole(actor, [Role.ADMIN]);

  try {
    const [
      capturedAgg,
      authorizedAgg,
      refundedAgg,
      failedAgg,
      pendingCount,
      successfulCount,
      failedCount,
      partiallyRefundedCount,
      fullyRefundedCount,
      attentionCount,
    ] = await Promise.all([
      // Total Captured Volume across CAPTURED, PARTIALLY_REFUNDED, REFUNDED
      prisma.bookingPayment.aggregate({
        where: {
          status: { in: [PaymentStatus.CAPTURED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED] },
          currency: "SAR",
        },
        _sum: { capturedAmount: true },
        _count: { id: true },
      }),
      // Authorized Payments
      prisma.bookingPayment.aggregate({
        where: { status: PaymentStatus.AUTHORIZED, currency: "SAR" },
        _sum: { amount: true },
        _count: { id: true },
      }),
      // Refunded volume across all refunded payments
      prisma.bookingPayment.aggregate({
        where: {
          currency: "SAR",
          refundedAmount: { gt: 0 },
        },
        _sum: { refundedAmount: true },
      }),
      // Failed payments volume
      prisma.bookingPayment.aggregate({
        where: {
          status: PaymentStatus.FAILED,
          currency: "SAR",
        },
        _sum: { amount: true },
      }),
      // Pending
      prisma.bookingPayment.count({ where: { status: PaymentStatus.PENDING } }),
      // Successful (Captured without refunds)
      prisma.bookingPayment.count({ where: { status: PaymentStatus.CAPTURED } }),
      // Failed
      prisma.bookingPayment.count({ where: { status: PaymentStatus.FAILED } }),
      // Partially Refunded
      prisma.bookingPayment.count({ where: { status: PaymentStatus.PARTIALLY_REFUNDED } }),
      // Fully Refunded
      prisma.bookingPayment.count({ where: { status: PaymentStatus.REFUNDED } }),
      // Transactions Requiring Attention (Failed, or Voided with issues)
      prisma.bookingPayment.count({
        where: {
          OR: [
            { status: PaymentStatus.FAILED },
            {
              status: PaymentStatus.PENDING,
              createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            },
          ],
        },
      }),
    ]);

    const totalCaptured = capturedAgg._sum.capturedAmount ?? 0;
    const refundedVolume = refundedAgg._sum.refundedAmount ?? 0;
    const netCapturedVolume = Math.max(0, totalCaptured - refundedVolume);
    const failedVolume = failedAgg._sum.amount ?? 0;

    return {
      totalCapturedVolume: totalCaptured,
      totalCapturedCount: capturedAgg._count.id ?? 0,
      authorizedVolume: authorizedAgg._sum.amount ?? 0,
      authorizedCount: authorizedAgg._count.id ?? 0,
      refundedVolume,
      netCapturedVolume,
      failedVolume,
      pendingCount,
      successfulCount,
      failedCount,
      partiallyRefundedCount,
      fullyRefundedCount,
      requiresAttentionCount: attentionCount,
      currency: "SAR",
    };
  } catch (error) {
    if (!isMissingBookingPaymentTable(error)) throw error;
    throw AppError.serviceUnavailable(
      "Payment records are unavailable because the BookingPayment database migration has not been applied. Apply the financial migration before relying on these totals.",
    );
  }
}

/**
 * Lists paginated payment transactions with multi-facet filters.
 */
export async function listPaymentsForAdmin(
  actor: AuthUser,
  query: PaymentListQuery,
): Promise<{
  payments: any[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  assertRole(actor, [Role.ADMIN]);

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const where: any = {};

  // Status Tab filtering
  if (query.tab && query.tab !== "all") {
    switch (query.tab) {
      case "pending":
        where.status = PaymentStatus.PENDING;
        break;
      case "authorized":
        where.status = PaymentStatus.AUTHORIZED;
        break;
      case "captured":
        where.status = PaymentStatus.CAPTURED;
        break;
      case "failed":
        where.status = PaymentStatus.FAILED;
        break;
      case "partially_refunded":
        where.status = PaymentStatus.PARTIALLY_REFUNDED;
        break;
      case "refunded":
        where.status = PaymentStatus.REFUNDED;
        break;
      case "attention":
        where.OR = [
          { status: PaymentStatus.FAILED },
          {
            status: PaymentStatus.PENDING,
            createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        ];
        break;
    }
  } else if (query.status && query.status !== "ALL") {
    where.status = query.status as PaymentStatus;
  }

  // Provider filter
  if (query.provider && query.provider !== "ALL") {
    where.provider = query.provider as PaymentProvider;
  }

  // Date range filter
  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) where.createdAt.gte = new Date(query.startDate);
    if (query.endDate) where.createdAt.lte = new Date(query.endDate);
  }

  // Search filter
  if (query.search?.trim()) {
    const term = query.search.trim();
    where.OR = [
      { id: { contains: term, mode: "insensitive" } },
      { providerPaymentId: { contains: term, mode: "insensitive" } },
      { bookingId: { contains: term, mode: "insensitive" } },
      { booking: { user: { name: { contains: term, mode: "insensitive" } } } },
      { booking: { user: { email: { contains: term, mode: "insensitive" } } } },
      { booking: { listing: { title: { contains: term, mode: "insensitive" } } } },
    ];
  }

  const orderBy: any = {};
  const sortField = ["createdAt", "amount", "capturedAmount"].includes(query.sortBy || "")
    ? query.sortBy!
    : "createdAt";
  const sortDir = query.sortOrder === "asc" ? "asc" : "desc";
  orderBy[sortField] = sortDir;

  const [payments, total] = await Promise.all([
    prisma.bookingPayment.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        booking: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            totalPrice: true,
            currency: true,
            user: { select: { id: true, name: true, email: true, image: true } },
            listing: {
              select: {
                id: true,
                title: true,
                city: true,
                photos: true,
                host: { select: { id: true, name: true, email: true, image: true } },
              },
            },
          },
        },
        refunds: {
          select: {
            id: true,
            refundReference: true,
            amount: true,
            status: true,
            createdAt: true,
          },
        },
      },
    }),
    prisma.bookingPayment.count({ where }),
  ]);

  const sanitized = payments.map((p: any) => ({
    ...p,
    booking: p.booking
      ? {
          ...p.booking,
          listing: sanitizeListing(p.booking.listing),
        }
      : null,
  }));

  return {
    payments: sanitized,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Returns single payment transaction details with booking, refund, and audit history.
 */
export async function getPaymentDetailsForAdmin(
  actor: AuthUser,
  paymentId: string,
): Promise<any> {
  assertRole(actor, [Role.ADMIN]);

  const payment = await prisma.bookingPayment.findUnique({
    where: { id: paymentId },
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
          refunds: true,
        },
      },
      refunds: true,
    },
  });

  if (!payment) {
    throw AppError.notFound(`Payment transaction ${paymentId} not found`);
  }

  // Audit events
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      resourceType: "BOOKING",
      resourceId: payment.bookingId,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const remainingRefundableBalance = Math.max(0, payment.capturedAmount - payment.refundedAmount);
  const hostPayout = extractStoredHostPayout(payment.booking);

  return {
    payment: {
      ...payment,
      remainingRefundableBalance,
    },
    booking: {
      ...payment.booking,
      listing: sanitizeListing(payment.booking.listing),
      storedHostPayout: hostPayout,
    },
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
 * Reconciles local payment record against verified provider state and booking totals.
 */
export async function reconcilePaymentForAdmin(
  actor: AuthUser,
  paymentId: string,
): Promise<any> {
  assertRole(actor, [Role.ADMIN]);

  const payment = await prisma.bookingPayment.findUnique({
    where: { id: paymentId },
    include: { booking: true, refunds: true },
  });

  if (!payment) throw AppError.notFound("Payment not found");

  const policy = getPaymentPolicy();
  const now = new Date();
  const issues: string[] = [];

  // 1. Verify refund totals against child refunds
  const succeededRefundsTotal = payment.refunds
    .filter((r: any) => r.status === RefundStatus.SUCCEEDED)
    .reduce((sum: number, r: any) => sum + r.amount, 0);

  if (succeededRefundsTotal !== payment.refundedAmount) {
    issues.push(
      `Refunded balance mismatch: record had ${payment.refundedAmount} cents, but sum of succeeded refunds is ${succeededRefundsTotal} cents.`,
    );
  }

  // 2. Check if status accurately reflects refunded balance
  let targetStatus = payment.status;
  if (payment.capturedAmount > 0) {
    if (succeededRefundsTotal >= payment.capturedAmount) {
      targetStatus = PaymentStatus.REFUNDED;
    } else if (succeededRefundsTotal > 0) {
      targetStatus = PaymentStatus.PARTIALLY_REFUNDED;
    } else {
      targetStatus = PaymentStatus.CAPTURED;
    }
  }

  if (targetStatus !== payment.status || succeededRefundsTotal !== payment.refundedAmount) {
    issues.push(
      "Local payment state differs from local refund records. Review local refund transactions.",
    );
  }

  // 3. Reconcile against remote payment gateway if provider reference is present
  if (payment.providerPaymentId && payment.provider === PaymentProvider.MOYASAR) {
    try {
      const verifyResult = await moyasarAdapter.verifyPayment(payment.providerPaymentId);
      if (verifyResult.verified) {
        if (verifyResult.amount !== payment.amount) {
          issues.push(
            `Gateway amount mismatch: local amount is ${payment.amount} ${payment.currency}, but Moyasar reported ${verifyResult.amount} ${verifyResult.currency}.`,
          );
        }
        if (verifyResult.status !== payment.status) {
          issues.push(
            `Gateway status mismatch: local status is ${payment.status}, but Moyasar reported ${verifyResult.status}.`,
          );
        }
        if (verifyResult.capturedAmount !== payment.capturedAmount) {
          issues.push(
            `Gateway captured balance mismatch: local captured is ${payment.capturedAmount}, but Moyasar reported ${verifyResult.capturedAmount}.`,
          );
        }
      }
    } catch (err: any) {
      issues.push(`Failed to reach payment gateway for verification: ${err.message || String(err)}`);
    }
  }

  // Record audit log
  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "PAYMENT_RECONCILED",
    resourceType: "BOOKING",
    resourceId: payment.bookingId,
    description: `Payment ${payment.id} reconciliation check completed without changing provider-dependent financial state.`,
    status: "SUCCESS",
    metadata: {
      paymentId: payment.id,
      issues,
      statusUpdated: false,
      policyMode: policy.paymentMode,
    },
  });

  return {
    payment,
    reconciledAt: now.toISOString(),
    statusUpdated: false,
    issuesFound: issues,
    isHealthy: issues.length === 0,
  };
}

/**
 * Returns KPI aggregate summary for Host Payout tracking.
 */
export async function getPayoutSummaryForAdmin(actor: AuthUser): Promise<PayoutSummaryData> {
  const summary = await payoutService.getPayoutSummaryForAdmin(actor);
  return {
    totalPaidVolume: summary.totalPaidVolume,
    totalPaidCount: summary.totalPaidCount,
    totalVerifiedPayoutVolume: summary.totalPaidVolume + summary.eligibleSettlementVolume,
    totalVerifiedPayoutCount: summary.totalPaidCount + summary.eligibleSettlementCount,
    pendingStayVolume: summary.scheduledPendingStayVolume,
    pendingStayCount: summary.scheduledPendingStayCount,
    eligibleSettlementVolume: summary.eligibleSettlementVolume,
    eligibleSettlementCount: summary.eligibleSettlementCount,
    onHoldVolume: summary.onHoldVolume,
    onHoldCount: summary.onHoldCount,
    platformCommissionVolume: summary.platformCommissionVolume,
    payoutsRequiringReviewCount: summary.payoutsRequiringReviewCount,
    currency: summary.currency,
  };
}

/**
 * Lists paginated Host Payout tracking records.
 */
export async function listHostPayoutsForAdmin(
  actor: AuthUser,
  query: PayoutListQuery,
): Promise<{
  payouts: any[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  return payoutService.listHostPayoutsForAdmin(actor, query);
}

/**
 * Returns detailed view of a Host Payout breakdown for a single reservation.
 */
export async function getHostPayoutDetailsForAdmin(
  actor: AuthUser,
  bookingId: string,
): Promise<any> {
  return payoutService.getHostPayoutDetailsForAdmin(actor, bookingId);
}

export const paymentAdminService = {
  getPaymentSummaryForAdmin,
  listPaymentsForAdmin,
  getPaymentDetailsForAdmin,
  reconcilePaymentForAdmin,
  getPayoutSummaryForAdmin,
  listHostPayoutsForAdmin,
  getHostPayoutDetailsForAdmin,
};
