/**
 * AI-Assisted Host Revenue Advisory Contracts - Phase 11
 * Grounded conversational advisory for hosts scoped strictly to their authenticated listings.
 */

export type HostAdvisoryQueryType =
  | "BOOKING_DECREASE"       // "Why did my bookings decrease this month?"
  | "WEEKEND_PRICING"        // "Should I increase my weekend price?"
  | "REVENUE_OPTIMIZATION"   // "How can I improve my listing revenue?"
  | "AMENITY_ROI"            // "Which amenities should I add?"
  | "CUSTOM_QUESTION";       // Custom host inquiry

export interface AdvisoryMetricSnapshot {
  listingId: string;
  listingTitle: string;
  currentBasePriceMinor: number;
  currency: string;
  currentOccupancyRate: number;      // e.g. 0.45 (45%)
  marketAverageOccupancyRate: number; // e.g. 0.58 (58%)
  leadTimeDays: number;              // Average days between booking and check-in
  forwardDemandTrend: "SURGING" | "STABLE" | "DECLINING";
  autoPilotEnabled: boolean;
  autoPilotMode: string;
  weekendPriceMultiplier: number;
}

export interface AdvisoryRecommendationAction {
  id: string;
  actionTitle: string;
  description: string;
  impactConfidence: "HIGH" | "MEDIUM" | "ESTIMATIVE";
  estimatedMonthlyUpliftMinor?: number; // In minor currency units (cents/halalas)
  suggestedSettingChange?: {
    settingKey: string;
    currentValue: string | number | boolean;
    proposedValue: string | number | boolean;
    dashboardDeepLink: string;
  };
}

export interface HostAdvisoryResponse {
  queryId: string;
  listingId: string;
  hostId: string;
  queryType: HostAdvisoryQueryType;
  userQuery: string;
  summaryAnswer: string;
  keyInsights: string[];
  recommendations: AdvisoryRecommendationAction[];
  metricSnapshot: AdvisoryMetricSnapshot;
  groundedDataSources: string[]; // e.g. ["recommendationEngineService", "forecastDataService", "occupancyService"]
  promptInjectionDetected: boolean;
  guardrails: {
    isAdvisoryOnly: true;
    peerDataRedacted: true;
    guestPaymentDataRedacted: true;
    disclaimer: string;
  };
  generatedAt: string;
}

export interface SuggestedHostPrompt {
  id: string;
  queryType: HostAdvisoryQueryType;
  promptText: string;
  shortDescription: string;
}

