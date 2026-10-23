import "server-only";

import type { AuthUser } from "@/lib/auth/types";
import {
  getHostDashboardData,
  type HostDashboardData,
  type HostDashboardFilterOptions,
} from "@/services/host-dashboard.service";
import { hostReviewsInsightsService, type HostReviewsOverviewData } from "@/services/host-reviews-insights.service";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";

export type InsightsTab = "reviews" | "stats" | "opportunities" | "superhost";

export interface HostInsightsQuery {
  tab?: InsightsTab;
  listingId?: string;
  period?: DateRangePreset;
  startDate?: string;
  endDate?: string;
  currency?: string;
}

export interface HostInsightsOpportunityItem {
  id: string;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  category: "PHOTOS" | "AMENITIES" | "DETAILS" | "POLICIES" | "MESSAGING" | "REVIEWS";
  title: string;
  description: string;
  listingId?: string;
  listingTitle?: string;
  actionLabel: string;
  actionHref: string;
  impact: string;
}

export interface HostInsightsSuperhostCriterion {
  id: "STAYS" | "RATING" | "RESPONSE_RATE" | "CANCELLATION" | "GOOD_STANDING";
  title: string;
  description: string;
  currentValue: string;
  targetValue: string;
  progressPercentage: number;
  isMet: boolean;
}

export interface HostInsightsData {
  activeTab: InsightsTab;
  reportingPeriod: HostDashboardData["reportingPeriod"];
  selectedListingId: string | null;
  listings: Array<{ id: string; title: string }>;
  reviews: {
    overallRating: number | null;
    totalReviewsCount: number;
    ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
    categoryRatings: {
      cleanliness: number | null;
      accuracy: number | null;
      checkIn: number | null;
      communication: number | null;
      location: number | null;
      value: number | null;
    };
    recentReviews: HostDashboardData["reviews"]["recentReviews"];
    trend: HostDashboardData["reviews"]["trend"];
    qualitySummary?: HostReviewsOverviewData["qualitySummary"];
    trends?: HostReviewsOverviewData["trends"];
  };
  stats: {
    earnings: HostDashboardData["earnings"];
    kpis: HostDashboardData["kpis"];
    performance: {
      confirmedBookingsCount: number;
      completedStaysCount: number;
      occupancyRatePercentage: number;
      bookedNights: number;
      availableNights: number;
      totalBookableNights: number;
      averageDailyRateCents: number;
      averageBookingValueCents: number | null;
      averageStayNights: number;
      currency: string;
    };
    quality: {
      responseRatePercentage: number | null;
      averageResponseTimeMinutes: number | null;
      hostCancellationRatePercentage: number;
      totalCancelledCount: number;
    };
    listingInventory: {
      totalListings: number;
      activeListings: number;
      draftListings: number;
      pausedListings: number;
    };
    analyticsLimitations: {
      pageViews: HostDashboardData["listingPerformance"]["pageViews"];
      conversionRate: HostDashboardData["listingPerformance"]["conversionRate"];
    };
    quickStats: {
      overallRating: number | null;
      totalReviewsCount: number;
      responseRatePercentage: number | null;
      responseInquiryCount: number;
      netEarningsCents: number;
      confirmedBookingsCount: number;
      listingViews: number | null;
    };
    chartComparison: {
      label: string;
      comparisonLabel: string;
      occupancy: { current: number; previous: number; bookedNights: number; availableNights: number };
      bookings: { current: number; previous: number; completedStays: number; cancelledBookings: number };
      earnings: { current: number; previous: number; currency: string };
    };
  };
  opportunities: {
    items: HostInsightsOpportunityItem[];
    totalCount: number;
    completedChecksCount: number;
    totalChecksCount: number;
  };
  superhost: {
    officialStatus: boolean;
    isQualified: boolean;
    windowStart: string;
    windowEnd: string;
    nextEvaluationAt: string;
    criteria: HostInsightsSuperhostCriterion[];
    gaps: string[];
    benefits: Array<{ title: string; description: string; icon: string }>;
  };
}

