import { adminBusinessOverviewService } from "@/services/admin-business-overview.service";
import { revenueAnalyticsService } from "./revenue.service";
import { occupancyAnalyticsService } from "./occupancy.service";
import { operationsAnalyticsService } from "./operations.service";
import type {
  AnalyticsFilterInput,
  DataQualityWarning,
  MetricDelta,
  UnifiedAnalyticsResponse,
} from "./analytics-contracts";
import { normalizeAnalyticsTimeframe } from "./analytics-filters";
import { normalizeDataQualityWarnings } from "./warning-normalization";

export interface UnifiedOverviewKpis {
  grossBookingValueCents: MetricDelta<number>;
  platformCommissionCents: MetricDelta<number>;
  capturedCashCents: MetricDelta<number>;
  confirmedBookingsCount: MetricDelta<number>;
  activeListingsCount: MetricDelta<number>;
  occupancyRatePercentage: MetricDelta<number>;
  averageDailyRateCents: MetricDelta<number>;
  activeBacklogCases: number;
  activeDisputesCount: number;
}

export interface OverviewDailySeriesPoint {
  dateKey: string;
  label: string;
  revenueCents: number;
  bookingsCount: number;
  occupancyRatePercentage: number | null;
}

export interface UnifiedOverviewData {
  kpis: UnifiedOverviewKpis;
  chartPoints: OverviewDailySeriesPoint[];
  operationalAttention: Array<{
    id: string;
    title: string;
    count: number;
    description?: string;
    severity: "critical" | "urgent" | "attention" | "all-clear";
    href: string;
    actionLabel?: string;
    category?: string;
  }>;
  recentBookings: Array<{
    id: string;
    guestName: string;
    guestEmail: string;
    guestImage?: string | null;
    listingTitle: string;
    city?: string | null;
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
    city?: string | null;
    bookingsCount: number;
    revenueCents: number;
  }>;
}

export const adminAnalyticsOverviewService = {
  async getUnifiedOverview(
    input: AnalyticsFilterInput = {}
  ): Promise<UnifiedAnalyticsResponse<UnifiedOverviewData>> {
    const norm = normalizeAnalyticsTimeframe(input);
    const currency = input.currency || "SAR";
    const warnings: DataQualityWarning[] = [];

    // Parallel fetch from domain services
    const [overviewCore, revRes, occRes, opsRes] = await Promise.all([
      adminBusinessOverviewService.getOverview({
        period: (input.period as any) || "30d",
        from: input.startDate,
        to: input.endDate,
      }),
      revenueAnalyticsService.getRevenueAnalytics(input),
      occupancyAnalyticsService.getOccupancyAnalytics(input),
      operationsAnalyticsService.getOperationsAnalytics(input),
    ]);

    const combinedWarnings = [
      ...revRes.dataQualityWarnings,
      ...occRes.dataQualityWarnings,
      ...opsRes.dataQualityWarnings,
    ];
    warnings.push(...normalizeDataQualityWarnings(combinedWarnings));

    // Build unified daily series
    const occMap = new Map(occRes.data.dailyTrends.map((d) => [d.dateKey, d.occupancyRatePercentage]));

    const chartPoints: OverviewDailySeriesPoint[] = overviewCore.chartPoints.map((pt) => ({
      dateKey: pt.date,
      label: pt.label,
      revenueCents: pt.revenueCents,
      bookingsCount: pt.bookingsCount,
      occupancyRatePercentage: occMap.get(pt.date) ?? null,
    }));

    const isNoComparison = norm.context.comparisonMode === "none";

    const kpis: UnifiedOverviewKpis = {
      grossBookingValueCents: revRes.data.breakdown.grossBookingValueCents,
      platformCommissionCents: revRes.data.breakdown.platformCommissionCents,
      capturedCashCents: revRes.data.breakdown.netCollectedCashCents,
      confirmedBookingsCount: {
        current: overviewCore.kpi.confirmedBookingsCount,
        previous: isNoComparison ? 0 : Math.round(overviewCore.kpi.confirmedBookingsCount / (1 + (overviewCore.kpi.confirmedBookingsDelta || 0) / 100)),
        absoluteChange: 0,
        percentageChange: isNoComparison ? null : overviewCore.kpi.confirmedBookingsDelta,
      },
      activeListingsCount: {
        current: overviewCore.kpi.activeListingsCount,
        previous: isNoComparison ? 0 : Math.round(overviewCore.kpi.activeListingsCount / (1 + (overviewCore.kpi.activeListingsDelta || 0) / 100)),
        absoluteChange: 0,
        percentageChange: isNoComparison ? null : overviewCore.kpi.activeListingsDelta,
      },
      occupancyRatePercentage: occRes.data.kpis.occupancyRatePercentage,
      averageDailyRateCents: occRes.data.kpis.averageDailyRateCents,
      activeBacklogCases: opsRes.data.kpis.activeBacklogCases,
      activeDisputesCount: opsRes.data.kpis.activeDisputesCount,
    };

    let recentBookings = overviewCore.recentBookings;
    let topListings = overviewCore.topListings;

    if (input.listingId) {
      topListings = topListings.filter((l) => l.id === input.listingId);
    }
    if (input.city) {
      const cityQuery = input.city.toLowerCase();
      recentBookings = recentBookings.filter((b) => b.city?.toLowerCase().includes(cityQuery));
      topListings = topListings.filter((l) => l.city?.toLowerCase().includes(cityQuery));
    }

    return {
      timeframe: norm.context,
      filters: {
        listingId: input.listingId,
        hostId: input.hostId,
        city: input.city,
        country: input.country,
        currency,
        comparisonMode: norm.context.comparisonMode,
      },
      currency,
      data: {
        kpis,
        chartPoints,
        operationalAttention: overviewCore.operationalAttention,
        recentBookings,
        topListings,
      },
      dataQualityWarnings: warnings,
      generatedAt: new Date().toISOString(),
    };
  },
};

