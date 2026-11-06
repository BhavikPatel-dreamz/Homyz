import { bookingDateKey, parseBookingDate, shiftBookingDateKey } from "@/lib/booking/booking-date";
import { isWeekendNight } from "@/lib/pricing/price-tips";
import { pricingDataService } from "./pricing-data.service";
import { demandFactorService } from "./demand-factor.service";
import { pricingConstraintsService } from "./pricing-constraints.service";
import type {
  DailyPricingRecommendation,
  PricingConstraintLimits,
  PricingRecommendationResult,
} from "./pricing-contracts";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const recommendationEngineService = {
  /**
   * Generates intelligent, constraint-bounded nightly pricing recommendations.
   */
  async generateRecommendations(params: {
    listingId: string;
    horizonDays?: number;
    startDate?: Date;
    maxDailyChangePercentage?: number;
  }): Promise<PricingRecommendationResult> {
    const horizonDays = Math.min(Math.max(params.horizonDays || 30, 7), 90);
    const startDate = params.startDate || new Date();
    const startDateKey = bookingDateKey(startDate);

    // 1. Retrieve Listing & Market Pricing Context
    const context = await pricingDataService.getListingPricingContext(
      params.listingId,
      horizonDays,
      startDate
    );

    const limits: PricingConstraintLimits = {
      systemMinPriceCents: 5000, // 50 SAR minimum
      systemMaxPriceCents: 5000000, // 50,000 SAR maximum
      hostFloorPriceCents: context.smartPricingMinPriceCents,
      hostCeilingPriceCents: context.smartPricingMaxPriceCents,
      maxDailyChangePercentage: params.maxDailyChangePercentage ?? 15,
      currency: context.currency,
    };

    const recommendations: DailyPricingRecommendation[] = [];
    let curDateKey = startDateKey;
    let totalDelta = 0;
    let adjustmentsCount = 0;
    let potentialRevenueOpportunity = 0;
    let lockedBookedCount = 0;

    for (let i = 0; i < horizonDays; i++) {
      const d = parseBookingDate(curDateKey);
      const dayLabel = `${DAY_LABELS[d.getUTCDay()]}, ${d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })}`;

      const isWeekend = isWeekendNight(curDateKey);
      const isBooked = context.confirmedBookedDates.has(curDateKey);
      const isBlocked = context.blockedDates.includes(curDateKey);
      const hasManualOverride = Boolean(context.customPrices[curDateKey]);

      const currentPriceCents = pricingDataService.resolveCurrentPrice(context, curDateKey);

      // 2. Evaluate Demand Adjustment
      const demand = demandFactorService.evaluateDemandFactor(
        curDateKey,
        {
          marketOccupancyRate: context.marketOccupancyRate,
          historicalPaceAheadPercentage: context.historicalPaceAheadPercentage,
          hasManualOverride,
        },
        startDate
      );

      // Raw unconstrained recommendation
      const rawRecommendedPrice = Math.round(currentPriceCents * demand.demandMultiplier);

      // 3. Apply Multi-Layer Pricing Constraints
      const constraint = pricingConstraintsService.applyPricingConstraints({
        currentPriceCents,
        rawRecommendedPriceCents: rawRecommendedPrice,
        isBooked,
        limits,
      });

      if (isBooked) {
        lockedBookedCount++;
      } else if (constraint.constrainedPriceCents !== currentPriceCents) {
        adjustmentsCount++;
        totalDelta += constraint.deltaPercentage;
        if (constraint.constrainedPriceCents > currentPriceCents) {
          potentialRevenueOpportunity += constraint.constrainedPriceCents - currentPriceCents;
        }
      }

      recommendations.push({
        dateKey: curDateKey,
        dayLabel,
        isWeekend,
        isBooked,
        isBlocked,
        hasManualOverride,
        currentPriceCents,
        recommendedPriceCents: constraint.constrainedPriceCents,
        unconstrainedPriceCents: constraint.unconstrainedPriceCents,
        deltaPercentage: constraint.deltaPercentage,
        appliedConstraints: constraint.appliedConstraints,
        demandSignal: demand.primarySignal,
        marketOccupancyPercentage: demand.marketOccupancyPercentage,
        explanation: demand.explanation,
        forecastConfidence: "HIGH",
        actionStatus: isBooked ? "LOCKED_BOOKED" : "PENDING_REVIEW",
      });

      curDateKey = shiftBookingDateKey(curDateKey, 1);
    }

    const avgDelta =
      adjustmentsCount > 0 ? Math.round((totalDelta / adjustmentsCount) * 10) / 10 : 0;

    return {
      listingId: context.id,
      listingTitle: context.title,
      city: context.city,
      currency: context.currency,
      basePriceCents: context.weekdayBasePriceCents,
      smartPricingEnabled: context.smartPricingEnabled,
      autoApplyPolicy: false, // Strict safety: disabled by default
      horizonDays,
      summary: {
        datesAnalyzedCount: horizonDays,
        recommendedAdjustmentsCount: adjustmentsCount,
        averageDeltaPercentage: avgDelta,
        potentialRevenueOpportunityCents: potentialRevenueOpportunity,
        lockedBookedDatesCount: lockedBookedCount,
      },
      recommendations,
      constraintsSummary: limits,
      dataFreshnessTimestamp: new Date().toISOString(),
    };
  },
};

