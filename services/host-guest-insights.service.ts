import "server-only";

import type { AuthUser } from "@/lib/auth/types";
import {
  getHostDashboardData,
  type HostDashboardData,
  type HostDashboardFilterOptions,
} from "@/services/host-dashboard.service";
import type { DateRangePreset, ReportingFilterParams } from "@/lib/dashboard/reporting-filter";
import { prisma } from "@/lib/db/prisma";
import { BookingStatus } from "@/generated/prisma/enums";
import { parseBookingDate } from "@/lib/booking/booking-date";

export interface GuestOriginCityItem {
  city: string;
  guestCount: number;
  sharePercentage: number;
}

export interface GuestOriginCountryItem {
  country: string;
  guestCount: number;
  sharePercentage: number;
  topCities: GuestOriginCityItem[];
}

export interface ReturningGuestCohortData {
  totalGuests: number;
  firstTimeGuests: number;
  returningGuests: number;
  returningPercentage: number;
  repeatStayBreakdown: Array<{
    category: string;
    guestCount: number;
    percentage: number;
  }>;
  trend: Array<{
    monthKey: string;
    label: string;
    returningGuestsCount: number;
    totalGuestsCount: number;
    returningPercentage: number;
  }>;
}

export interface CheckInEngagementData {
  eligibleReservationsCount: number;
  viewedCount: number;
  notViewedCount: number;
  viewedPercentage: number;
  trackingStatus: {
    status: "ACTIVE" | "DATA_UNAVAILABLE";
    message: string;
    trackingStartDate: string | null;
  };
  propertyBreakdown: Array<{
    listingId: string;
    listingTitle: string;
    viewedCount: number;
    eligibleCount: number;
    percentage: number;
  }>;
}

export interface GuestInsightsOverviewData {
  reportingPeriod: HostDashboardData["reportingPeriod"];
  selectedListingId: string | null;
  listings: Array<{ id: string; title: string }>;
  summary: {
    uniqueGuestsCount: number;
    completedGuestStaysCount: number;
    originCountriesCount: number;
    returningGuestsPercentage: number;
    returningGuestsCount: number;
    averageRatingReceived: number | null;
    totalReviewsCount: number;
    checkInInstructionsViewedPercentage: number | null;
  };
  origins: {
    countries: GuestOriginCountryItem[];
    unknownOriginGuestsCount: number;
    totalGuestsWithKnownOrigin: number;
  };
  returning: ReturningGuestCohortData;
  checkInEngagement: CheckInEngagementData;
  reviewEngagement: {
    overallRating: number | null;
    totalReviewsCount: number;
    ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  };
}

