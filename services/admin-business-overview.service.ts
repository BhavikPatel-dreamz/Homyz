import { prisma } from "@/lib/db/prisma";
import {
  BookingStatus,
  DistributionStatus,
  ListingStatus,
  PaymentStatus,
  RefundStatus,
  Role,
  SupportCaseStatus,
} from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { extractStoredHostPayout } from "@/lib/booking/booking-financials";

export interface OverviewDateFilter {
  period?: "7d" | "30d" | "this_month" | "90d";
  from?: string;
  to?: string;
}

export interface AdminBusinessOverviewData {
  timeframe: {
    label: string;
    period: string;
    startDate: string;
    endDate: string;
    comparisonLabel: string;
  };
  kpi: {
    grossBookingValueCents: number;
    grossBookingValueDelta: number | null;
    confirmedBookingsCount: number;
    confirmedBookingsDelta: number | null;
    platformRevenueCents: number;
    platformRevenueDelta: number | null;
    activeListingsCount: number;
    activeListingsDelta: number | null;
    registeredGuestsCount: number;
    registeredGuestsDelta: number | null;
    activeHostsCount: number;
    activeHostsDelta: number | null;
  };
  chartPoints: Array<{
    date: string;
    label: string;
    revenueCents: number;
    bookingsCount: number;
  }>;
  operationalAttention: Array<{
    id: string;
    title: string;
    count: number;
    description: string;
    href: string;
    severity: "critical" | "urgent" | "attention" | "all-clear";
    category: string;
  }>;
  bookingStatusDistribution: Array<{
    status: string;
    label: string;
    count: number;
    percentage: number;
    color: string;
  }>;
  revenueSourceBreakdown: Array<{
    source: string;
    amountCents: number;
    percentage: number;
    color: string;
  }>;
  pendingFinancialActions: {
    pendingPayoutsCents: number;
    pendingPayoutsCount: number;
    pendingRefundsCents: number;
    pendingRefundsCount: number;
    failedPaymentsCount: number;
  };
  financialSummary: {
    grossBookingsCents: number;
    platformFeesCents: number;
    hostPayoutObligationsCents: number;
    pendingPayoutsCents: number;
    successfulPayoutsCents: number;
    refundVolumeCents: number;
  };
  recentBookings: Array<{
    id: string;
    guestName: string;
    guestEmail: string;
    guestImage?: string | null;
    listingTitle: string;
    listingPhoto?: string | null;
    city?: string | null;
    country?: string | null;
    startDate: string;
    endDate: string;
    nights: number;
    amountCents: number;
    currency: string;
    status: string;
    createdAt: string;
  }>;
  topListings: Array<{
    id: string;
    title: string;
    photo?: string | null;
    city?: string | null;
    country?: string | null;
    bookingsCount: number;
    revenueCents: number;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    description: string;
    actorEmail: string;
    timestamp: string;
    status: string;
  }>;
}

function resolvePeriodDates(filter: OverviewDateFilter = {}): {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  label: string;
  comparisonLabel: string;
  period: string;
} {
  const now = new Date();
  const period = filter.period || "30d";
  let start: Date;
  let end: Date = new Date(now);

  switch (period) {
    case "7d":
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "this_month":
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      break;
    case "90d":
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  if (filter.from && filter.to) {
    start = new Date(filter.from);
    end = new Date(filter.to);
  }

  const durationMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - durationMs);

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const label =
    period === "7d"
      ? "Last 7 days"
      : period === "this_month"
      ? `Month to date (${months[now.getUTCMonth()]} ${now.getUTCFullYear()})`
      : period === "90d"
      ? "Last 90 days"
      : "Last 30 days";

  const comparisonLabel =
    period === "this_month" ? "vs last month" : "vs previous period";

  return { start, end, prevStart, prevEnd, label, comparisonLabel, period };
}

