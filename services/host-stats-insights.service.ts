import "server-only";

import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import {
  getHostDashboardData,
  type HostDashboardData,
  type HostDashboardFilterOptions,
} from "@/services/host-dashboard.service";
import { type DateRangePreset, type ReportingFilterParams } from "@/lib/dashboard/reporting-filter";
import { messagingService } from "@/services/messaging.service";

export type StatMetricType =
  | "earnings"
  | "views"
  | "bookings"
  | "occupancy"
  | "rates"
  | "conversion"
  | "response-rate"
  | "cancellations"
  | "stay-length";

export interface StatTrendPoint {
  periodKey: string;
  label: string;
  value: number | null;
  secondaryValue?: number | null;
}

export interface StatPropertyBreakdownItem {
  listingId: string;
  listingTitle: string;
  value: number | null;
  formattedValue: string;
  secondaryValue?: number | null;
  secondaryLabel?: string;
}

export interface StatMetricDetailData {
  metric: StatMetricType;
  title: string;
  subtitle: string;
  currentValue: number | null;
  formattedCurrentValue: string;
  previousValue: number | null;
  formattedPreviousValue: string;
  deltaPercentage: number | null;
  deltaDirection: "increase" | "decrease" | "neutral";
  comparisonLabel: string;
  unit: string;
  currency?: string;
  benchmark?: {
    label: string;
    target: string;
    isMet: boolean;
  };
  trend: StatTrendPoint[];
  propertyBreakdown: StatPropertyBreakdownItem[];
  supportingMetrics: Array<{
    id: string;
    label: string;
    value: string;
    description?: string;
  }>;
  instrumentationStatus?: {
    status: "AVAILABLE" | "DATA_UNAVAILABLE" | "PARTIAL";
    message: string;
    sinceDate?: string;
  };
  action: {
    label: string;
    href: string;
  };
  reportingPeriod: HostDashboardData["reportingPeriod"];
  selectedListingId: string | null;
  listings: Array<{ id: string; title: string }>;
}

