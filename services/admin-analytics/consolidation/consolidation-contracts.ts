/**
 * Multi-Entity Cross-Border Financial Consolidation Contracts - Phase 9 & Phase 10
 * Types and interfaces for legal entities, intercompany eliminations, currency translation, and period closing.
 */

export interface LegalEntity {
  entityId: string;
  legalName: string;
  countryCode: string;
  functionalCurrency: "SAR" | "USD" | "EUR" | "GBP";
  parentEntityId: string | null;
  taxRegistrationNumber?: string;
  erpProvider: "QUICKBOOKS" | "XERO" | "NETSUITE" | "INTERNAL";
  erpTenantId: string;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
}

export interface EntityFinancialPerformance {
  entityId: string;
  legalName: string;
  functionalCurrency: string;
  period: string;
  grossBookingValueMinor: number;
  accommodationRevenueMinor: number;
  platformFeeRevenueMinor: number;
  intercompanyRevenueMinor?: number;
  intercompanyExpenseMinor?: number;
  collectedCashMinor: number;
  refundsSettledMinor: number;
  hostPayoutLiabilitiesMinor: number;
  hostPayoutsSettledMinor: number;
  taxesCollectedMinor: number;
  gatewayFeesMinor: number;
}

export interface IntercompanyTransaction {
  transactionId: string;
  fromEntityId: string;
  toEntityId: string;
  amountMinor: number;
  currency: string;
  transactionType: "MANAGEMENT_FEE" | "GATEWAY_PROCESSING_REIMBURSEMENT" | "PLATFORM_COMMISSION_SHARE" | "INTERCOMPANY_LOAN";
  description: string;
  eliminated: boolean;
  dateKey: string;
  // Specific journal accounts to reverse
  sourceRevenueAccountRole: string; // e.g. "4020_INTERCOMPANY_MANAGEMENT_REVENUE"
  counterpartyExpenseAccountRole: string; // e.g. "5030_INTERCOMPANY_MANAGEMENT_EXPENSE"
  sourceReceivableAccountRole?: string; // e.g. "1040_INTERCOMPANY_RECEIVABLE"
  counterpartyPayableAccountRole?: string; // e.g. "2040_INTERCOMPANY_PAYABLE"
}

export interface ConsolidatedEntityBreakdown {
  entityId: string;
  legalName: string;
  functionalCurrency: string;
  balancesInFunctionalCurrency: Record<string, number>;
  balancesInPresentationCurrency: Record<string, number>;
  exchangeRateApplied: number;
  exchangeRateSource: string;
}

export type PeriodCloseStatus = "OPEN" | "REVIEW" | "APPROVED" | "CLOSED";

export interface PeriodCloseRecord {
  period: string;
  status: PeriodCloseStatus;
  closedAt?: string | null;
  closedByActorId?: string | null;
  snapshotHash?: string | null;
  approvedAdjustments: Array<{
    adjustmentId: string;
    accountRole: string;
    amountMinor: number;
    reason: string;
    approvedBy: string;
    approvedAt: string;
  }>;
}

export interface ConsolidatedFinancialStatement {
  statementId: string;
  presentationCurrency: "SAR" | "USD" | "EUR" | "GBP";
  period: string;
  asOfDate: string;
  periodCloseStatus: PeriodCloseStatus;
  entitiesIncluded: string[];
  entityBreakdowns: ConsolidatedEntityBreakdown[];
  intercompanyEliminations: Array<{
    eliminationId: string;
    transactionReference: string;
    sourceEntityId: string;
    counterpartyEntityId: string;
    description: string;
    debitRole: string;
    creditRole: string;
    amountMinorInPresentation: number;
  }>;
  consolidatedTotals: {
    grossBookingValueMinor: number;
    platformFeeRevenueMinor: number;
    collectedCashMinor: number;
    refundsSettledMinor: number;
    hostPayoutLiabilitiesMinor: number;
    hostPayoutsSettledMinor: number;
    taxesCollectedMinor: number;
    gatewayFeesMinor: number;
    netOperatingMarginMinor: number;
  };
  currencyTranslationAdjustmentMinor: number;
  reconciliationExceptions: string[];
  isReconciled: boolean;
}
