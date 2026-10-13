import { prisma } from "@/lib/db/prisma";
import { BookingStatus, PaymentStatus, RefundStatus, Role } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
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
    return {
      start: new Date(query.startDate),
      end: new Date(query.endDate),
    };
  }

  const period = query.period || "30d";
  const end = new Date(now);
  let start = new Date(now);

  switch (period) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "7d":
      start.setDate(now.getDate() - 7);
      break;
    case "30d":
      start.setDate(now.getDate() - 30);
      break;
    case "this_month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "last_month":
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end.setDate(0); // last day of previous month
      break;
    case "90d":
      start.setDate(now.getDate() - 90);
      break;
    case "this_year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
    default:
      start.setDate(now.getDate() - 30);
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

export class AnalyticsAdminService {
  /**
   * Generates comprehensive booking, financial, cancellation, and dispute analytics.
   */
  async getBookingAnalyticsOverview(actor: AuthUser, query: AnalyticsFilterQuery) {
    assertRole(actor, [Role.ADMIN]);

    const { start, end } = getDateRange(query);
    const now = new Date();

    const bookingWhere: Prisma.BookingWhereInput = {
      createdAt: {
        gte: start,
        lte: end,
      },
    };

    if (query.listingId) bookingWhere.listingId = query.listingId;
    if (query.hostId) bookingWhere.listing = { hostId: query.hostId };
    if (query.city) {
      bookingWhere.listing = {
        ...((bookingWhere.listing as Prisma.ListingWhereInput) || {}),
        city: { contains: query.city, mode: "insensitive" },
      };
    }
    if (query.country) {
      bookingWhere.listing = {
        ...((bookingWhere.listing as Prisma.ListingWhereInput) || {}),
        country: { contains: query.country, mode: "insensitive" },
      };
    }
    if (query.currency) {
      bookingWhere.currency = query.currency;
    }

    // 1. Fetch relevant bookings for KPI & status distribution
    const bookings = await prisma.booking.findMany({
      where: bookingWhere,
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        totalPrice: true,
        currency: true,
        createdAt: true,
        cancellationReason: true,
        cancelledAt: true,
        priceBreakdown: true,
      },
      orderBy: { createdAt: "asc" },
    });

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