export const hostStatsInsightsService = {
  /**
   * Retrieves full Stats overview data, reconciling 100% with Host Dashboard and Earnings.
   */
  async getStatsOverview(actor: AuthUser, query: ReportingFilterParams = {}) {
    const filterOptions: HostDashboardFilterOptions = {
      listingId: query.propertyId || undefined,
      period: query.period as DateRangePreset | undefined,
      startDate: query.startDate || undefined,
      endDate: query.endDate || undefined,
      currency: query.currency || undefined,
    };

    const dashboardData = await getHostDashboardData(actor, filterOptions);

    return {
      reportingPeriod: dashboardData.reportingPeriod,
      selectedListingId: dashboardData.filterListingId,
      listings: dashboardData.listings.map((l) => ({ id: l.id, title: l.title })),
      performance: {
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
      earnings: dashboardData.earnings,
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
    };
  },

  /**
   * Retrieves in-depth time series, comparisons, breakdowns, and actions for a single metric.
   */
  async getMetricDetail(
    actor: AuthUser,
    metric: string,
    query: ReportingFilterParams = {},
  ): Promise<StatMetricDetailData> {
    const validMetrics: StatMetricType[] = [
      "earnings",
      "views",
      "bookings",
      "occupancy",
      "rates",
      "conversion",
      "response-rate",
      "cancellations",
      "stay-length",
    ];

    if (!validMetrics.includes(metric as StatMetricType)) {
      throw AppError.notFound(`Metric "${metric}" is not supported.`);
    }

    const metricType = metric as StatMetricType;

    const filterOptions: HostDashboardFilterOptions = {
      listingId: query.propertyId || undefined,
      period: query.period as DateRangePreset | undefined,
      startDate: query.startDate || undefined,
      endDate: query.endDate || undefined,
      currency: query.currency || undefined,
    };

    const currentDashboard = await getHostDashboardData(actor, filterOptions);
    const resolvedPeriod = currentDashboard.reportingPeriod;

    // Load comparison period dashboard
    const compFilterOptions: HostDashboardFilterOptions = {
      listingId: filterOptions.listingId,
      period: "custom",
      startDate: resolvedPeriod.comparisonStartDateKey,
      endDate: resolvedPeriod.comparisonEndDateKey,
      currency: filterOptions.currency,
    };
    const compDashboard = await getHostDashboardData(actor, compFilterOptions);

    const currency = currentDashboard.kpis.monthlyEarnings.currency || "SAR";
    const formatMoney = (cents: number) =>
      new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(cents / 100);

    const listings = currentDashboard.listings.map((l) => ({ id: l.id, title: l.title }));

    // Helper for delta calculation
    const calcDelta = (curr: number | null, prev: number | null) => {
      if (curr === null || prev === null || prev === 0) return { deltaPercentage: null, deltaDirection: "neutral" as const };
      const pct = Math.round(((curr - prev) / prev) * 100);
      const direction = pct > 0 ? ("increase" as const) : pct < 0 ? ("decrease" as const) : ("neutral" as const);
      return { deltaPercentage: pct, deltaDirection: direction };
    };

    switch (metricType) {
      case "earnings": {
        const currVal = currentDashboard.earnings.netEarningsCents;
        const prevVal = compDashboard.earnings.netEarningsCents;
        const { deltaPercentage, deltaDirection } = calcDelta(currVal, prevVal);

        const trend: StatTrendPoint[] = [];
        const propertyBreakdown: StatPropertyBreakdownItem[] = [];

        return {
          metric: "earnings",
          title: "Earnings",
          subtitle: "Net realized host revenue from completed stays after platform fees and adjustments",
          currentValue: currVal / 100,
          formattedCurrentValue: formatMoney(currVal),
          previousValue: prevVal / 100,
          formattedPreviousValue: formatMoney(prevVal),
          deltaPercentage,
          deltaDirection,
          comparisonLabel: resolvedPeriod.comparisonLabel,
          unit: currency,
          currency,
          trend,
          propertyBreakdown,
          supportingMetrics: [
            {
              id: "gross",
              label: "Gross Bookings Revenue",
              value: formatMoney(currentDashboard.earnings.grossEarningsCents),
              description: "Total accommodation payments before fee deductions",
            },
            {
              id: "service_fee",
              label: "Host Service Fees",
              value: formatMoney(currentDashboard.earnings.deductionsCents),
              description: "Homyz host service platform commission",
            },
            {
              id: "avg_stay_earnings",
              label: "Average Earnings per Stay",
              value:
                currentDashboard.kpis.averageStayLength.completedStaysCount > 0
                  ? formatMoney(Math.round(currVal / currentDashboard.kpis.averageStayLength.completedStaysCount))
                  : "—",
              description: "Realized net payout per completed reservation",
            },
          ],
          action: {
            label: "View in Earnings",
            href: "/host/earnings",
          },
          reportingPeriod: resolvedPeriod,
          selectedListingId: currentDashboard.filterListingId ?? null,
          listings,
          instrumentationStatus: {
            status: "PARTIAL",
            message: "The selected-period net earnings total is authoritative. Historical and property earnings series are not yet stored separately, so they are not reconstructed here.",
          },
        };
      }

      case "occupancy": {
        const currVal = currentDashboard.kpis.occupancy.ratePercentage;
        const prevVal = compDashboard.kpis.occupancy.ratePercentage;
        const { deltaPercentage, deltaDirection } = calcDelta(currVal, prevVal);

        const trend: StatTrendPoint[] = [];
        const propertyBreakdown: StatPropertyBreakdownItem[] = [];

        return {
          metric: "occupancy",
          title: "Occupancy Rate",
          subtitle: "Percentage of bookable nights reserved by guests during the selected period",
          currentValue: currVal,
          formattedCurrentValue: `${currVal}%`,
          previousValue: prevVal,
          formattedPreviousValue: `${prevVal}%`,
          deltaPercentage,
          deltaDirection,
          comparisonLabel: resolvedPeriod.comparisonLabel,
          unit: "%",
          trend,
          propertyBreakdown,
          instrumentationStatus: {
            status: "PARTIAL",
            message: "Occupancy totals use the calendar availability service. Historical and per-property occupancy series are not yet stored, so they are not estimated here.",
          },
          supportingMetrics: [
            {
              id: "booked_nights",
              label: "Booked Nights",
              value: `${currentDashboard.kpis.occupancy.bookedNights} nights`,
              description: "Total nights reserved across completed and active stays",
            },
            {
              id: "available_nights",
              label: "Available Nights",
              value: `${currentDashboard.kpis.occupancy.availableNights} nights`,
              description: "Open calendar dates available for guest booking",
            },
            {
              id: "total_bookable",
              label: "Total Bookable Inventory",
              value: `${currentDashboard.kpis.occupancy.totalBookableNights} nights`,
              description: "Total inventory excluding host-blocked dates",
            },
          ],
          action: {
            label: "Manage Calendar",
            href: "/host/calendar",
          },
          reportingPeriod: resolvedPeriod,
          selectedListingId: currentDashboard.filterListingId ?? null,
          listings,
        };
      }

      case "bookings": {
        const currVal = currentDashboard.thisMonthSnapshot.bookingsCount;
        const prevVal = compDashboard.thisMonthSnapshot.bookingsCount;
        const { deltaPercentage, deltaDirection } = calcDelta(currVal, prevVal);

        const trend: StatTrendPoint[] = [];
        const propertyBreakdown: StatPropertyBreakdownItem[] = [];

        return {
          metric: "bookings",
          title: "Bookings",
          subtitle: "Total confirmed guest reservations received for the reporting period",
          currentValue: currVal,
          formattedCurrentValue: `${currVal}`,
          previousValue: prevVal,
          formattedPreviousValue: `${prevVal}`,
          deltaPercentage,
          deltaDirection,
          comparisonLabel: resolvedPeriod.comparisonLabel,
          unit: "bookings",
          trend,
          propertyBreakdown,
          supportingMetrics: [
            {
              id: "completed_stays",
              label: "Completed Stays",
              value: `${currentDashboard.kpis.averageStayLength.completedStaysCount}`,
              description: "Stays where guests have completed check-out",
            },
            {
              id: "cancelled_count",
              label: "Cancelled Bookings",
              value: `${currentDashboard.kpis.cancellationRate.totalCancelledCount}`,
              description: "Cancellations across guest and host cancellations",
            },
            {
              id: "booked_nights",
              label: "Total Nights",
              value: `${currentDashboard.kpis.occupancy.bookedNights} nights`,
              description: "Accumulated length across all confirmed bookings",
            },
          ],
          action: {
            label: "View Bookings",
            href: "/host/bookings",
          },
          reportingPeriod: resolvedPeriod,
          selectedListingId: currentDashboard.filterListingId ?? null,
          listings,
          instrumentationStatus: {
            status: "PARTIAL",
            message: "Booking counts use the authoritative dashboard snapshot. Historical and per-property booking series are not stored separately, so they are not reconstructed here.",
          },
        };
      }

      case "rates": {
        const currVal = currentDashboard.kpis.occupancy.bookedNights > 0
          ? Math.round(currentDashboard.earnings.completedPayoutsCents / currentDashboard.kpis.occupancy.bookedNights)
          : 0;
        const prevVal = compDashboard.kpis.occupancy.bookedNights > 0
          ? Math.round(compDashboard.earnings.completedPayoutsCents / compDashboard.kpis.occupancy.bookedNights)
          : 0;
        const { deltaPercentage, deltaDirection } = calcDelta(currVal, prevVal);

        const trend: StatTrendPoint[] = [];
        const propertyBreakdown: StatPropertyBreakdownItem[] = [];

        return {
          metric: "rates",
          title: "Average Nightly Rate",
          subtitle: "Realized gross accommodation revenue earned per booked night",
          currentValue: currVal / 100,
          formattedCurrentValue: formatMoney(currVal),
          previousValue: prevVal / 100,
          formattedPreviousValue: formatMoney(prevVal),
          deltaPercentage,
          deltaDirection,
          comparisonLabel: resolvedPeriod.comparisonLabel,
          unit: currency,
          currency,
          trend,
          propertyBreakdown,
          instrumentationStatus: {
            status: "PARTIAL",
            message: "Average nightly rate is calculated from the authoritative dashboard period total. Per-property and historical rate series are not stored, so they are not inferred.",
          },
          supportingMetrics: [
            {
              id: "abv",
              label: "Average Booking Value",
              value:
                currentDashboard.kpis.averageBookingValue.hostPayoutCents !== null
                  ? formatMoney(currentDashboard.kpis.averageBookingValue.hostPayoutCents)
                  : "—",
              description: "Average net payout received per completed booking",
            },
            {
              id: "stay_length",
              label: "Average Stay Length",
              value: `${currentDashboard.kpis.averageStayLength.nights} nights`,
              description: "Average duration per reservation",
            },
          ],
          action: {
            label: "Review Calendar & Pricing",
            href: "/host/calendar",
          },
          reportingPeriod: resolvedPeriod,
          selectedListingId: currentDashboard.filterListingId ?? null,
          listings,
        };
      }

      case "stay-length": {
        const currVal = currentDashboard.kpis.averageStayLength.nights;
        const prevVal = compDashboard.kpis.averageStayLength.nights;
        const { deltaPercentage, deltaDirection } = calcDelta(currVal, prevVal);

        const trend: StatTrendPoint[] = [];
        const propertyBreakdown: StatPropertyBreakdownItem[] = [];

        return {
          metric: "stay-length",
          title: "Average Stay Length",
          subtitle: "Average number of reserved nights across all completed and confirmed guest stays",
          currentValue: currVal,
          formattedCurrentValue: `${currVal} ${currVal === 1 ? "night" : "nights"}`,
          previousValue: prevVal,
          formattedPreviousValue: `${prevVal} ${prevVal === 1 ? "night" : "nights"}`,
          deltaPercentage,
          deltaDirection,
          comparisonLabel: resolvedPeriod.comparisonLabel,
          unit: "nights",
          trend,
          propertyBreakdown,
          instrumentationStatus: {
            status: "PARTIAL",
            message: "Average stay length uses actual reservations in the selected period. Per-property and historical series are not stored, so they are not inferred.",
          },
          supportingMetrics: [
            {
              id: "booked_nights",
              label: "Total Booked Nights",
              value: `${currentDashboard.kpis.occupancy.bookedNights} nights`,
              description: "Cumulative guest nights in period",
            },
            {
              id: "completed_stays",
              label: "Completed Stays",
              value: `${currentDashboard.kpis.averageStayLength.completedStaysCount} stays`,
              description: "Stays checked out during reporting window",
            },
          ],
          action: {
            label: "View Bookings",
            href: "/host/bookings",
          },
          reportingPeriod: resolvedPeriod,
          selectedListingId: currentDashboard.filterListingId ?? null,
          listings,
        };
      }

      case "response-rate": {
        const currVal = currentDashboard.listingHealth.responseRatePercentage;
        const prevVal = compDashboard.listingHealth.responseRatePercentage;
        const { deltaPercentage, deltaDirection } = calcDelta(currVal, prevVal);

        const avgMins = currentDashboard.listingHealth.averageResponseTimeMinutes;

        const responseTrend = await messagingService.getHostResponseRateTrend(actor.id, {
          endingAt: new Date(`${resolvedPeriod.endDateKey}T23:59:59.999Z`),
          listingId: currentDashboard.filterListingId ?? undefined,
        });
        const trend: StatTrendPoint[] = responseTrend.map((point) => ({
          periodKey: point.monthKey,
          label: point.label,
          value: point.responseRatePercentage,
          secondaryValue: point.totalGuestInquiries,
        }));
        const propertyBreakdown: StatPropertyBreakdownItem[] = [];

        return {
          metric: "response-rate",
          title: "Response Rate",
          subtitle: "Percentage of new guest messages and inquiries answered within 24 hours",
          currentValue: currVal,
          formattedCurrentValue: currVal !== null ? `${currVal}%` : "No inquiries",
          previousValue: prevVal,
          formattedPreviousValue: prevVal !== null ? `${prevVal}%` : "No inquiries",
          deltaPercentage,
          deltaDirection,
          comparisonLabel: resolvedPeriod.comparisonLabel,
          unit: "%",
          benchmark: {
            label: "Superhost Target",
            target: "90% or higher",
            isMet: currVal !== null && currVal >= 90,
          },
          trend,
          propertyBreakdown,
          instrumentationStatus: {
            status: "PARTIAL",
            message: "Response metrics and the monthly trend use qualifying guest inquiries. Historical and per-property response series are not stored as pre-aggregated records, so only the source-backed monthly trend is shown.",
          },
          supportingMetrics: [
            {
              id: "qualifying_inquiries",
              label: "Qualifying Guest Inquiries",
              value: `${currentDashboard.messaging.totalGuestInquiries}`,
              description: "First guest inquiry in each conversation created during the selected period.",
            },
            {
              id: "answered_inquiries",
              label: "Answered Within 24 Hours",
              value: `${currentDashboard.messaging.respondedWithin24hCount}`,
              description: "Qualifying inquiries with a host reply within 24 hours.",
            },
            {
              id: "unanswered_inquiries",
              label: "Unanswered or Late",
              value: `${Math.max(0, currentDashboard.messaging.totalGuestInquiries - currentDashboard.messaging.respondedWithin24hCount)}`,
              description: "Qualifying inquiries without a reply inside the 24-hour response window.",
            },
            {
              id: "resp_time",
              label: "Average Response Time",
              value:
                avgMins !== null
                  ? avgMins < 60
                    ? `${avgMins} mins`
                    : `${Math.round(avgMins / 60)} hours`
                  : "No inquiries",
              description: "Typical speed responding to new guest inquiries",
            },
            {
              id: "superhost_std",
              label: "Superhost Benchmark",
              value: "≥ 90%",
              description: "Evaluation standard across 12-month evaluation window",
            },
          ],
          action: {
            label: "Open Messages",
            href: "/host/messages",
          },
          reportingPeriod: resolvedPeriod,
          selectedListingId: currentDashboard.filterListingId ?? null,
          listings,
        };
      }

      case "cancellations": {
        const currVal = currentDashboard.kpis.cancellationRate.hostPercentage;
        const prevVal = compDashboard.kpis.cancellationRate.hostPercentage;
        const { deltaPercentage, deltaDirection } = calcDelta(currVal, prevVal);

        const trend: StatTrendPoint[] = [];
        const propertyBreakdown: StatPropertyBreakdownItem[] = [];

        return {
          metric: "cancellations",
          title: "Cancellation Rate",
          subtitle: "Percentage of host-initiated cancellations relative to total confirmed bookings",
          currentValue: currVal,
          formattedCurrentValue: `${currVal}%`,
          previousValue: prevVal,
          formattedPreviousValue: `${prevVal}%`,
          deltaPercentage,
          deltaDirection: deltaDirection === "increase" ? "decrease" : "increase", // For cancellations, lower is better
          comparisonLabel: resolvedPeriod.comparisonLabel,
          unit: "%",
          benchmark: {
            label: "Superhost Standard",
            target: "< 1.0%",
            isMet: currVal < 1.0,
          },
          trend,
          propertyBreakdown,
          instrumentationStatus: {
            status: "PARTIAL",
            message: "Cancellation classification uses authoritative booking records. Historical and per-property series are not stored, so they are not inferred.",
          },
          supportingMetrics: [
            {
              id: "host_cancels",
              label: "Host Cancellations",
              value: `${currentDashboard.kpis.cancellationRate.hostCancelledCount} cancellations`,
              description: "Direct host-initiated cancellations",
            },
            {
              id: "guest_cancels",
              label: "Guest Cancellations",
              value: `${currentDashboard.kpis.cancellationRate.guestCancelledCount} cancellations`,
              description: "Guest-requested cancellations under property policy",
            },
            {
              id: "superhost_thresh",
              label: "Superhost Threshold",
              value: "< 1.0%",
              description: "Maintain cancellation rate below 1% to qualify for Superhost",
            },
          ],
          action: {
            label: "Review Calendar & Policies",
            href: "/host/calendar",
          },
          reportingPeriod: resolvedPeriod,
          selectedListingId: currentDashboard.filterListingId ?? null,
          listings,
        };
      }

      case "views": {
        return {
          metric: "views",
          title: "Listing Views",
          subtitle: "Total impressions and unique guest page views on your listing details pages",
          currentValue: null,
          formattedCurrentValue: "Data Provisioning",
          previousValue: null,
          formattedPreviousValue: "—",
          deltaPercentage: null,
          deltaDirection: "neutral",
          comparisonLabel: resolvedPeriod.comparisonLabel,
          unit: "views",
          trend: [],
          propertyBreakdown: listings.map((l) => ({
            listingId: l.id,
            listingTitle: l.title,
            value: null,
            formattedValue: "Provisioning",
            secondaryLabel: "Live on Homyz",
          })),
          supportingMetrics: [
            {
              id: "telemetry_notice",
              label: "Telemetry Status",
              value: "In Progress",
              description: currentDashboard.listingPerformance.pageViews.message,
            },
            {
              id: "active_listings",
              label: "Active Listings",
              value: `${currentDashboard.listingPerformance.activeListings} published`,
              description: "Listings currently discoverable in search results",
            },
          ],
          instrumentationStatus: {
            status: "DATA_UNAVAILABLE",
            message: currentDashboard.listingPerformance.pageViews.message,
          },
          action: {
            label: "View Listings",
            href: "/host/listings",
          },
          reportingPeriod: resolvedPeriod,
          selectedListingId: currentDashboard.filterListingId ?? null,
          listings,
        };
      }

      case "conversion": {
        return {
          metric: "conversion",
          title: "Booking Conversion",
          subtitle: "Ratio of guest browsing activity and inquiries converting into confirmed bookings",
          currentValue: null,
          formattedCurrentValue: "Data Provisioning",
          previousValue: null,
          formattedPreviousValue: "—",
          deltaPercentage: null,
          deltaDirection: "neutral",
          comparisonLabel: resolvedPeriod.comparisonLabel,
          unit: "%",
          trend: [],
          propertyBreakdown: listings.map((l) => ({
            listingId: l.id,
            listingTitle: l.title,
            value: null,
            formattedValue: "Provisioning",
            secondaryLabel: `${currentDashboard.thisMonthSnapshot.bookingsCount} bookings`,
          })),
          supportingMetrics: [
            {
              id: "funnel_notice",
              label: "Funnel Telemetry",
              value: "In Progress",
              description: currentDashboard.listingPerformance.conversionRate.message,
            },
            {
              id: "confirmed_stays",
              label: "Confirmed Bookings",
              value: `${currentDashboard.thisMonthSnapshot.bookingsCount} bookings`,
              description: "Real verified booking conversions completed",
            },
          ],
          instrumentationStatus: {
            status: "DATA_UNAVAILABLE",
            message: currentDashboard.listingPerformance.conversionRate.message,
          },
          action: {
            label: "View Opportunities",
            href: "/host/insights?tab=opportunities",
          },
          reportingPeriod: resolvedPeriod,
          selectedListingId: currentDashboard.filterListingId ?? null,
          listings,
        };
      }
    }
  },
};
