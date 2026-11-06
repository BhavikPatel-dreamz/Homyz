/**
 * Customer & Host Lifetime Intelligence & Churn Contracts - Phase 9
 * Types and interfaces for Guest LTV, Host Retention, and Churn Risk Modeling.
 */

export interface GuestCohortEntry {
  cohortMonth: string;
  totalGuests: number;
  repeatGuests: number;
  retention30d: number;
  retention60d: number;
  retention90d: number;
  retention180d: number;
  retention12m: number;
  retentionRate30d: number;
  retentionRate90d: number;
  isMatured: boolean;
}

export interface GuestLtvMetrics {
  totalRegisteredGuests: number;
  firstTimeGuests: number;
  repeatGuests: number;
  repeatRatePercentage: number;
  averageBookingFrequency: number;
  averageGrossBookingValueCents: number;
  averagePlatformRevenueCents: number;
  averageContributionLtvCents: number;
  averageDaysBetweenBookings: number;
  cohorts: GuestCohortEntry[];
}

export interface HostMilestoneCohortEntry {
  cohortMonth: string;
  totalHostsRegistered: number;
  publishedFirstListing: number;
  firstBookingReceived: number;
  active30d: number;
  active60d: number;
  active90d: number;
  active180d: number;
  active12m: number;
  retentionRate30d: number;
  retentionRate90d: number;
  isMatured: boolean;
}

export interface HostLtvMetrics {
  totalRegisteredHosts: number;
  hostsWithPublishedListings: number;
  hostsWithConfirmedBookings: number;
  activeListingsCount: number;
  totalGrossBookingValueAttributableCents: number;
  totalPlatformRevenueAttributableCents: number;
  averageRevenuePerHostCents: number;
  cohorts: HostMilestoneCohortEntry[];
}

export type ChurnRiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface ChurnRiskAssessment {
  entityType: "GUEST" | "HOST";
  entityId: string;
  riskLevel: ChurnRiskLevel;
  riskScore: number; // 0 to 100
  contributingFactors: string[];
  observationPeriod: string;
  modelVersion: string;
  dataSufficiency: "SUFFICIENT" | "LIMITED" | "INSUFFICIENT";
  recommendedIntervention: string;
}

export interface ChurnModelEvaluation {
  modelVersion: string;
  evaluatedAt: string;
  precision: number;
  recall: number;
  falsePositiveRate: number;
  f1Score: number;
  validationSampleSize: number;
  dataLeakagePrevented: boolean;
}

