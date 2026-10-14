import { prisma } from "@/lib/db/prisma";
import { BookingStatus, ListingStatus, PaymentStatus, RefundStatus, Role } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { assertRole } from "@/lib/permissions/authorize";
import { extractStoredHostPayout } from "@/lib/booking/booking-financials";

export interface AnalyticsFilterQuery {
  period?: "today" | "7d" | "30d" | "this_month" | "last_month" | "90d" | "this_year" | "custom";
  startDate?: string;
  endDate?: string;
  listingId?: string;
  hostId?: string;
  city?: string;
  country?: string;
  currency?: string;
}

export type ReportType =
  | "BOOKING_REPORT"
  | "CANCELLATION_REPORT"
  | "PAYMENT_REPORT"
  | "REFUND_REPORT"
  | "PAYOUT_REPORT"
  | "DISPUTE_REPORT"
  | "PROPERTY_REPORT"
  | "HOST_REPORT";

function getDateRange(query: AnalyticsFilterQuery): { start: Date; end: Date } {
  const now = new Date();
  if (query.startDate && query.endDate) {
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/;
    return {
      // Admin booking screens use UTC consistently. Date-only filters are
      // inclusive calendar days rather than midnight-to-midnight ranges.
      start: isDateOnly.test(query.startDate)
        ? new Date(`${query.startDate}T00:00:00.000Z`)
        : new Date(query.startDate),
      end: isDateOnly.test(query.endDate)
        ? new Date(`${query.endDate}T23:59:59.999Z`)
        : new Date(query.endDate),
    };
  }

  const period = query.period || "30d";
  let end = new Date(now);
  let start = new Date(now);

  switch (period) {
    case "today":
      start.setUTCHours(0, 0, 0, 0);
      break;
    case "7d":
      start.setUTCDate(now.getUTCDate() - 7);
      break;
    case "30d":
      start.setUTCDate(now.getUTCDate() - 30);
      break;
    case "this_month":
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      break;
    case "last_month":
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
      break;
    case "90d":
      start.setUTCDate(now.getUTCDate() - 90);
      break;
    case "this_year":
      start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      break;
    default:
      start.setUTCDate(now.getUTCDate() - 30);
  }

  return { start, end };
}

/**
 * Escapes CSV values and protects against CSV formula injection.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let str = String(value);

  // CSV Formula Injection Prevention: prepend single quote if starting with formula triggers
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escape inner double quotes
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}

type CancellationSnapshot = {
  reason: string | null;
  cancelledAt: Date | null;
};

type MoneyByCurrency = Record<string, number>;

type BookingCohortRecord = {
  id: string;
  listingId: string;
  status: BookingStatus;
  totalPrice: number | null;
  currency: string;
  endDate: Date;
  createdAt: Date;
  priceBreakdown?: Prisma.JsonValue | null;
};
type PaymentAnalyticsRecord = { id: string; bookingId: string; capturedAmount: number; status: PaymentStatus; currency: string; provider: string };
type RefundAnalyticsRecord = { id: string; bookingId: string; amount: number; status: RefundStatus; currency: string };
type DisputeAnalyticsRecord = { id: string; category: string; status: string };

function addCurrencyAmount(target: MoneyByCurrency, currency: string, amount: number | null) {
  target[currency] = (target[currency] || 0) + (amount || 0);
}

function subtractCurrencyAmounts(gross: MoneyByCurrency, refunds: MoneyByCurrency): MoneyByCurrency {
  const currencies = new Set([...Object.keys(gross), ...Object.keys(refunds)]);
  return Object.fromEntries(
    [...currencies].map((currency) => [currency, (gross[currency] || 0) - (refunds[currency] || 0)]),
  );
}

/**
 * Cancellation details are an immutable booking snapshot stored in priceBreakdown.
 * They are not columns on the Booking model.
 */
