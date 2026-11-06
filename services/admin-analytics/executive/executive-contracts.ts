/**
 * Executive Board Analytics & Investor Reporting Contracts - Phase 10
 * Types and interfaces for high-level board packages and executive analytics.
 */

export interface ExecutiveKpiSummary {
  grossBookingValueCents: number;
  platformFeeRevenueCents: number;
  netCollectedCashCents: number;
  bookingGrowthPct: number;
  occupancyRatePct: number;
  adrCents: number;
  revParCents: number;
  activeHostsCount: number;
  activeListingsCount: number;
  repeatGuestRatePct: number;
  supportSlaCompliancePct: number;
  refundRatePct: number;
  reconciliationExceptionsCount: number;
}

export interface BoardReportPackage {
  reportId: string;
  reportingPeriod: string;
  presentationCurrency: "SAR" | "USD" | "EUR" | "GBP";
  dateGenerated: string;
  generatedByActorId: string;
  accountingBasis: "ACCRUAL";
  isAudited: false; // Explicit disclosure: unaudited internal management accounts
  reconciliationStatus: "RECONCILED" | "EXCEPTIONS_PENDING";
  dataQualityLimitations: string[];

  // Section A — Executive Summary
  executiveSummary: {
    periodHighlight: string;
    macroPerformance: string;
    kpis: ExecutiveKpiSummary;
  };

  // Section B — Revenue & Finance
  revenueAndFinance: {
    grossBookingValueCents: number;
    platformFeeRevenueCents: number;
    netCollectedCashCents: number;
    totalRefundsCents: number;
    hostPayoutObligationsCents: number;
    settledPayoutsCents: number;
    netContributionMarginCents: number;
  };

  // Section C — Marketplace Operations
  marketplaceOperations: {
    totalReservationsCount: number;
    confirmedNightsStayed: number;
    cancellationRatePct: number;
    averageLengthOfStayDays: number;
    activeListingInventory: number;
  };

  // Section D — Guest & Host Growth
  growthAndCohorts: {
    repeatGuestBookingPct: number;
    averageGuestBookingFrequency: number;
    hostRetentionRate90dPct: number;
    newHostAcquisitionsCount: number;
  };

  // Section E — Risk & Compliance
  riskAndCompliance: {
    supportCaseSlaCompliancePct: number;
    totalDisputesLogged: number;
    activeAnomalyAlertsCount: number;
    unresolvedReconciliationDiscrepancies: number;
  };

  // Section F — Forecasts & Business Outlook
  forecastOutlook: {
    nextQuarterProjectedRevenueCents: number;
    projectedOccupancyRatePct: number;
    forecastModelVersion: string;
    uncertaintyIntervalPct: number;
    keyMacroAssumptions: string[];
  };

  // Section G — Financial Statements (Unaudited Management Accounts)
  financialStatements: {
    profitAndLossSummary: {
      grossMarketplaceBookings: number;
      platformRevenue: number;
      directGatewayExpenses: number;
      grossOperatingProfit: number;
    };
    balanceSheetSummary: {
      cashAndEquivalents: number;
      inTransitClearing: number;
      hostPayoutLiabilities: number;
      vatAndTaxPayable: number;
      retainedEarnings: number;
    };
  };
}