export const hostInsightsService = {
  /**
   * Assembles the authoritative Host Insights dataset.
   * Directly reuses getHostDashboardData to ensure 100% financial and metric reconciliation.
   */
  async getInsights(
    actor: AuthUser,
    query: HostInsightsQuery = {},
  ): Promise<HostInsightsData> {
    const validTabs: InsightsTab[] = ["reviews", "stats", "opportunities", "superhost"];
    const activeTab = validTabs.includes(query.tab as InsightsTab) ? (query.tab as InsightsTab) : "reviews";

    const filterOptions: HostDashboardFilterOptions = {
      listingId: query.listingId,
      period: query.period,
      startDate: query.startDate,
      endDate: query.endDate,
      currency: query.currency,
      actorRole: actor.role,
    };

    // Review quality/trend aggregation is only rendered on the Reviews tab. Keeping it
    // out of the other tabs avoids two unbounded review reads on every Stats, Opportunities,
    // or Superhost navigation while preserving the dashboard review summary everywhere.
    // const dashboardData = await getHostDashboardData(actor, filterOptions);
    // The dashboard aggregate and the Reviews-only supplemental aggregate are independent.
    const [dashboardData, reviewsOverview] = await Promise.all([
      getHostDashboardData(actor, filterOptions),
      activeTab === "reviews"
        ? hostReviewsInsightsService.getReviewsOverview(actor.id, {
            listingId: query.listingId,
            period: query.period,
            startDate: query.startDate,
            endDate: query.endDate,
          })
        : Promise.resolve(null),
    ]);

    // A comparison dashboard is needed only for the Stats charts. Other tabs should
    // not pay for a second complete dashboard aggregation they never render.
    const comparisonDashboard = activeTab === "stats"
      ? await getHostDashboardData(actor, {
          ...filterOptions,
          period: "custom",
          startDate: dashboardData.reportingPeriod.comparisonStartDateKey,
          endDate: dashboardData.reportingPeriod.comparisonEndDateKey,
        })
      : null;

    // Build Opportunities from real listing health and completeness data
    const opportunities: HostInsightsOpportunityItem[] = [];
    let completedChecks = 0;
    let totalChecks = 0;

    for (const listing of dashboardData.listingHealth.listings) {
      completedChecks += listing.completedChecks;
      totalChecks += listing.totalChecks;

      // Filter by property if one is selected
      if (query.listingId && listing.listingId !== query.listingId) continue;

      if (listing.photoCount < 5) {
        opportunities.push({
          id: `photos-${listing.listingId}`,
          priority: listing.photoCount === 0 ? "CRITICAL" : "HIGH",
          category: "PHOTOS",
          title: "Improve listing photo gallery",
          description: `Your property "${listing.title}" currently has ${listing.photoCount} photo${
            listing.photoCount === 1 ? "" : "s"
          }. Properties with at least 5 high-resolution photos receive significantly more guest interest.`,
          listingId: listing.listingId,
          listingTitle: listing.title,
          actionLabel: "Manage photos",
          actionHref: `/host/listings/${listing.listingId}`,
          impact: "High",
        });
      }

      if (listing.missingFields.length > 0) {
        opportunities.push({
          id: `details-${listing.listingId}`,
          priority: "MEDIUM",
          category: "DETAILS",
          title: "Complete property details",
          description: `Complete the missing details (${listing.missingFields.slice(0, 3).join(", ")}) on "${listing.title}" to improve search ranking.`,
          listingId: listing.listingId,
          listingTitle: listing.title,
          actionLabel: "Edit listing",
          actionHref: `/host/listings/${listing.listingId}`,
          impact: "Medium",
        });
      }

      if (listing.amenityCount < 5) {
        opportunities.push({
          id: `amenities-${listing.listingId}`,
          priority: "MEDIUM",
          category: "AMENITIES",
          title: "Add popular amenities",
          description: `"${listing.title}" has ${listing.amenityCount} amenities listed. Adding amenities like Wi-Fi, air conditioning, and dedicated workspace helps guests find your place.`,
          listingId: listing.listingId,
          listingTitle: listing.title,
          actionLabel: "Add amenities",
          actionHref: `/host/listings/${listing.listingId}`,
          impact: "Medium",
        });
      }
    }

    // Host-level reliability and messaging opportunities
    if (dashboardData.kpis.cancellationRate.hostPercentage > 1) {
      opportunities.push({
        id: "opp-cancellations",
        priority: "CRITICAL",
        category: "POLICIES",
        title: "Reduce host cancellation rate",
        description: `Your host cancellation rate is ${dashboardData.kpis.cancellationRate.hostPercentage}%, above the 1.0% Superhost maximum threshold.`,
        actionLabel: "Review calendar",
        actionHref: "/host/calendar",
        impact: "High",
      });
    }

    if (
      dashboardData.kpis.averageRating.overallRating !== null &&
      dashboardData.kpis.averageRating.totalReviewsCount > 0 &&
      dashboardData.kpis.averageRating.overallRating < 4.8
    ) {
      opportunities.push({
        id: "opp-rating",
        priority: "HIGH",
        category: "REVIEWS",
        title: "Maintain a 4.80+ guest rating",
        description: `Your average rating is ${dashboardData.kpis.averageRating.overallRating.toFixed(
          2,
        )}. Address review feedback on cleanliness and check-in to reach Superhost standards.`,
        actionLabel: "View reviews",
        actionHref: "/host/insights?tab=reviews",
        impact: "High",
      });
    }

    if (
      dashboardData.listingHealth.responseRatePercentage !== null &&
      dashboardData.listingHealth.responseRatePercentage < 90
    ) {
      opportunities.push({
        id: "opp-response-rate",
        priority: "HIGH",
        category: "MESSAGING",
        title: "Reply to guest inquiries faster",
        description: `Your 24-hour response rate is ${dashboardData.listingHealth.responseRatePercentage}%. Superhosts maintain a 90% response rate.`,
        actionLabel: "Open messages",
        actionHref: "/host/messages",
        impact: "High",
      });
    }

    // Superhost criteria breakdown
    const superhostProg = dashboardData.superhostEvaluation.currentProgress;

    const superhostCriteria: HostInsightsSuperhostCriterion[] = [
      {
        id: "STAYS",
        title: "Completed stays",
        description: "Host at least 10 trips or 100 nights over the past 12 months.",
        currentValue: `${superhostProg.completedReservationsCount} trips (${superhostProg.completedNightsCount} nights)`,
        targetValue: "10 trips or 100 nights",
        progressPercentage: Math.min(100, Math.round((superhostProg.completedReservationsCount / 10) * 100)),
        isMet: superhostProg.hostingVolumeMet,
      },
      {
        id: "RATING",
        title: "Overall rating",
        description: "Maintain an overall guest rating of 4.80 or higher.",
        currentValue: superhostProg.overallRating !== null ? `${superhostProg.overallRating.toFixed(2)} ★` : "No rating yet",
        targetValue: "4.80 ★",
        progressPercentage:
          superhostProg.overallRating !== null
            ? Math.min(100, Math.round((superhostProg.overallRating / 4.8) * 100))
            : 0,
        isMet: superhostProg.ratingMet,
      },
      {
        id: "RESPONSE_RATE",
        title: "Response rate",
        description: "Respond to at least 90% of new guest inquiries within 24 hours.",
        currentValue:
          superhostProg.responseRatePercentage !== null ? `${superhostProg.responseRatePercentage}%` : "No inquiries",
        targetValue: "90%",
        progressPercentage: superhostProg.responseRatePercentage ?? 0,
        isMet: superhostProg.responseRateMet,
      },
      {
        id: "CANCELLATION",
        title: "Cancellation rate",
        description: "Maintain a host cancellation rate below 1.0%.",
        currentValue: `${superhostProg.hostCancellationRatePercentage}%`,
        targetValue: "< 1.0%",
        progressPercentage: superhostProg.cancellationMet ? 100 : Math.max(0, 100 - superhostProg.hostCancellationRatePercentage * 10),
        isMet: superhostProg.cancellationMet,
      },
      {
        id: "GOOD_STANDING",
        title: "Account standing",
        description: "Maintain an account in full compliance with Homyz hosting policies.",
        currentValue: superhostProg.accountGoodStanding ? "In good standing" : "Requires attention",
        targetValue: "Good standing",
        progressPercentage: superhostProg.accountGoodStanding ? 100 : 0,
        isMet: superhostProg.accountStandingMet,
      },
    ];

    const superhostBenefits = [
      {
        title: "Superhost Badge",
        description: "A verified badge displayed on eligible public host and listing surfaces after an official assessment.",
        icon: "badge",
      },
    ];

    return {
      activeTab,
      reportingPeriod: dashboardData.reportingPeriod,
      selectedListingId: dashboardData.filterListingId ?? null,
      listings: dashboardData.listings.map((l) => ({ id: l.id, title: l.title })),
      reviews: {
        overallRating: dashboardData.reviews.overallRating,
        totalReviewsCount: dashboardData.reviews.totalReviewsCount,
        ratingDistribution: dashboardData.reviews.ratingDistribution,
        categoryRatings: dashboardData.reviews.categoryRatings,
        recentReviews: dashboardData.reviews.recentReviews,
        trend: dashboardData.reviews.trend,
        qualitySummary: reviewsOverview?.qualitySummary,
        trends: reviewsOverview?.trends,
      },
      stats: {
        earnings: dashboardData.earnings,
        kpis: dashboardData.kpis,
        performance: {
          // Replaces the former all-time dashboardData.reservationSummary.totalBookings
          // value so Stats always honors the selected reporting period.
          confirmedBookingsCount: dashboardData.reportingActivity.confirmedBookingsCount,
          completedStaysCount: dashboardData.kpis.averageStayLength.completedStaysCount,
          occupancyRatePercentage: dashboardData.kpis.occupancy.ratePercentage,
          bookedNights: dashboardData.kpis.occupancy.bookedNights,
          availableNights: dashboardData.kpis.occupancy.availableNights,
          totalBookableNights: dashboardData.kpis.occupancy.totalBookableNights,
          averageDailyRateCents:
            dashboardData.reportingActivity.completedNightsCount > 0
              ? Math.round(dashboardData.earnings.netEarningsCents / dashboardData.reportingActivity.completedNightsCount)
              : 0,
          averageBookingValueCents: dashboardData.kpis.averageBookingValue.hostPayoutCents,
          averageStayNights: dashboardData.kpis.averageStayLength.nights,
          currency: dashboardData.kpis.monthlyEarnings.currency,
        },
        quality: {
          responseRatePercentage: dashboardData.listingHealth.responseRatePercentage,
          averageResponseTimeMinutes: dashboardData.listingHealth.averageResponseTimeMinutes,
          hostCancellationRatePercentage: dashboardData.kpis.cancellationRate.hostPercentage,
          totalCancelledCount: dashboardData.kpis.cancellationRate.totalCancelledCount,
        },
        listingInventory: {
          totalListings: dashboardData.listingPerformance.totalListings,
          activeListings: dashboardData.listingPerformance.activeListings,
          draftListings: dashboardData.listingPerformance.draftListings,
          pausedListings: dashboardData.listingPerformance.pausedListings,
        },
        analyticsLimitations: {
          pageViews: dashboardData.listingPerformance.pageViews,
          conversionRate: dashboardData.listingPerformance.conversionRate,
        },
        quickStats: {
          overallRating: dashboardData.kpis.averageRating.overallRating,
          totalReviewsCount: dashboardData.kpis.averageRating.totalReviewsCount,
          responseRatePercentage: dashboardData.listingHealth.responseRatePercentage,
          responseInquiryCount: dashboardData.listingHealth.totalGuestInquiries,
          netEarningsCents: dashboardData.earnings.netEarningsCents,
          confirmedBookingsCount: dashboardData.reportingActivity.confirmedBookingsCount,
          listingViews: dashboardData.listingPerformance.pageViews.status === "ACTIVE"
            ? dashboardData.listingPerformance.pageViews.count
            : null,
        },
        chartComparison: {
          label: dashboardData.reportingPeriod.label,
          comparisonLabel: dashboardData.reportingPeriod.comparisonLabel,
          occupancy: {
            current: dashboardData.kpis.occupancy.ratePercentage,
            previous: comparisonDashboard?.kpis.occupancy.ratePercentage ?? 0,
            bookedNights: dashboardData.kpis.occupancy.bookedNights,
            availableNights: dashboardData.kpis.occupancy.availableNights,
          },
          bookings: {
            current: dashboardData.reportingActivity.confirmedBookingsCount,
            previous: comparisonDashboard?.reportingActivity.confirmedBookingsCount ?? 0,
            completedStays: dashboardData.reportingActivity.completedStaysCount,
            cancelledBookings: dashboardData.reportingActivity.cancelledBookingsCount,
          },
          earnings: {
            current: dashboardData.earnings.netEarningsCents,
            previous: comparisonDashboard?.earnings.netEarningsCents ?? 0,
            currency: dashboardData.earnings.currency,
          },
        },
      },
      opportunities: {
        items: opportunities,
        totalCount: opportunities.length,
        completedChecksCount: completedChecks,
        totalChecksCount: totalChecks,
      },
      superhost: {
        officialStatus: dashboardData.superhostEvaluation.officialStatus,
        isQualified: dashboardData.superhostEvaluation.isQualified,
        windowStart: dashboardData.superhostEvaluation.windowStart,
        windowEnd: dashboardData.superhostEvaluation.windowEnd,
        nextEvaluationAt: dashboardData.superhostEvaluation.nextEvaluationAt,
        criteria: superhostCriteria,
        gaps: dashboardData.superhostEvaluation.gaps,
        benefits: superhostBenefits,
      },
    };
  },
};