function getCheckInTrackingStartDate() {
  const value = process.env.CHECKIN_INSTRUCTIONS_TRACKING_STARTED_AT;
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export const hostGuestInsightsService = {
  /**
   * Records a verified check-in instruction viewed event by an authorized guest.
   */
  async recordCheckInViewed(input: {
    reservationId: string;
    listingId: string;
    guestId: string;
  }) {
    if (!input.reservationId || !input.guestId) return { recorded: false };
    const result = await prisma.booking.updateMany({
      where: {
        id: input.reservationId,
        listingId: input.listingId,
        userId: input.guestId,
        status: BookingStatus.CONFIRMED,
        checkInInstructionsViewedAt: null,
        listing: { checkInInstructions: { not: null } },
      },
      data: { checkInInstructionsViewedAt: new Date() },
    });
    return { recorded: result.count > 0 };
  },

  /**
   * Assembles full Guest Insights overview data, reconciling with Host Dashboard.
   */
  async getGuestInsightsOverview(
    actor: AuthUser,
    query: ReportingFilterParams = {},
  ): Promise<GuestInsightsOverviewData> {
    const filterOptions: HostDashboardFilterOptions = {
      listingId: query.propertyId || undefined,
      period: query.period as DateRangePreset | undefined,
      startDate: query.startDate || undefined,
      endDate: query.endDate || undefined,
      currency: query.currency || undefined,
      actorRole: actor.role,
    };

    const dashboardData = await getHostDashboardData(actor, filterOptions);
    const guestAnalytics = dashboardData.guestAnalytics;

    // Build structured countries & top cities map
    const countryMap = new Map<
      string,
      {
        country: string;
        guestCount: number;
        cities: Map<string, number>;
      }
    >();

    for (const origin of guestAnalytics.guestOrigins) {
      let entry = countryMap.get(origin.country);
      if (!entry) {
        entry = { country: origin.country, guestCount: 0, cities: new Map() };
        countryMap.set(origin.country, entry);
      }
      entry.guestCount += origin.guestCount;
      if (origin.city) {
        entry.cities.set(origin.city, (entry.cities.get(origin.city) ?? 0) + origin.guestCount);
      }
    }

    const totalKnownGuests = Array.from(countryMap.values()).reduce((sum, c) => sum + c.guestCount, 0);

    const countries: GuestOriginCountryItem[] = Array.from(countryMap.values())
      .map((c) => {
        const topCities: GuestOriginCityItem[] = Array.from(c.cities.entries())
          .map(([cityName, count]) => ({
            city: cityName,
            guestCount: count,
            sharePercentage: c.guestCount > 0 ? Math.round((count / c.guestCount) * 1000) / 10 : 0,
          }))
          .sort((a, b) => b.guestCount - a.guestCount);

        return {
          country: c.country,
          guestCount: c.guestCount,
          sharePercentage: totalKnownGuests > 0 ? Math.round((c.guestCount / totalKnownGuests) * 1000) / 10 : 0,
          topCities,
        };
      })
      .sort((a, b) => b.guestCount - a.guestCount);

    // Build returning cohorts from completed stays in the requested reporting period.
    const scopedListings = dashboardData.listings;
    const scopedListingIds = query.propertyId ? [query.propertyId] : scopedListings.map((l) => l.id);
    const asOf = new Date();
    const reportingStartDate = parseBookingDate(dashboardData.reportingPeriod.startDateKey);
    const reportingEndDate = parseBookingDate(dashboardData.reportingPeriod.endDateKey);
    const completedPeriodEnd = reportingEndDate < asOf
      ? reportingEndDate
      : asOf;
    const completedGuestBookings = await prisma.booking.findMany({
      where: {
        listingId: { in: scopedListingIds },
        status: BookingStatus.CONFIRMED,
        endDate: { gte: reportingStartDate, lte: completedPeriodEnd },
      },
      select: { userId: true, endDate: true },
      orderBy: { endDate: "asc" },
    });
    const guestStayCounts = new Map<string, number>();
    for (const booking of completedGuestBookings) {
      guestStayCounts.set(booking.userId, (guestStayCounts.get(booking.userId) ?? 0) + 1);
    }
    const totalGuests = guestStayCounts.size;
    const returningGuests = Array.from(guestStayCounts.values()).filter((count) => count >= 2).length;
    const firstTimeGuests = Math.max(0, totalGuests - returningGuests);
    const returningPercentage = totalGuests > 0 ? Math.round((returningGuests / totalGuests) * 100) : 0;

    // Multi-stay breakdown
    const repeatStayBreakdown = [
      {
        category: "1 stay (First-time)",
        guestCount: firstTimeGuests,
        percentage: totalGuests > 0 ? Math.round((firstTimeGuests / totalGuests) * 100) : 0,
      },
      {
        category: "2 stays (Repeat)",
        guestCount: Array.from(guestStayCounts.values()).filter((count) => count === 2).length,
        percentage: totalGuests > 0 ? Math.round((Array.from(guestStayCounts.values()).filter((count) => count === 2).length / totalGuests) * 100) : 0,
      },
      {
        category: "3+ stays (Loyal)",
        guestCount: Array.from(guestStayCounts.values()).filter((count) => count >= 3).length,
        percentage: totalGuests > 0 ? Math.round((Array.from(guestStayCounts.values()).filter((count) => count >= 3).length / totalGuests) * 100) : 0,
      },
    ];

    // Build a real six-month activity trend. A guest is returning within a month
    // only when that month's completed stay is their second-or-later stay in scope.
    const now = asOf;
    const trend: ReturningGuestCohortData["trend"] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const mKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(d);
      const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      const monthEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      const counts = new Map<string, number>();
      for (const booking of completedGuestBookings) {
        if (booking.endDate >= monthStart && booking.endDate <= monthEnd) {
          counts.set(booking.userId, (counts.get(booking.userId) ?? 0) + 1);
        }
      }
      const totalInMonth = counts.size;
      const returningInMonth = Array.from(counts.keys()).filter((guestId) => (guestStayCounts.get(guestId) ?? 0) >= 2).length;
      trend.push({
        monthKey: mKey,
        label,
        returningGuestsCount: returningInMonth,
        totalGuestsCount: totalInMonth,
        returningPercentage: totalInMonth > 0 ? Math.round((returningInMonth / totalInMonth) * 100) : 0,
      });
    }

    // Check-in Instruction Engagement Metrics
    // Fetch completed/confirmed bookings in period for scoped listings to inspect check-in engagement
    const trackingStartDate = getCheckInTrackingStartDate();
    const eligibleBookings: Array<{ listingId: string; checkInInstructionsViewedAt: Date | null }> = trackingStartDate ? await prisma.booking.findMany({
      where: {
        listingId: { in: scopedListingIds },
        status: BookingStatus.CONFIRMED,
        endDate: {
          gte: trackingStartDate > reportingStartDate ? trackingStartDate : reportingStartDate,
          lte: reportingEndDate,
        },
        // Future stays are not counted as "not viewed" before the guest can
        // reasonably access arrival information.
        startDate: { lte: asOf },
        listing: {
          checkInInstructions: { not: null },
        },
      },
      select: {
        listingId: true,
        checkInInstructionsViewedAt: true,
      },
    }) : [];
    const eligibleCount = eligibleBookings.length;
    const viewedCount = eligibleBookings.filter((booking) => booking.checkInInstructionsViewedAt !== null).length;
    const notViewedCount = Math.max(0, eligibleCount - viewedCount);
    const viewedPercentage = eligibleCount > 0 ? Math.round((viewedCount / eligibleCount) * 100) : 0;

    // Property-level check-in breakdown
    const checkInPropBreakdown = scopedListings.map((l) => {
      const propBookings = eligibleBookings.filter((b) => b.listingId === l.id);
      const pEligible = propBookings.length;
      const pViewed = propBookings.filter((b) => b.checkInInstructionsViewedAt !== null).length;
      return {
        listingId: l.id,
        listingTitle: l.title,
        viewedCount: pViewed,
        eligibleCount: pEligible,
        percentage: pEligible > 0 ? Math.round((pViewed / pEligible) * 100) : 0,
      };
    });

    return {
      reportingPeriod: dashboardData.reportingPeriod,
      selectedListingId: dashboardData.filterListingId ?? null,
      listings: scopedListings.map((l) => ({ id: l.id, title: l.title })),
      summary: {
        uniqueGuestsCount: totalGuests,
        completedGuestStaysCount: guestAnalytics.completedGuestStaysCount,
        originCountriesCount: countries.length,
        returningGuestsPercentage: returningPercentage,
        returningGuestsCount: returningGuests,
        averageRatingReceived: dashboardData.reviews.overallRating,
        totalReviewsCount: dashboardData.reviews.totalReviewsCount,
        checkInInstructionsViewedPercentage: trackingStartDate && eligibleCount > 0 ? viewedPercentage : null,
      },
      origins: {
        countries,
        unknownOriginGuestsCount: guestAnalytics.staysWithoutRecordedOriginCount,
        totalGuestsWithKnownOrigin: totalKnownGuests,
      },
      returning: {
        totalGuests,
        firstTimeGuests,
        returningGuests,
        returningPercentage,
        repeatStayBreakdown,
        trend,
      },
      checkInEngagement: {
        eligibleReservationsCount: eligibleCount,
        viewedCount,
        notViewedCount,
        viewedPercentage,
        trackingStatus: {
          status: trackingStartDate ? "ACTIVE" : "DATA_UNAVAILABLE",
          message: trackingStartDate
            ? "Check-in instruction access is recorded when an authorized guest opens the arrival instructions. Dates before tracking began are excluded."
            : "Check-in instruction engagement will be available after the tracking start date is configured for this deployment.",
          trackingStartDate: trackingStartDate?.toISOString() ?? null,
        },
        propertyBreakdown: checkInPropBreakdown,
      },
      reviewEngagement: {
        overallRating: dashboardData.reviews.overallRating,
        totalReviewsCount: dashboardData.reviews.totalReviewsCount,
        ratingDistribution: dashboardData.reviews.ratingDistribution,
      },
    };
  },
};