function getCancellationSnapshot(priceBreakdown: Prisma.JsonValue | null): CancellationSnapshot {
  if (!priceBreakdown || typeof priceBreakdown !== "object" || Array.isArray(priceBreakdown)) {
    return { reason: null, cancelledAt: null };
  }

  const cancellation = (priceBreakdown as Record<string, unknown>).cancellation;
  if (!cancellation || typeof cancellation !== "object" || Array.isArray(cancellation)) {
    return { reason: null, cancelledAt: null };
  }

  const details = cancellation as Record<string, unknown>;
  const reason = typeof details.reason === "string" && details.reason.trim() ? details.reason : null;
  const rawCancelledAt = typeof details.cancelledAt === "string" ? details.cancelledAt : null;
  const parsedCancelledAt = rawCancelledAt ? new Date(rawCancelledAt) : null;

  return {
    reason,
    cancelledAt:
      parsedCancelledAt && !Number.isNaN(parsedCancelledAt.getTime()) ? parsedCancelledAt : null,
  };
}

export class AnalyticsAdminService {
  /**
   * Generates comprehensive booking, financial, cancellation, and dispute analytics.
   */
  async getBookingAnalyticsOverview(actor: AuthUser, query: AnalyticsFilterQuery) {
    assertRole(actor, [Role.ADMIN]);

    const { start, end } = getDateRange(query);
    const now = new Date();

    const listingScope: Prisma.ListingWhereInput = {};
    if (query.hostId) listingScope.hostId = query.hostId;
    if (query.city) listingScope.city = { contains: query.city, mode: "insensitive" };
    if (query.country) listingScope.country = { contains: query.country, mode: "insensitive" };
    const scopedBookingWhere: Prisma.BookingWhereInput = {
      ...(query.listingId ? { listingId: query.listingId } : {}),
      ...(Object.keys(listingScope).length ? { listing: listingScope } : {}),
    };
    const bookingWhere: Prisma.BookingWhereInput = {
      ...scopedBookingWhere,
      createdAt: { gte: start, lte: end },
    };

    if (query.currency) {
      bookingWhere.currency = query.currency;
    }

    // Booking KPIs are a created-at cohort. Financial KPIs intentionally use
    // transaction timestamps instead, so cash movement is never inferred from
    // a booking price.
    const [bookings, payments, refunds, disputes]: [
      BookingCohortRecord[],
      PaymentAnalyticsRecord[],
      RefundAnalyticsRecord[],
      DisputeAnalyticsRecord[],
    ] = await Promise.all([
      prisma.booking.findMany({
        where: bookingWhere,
        select: {
          id: true,
          listingId: true,
          status: true,
          endDate: true,
          createdAt: true,
          priceBreakdown: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.bookingPayment.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          ...(Object.keys(scopedBookingWhere).length ? { booking: scopedBookingWhere } : {}),
          ...(query.currency ? { currency: query.currency } : {}),
        },
        select: {
          id: true,
          bookingId: true,
          capturedAmount: true,
          status: true,
          currency: true,
          provider: true,
        },
      }),
      prisma.bookingRefund.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          ...(Object.keys(scopedBookingWhere).length ? { booking: scopedBookingWhere } : {}),
          ...(query.currency ? { currency: query.currency } : {}),
        },
        select: { id: true, bookingId: true, amount: true, status: true, currency: true },
      }),
      prisma.listingQualityIncident.findMany({
        where: {
          createdAt: { gte: start, lte: end },
          ...(Object.keys(listingScope).length ? { listing: listingScope } : {}),
          ...(query.listingId ? { listingId: query.listingId } : {}),
        },
        select: { id: true, category: true, status: true },
      }),
    ]);

    const totalBookings = bookings.length;
    let confirmedCount = 0;
    let completedCount = 0;
    let cancelledCount = 0;
    let pendingCount = 0;

    for (const b of bookings) {
      if (b.status === BookingStatus.CANCELLED) {
        cancelledCount++;
      } else if (b.status === BookingStatus.CONFIRMED) {
        if (new Date(b.endDate) < now) {
          completedCount++;
        } else {
          confirmedCount++;
        }
      } else if (b.status === BookingStatus.PENDING) {
        pendingCount++;
      }
    }

    const cancellationRate = totalBookings > 0 ? (cancelledCount / totalBookings) * 100 : 0;

    const currencyTotals: Record<
      string,
      { grossCaptured: number; refunded: number; netCollected: number }
    > = {};

    let totalCapturedTransactions = 0;
    let failedPaymentAttempts = 0;
    let pendingPayments = 0;
    const providerBreakdown: Record<string, { count: number; volumeByCurrency: Record<string, number> }> = {};
    const capturedStatuses: PaymentStatus[] = [
      PaymentStatus.CAPTURED,
      PaymentStatus.PARTIALLY_REFUNDED,
      PaymentStatus.REFUNDED,
    ];

    for (const p of payments) {
      const cur = p.currency || "SAR";
      if (!currencyTotals[cur]) {
        currencyTotals[cur] = { grossCaptured: 0, refunded: 0, netCollected: 0 };
      }

      const prov = p.provider || "OTHER";
      if (!providerBreakdown[prov]) {
        providerBreakdown[prov] = { count: 0, volumeByCurrency: {} };
      }

      if (capturedStatuses.includes(p.status)) {
        totalCapturedTransactions++;
        currencyTotals[cur].grossCaptured += p.capturedAmount;
        providerBreakdown[prov].count++;
        providerBreakdown[prov].volumeByCurrency[cur] =
          (providerBreakdown[prov].volumeByCurrency[cur] || 0) + p.capturedAmount;
      } else if (p.status === PaymentStatus.FAILED) {
        failedPaymentAttempts++;
      } else if (p.status === PaymentStatus.PENDING) {
        pendingPayments++;
      }
    }

    for (const refund of refunds) {
      if (refund.status !== RefundStatus.SUCCEEDED) continue;
      const currency = refund.currency || "SAR";
      if (!currencyTotals[currency]) {
        currencyTotals[currency] = { grossCaptured: 0, refunded: 0, netCollected: 0 };
      }
      currencyTotals[currency].refunded += refund.amount;
    }

    for (const totals of Object.values(currencyTotals)) {
      totals.netCollected = totals.grossCaptured - totals.refunded;
    }

    const refundStats = {
      totalRequests: refunds.length,
      approvedCount: refunds.filter((r) => r.status === RefundStatus.SUCCEEDED).length,
      pendingCount: refunds.filter((r) => r.status === RefundStatus.PENDING).length,
      rejectedCount: refunds.filter((r) => r.status === RefundStatus.REJECTED).length,
      failedCount: refunds.filter((r) => r.status === RefundStatus.FAILED).length,
      totalRefundedCents: refunds
        .filter((r) => r.status === RefundStatus.SUCCEEDED)
        .reduce((sum, r) => sum + r.amount, 0),
    };

    const disputeStats = {
      totalCases: disputes.length,
      activeCases: disputes.filter((d) => d.status === "PENDING" || d.status === "CONFIRMED").length,
      openCases: disputes.filter((d) => d.status === "PENDING").length,
      reviewingCases: disputes.filter((d) => d.status === "CONFIRMED").length,
      resolvedCases: disputes.filter((d) => d.status === "RESOLVED").length,
      closedCases: disputes.filter((d) => d.status === "REJECTED").length,
      categoryCounts: disputes.reduce((acc: Record<string, number>, d) => {
        acc[d.category] = (acc[d.category] || 0) + 1;
        return acc;
      }, {}),
    };

    // Daily UTC cohort trend. Booking status history is not persisted, so
    // confirmed/completed/cancelled values describe the current lifecycle of
    // bookings created on each day; they are not invented status-change events.
    const trendsMap: Record<
      string,
      { date: string; newBookings: number; confirmed: number; completed: number; cancelled: number }
    > = {};

    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    while (cursor <= lastDay) {
      const date = cursor.toISOString().slice(0, 10);
      trendsMap[date] = { date, newBookings: 0, confirmed: 0, completed: 0, cancelled: 0 };
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    for (const b of bookings) {
      const d = b.createdAt.toISOString().slice(0, 10);
      // A timestamp near a custom-range boundary may fall outside a date-only
      // range after conversion, so retain a safe bucket for it.
      trendsMap[d] ||= { date: d, newBookings: 0, confirmed: 0, completed: 0, cancelled: 0 };
      trendsMap[d].newBookings++;
      if (b.status === BookingStatus.CANCELLED) {
        trendsMap[d].cancelled++;
      } else if (b.status === BookingStatus.CONFIRMED) {
        if (new Date(b.endDate) < now) {
          trendsMap[d].completed++;
        } else {
          trendsMap[d].confirmed++;
        }
      }
    }

    const bookingTrends = Object.values(trendsMap).sort((a, b) => a.date.localeCompare(b.date));

    // 6. Cancellation Reasons Breakdown
    const cancellationReasons: Record<string, number> = {};
    for (const b of bookings) {
      if (b.status === BookingStatus.CANCELLED) {
        const reason = getCancellationSnapshot(b.priceBreakdown ?? null).reason || "Unspecified";
        cancellationReasons[reason] = (cancellationReasons[reason] || 0) + 1;
      }
    }

    return {
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString(),
        period: query.period || "30d",
      },
      kpi: {
        totalBookings,
        confirmedBookings: confirmedCount,
        completedBookings: completedCount,
        cancelledBookings: cancelledCount,
        pendingBookings: pendingCount,
        cancellationRate: Number(cancellationRate.toFixed(1)),
        currencies: currencyTotals,
      },
      statusDistribution: {
        PENDING: pendingCount,
        CONFIRMED: confirmedCount,
        COMPLETED: completedCount,
        CANCELLED: cancelledCount,
      },
      bookingTrends,
      cancellationAnalytics: {
        totalCancellations: cancelledCount,
        cancellationRate: Number(cancellationRate.toFixed(1)),
        reasons: cancellationReasons,
      },
      paymentPerformance: {
        totalAttempts: payments.length,
        successfulCaptures: totalCapturedTransactions,
        failedAttempts: failedPaymentAttempts,
        pendingPayments,
        providers: providerBreakdown,
      },
      refundAnalytics: refundStats,
      disputeAnalytics: disputeStats,
    };
  }

  /**
   * Generates property performance analytics table.
   */
  async getPropertyPerformanceAnalytics(
    actor: AuthUser,
    query: AnalyticsFilterQuery & {
      page?: number;
      limit?: number;
      search?: string;
      includeInactive?: boolean;
      includeZeroActivity?: boolean;
    },
  ) {
    assertRole(actor, [Role.ADMIN]);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    const { start, end } = getDateRange(query);
    const bookingWhere: Prisma.BookingWhereInput = {
      createdAt: { gte: start, lte: end },
      ...(query.currency ? { currency: query.currency } : {}),
    };

    const filters: Prisma.ListingWhereInput[] = [];
    if (!query.includeInactive) filters.push({ status: ListingStatus.ACTIVE });
    if (!query.includeZeroActivity) filters.push({ bookings: { some: bookingWhere } });
    if (query.hostId) filters.push({ hostId: query.hostId });
    if (query.city) filters.push({ city: { contains: query.city, mode: "insensitive" } });
    if (query.country) filters.push({ country: { contains: query.country, mode: "insensitive" } });
    if (query.search?.trim()) {
      filters.push({ OR: [
        { title: { contains: query.search.trim(), mode: "insensitive" } },
        { city: { contains: query.search.trim(), mode: "insensitive" } },
        { host: { name: { contains: query.search.trim(), mode: "insensitive" } } },
      ] });
    }
    const where: Prisma.ListingWhereInput = filters.length ? { AND: filters } : {};

    const [listings, total]: [
      Array<{ id: string; title: string; city: string | null; country: string | null; photos: string[]; host: { id: string; name: string | null; email: string | null } }>,
      number,
    ] = await Promise.all([
      prisma.listing.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          city: true,
          country: true,
          photos: true,
          host: { select: { id: true, name: true, email: true } },
        },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.listing.count({ where }),
    ]);

    const listingIds = listings.map((listing) => listing.id);
    const bookings: BookingCohortRecord[] = listingIds.length
      ? await prisma.booking.findMany({
          where: { ...bookingWhere, listingId: { in: listingIds } },
          select: {
            id: true,
            listingId: true,
            status: true,
            totalPrice: true,
            currency: true,
            endDate: true,
            createdAt: true,
          },
        })
      : [];
    const bookingIds = bookings.map((booking) => booking.id);
    const [payments, refunds]: [PaymentAnalyticsRecord[], RefundAnalyticsRecord[]] = bookingIds.length
      ? await Promise.all([
          prisma.bookingPayment.findMany({
            where: {
              bookingId: { in: bookingIds },
              status: { in: [PaymentStatus.CAPTURED, PaymentStatus.PARTIALLY_REFUNDED, PaymentStatus.REFUNDED] },
            },
            select: { bookingId: true, currency: true, capturedAmount: true },
          }),
          prisma.bookingRefund.findMany({
            where: { bookingId: { in: bookingIds }, status: RefundStatus.SUCCEEDED },
            select: { bookingId: true, currency: true, amount: true },
          }),
        ])
      : [[], []];

    const bookingListingIds = new Map(bookings.map((booking) => [booking.id, booking.listingId]));
    const paymentsByListing = new Map<string, MoneyByCurrency>();
    const refundsByListing = new Map<string, MoneyByCurrency>();
    for (const payment of payments) {
      const listingId = bookingListingIds.get(payment.bookingId);
      if (!listingId) continue;
      const amounts = paymentsByListing.get(listingId) || {};
      addCurrencyAmount(amounts, payment.currency, payment.capturedAmount);
      paymentsByListing.set(listingId, amounts);
    }
    for (const refund of refunds) {
      const listingId = bookingListingIds.get(refund.bookingId);
      if (!listingId) continue;
      const amounts = refundsByListing.get(listingId) || {};
      addCurrencyAmount(amounts, refund.currency, refund.amount);
      refundsByListing.set(listingId, amounts);
    }
    const bookingsByListing = new Map<string, typeof bookings>();
    for (const booking of bookings) {
      const current = bookingsByListing.get(booking.listingId) || [];
      current.push(booking);
      bookingsByListing.set(booking.listingId, current);
    }

    const now = new Date();
    const rows = listings.map((l) => {
      let totalB = 0;
      let confirmedB = 0;
      let completedB = 0;
      let cancelledB = 0;
      const grossBookingValueByCurrency: MoneyByCurrency = {};

      for (const b of bookingsByListing.get(l.id) || []) {
        totalB++;
        if (b.status === BookingStatus.CANCELLED) {
          cancelledB++;
        } else if (b.status === BookingStatus.CONFIRMED) {
          if (new Date(b.endDate) < now) completedB++;
          else confirmedB++;
        }
        addCurrencyAmount(grossBookingValueByCurrency, b.currency, b.totalPrice);
      }

      const grossCapturedByCurrency = paymentsByListing.get(l.id) || {};
      const successfulRefundsByCurrency = refundsByListing.get(l.id) || {};

      return {
        listingId: l.id,
        title: l.title,
        city: l.city,
        country: l.country,
        photo: l.photos[0] || null,
        host: l.host,
        totalBookings: totalB,
        confirmedBookings: confirmedB,
        completedStays: completedB,
        cancellations: cancelledB,
        grossBookingValueByCurrency,
        grossCapturedByCurrency,
        successfulRefundsByCurrency,
        netFinancialVolumeByCurrency: subtractCurrencyAmounts(grossCapturedByCurrency, successfulRefundsByCurrency),
      };
    });

    return {
      properties: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Generates host performance analytics table.
   */
  async getHostPerformanceAnalytics(
    actor: AuthUser,
    query: AnalyticsFilterQuery & { page?: number; limit?: number; search?: string },
  ) {
    assertRole(actor, [Role.ADMIN]);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;
    const { start, end } = getDateRange(query);
    const bookingWhere: Prisma.BookingWhereInput = {
      createdAt: { gte: start, lte: end },
      ...(query.currency ? { currency: query.currency } : {}),
    };

    const where: Prisma.UserWhereInput = {
      role: Role.HOST,
    };

    if (query.search?.trim()) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: "insensitive" } },
        { email: { contains: query.search.trim(), mode: "insensitive" } },
      ];
    }

    const [hosts, total]: [
      Array<{ id: string; name: string | null; email: string | null; image: string | null; _count: { listings: number } }>,
      number,
    ] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          _count: { select: { listings: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    const hostIds = hosts.map((host) => host.id);
    const listings: Array<{ id: string; hostId: string }> = hostIds.length
      ? await prisma.listing.findMany({
          where: { hostId: { in: hostIds } },
          select: { id: true, hostId: true },
        })
      : [];
    const listingIds = listings.map((listing) => listing.id);
    const bookings: BookingCohortRecord[] = listingIds.length
      ? await prisma.booking.findMany({
          where: { ...bookingWhere, listingId: { in: listingIds } },
          select: {
            id: true,
            listingId: true,
            status: true,
            totalPrice: true,
            currency: true,
            priceBreakdown: true,
            endDate: true,
            createdAt: true,
          },
        })
      : [];
    const listingHostIds = new Map(listings.map((listing) => [listing.id, listing.hostId]));
    const bookingsByHost = new Map<string, typeof bookings>();
    for (const booking of bookings) {
      const hostId = listingHostIds.get(booking.listingId);
      if (!hostId) continue;
      const current = bookingsByHost.get(hostId) || [];
      current.push(booking);
      bookingsByHost.set(hostId, current);
    }

    const now = new Date();
    const rows = hosts.map((h) => {
      let totalB = 0;
      let completedB = 0;
      let cancelledB = 0;
      const grossBookingValueByCurrency: MoneyByCurrency = {};
      const recordedNetHostPayoutByCurrency: MoneyByCurrency = {};

      for (const b of bookingsByHost.get(h.id) || []) {
        totalB++;
        if (b.status === BookingStatus.CANCELLED) {
          cancelledB++;
        } else if (b.status === BookingStatus.CONFIRMED && new Date(b.endDate) < now) {
          completedB++;
        }
        addCurrencyAmount(grossBookingValueByCurrency, b.currency, b.totalPrice);

        // There is no settlement/payout ledger in the schema. Report only the
        // immutable recorded payout snapshot; never estimate host earnings.
        const storedPayout = extractStoredHostPayout(b);
        if (storedPayout) {
          addCurrencyAmount(
            recordedNetHostPayoutByCurrency,
            storedPayout.currency || b.currency,
            storedPayout.netHostPayout,
          );
        }
      }

      return {
        hostId: h.id,
        name: h.name,
        email: h.email,
        image: h.image,
        listingCount: h._count.listings,
        totalBookings: totalB,
        completedStays: completedB,
        cancellations: cancelledB,
        grossBookingValueByCurrency,
        recordedNetHostPayoutByCurrency,
      };
    });

    return {
      hosts: rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Generates tabular report data for one of the 8 supported categories.
   */
  async generateReportData(
    actor: AuthUser,
    reportType: ReportType,
    query: { startDate?: string; endDate?: string; status?: string; currency?: string; limit?: number },
  ) {
    assertRole(actor, [Role.ADMIN]);

    const limit = Math.min(500, Math.max(1, Number(query.limit) || 100));
    const start = query.startDate ? new Date(query.startDate) : undefined;
    const end = query.endDate ? new Date(query.endDate) : undefined;

    switch (reportType) {
      case "BOOKING_REPORT": {
        const bookings = await prisma.booking.findMany({
          where: {
            ...(start || end ? { createdAt: { gte: start, lte: end } } : {}),
            ...(query.status ? { status: query.status as BookingStatus } : {}),
            ...(query.currency ? { currency: query.currency } : {}),
          },
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { name: true, email: true } },
            listing: { select: { title: true, city: true, host: { select: { name: true, email: true } } } },
          },
        });

        return {
          reportType,
          columns: ["Booking ID", "Guest Name", "Guest Email", "Property", "City", "Host Name", "Status", "Start Date", "End Date", "Total (Cents)", "Currency", "Created At"],
          rows: bookings.map((b: any) => [
            b.id,
            b.user.name || "N/A",
            b.user.email || "N/A",
            b.listing.title,
            b.listing.city || "N/A",
            b.listing.host.name || "N/A",
            b.status,
            b.startDate.toISOString().slice(0, 10),
            b.endDate.toISOString().slice(0, 10),
            b.totalPrice ?? 0,
            b.currency,
            b.createdAt.toISOString(),
          ]),
        };
      }

      case "CANCELLATION_REPORT": {
        const cancelledAtRange: Prisma.DateTimeFilter = {};
        const cancellationTimestampFilter: Record<string, unknown> = {
          path: ["cancellation", "cancelledAt"],
        };
        if (start) {
          cancelledAtRange.gte = start;
          cancellationTimestampFilter.gte = start.toISOString();
        }
        if (end) {
          cancelledAtRange.lte = end;
          cancellationTimestampFilter.lte = end.toISOString();
        }

        // Older cancellations do not always have a snapshot timestamp, so retain
        // updatedAt as a conservative fallback for those records.
        const cancellationDateFilter: Prisma.BookingWhereInput =
          start || end
            ? {
                OR: [
                  { priceBreakdown: cancellationTimestampFilter as Prisma.JsonNullableFilter<"Booking"> },
                  {
                    AND: [
                      {
                        priceBreakdown: {
                          path: ["cancellation", "cancelledAt"],
                          equals: Prisma.AnyNull,
                        },
                      },
                      { updatedAt: cancelledAtRange },
                    ],
                  },
                ],
              }
            : {};

        const cancellations = await prisma.booking.findMany({
          where: {
            status: BookingStatus.CANCELLED,
            ...cancellationDateFilter,
          },
          take: limit,
          orderBy: { updatedAt: "desc" },
          include: {
            user: { select: { name: true, email: true } },
            listing: { select: { title: true } },
          },
        });

        return {
          reportType,
          columns: ["Booking ID", "Guest Name", "Property", "Reason", "Cancelled At", "Total Price (Cents)", "Currency"],
          rows: cancellations.map((c: any) => {
            const cancellation = getCancellationSnapshot(c.priceBreakdown);
            return [
              c.id,
              c.user.name || "N/A",
              c.listing.title,
              cancellation.reason || "Not provided",
              (cancellation.cancelledAt || c.updatedAt).toISOString(),
              c.totalPrice ?? 0,
              c.currency,
            ];
          }),
        };
      }

      case "PAYMENT_REPORT": {
        const payments = await prisma.bookingPayment.findMany({
          where: {
            ...(start || end ? { createdAt: { gte: start, lte: end } } : {}),
            ...(query.status ? { status: query.status as PaymentStatus } : {}),
          },
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            booking: { select: { id: true, user: { select: { name: true } } } },
          },
        });

        return {
          reportType,
          columns: ["Payment ID", "Booking ID", "Guest", "Provider", "Amount (Cents)", "Refunded (Cents)", "Status", "Created At"],
          rows: payments.map((p: any) => [
            p.id,
            p.bookingId,
            p.booking.user.name || "N/A",
            p.provider,
            p.amount,
            p.refundedAmount,
            p.status,
            p.createdAt.toISOString(),
          ]),
        };
      }

      case "REFUND_REPORT": {
        const refunds = await prisma.bookingRefund.findMany({
          where: {
            ...(start || end ? { createdAt: { gte: start, lte: end } } : {}),
            ...(query.status ? { status: query.status as RefundStatus } : {}),
          },
          take: limit,
          orderBy: { createdAt: "desc" },
          include: {
            booking: { select: { id: true, listing: { select: { title: true } } } },
          },
        });

        return {
          reportType,
          columns: ["Refund ID", "Booking ID", "Property", "Amount (Cents)", "Currency", "Status", "Reason", "Created At"],
          rows: refunds.map((r: any) => [
            r.id,
            r.bookingId,
            r.booking.listing.title,
            r.amount,
            r.currency,
            r.status,
            r.reason || "N/A",
            r.createdAt.toISOString(),
          ]),
        };
      }

      case "PAYOUT_REPORT": {
        const bookings: Array<{
          id: string;
          currency: string;
          priceBreakdown: Prisma.JsonValue | null;
          createdAt: Date;
          listing: { title: string; host: { name: string | null; email: string | null } };
        }> = await prisma.booking.findMany({
          where: {
            ...(start || end ? { createdAt: { gte: start, lte: end } } : {}),
            ...(query.currency ? { currency: query.currency } : {}),
          },
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            currency: true,
            priceBreakdown: true,
            createdAt: true,
            listing: { select: { title: true, host: { select: { name: true, email: true } } } },
          },
        });
        const rows = bookings.flatMap((booking) => {
          const payout = extractStoredHostPayout(booking);
          if (!payout) return [];
          return [[
            booking.id,
            booking.listing.title,
            booking.listing.host.name || "N/A",
            booking.listing.host.email || "N/A",
            payout.netHostPayout,
            payout.hostServiceFee,
            payout.currency || booking.currency,
            booking.createdAt.toISOString(),
            "Recorded booking snapshot — settlement status unavailable",
          ]];
        });
        return {
          reportType,
          columns: ["Booking ID", "Property", "Host", "Host Email", "Recorded Net Payout (Cents)", "Recorded Host Fee (Cents)", "Currency", "Booking Created At", "Status"],
          rows,
        };
      }

      case "DISPUTE_REPORT": {
        const disputes: Array<{
          id: string;
          category: string;
          status: string;
          severity: string | null;
          createdAt: Date;
          resolvedAt: Date | null;
          listing: { title: string };
          reportedBy: { name: string | null; email: string | null } | null;
        }> = await prisma.listingQualityIncident.findMany({
          where: { createdAt: { gte: start, lte: end } },
          take: limit,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            category: true,
            status: true,
            severity: true,
            createdAt: true,
            resolvedAt: true,
            listing: { select: { title: true } },
            reportedBy: { select: { name: true, email: true } },
          },
        });
        return {
          reportType,
          columns: ["Case ID", "Property", "Category", "Severity", "Status", "Reported By", "Reporter Email", "Opened At", "Resolved At"],
          rows: disputes.map((dispute) => [
            dispute.id,
            dispute.listing.title,
            dispute.category,
            dispute.severity || "N/A",
            dispute.status,
            dispute.reportedBy?.name || "N/A",
            dispute.reportedBy?.email || "N/A",
            dispute.createdAt.toISOString(),
            dispute.resolvedAt?.toISOString() || "N/A",
          ]),
        };
      }

      case "PROPERTY_REPORT": {
        const data = await this.getPropertyPerformanceAnalytics(actor, {
          period: "custom",
          startDate: query.startDate,
          endDate: query.endDate,
          currency: query.currency,
          includeInactive: true,
          includeZeroActivity: true,
          limit,
        });
        return {
          reportType,
          columns: ["Property", "Host", "City", "Bookings", "Completed Stays", "Cancellations", "Booked Value", "Gross Captured", "Successful Refunds", "Net Financial Volume"],
          rows: data.properties.map((property) => [
            property.title,
            property.host.name || "N/A",
            property.city || "N/A",
            property.totalBookings,
            property.completedStays,
            property.cancellations,
            JSON.stringify(property.grossBookingValueByCurrency),
            JSON.stringify(property.grossCapturedByCurrency),
            JSON.stringify(property.successfulRefundsByCurrency),
            JSON.stringify(property.netFinancialVolumeByCurrency),
          ]),
        };
      }

      case "HOST_REPORT": {
        const data = await this.getHostPerformanceAnalytics(actor, {
          period: "custom",
          startDate: query.startDate,
          endDate: query.endDate,
          currency: query.currency,
          limit,
        });
        return {
          reportType,
          columns: ["Host", "Email", "Listings", "Bookings", "Completed Stays", "Cancellations", "Booked Value", "Recorded Payout Snapshot"],
          rows: data.hosts.map((host) => [
            host.name || "N/A",
            host.email || "N/A",
            host.listingCount,
            host.totalBookings,
            host.completedStays,
            host.cancellations,
            JSON.stringify(host.grossBookingValueByCurrency),
            JSON.stringify(host.recordedNetHostPayoutByCurrency),
          ]),
        };
      }

      default:
        throw AppError.badRequest(`Unsupported report type: ${reportType}`);
    }
  }

  /**
   * Generates a sanitized CSV string and records an audit log entry.
   */
  async exportReportToCsv(
    actor: AuthUser,
    reportType: ReportType,
    query: { startDate?: string; endDate?: string; status?: string; currency?: string; limit?: number },
  ): Promise<string> {
    assertRole(actor, [Role.ADMIN]);

    const report = await this.generateReportData(actor, reportType, {
      ...query,
      limit: 1000, // Safe bounding limit
    });

    const headerLine = report.columns.map(sanitizeCsvCell).join(",");
    const rowLines = report.rows.map((row: any[]) => row.map(sanitizeCsvCell).join(","));
    const csvContent = [headerLine, ...rowLines].join("\n");

    // Record audit event for data export
    await prisma.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email || "admin@homyz.test",
        actorRole: actor.role,
        action: "REPORT_EXPORTED",
        entityType: "Report",
        entityId: reportType,
        details: {
          reportType,
          rowCount: report.rows.length,
          query,
        },
      },
    }).catch((err: any) => {
      console.error("[AnalyticsAdminService] Audit log error:", err);
    });

    return csvContent;
  }
}

export const analyticsAdminService = new AnalyticsAdminService();
