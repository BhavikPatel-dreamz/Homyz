export type ForecastHorizon = "7d" | "30d" | "90d";

export type ForecastReliabilityStatus = "HIGH" | "MODERATE" | "LOW_DATA" | "INSUFFICIENT_DATA";

export interface ForecastPointEstimate {
  dateKey: string; // YYYY-MM-DD
  dayLabel: string;
  confirmedBookings: number; // Already confirmed future reservations
  projectedAdditionalBookings: number; // Expected incremental pickup
  totalExpectedBookings: number; // confirmed + projected
  confirmedNights: number;
  projectedAdditionalNights: number;
  totalExpectedNights: number;
  projectedOccupancyPercentage: number;
  confirmedGmvCents: number;
  projectedAdditionalGmvCents: number;
  totalExpectedGmvCents: number;
  projectedCommissionCents: number;
  lowerBoundGmvCents: number; // Lower 80% confidence bound
  upperBoundGmvCents: number; // Upper 80% confidence bound
}

export interface BookingPaceMetric {
  leadTimeDaysBucket: string; // e.g. "0-3d", "4-7d", "8-14d", "15-30d", "31d+"
  historicalSharePercentage: number;
  currentCycleSharePercentage: number;
  paceVariancePercentage: number; // current vs historical pace
}

export interface ForecastValidationMetrics {
  backtestedPeriodsCount: number;
  meanAbsoluteErrorGmvCents: number;
  weightedAbsolutePercentageError: number; // WAPE percentage (e.g. 7.4%)
  meanForecastBiasPercentage: number; // Positive = overprediction, Negative = underprediction
  predictionIntervalCoveragePercentage: number; // % of actuals falling within [lower, upper] bounds
  baselineComparisonAdvantagePercentage: number; // Relative % error reduction over naive baseline
  absolutePercentagePointAdvantage?: number; // Absolute difference in percentage points (pp)
}

export interface DemandForecastResult {
  horizon: ForecastHorizon;
  currency: string;
  startDateKey: string;
  endDateKey: string;
  generatedAt: string;
  modelVersion: string; // e.g. "Homyz-PACE-v1.4"
  reliabilityStatus: ForecastReliabilityStatus;
  dataCoveragePercentage: number;
  // Summary Aggregates
  summary: {
    totalExpectedGmvCents: number;
    confirmedFutureGmvCents: number;
    projectedAdditionalGmvCents: number;
    totalExpectedNights: number;
    projectedOccupancyPercentage: number;
    expectedPlatformCommissionCents: number;
    currentBookingPaceStatus: "AHEAD_OF_PACE" | "ON_PACE" | "BEHIND_OF_PACE";
    paceVariancePercentage: number;
  };
  // Daily Projections
  dailyProjections: ForecastPointEstimate[];
  // Booking Pickup Curves & Pace
  paceDistribution: BookingPaceMetric[];
  // Backtesting Validation
  validation: ForecastValidationMetrics;
  // Data Limitations & Assumptions
  assumptions: string[];
  dataQualityNotes: string[];
}