    // 2. Financials: Payments captured in period
    const payments = await prisma.bookingPayment.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...(query.currency ? { currency: query.currency } : {}),
      },
      select: {
        id: true,
        amount: true,
        refundedAmount: true,
        status: true,
        currency: true,
        provider: true,
        createdAt: true,
      },
    });

    const currencyTotals: Record<
      string,
      { grossCaptured: number; refunded: number; netCollected: number }
    > = {};

    let totalCapturedTransactions = 0;
    let failedPaymentAttempts = 0;
    let pendingPayments = 0;
    const providerBreakdown: Record<string, { count: number; volume: number }> = {};

    for (const p of payments) {
      const cur = p.currency || "SAR";
      if (!currencyTotals[cur]) {
        currencyTotals[cur] = { grossCaptured: 0, refunded: 0, netCollected: 0 };
      }

      const prov = p.provider || "OTHER";
      if (!providerBreakdown[prov]) {
        providerBreakdown[prov] = { count: 0, volume: 0 };
      }

      if (p.status === PaymentStatus.CAPTURED) {
        totalCapturedTransactions++;
        currencyTotals[cur].grossCaptured += p.amount;
        currencyTotals[cur].refunded += p.refundedAmount;
        currencyTotals[cur].netCollected += p.amount - p.refundedAmount;
        providerBreakdown[prov].count++;
        providerBreakdown[prov].volume += p.amount;
      } else if (p.status === PaymentStatus.FAILED) {
        failedPaymentAttempts++;
      } else if (p.status === PaymentStatus.PENDING) {
        pendingPayments++;
      }
    }

    // 3. Refunds in period
    const refunds = await prisma.bookingRefund.findMany({
      where: {
        createdAt: { gte: start, lte: end },
        ...(query.currency ? { currency: query.currency } : {}),
      },
      select: {
        id: true,
        amount: true,
        status: true,
        currency: true,
        reason: true,
        createdAt: true,
      },
    });

    const refundStats = {
      totalRequests: refunds.length,
      approvedCount: refunds.filter((r: any) => r.status === RefundStatus.SUCCEEDED).length,
      pendingCount: refunds.filter((r: any) => r.status === RefundStatus.PENDING).length,
      rejectedCount: refunds.filter((r: any) => r.status === RefundStatus.REJECTED).length,
      failedCount: refunds.filter((r: any) => r.status === RefundStatus.FAILED).length,
      totalRefundedCents: refunds
        .filter((r: any) => r.status === RefundStatus.SUCCEEDED)
        .reduce((sum: number, r: any) => sum + r.amount, 0),
    };

    // 4. Disputes in period
    const disputes = await prisma.listingQualityIncident.findMany({
      where: {
        createdAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        category: true,
        status: true,
        severity: true,
        createdAt: true,
      },
    });

    const disputeStats = {
      totalCases: disputes.length,
      openCases: disputes.filter((d: any) => d.status === "PENDING").length,
      reviewingCases: disputes.filter((d: any) => d.status === "CONFIRMED").length,
      resolvedCases: disputes.filter((d: any) => d.status === "RESOLVED").length,
      closedCases: disputes.filter((d: any) => d.status === "REJECTED").length,
      categoryCounts: disputes.reduce((acc: Record<string, number>, d: any) => {
        acc[d.category] = (acc[d.category] || 0) + 1;
        return acc;
      }, {}),
    };

    // 5. Booking Time Series Trends (Bucket by date)
    const trendsMap: Record<
      string,
      { date: string; newBookings: number; confirmed: number; completed: number; cancelled: number }
    > = {};

    for (const b of bookings) {
      const d = b.createdAt.toISOString().slice(0, 10);
      if (!trendsMap[d]) {
        trendsMap[d] = { date: d, newBookings: 0, confirmed: 0, completed: 0, cancelled: 0 };
      }
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
        const reason = b.cancellationReason || "Unspecified";
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
    query: { page?: number; limit?: number; search?: string; startDate?: string; endDate?: string },
  ) {
    assertRole(actor, [Role.ADMIN]);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ListingWhereInput = {};
    if (query.search?.trim()) {
      where.OR = [
        { title: { contains: query.search.trim(), mode: "insensitive" } },
        { city: { contains: query.search.trim(), mode: "insensitive" } },
        { host: { name: { contains: query.search.trim(), mode: "insensitive" } } },
      ];
    }

    const [listings, total] = await Promise.all([
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
          bookings: {
            select: {
              id: true,
              status: true,
              totalPrice: true,
              currency: true,
              startDate: true,
              endDate: true,
              refunds: { select: { amount: true, status: true } },
            },
          },
        },
      }),
      prisma.listing.count({ where }),
    ]);

    const now = new Date();
    const rows = listings.map((l: any) => {
      let totalB = 0;
      let confirmedB = 0;
      let completedB = 0;
      let cancelledB = 0;
      let grossCents = 0;
      let refundCents = 0;
      const currency = l.bookings[0]?.currency || "SAR";

      for (const b of l.bookings) {
        totalB++;
        if (b.status === BookingStatus.CANCELLED) {
          cancelledB++;
        } else if (b.status === BookingStatus.CONFIRMED) {
          if (new Date(b.endDate) < now) completedB++;
          else confirmedB++;
          grossCents += b.totalPrice || 0;
        }

        for (const r of b.refunds) {
          if (r.status === RefundStatus.SUCCEEDED) {
            refundCents += r.amount;
          }
        }
      }

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
        grossVolumeCents: grossCents,
        refundVolumeCents: refundCents,
        netVolumeCents: grossCents - refundCents,
        currency,
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
    query: { page?: number; limit?: number; search?: string },
  ) {
    assertRole(actor, [Role.ADMIN]);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: Role.HOST,
    };

    if (query.search?.trim()) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: "insensitive" } },
        { email: { contains: query.search.trim(), mode: "insensitive" } },
      ];
    }

    const [hosts, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
          createdAt: true,
          _count: { select: { listings: true } },
          listings: {
            select: {
              bookings: {
                select: {
                  id: true,
                  status: true,
                  totalPrice: true,
                  currency: true,
                  priceBreakdown: true,
                  endDate: true,
                  refunds: { select: { amount: true, status: true } },
                },
              },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const now = new Date();
    const rows = hosts.map((h: any) => {
      let totalB = 0;
      let completedB = 0;
      let cancelledB = 0;
      let grossCents = 0;
      let netPayoutCents = 0;
      let refundAdjustmentCents = 0;
      let currency = "SAR";

      for (const l of h.listings) {
        for (const b of l.bookings) {
          totalB++;
          currency = b.currency || currency;
          if (b.status === BookingStatus.CANCELLED) {
            cancelledB++;
          } else if (b.status === BookingStatus.CONFIRMED) {
            if (new Date(b.endDate) < now) completedB++;
            grossCents += b.totalPrice || 0;

            const storedPayout = extractStoredHostPayout(b);
            if (storedPayout) {
              netPayoutCents += storedPayout.netHostPayout;
            } else {
              // Standard 3% host platform fee fallback
              netPayoutCents += Math.round((b.totalPrice || 0) * 0.97);
            }
          }

          for (const r of b.refunds) {
            if (r.status === RefundStatus.SUCCEEDED) {
              refundAdjustmentCents += r.amount;
            }
          }
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
        grossBookingVolumeCents: grossCents,
        netHostPayoutsCents: netPayoutCents,
        refundAdjustmentsCents: refundAdjustmentCents,
        currency,
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
        const cancellations = await prisma.booking.findMany({
          where: {
            status: BookingStatus.CANCELLED,
            ...(start || end ? { cancelledAt: { gte: start, lte: end } } : {}),
          },
          take: limit,
          orderBy: { cancelledAt: "desc" },
          include: {
            user: { select: { name: true, email: true } },
            listing: { select: { title: true } },
          },
        });

        return {
          reportType,
          columns: ["Booking ID", "Guest Name", "Property", "Reason", "Cancelled At", "Total Price (Cents)", "Currency"],
          rows: cancellations.map((c: any) => [
            c.id,
            c.user.name || "N/A",
            c.listing.title,
            c.cancellationReason || "Not provided",
            c.cancelledAt ? c.cancelledAt.toISOString() : "N/A",
            c.totalPrice ?? 0,
            c.currency,
          ]),
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

