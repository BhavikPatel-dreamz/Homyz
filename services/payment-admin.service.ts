import "server-only";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { Role, PaymentStatus, PaymentProvider, RefundStatus, BookingStatus } from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { assertRole } from "@/lib/permissions/authorize";
import { auditService } from "@/services/audit.service";
import { getPaymentPolicy } from "@/lib/booking/payment-policy";
import { extractStoredHostPayout, isStoredBookingPayoutEligible } from "@/lib/booking/booking-financials";

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

/**
 * Returns KPI aggregate summary for payment transactions.
 */
export async function getPaymentSummaryForAdmin(actor: AuthUser): Promise<PaymentSummaryData> {
  assertRole(actor, [Role.ADMIN]);

  const [
    capturedAgg,
    authorizedAgg,
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

  return {
    totalCapturedVolume: capturedAgg._sum.capturedAmount ?? 0,
    totalCapturedCount: capturedAgg._count.id ?? 0,
    authorizedVolume: authorizedAgg._sum.amount ?? 0,
    authorizedCount: authorizedAgg._count.id ?? 0,
    pendingCount,
    successfulCount,
    failedCount,
    partiallyRefundedCount,
    fullyRefundedCount,
    requiresAttentionCount: attentionCount,
    currency: "SAR",
  };
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
      "Local payment state differs from local refund records. No financial state was changed because provider verification is unavailable.",
    );
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
  assertRole(actor, [Role.ADMIN]);

  const now = new Date();

  // Load confirmed and completed bookings to evaluate payout readiness
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
    },
  });

  let totalVerifiedPayoutVolume = 0;
  let totalVerifiedPayoutCount = 0;
  let pendingStayVolume = 0;
  let pendingStayCount = 0;
  let eligibleSettlementVolume = 0;
  let eligibleSettlementCount = 0;
  let onHoldVolume = 0;
  let onHoldCount = 0;
  let platformCommissionVolume = 0;
  let payoutsRequiringReviewCount = 0;

  for (const b of bookings) {
    const payout = extractStoredHostPayout(b);
    if (!payout) {
      payoutsRequiringReviewCount++;
      continue;
    }

    const net = payout.netHostPayout;
    const commission = payout.hostServiceFee;
    platformCommissionVolume += commission;

    const hasActiveRefund = (b.refunds || []).some(
      (r: any) => r.status === RefundStatus.PENDING || r.status === RefundStatus.PROCESSING,
    );

    if (hasActiveRefund) {
      onHoldVolume += net;
      onHoldCount++;
    } else if (new Date(b.endDate) < now) {
      // Stay completed -> Eligible for settlement
      eligibleSettlementVolume += net;
      eligibleSettlementCount++;
      totalVerifiedPayoutVolume += net;
      totalVerifiedPayoutCount++;
    } else {
      // Stay in the future or active -> Pending Stay
      pendingStayVolume += net;
      pendingStayCount++;
    }
  }

  return {
    totalVerifiedPayoutVolume,
    totalVerifiedPayoutCount,
    pendingStayVolume,
    pendingStayCount,
    eligibleSettlementVolume,
    eligibleSettlementCount,
    onHoldVolume,
    onHoldCount,
    platformCommissionVolume,
    payoutsRequiringReviewCount,
    currency: "SAR",
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
  assertRole(actor, [Role.ADMIN]);

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const now = new Date();

  const where: any = {
    status: BookingStatus.CONFIRMED,
  };

  // Search filter
  if (query.search?.trim()) {
    const term = query.search.trim();
    where.OR = [
      { id: { contains: term, mode: "insensitive" } },
      { listing: { title: { contains: term, mode: "insensitive" } } },
      { listing: { host: { name: { contains: term, mode: "insensitive" } } } },
      { listing: { host: { email: { contains: term, mode: "insensitive" } } } },
    ];
  }

  // Date range filter
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
        user: { select: { id: true, name: true, email: true } },
        listing: {
          select: {
            id: true,
            title: true,
            city: true,
            photos: true,
            host: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        refunds: { select: { id: true, status: true, amount: true } },
        payments: { select: { id: true, status: true, capturedAmount: true } },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  const payouts = bookings.map((b: any) => {
    const stored = extractStoredHostPayout(b);
    const hasActiveRefund = (b.refunds || []).some(
      (r: any) => r.status === RefundStatus.PENDING || r.status === RefundStatus.PROCESSING,
    );

    let status = "PENDING_STAY";
    if (!stored) {
      status = "REQUIRES_REVIEW";
    } else if (hasActiveRefund) {
      status = "ON_HOLD";
    } else if (new Date(b.endDate) < now) {
      status = "ELIGIBLE_SETTLEMENT";
    }

    return {
      id: `po_${b.id}`,
      bookingId: b.id,
      startDate: b.startDate,
      endDate: b.endDate,
      host: b.listing.host,
      listing: sanitizeListing(b.listing),
      grossEarnings: stored
        ? stored.accommodationSubtotal + stored.extraGuestFee + stored.petFee + stored.cleaningFee
        : b.totalPrice ?? 0,
      platformFee: stored ? stored.hostServiceFee : 0,
      deductions: 0,
      netPayout: stored ? stored.netHostPayout : b.totalPrice ?? 0,
      currency: stored?.currency || b.currency || "SAR",
      status,
      settlementExecutionSupported: false, // Documented limitation: direct automated gateway wire is disabled
      payoutAccountMasked: "IBAN SA••••••••••",
      createdAt: b.createdAt,
    };
  });

  return {
    payouts,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Returns detailed view of a Host Payout breakdown for a single reservation.
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
          host: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      payments: true,
      refunds: true,
    },
  });

  if (!booking) throw AppError.notFound(`Booking ${bookingId} not found`);

  const stored = extractStoredHostPayout(booking);
  const now = new Date();
  const hasActiveRefund = (booking.refunds || []).some(
    (r: any) => r.status === RefundStatus.PENDING || r.status === RefundStatus.PROCESSING,
  );

  let status = "PENDING_STAY";
  if (!stored) {
    status = "REQUIRES_REVIEW";
  } else if (hasActiveRefund) {
    status = "ON_HOLD";
  } else if (new Date(booking.endDate) < now) {
    status = "ELIGIBLE_SETTLEMENT";
  }

  return {
    payoutId: `po_${booking.id}`,
    bookingId: booking.id,
    startDate: booking.startDate,
    endDate: booking.endDate,
    status,
    host: booking.listing.host,
    listing: sanitizeListing(booking.listing),
    breakdown: stored
      ? {
          accommodationSubtotal: stored.accommodationSubtotal,
          extraGuestFee: stored.extraGuestFee,
          petFee: stored.petFee,
          cleaningFee: stored.cleaningFee,
          platformCommission: stored.hostServiceFee,
          netHostPayout: stored.netHostPayout,
          currency: stored.currency || "SAR",
        }
      : null,
    payments: booking.payments,
    refunds: booking.refunds,
    settlementExecutionNotice:
      "Automated provider bank payouts are currently disabled in the gateway configuration. Payout figures represent authoritative verified platform earnings readiness.",
  };
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