function calcDeltaPct(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

export const adminBusinessOverviewService = {
  async getOverview(filter: OverviewDateFilter = {}): Promise<AdminBusinessOverviewData> {
    const { start, end, prevStart, prevEnd, label, comparisonLabel, period } = resolvePeriodDates(filter);
    const now = new Date();

    // Parallel fetch across core marketplace tables
    let currentBookings: any[] = [];
    let prevBookings: any[] = [];
    let activeListingsCount = 0;
    let prevActiveListingsCount = 0;
    let totalGuestsCount = 0;
    let prevGuestsCount = 0;
    let activeHostsCount = 0;
    let prevHostsCount = 0;
    let pendingListingsCount = 0;
    let pendingHostRequestsCount = 0;
    let pendingRefundsCount = 0;
    let openDisputesCount = 0;
    let openSupportCasesCount = 0;
    let failedPaymentsCount = 0;
    let urgentModerationCount = 0;
    let payoutDistributions: any[] = [];
    let recentBookingsRaw: any[] = [];
    let recentLogsRaw: any[] = [];

    try {
      [
        currentBookings,
        prevBookings,
        activeListingsCount,
        prevActiveListingsCount,
        totalGuestsCount,
        prevGuestsCount,
        activeHostsCount,
        prevHostsCount,
        pendingListingsCount,
        pendingHostRequestsCount,
        pendingRefundsCount,
        openDisputesCount,
        openSupportCasesCount,
        failedPaymentsCount,
        urgentModerationCount,
        payoutDistributions,
        recentBookingsRaw,
        recentLogsRaw,
      ] = await Promise.all([
      // 1. Current period bookings
      prisma.booking.findMany({
        where: {
          createdAt: { gte: start, lte: end },
        },
        select: {
          id: true,
          status: true,
          totalPrice: true,
          priceBreakdown: true,
          cleaningFee: true,
          currency: true,
          startDate: true,
          endDate: true,
          createdAt: true,
        },
      }),

      // 2. Previous period bookings for authentic delta calculations
      prisma.booking.findMany({
        where: {
          createdAt: { gte: prevStart, lte: prevEnd },
        },
        select: {
          id: true,
          status: true,
          totalPrice: true,
          priceBreakdown: true,
        },
      }),

      // 3. Active Listings
      prisma.listing.count({
        where: { published: true, status: ListingStatus.ACTIVE },
      }),

      // 4. Historical active listings baseline
      prisma.listing.count({
        where: { published: true, createdAt: { lte: prevEnd } },
      }),

      // 5. Registered guests
      prisma.user.count({
        where: { role: Role.USER },
      }),

      // 6. Registered guests baseline
      prisma.user.count({
        where: { role: Role.USER, createdAt: { lte: prevEnd } },
      }),

      // 7. Active hosts
      prisma.user.count({
        where: { role: Role.HOST },
      }),

      // 8. Active hosts baseline
      prisma.user.count({
        where: { role: Role.HOST, createdAt: { lte: prevEnd } },
      }),

      // 9. Operational item 1: Pending listing reviews
      prisma.listing.count({
        where: { status: ListingStatus.PENDING_REVIEW },
      }),

      // 10. Operational item 2: Host registration requests pending
      (async () => {
        try {
          return await prisma.hostRegistrationRequest.count({
            where: { status: { in: ["PENDING", "IN_REVIEW"] } },
          });
        } catch {
          return 0;
        }
      })(),

      // 11. Operational item 3: Pending refunds
      prisma.bookingRefund.count({
        where: { status: RefundStatus.PENDING },
      }),

      // 12. Operational item 4: Open disputes / incidents
      prisma.listingQualityIncident.count({
        where: { status: { in: ["PENDING", "CONFIRMED"] } },
      }),

      // 13. Operational item 5: Open support cases
      prisma.supportCase.count({
        where: {
          status: {
            in: [
              SupportCaseStatus.OPEN,
              SupportCaseStatus.IN_REVIEW,
              SupportCaseStatus.REOPENED,
              SupportCaseStatus.ESCALATED,
            ],
          },
        },
      }),

      // 14. Operational item 6: Failed payments
      prisma.bookingPayment.count({
        where: { status: PaymentStatus.FAILED },
      }),

      // 15. Operational item 7: Urgent moderation reports
      (async () => {
        try {
          return await prisma.moderationReport.count({
            where: {
              caseId: null,
            },
          });
        } catch {
          return 0;
        }
      })(),

      // 16. Payout distributions breakdown
      (async () => {
        try {
          return await prisma.bookingPayoutDistribution.findMany({
            select: {
              amountCents: true,
              status: true,
              isHeld: true,
            },
          });
        } catch {
          return [];
        }
      })(),

      // 17. Recent authentic bookings for Marketplace Performance
      prisma.booking.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          totalPrice: true,
          currency: true,
          status: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          user: {
            select: {
              name: true,
              email: true,
              image: true,
            },
          },
          listing: {
            select: {
              title: true,
              city: true,
              country: true,
              photos: true,
            },
          },
        },
      }),

      // 18. Recent audit logs for Recent Activity feed
      prisma.auditLog.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          description: true,
          actorEmail: true,
          createdAt: true,
          status: true,
        },
      }),
    ]);
  } catch {
    // Offline / sandbox fallback
  }

    // Compute Current Bookings Financials & Breakdown
    let currentGMVCents = 0;
    let currentPlatformRevCents = 0;
    let currentConfirmedCount = 0;
    let currentCompletedCount = 0;
    let currentPendingCount = 0;
    let currentCancelledCount = 0;
    let currentAccommodationCents = 0;
    let currentCleaningCents = 0;

    // Time-series Trend Map (Daily cohort within period)
    const trendMap = new Map<string, { label: string; revenueCents: number; bookingsCount: number }>();
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    const monthsShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    while (cursor <= lastDay) {
      const dateKey = cursor.toISOString().slice(0, 10);
      const dayLabel = `${cursor.getUTCDate()} ${monthsShort[cursor.getUTCMonth()]}`;
      trendMap.set(dateKey, { label: dayLabel, revenueCents: 0, bookingsCount: 0 });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    for (const b of currentBookings) {
      const dateKey = b.createdAt.toISOString().slice(0, 10);
      const isConfirmed = b.status === BookingStatus.CONFIRMED;

      if (isConfirmed) {
        currentConfirmedCount++;
        const total = b.totalPrice || 0;
        currentGMVCents += total;

        const stored = extractStoredHostPayout(b);
        const hostServiceFee = stored?.hostServiceFee ?? Math.round(total * 0.03);
        const cleaning = stored?.cleaningFee ?? b.cleaningFee ?? 0;
        const accommodation = Math.max(0, total - hostServiceFee - cleaning);

        currentPlatformRevCents += hostServiceFee;
        currentAccommodationCents += accommodation;
        currentCleaningCents += cleaning;

        if (new Date(b.endDate) < now) {
          currentCompletedCount++;
        }

        const point = trendMap.get(dateKey);
        if (point) {
          point.revenueCents += total;
          point.bookingsCount += 1;
        }
      } else if (b.status === BookingStatus.PENDING) {
        currentPendingCount++;
      } else if (b.status === BookingStatus.CANCELLED) {
        currentCancelledCount++;
      }
    }

    // Compute Previous Period Comparisons
    let prevGMVCents = 0;
    let prevPlatformRevCents = 0;
    let prevConfirmedCount = 0;

    for (const pb of prevBookings) {
      if (pb.status === BookingStatus.CONFIRMED) {
        prevConfirmedCount++;
        const total = pb.totalPrice || 0;
        prevGMVCents += total;
        const stored = extractStoredHostPayout(pb);
        const fee = stored?.hostServiceFee ?? Math.round(total * 0.03);
        prevPlatformRevCents += fee;
      }
    }

    // Payout stats aggregation
    let pendingPayoutsCents = 0;
    let pendingPayoutsCount = 0;
    let successfulPayoutsCents = 0;
    let failedPayoutsCount = 0;

    for (const p of payoutDistributions) {
      if (p.status === DistributionStatus.PAID) {
        successfulPayoutsCents += p.amountCents;
      } else if (p.status === DistributionStatus.SCHEDULED || p.status === DistributionStatus.PROCESSING) {
        pendingPayoutsCents += p.amountCents;
        pendingPayoutsCount++;
      }
      if (p.status === DistributionStatus.FAILED || p.isHeld) {
        failedPayoutsCount++;
      }
    }

    // Refund stats aggregation
    let pendingRefundsCents = 0;
    let totalRefundVolumeCents = 0;
    try {
      const pendingRefundsAgg = await prisma.bookingRefund.aggregate({
        where: { status: RefundStatus.PENDING },
        _sum: { amount: true },
      });
      pendingRefundsCents = pendingRefundsAgg._sum.amount || 0;

      const succeededRefundsAgg = await prisma.bookingRefund.aggregate({
        where: { status: RefundStatus.SUCCEEDED },
        _sum: { amount: true },
      });
      totalRefundVolumeCents = succeededRefundsAgg._sum.amount || 0;
    } catch {
      // Offline / sandbox fallback
    }

    // Operational Attention Items
    const operationalAttention = [
      {
        id: "listings-review",
        title: "Listings awaiting approval",
        count: pendingListingsCount,
        description: "New host property submissions requiring admin compliance review.",
        href: "/admin/listings?status=PENDING_REVIEW",
        severity: (pendingListingsCount > 10 ? "critical" : pendingListingsCount > 0 ? "urgent" : "all-clear") as any,
        category: "Listings",
      },
      {
        id: "host-onboarding",
        title: "Pending host verifications",
        count: pendingHostRequestsCount,
        description: "Host onboarding requests waiting for document verification.",
        href: "/admin/hosts/onboarding/registration-requests",
        severity: (pendingHostRequestsCount > 5 ? "urgent" : pendingHostRequestsCount > 0 ? "attention" : "all-clear") as any,
        category: "Hosts",
      },
      {
        id: "pending-refunds",
        title: "Refunds requiring review",
        count: pendingRefundsCount,
        description: "Guest refund requests submitted and awaiting administrator approval.",
        href: "/admin/bookings/refunds?status=PENDING",
        severity: (pendingRefundsCount > 5 ? "critical" : pendingRefundsCount > 0 ? "urgent" : "all-clear") as any,
        category: "Finance",
      },
      {
        id: "open-disputes",
        title: "Open guest-host disputes",
        count: openDisputesCount,
        description: "Active quality or reservation dispute cases requiring mediation.",
        href: "/admin/bookings/disputes",
        severity: (openDisputesCount > 3 ? "critical" : openDisputesCount > 0 ? "urgent" : "all-clear") as any,
        category: "Disputes",
      },
      {
        id: "support-sla",
        title: "Open support cases",
        count: openSupportCasesCount,
        description: "Customer service cases in queue requiring agent assignment or reply.",
        href: "/admin/support",
        severity: (openSupportCasesCount > 15 ? "critical" : openSupportCasesCount > 0 ? "attention" : "all-clear") as any,
        category: "Support",
      },
      {
        id: "failed-payments",
        title: "Failed payment attempts",
        count: failedPaymentsCount,
        description: "Transactions declined or voided by gateway in the active period.",
        href: "/admin/bookings/payments",
        severity: (failedPaymentsCount > 5 ? "urgent" : failedPaymentsCount > 0 ? "attention" : "all-clear") as any,
        category: "Finance",
      },
    ];

    // Status Distribution
    const totalBookingsAll = currentConfirmedCount + currentPendingCount + currentCancelledCount || 1;
    const bookingStatusDistribution = [
      {
        status: "CONFIRMED",
        label: "Confirmed stays",
        count: currentConfirmedCount,
        percentage: Math.round((currentConfirmedCount / totalBookingsAll) * 100),
        color: "#10B981", // Emerald
      },
      {
        status: "COMPLETED",
        label: "Completed checkouts",
        count: currentCompletedCount,
        percentage: Math.round((currentCompletedCount / totalBookingsAll) * 100),
        color: "#3B82F6", // Blue
      },
      {
        status: "PENDING",
        label: "Pending confirmation",
        count: currentPendingCount,
        percentage: Math.round((currentPendingCount / totalBookingsAll) * 100),
        color: "#F59E0B", // Amber
      },
      {
        status: "CANCELLED",
        label: "Cancelled reservations",
        count: currentCancelledCount,
        percentage: Math.max(0, 100 - Math.round((currentConfirmedCount / totalBookingsAll) * 100) - Math.round((currentPendingCount / totalBookingsAll) * 100)),
        color: "#EF4444", // Rose
      },
    ];

    // Revenue Source Breakdown
    const totalSources = currentAccommodationCents + currentCleaningCents + currentPlatformRevCents || 1;
    const revenueSourceBreakdown = [
      {
        source: "Accommodation subtotal",
        amountCents: currentAccommodationCents,
        percentage: Math.round((currentAccommodationCents / totalSources) * 100),
        color: "#D97706",
      },
      {
        source: "Cleaning fees",
        amountCents: currentCleaningCents,
        percentage: Math.round((currentCleaningCents / totalSources) * 100),
        color: "#FCD34D",
      },
      {
        source: "Platform commission (3%)",
        amountCents: currentPlatformRevCents,
        percentage: Math.max(0, 100 - Math.round((currentAccommodationCents / totalSources) * 100) - Math.round((currentCleaningCents / totalSources) * 100)),
        color: "#1E293B",
      },
    ];

    // Top Listings by Revenue / Bookings
    let topListingsRaw: any[] = [];
    try {
      topListingsRaw = await prisma.listing.findMany({
        where: { published: true },
        take: 4,
        orderBy: { bookings: { _count: "desc" } },
        select: {
          id: true,
          title: true,
          city: true,
          country: true,
          photos: true,
          bookings: {
            where: { status: BookingStatus.CONFIRMED },
            select: { totalPrice: true },
          },
        },
      });
    } catch {
      // Offline / sandbox fallback
    }

    const topListings = topListingsRaw.map((l) => {
      const rev = l.bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
      return {
        id: l.id,
        title: l.title,
        photo: l.photos?.[0] || null,
        city: l.city,
        country: l.country,
        bookingsCount: l.bookings.length,
        revenueCents: rev,
      };
    });

    // Recent Bookings Formatted
    const recentBookings = recentBookingsRaw.map((b) => {
      const sDate = new Date(b.startDate);
      const eDate = new Date(b.endDate);
      const nights = Math.max(1, Math.round((eDate.getTime() - sDate.getTime()) / (24 * 60 * 60 * 1000)));

      return {
        id: b.id,
        guestName: b.user?.name || "Guest",
        guestEmail: b.user?.email || "Unknown email",
        guestImage: b.user?.image || null,
        listingTitle: b.listing?.title || "Property Listing",
        listingPhoto: b.listing?.photos?.[0] || null,
        city: b.listing?.city,
        country: b.listing?.country,
        startDate: sDate.toISOString().slice(0, 10),
        endDate: eDate.toISOString().slice(0, 10),
        nights,
        amountCents: b.totalPrice || 0,
        currency: b.currency || "SAR",
        status: b.status,
        createdAt: b.createdAt.toISOString(),
      };
    });

    // Recent Activity Formatted
    const recentActivity = recentLogsRaw.map((l) => ({
      id: l.id,
      action: l.action,
      description: l.description,
      actorEmail: l.actorEmail || "System",
      timestamp: l.createdAt.toISOString(),
      status: l.status,
    }));

    return {
      timeframe: {
        label,
        period,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        comparisonLabel,
      },
      kpi: {
        grossBookingValueCents: currentGMVCents,
        grossBookingValueDelta: calcDeltaPct(currentGMVCents, prevGMVCents),
        confirmedBookingsCount: currentConfirmedCount,
        confirmedBookingsDelta: calcDeltaPct(currentConfirmedCount, prevConfirmedCount),
        platformRevenueCents: currentPlatformRevCents,
        platformRevenueDelta: calcDeltaPct(currentPlatformRevCents, prevPlatformRevCents),
        activeListingsCount,
        activeListingsDelta: calcDeltaPct(activeListingsCount, prevActiveListingsCount),
        registeredGuestsCount: totalGuestsCount,
        registeredGuestsDelta: calcDeltaPct(totalGuestsCount, prevGuestsCount),
        activeHostsCount,
        activeHostsDelta: calcDeltaPct(activeHostsCount, prevHostsCount),
      },
      chartPoints: Array.from(trendMap.entries()).map(([date, pt]) => ({
        date,
        label: pt.label,
        revenueCents: pt.revenueCents,
        bookingsCount: pt.bookingsCount,
      })),
      operationalAttention,
      bookingStatusDistribution,
      revenueSourceBreakdown,
      pendingFinancialActions: {
        pendingPayoutsCents,
        pendingPayoutsCount,
        pendingRefundsCents,
        pendingRefundsCount,
        failedPaymentsCount,
      },
      financialSummary: {
        grossBookingsCents: currentGMVCents,
        platformFeesCents: currentPlatformRevCents,
        hostPayoutObligationsCents: Math.max(0, currentGMVCents - currentPlatformRevCents),
        pendingPayoutsCents,
        successfulPayoutsCents,
        refundVolumeCents: totalRefundVolumeCents,
      },
      recentBookings,
      topListings,
      recentActivity,
    };
  },
};
