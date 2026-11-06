export type PricingDemandSignal =
  | "HIGH_DEMAND_WEEKEND"
  | "STRONG_BOOKING_PACE"
  | "PEAK_SEASONAL_SURGE"
  | "MODERATE_STABLE_DEMAND"
  | "LOW_OCCUPANCY_STIMULATION"
  | "LAST_MINUTE_UNSOLD"
  | "INSUFFICIENT_MARKET_DATA";

export interface PricingConstraintLimits {
  systemMinPriceCents: number; // Global floor, e.g. 5,000 cents (50 SAR)
  systemMaxPriceCents: number; // Global ceiling, e.g. 5,000,000 cents (50,000 SAR)
  hostFloorPriceCents?: number | null; // smartPricingMinPrice
  hostCeilingPriceCents?: number | null; // smartPricingMaxPrice
  maxDailyChangePercentage: number; // e.g. 15% (clamps recommended delta to [-15%, +15%])
  currency: string;
}

export interface DailyPricingRecommendation {
  dateKey: string; // YYYY-MM-DD
  dayLabel: string; // e.g. "Thu, Nov 12"
  isWeekend: boolean; // Saudi weekend (Thu/Fri)
  isBooked: boolean; // True if confirmed reservation already covers this date
  isBlocked: boolean; // True if host blocked
  hasManualOverride: boolean; // True if host has set a customPrice
  currentPriceCents: number;
  recommendedPriceCents: number;
  unconstrainedPriceCents: number;
  deltaPercentage: number; // e.g. +12.5% or -8.0%
  appliedConstraints: string[]; // e.g. ["HOST_FLOOR_CLAMPED", "MAX_DAILY_CHANGE_LIMITED"]
  demandSignal: PricingDemandSignal;
  marketOccupancyPercentage: number;
  explanation: string; // Clear, human-readable reason
  forecastConfidence: "HIGH" | "MODERATE" | "LOW_DATA";
  actionStatus: "PENDING_REVIEW" | "ACCEPTED" | "REJECTED" | "LOCKED_BOOKED";
}

export interface PricingRecommendationResult {
  listingId: string;
  listingTitle: string;
  city: string;
  currency: string;
  basePriceCents: number;
  smartPricingEnabled: boolean;
  autoApplyPolicy: boolean; // Must be false by default
  horizonDays: number;
  summary: {
    datesAnalyzedCount: number;
    recommendedAdjustmentsCount: number;
    averageDeltaPercentage: number;
    potentialRevenueOpportunityCents: number;
    lockedBookedDatesCount: number;
  };
  recommendations: DailyPricingRecommendation[];
  constraintsSummary: PricingConstraintLimits;
  dataFreshnessTimestamp: string;
}

export interface PricingActionAuditRecord {
  id: string;
  listingId: string;
  dateKey: string;
  actorId: string;
  previousPriceCents: number;
  newPriceCents: number;
  reason: string;
  action: "ACCEPTED" | "REJECTED" | "REVERTED" | "MANUAL_OVERRIDE";
  timestamp: string;
}

