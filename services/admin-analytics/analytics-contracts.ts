/**
 * Comprehensive KPI Definitions Registry & Unified Analytics Contracts
 * 
 * Every metric supported by the Homyz Admin Analytics platform is defined here with its:
 * - Metric identifier and user-facing title
 * - Category and measurement unit
 * - Authoritative database source
 * - Exact mathematical formula
 * - Included and excluded statuses
 * - Date dimension (Transaction timestamp vs. Stay calendar date)
 * - Handling of missing data and comparison policies
 */

export type MetricCategory = "FINANCIAL" | "BOOKING" | "OCCUPANCY" | "OPERATIONAL";
export type MetricUnit = "CURRENCY_CENTS" | "COUNT" | "PERCENTAGE" | "MINUTES" | "DAYS";

export interface KpiDefinition {
  id: string;
  name: string;
  category: MetricCategory;
  unit: MetricUnit;
  description: string;
  source: string;
  formula: string;
  includedStatuses: string[];
  excludedStatuses: string[];
  dateDimension: "TRANSACTION_TIMESTAMP" | "STAY_CALENDAR_DATE" | "CASE_TIMESTAMP";
  missingDataPolicy: string;
  comparisonPolicy: string;
  knownLimitations?: string;
}

export const KPI_REGISTRY: Record<string, KpiDefinition> = {
  // FINANCIAL KPIS
  GROSS_BOOKING_VALUE: {
    id: "gross_booking_value",
    name: "Gross Booking Value (GMV)",
    category: "FINANCIAL",
    unit: "CURRENCY_CENTS",
    description: "Total monetary value of stays reserved within the reporting period.",
    source: "Booking.totalPrice / Booking.priceBreakdown.guestTotal",
    formula: "SUM(Booking.totalPrice)",
    includedStatuses: ["CONFIRMED", "COMPLETED"],
    excludedStatuses: ["PENDING", "CANCELLED", "EXPIRED", "REJECTED"],
    dateDimension: "TRANSACTION_TIMESTAMP",
    missingDataPolicy: "Fallback to Booking.totalPrice if JSON snapshot absent.",
    comparisonPolicy: "Percentage delta vs prior window of identical length.",
  },
  CAPTURED_PAYMENT_VOLUME: {
    id: "captured_payment_volume",
    name: "Captured Payment Volume",
    category: "FINANCIAL",
    unit: "CURRENCY_CENTS",
    description: "Actual cash successfully captured through payment gateways.",
    source: "BookingPayment.capturedAmount",
    formula: "SUM(BookingPayment.capturedAmount)",
    includedStatuses: ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED"],
    excludedStatuses: ["PENDING", "AUTHORIZED", "FAILED", "VOIDED"],
    dateDimension: "TRANSACTION_TIMESTAMP",
    missingDataPolicy: "Excludes records without successful capture timestamp.",
    comparisonPolicy: "Percentage delta vs prior window.",
  },
  REFUNDED_VOLUME: {
    id: "refunded_volume",
    name: "Refunded Volume",
    category: "FINANCIAL",
    unit: "CURRENCY_CENTS",
    description: "Total monetary cash returned to guests across settled refunds.",
    source: "BookingRefund.amount (where status = SUCCEEDED)",
    formula: "SUM(BookingRefund.amount)",
    includedStatuses: ["SUCCEEDED"],
    excludedStatuses: ["PENDING", "APPROVED", "REJECTED", "FAILED"],
    dateDimension: "TRANSACTION_TIMESTAMP",
    missingDataPolicy: "Cross-checked with BookingPayment.refundedAmount to ensure 0 double counting.",
    comparisonPolicy: "Percentage delta vs prior window.",
  },
  NET_COLLECTED_CASH: {
    id: "net_collected_cash",
    name: "Net Collected Cash",
    category: "FINANCIAL",
    unit: "CURRENCY_CENTS",
    description: "Net cash inflow held by platform after deducting refunds.",
    source: "Derived from BookingPayment and BookingRefund",
    formula: "Captured Payment Volume - Refunded Volume",
    includedStatuses: ["CAPTURED", "PARTIALLY_REFUNDED", "REFUNDED", "SUCCEEDED"],
    excludedStatuses: ["FAILED", "PENDING", "VOIDED"],
    dateDimension: "TRANSACTION_TIMESTAMP",
    missingDataPolicy: "Zero if no payments captured.",
    comparisonPolicy: "Percentage delta vs prior window.",
  },
  PLATFORM_COMMISSION: {
    id: "platform_commission",
    name: "Platform Commission (Revenue)",
    category: "FINANCIAL",
    unit: "CURRENCY_CENTS",
    description: "Revenue earned by Homyz platform from completed stays and confirmed fees.",
    source: "Booking.priceBreakdown.payoutBreakdown.hostServiceFee",
    formula: "SUM(hostServiceFee) [or 3% standard rate if snapshot explicitly absent]",
    includedStatuses: ["CONFIRMED", "COMPLETED"],
    excludedStatuses: ["CANCELLED", "PENDING", "EXPIRED", "REJECTED"],
    dateDimension: "TRANSACTION_TIMESTAMP",
    missingDataPolicy: "Flags data quality warning when 3% fallback is required.",
    comparisonPolicy: "Percentage delta vs prior window.",
  },
  NET_HOST_PAYOUTS: {
    id: "net_host_payouts",
    name: "Net Host Earnings / Payouts",
    category: "FINANCIAL",
    unit: "CURRENCY_CENTS",
    description: "Total funds allocated to property hosts after deducting platform fees.",
    source: "Booking.priceBreakdown.payoutBreakdown.netHostPayout",
    formula: "SUM(accommodationSubtotal + cleaningFee - hostServiceFee)",
    includedStatuses: ["CONFIRMED", "COMPLETED"],
    excludedStatuses: ["CANCELLED", "PENDING"],
    dateDimension: "TRANSACTION_TIMESTAMP",
    missingDataPolicy: "Excludes records without valid host payout breakdown.",
    comparisonPolicy: "Percentage delta vs prior window.",
  },
  PENDING_PAYOUT_LIABILITY: {
    id: "pending_payout_liability",
    name: "Pending Host Settlements",
    category: "FINANCIAL",
    unit: "CURRENCY_CENTS",
    description: "Disbursement obligations queued for future SARIE bank payout.",
    source: "BookingPayoutDistribution.amountCents",
    formula: "SUM(amountCents) WHERE status = 'SCHEDULED' AND isHeld = false",
    includedStatuses: ["SCHEDULED"],
    excludedStatuses: ["PAID", "FAILED", "CANCELLED"],
    dateDimension: "TRANSACTION_TIMESTAMP",
    missingDataPolicy: "Zero if no scheduled distributions.",
    comparisonPolicy: "Current point-in-time balance.",
  },
  HELD_PAYOUT_LIABILITY: {
    id: "held_payout_liability",
    name: "Held Payouts",
    category: "FINANCIAL",
    unit: "CURRENCY_CENTS",
    description: "Host payout obligations currently frozen due to disputes or compliance holds.",
    source: "BookingPayoutDistribution.amountCents",
    formula: "SUM(amountCents) WHERE isHeld = true",
    includedStatuses: ["SCHEDULED", "PROCESSING"],
    excludedStatuses: ["PAID", "CANCELLED"],
    dateDimension: "TRANSACTION_TIMESTAMP",
    missingDataPolicy: "Zero if no active holds.",
    comparisonPolicy: "Current point-in-time balance.",
  },
  ACCOMMODATION_REVENUE: {
    id: "accommodation_revenue",
    name: "Accommodation Revenue",
    category: "FINANCIAL",
    unit: "CURRENCY_CENTS",
    description: "Net room night revenue generated excluding cleaning, taxes, and service fees.",
    source: "Booking.priceBreakdown.accommodationSubtotal",
    formula: "SUM(nightlySubtotal - discountAmount)",
    includedStatuses: ["CONFIRMED", "COMPLETED"],
    excludedStatuses: ["CANCELLED", "PENDING", "EXPIRED", "REJECTED"],
    dateDimension: "STAY_CALENDAR_DATE",
    missingDataPolicy: "Falls back to Booking.totalPrice minus cleaning fee if snapshot absent.",
    comparisonPolicy: "Percentage delta vs prior window.",
  },
  GUEST_SERVICE_FEES: {
    id: "guest_service_fees",
    name: "Guest Service Fees",
    category: "FINANCIAL",
    unit: "CURRENCY_CENTS",
    description: "Platform service charges levied directly on guest reservations.",
    source: "Booking.priceBreakdown.guestServiceFee",
    formula: "SUM(guestServiceFee)",
    includedStatuses: ["CONFIRMED", "COMPLETED"],
    excludedStatuses: ["CANCELLED", "PENDING"],
    dateDimension: "TRANSACTION_TIMESTAMP",
    missingDataPolicy: "Zero if guest service fee is 0.",
    comparisonPolicy: "Percentage delta vs prior window.",
  },
  HOST_SERVICE_FEES: {
    id: "host_service_fees",
    name: "Host Service Fees",
    category: "FINANCIAL",
    unit: "CURRENCY_CENTS",
    description: "Commission fees deducted from host accommodation subtotal.",
    source: "Booking.priceBreakdown.payoutBreakdown.hostServiceFee",
    formula: "SUM(hostServiceFee)",
    includedStatuses: ["CONFIRMED", "COMPLETED"],
    excludedStatuses: ["CANCELLED", "PENDING"],
    dateDimension: "TRANSACTION_TIMESTAMP",
    missingDataPolicy: "Falls back to 3% estimated commission if snapshot absent.",
    comparisonPolicy: "Percentage delta vs prior window.",
  },
  CLEANING_FEES: {
    id: "cleaning_fees",
    name: "Cleaning Fees",
    category: "FINANCIAL",
    unit: "CURRENCY_CENTS",
    description: "Total cleaning turnover fees collected on reservations.",
    source: "Booking.cleaningFee / Booking.priceBreakdown.cleaningFee",
    formula: "SUM(cleaningFee)",
    includedStatuses: ["CONFIRMED", "COMPLETED"],
    excludedStatuses: ["CANCELLED", "PENDING"],
    dateDimension: "TRANSACTION_TIMESTAMP",
    missingDataPolicy: "Zero if no cleaning fee.",
    comparisonPolicy: "Percentage delta vs prior window.",
  },
  TAXES_COLLECTED: {
    id: "taxes_collected",
    name: "Taxes Collected",
    category: "FINANCIAL",
    unit: "CURRENCY_CENTS",
    description: "Total municipal, hospitality, and VAT taxes collected on bookings.",
    source: "Booking.priceBreakdown.taxTotal / ReservationTax.taxAmount",
    formula: "SUM(taxTotal)",
    includedStatuses: ["CONFIRMED", "COMPLETED"],
    excludedStatuses: ["CANCELLED", "PENDING"],
    dateDimension: "TRANSACTION_TIMESTAMP",
    missingDataPolicy: "Zero if no taxes levied.",
    comparisonPolicy: "Percentage delta vs prior window.",
  },
  DISCOUNTS_TOTAL: {
    id: "discounts_total",
    name: "Discounts Total",
    category: "FINANCIAL",
    unit: "CURRENCY_CENTS",
    description: "Total promotional, weekly/monthly, and non-refundable discounts granted to guests.",
    source: "Booking.priceBreakdown.discountAmount",
    formula: "SUM(discountAmount)",
    includedStatuses: ["CONFIRMED", "COMPLETED"],
    excludedStatuses: ["CANCELLED", "PENDING"],
    dateDimension: "TRANSACTION_TIMESTAMP",
    missingDataPolicy: "Zero if no discount applied.",
    comparisonPolicy: "Percentage delta vs prior window.",
  },
  SETTLED_HOST_PAYOUTS: {
    id: "settled_host_payouts",
    name: "Settled Host Payouts",
    category: "FINANCIAL",
    unit: "CURRENCY_CENTS",
    description: "Actual funds successfully transferred to host bank accounts or SARIE rail.",
    source: "BookingPayoutDistribution.amountCents (where status = PAID)",
    formula: "SUM(amountCents) WHERE status = 'PAID'",
    includedStatuses: ["PAID"],
    excludedStatuses: ["SCHEDULED", "PROCESSING", "FAILED", "CANCELLED"],
    dateDimension: "TRANSACTION_TIMESTAMP",
    missingDataPolicy: "Zero if no payouts settled in window.",
    comparisonPolicy: "Percentage delta vs prior window.",
  },
  OUTSTANDING_PAYOUT_LIABILITY: {
    id: "outstanding_payout_liability",
    name: "Outstanding Payout Liability",
    category: "FINANCIAL",
    unit: "CURRENCY_CENTS",
    description: "Total pending and held host payout obligations awaiting settlement.",
    source: "BookingPayoutDistribution.amountCents (where status IN ('SCHEDULED', 'PROCESSING'))",
    formula: "SUM(amountCents) WHERE status IN ('SCHEDULED', 'PROCESSING')",
    includedStatuses: ["SCHEDULED", "PROCESSING"],
    excludedStatuses: ["PAID", "CANCELLED"],
    dateDimension: "TRANSACTION_TIMESTAMP",
    missingDataPolicy: "Zero if no pending distributions.",
    comparisonPolicy: "Current point-in-time balance.",
  },

  // BOOKING KPIS
  CONFIRMED_BOOKINGS: {
    id: "confirmed_bookings",
    name: "Confirmed Bookings",
    category: "BOOKING",
    unit: "COUNT",
    description: "Number of reservations confirmed and locked into property calendars.",
    source: "Booking.status",
    formula: "COUNT(Booking.id) WHERE status = 'CONFIRMED'",
    includedStatuses: ["CONFIRMED"],
    excludedStatuses: ["PENDING", "CANCELLED", "EXPIRED", "REJECTED"],
    dateDimension: "TRANSACTION_TIMESTAMP",
    missingDataPolicy: "Exact count.",
    comparisonPolicy: "Percentage delta vs prior window.",
  },
  COMPLETED_STAYS: {
    id: "completed_stays",
    name: "Completed Stays",
    category: "BOOKING",
    unit: "COUNT",
    description: "Stays where guest checkout has passed without cancellation.",
    source: "Booking.status and Booking.endDate",
    formula: "COUNT(Booking.id) WHERE status = 'COMPLETED' OR (status = 'CONFIRMED' AND endDate <= NOW())",
    includedStatuses: ["COMPLETED", "CONFIRMED"],
    excludedStatuses: ["CANCELLED", "PENDING", "EXPIRED", "REJECTED"],
    dateDimension: "STAY_CALENDAR_DATE",
    missingDataPolicy: "Evaluated strictly via stay checkout calendar date.",
    comparisonPolicy: "Percentage delta vs prior window.",
  },
  CANCELLATION_RATE: {
    id: "cancellation_rate",
    name: "Cancellation Rate",
    category: "BOOKING",
    unit: "PERCENTAGE",
    description: "Proportion of total bookings created in period that were cancelled.",
    source: "Booking.status",
    formula: "(Cancelled Bookings / Total Created Bookings) * 100",
    includedStatuses: ["CANCELLED", "CONFIRMED", "COMPLETED", "PENDING"],
    excludedStatuses: [],
    dateDimension: "TRANSACTION_TIMESTAMP",
    missingDataPolicy: "Null if total bookings = 0.",
    comparisonPolicy: "Absolute percentage point change.",
  },
  AVERAGE_LENGTH_OF_STAY: {
    id: "average_length_of_stay",
    name: "Average Length of Stay (ALOS)",
    category: "BOOKING",
    unit: "DAYS",
    description: "Average number of reserved nights per confirmed booking.",
    source: "Booking.startDate and Booking.endDate",
    formula: "SUM(differenceInBookingNights(startDate, endDate)) / COUNT(confirmed bookings)",
    includedStatuses: ["CONFIRMED", "COMPLETED"],
    excludedStatuses: ["CANCELLED", "PENDING"],
    dateDimension: "TRANSACTION_TIMESTAMP",
    missingDataPolicy: "Null if confirmed bookings = 0.",
    comparisonPolicy: "Delta in days.",
  },
  AVERAGE_BOOKING_VALUE: {
    id: "average_booking_value",
    name: "Average Booking Value (ABV)",
    category: "BOOKING",
    unit: "CURRENCY_CENTS",
    description: "Average Gross Booking Value per confirmed reservation.",
    source: "Booking.totalPrice",
    formula: "Gross Booking Value / Confirmed Bookings",
    includedStatuses: ["CONFIRMED", "COMPLETED"],
    excludedStatuses: ["CANCELLED", "PENDING"],
    dateDimension: "TRANSACTION_TIMESTAMP",
    missingDataPolicy: "Null if confirmed bookings = 0.",
    comparisonPolicy: "Percentage delta vs prior window.",
  },

  // OCCUPANCY KPIS
  BOOKABLE_NIGHTS: {
    id: "bookable_nights",
    name: "Bookable Room Nights",
    category: "OCCUPANCY",
    unit: "COUNT",
    description: "Total inventory nights eligible for guest reservations (excluding host/admin blocks).",
    source: "Listing calendar inventory engine (calculateSharedDashboardInventory)",
    formula: "Total Property Nights - Host Blocked Nights",
    includedStatuses: ["ACTIVE", "PUBLISHED"],
    excludedStatuses: ["DRAFT", "SUSPENDED", "INACTIVE"],
    dateDimension: "STAY_CALENDAR_DATE",
    missingDataPolicy: "Zero if no published active listings.",
    comparisonPolicy: "Percentage delta vs prior window.",
    knownLimitations: "Listing.blockedDates stores current calendar blocks; historical unblocks cannot be retroactively proven.",
  },
  BOOKED_NIGHTS: {
    id: "booked_nights",
    name: "Sold / Booked Room Nights",
    category: "OCCUPANCY",
    unit: "COUNT",
    description: "Total room nights reserved under confirmed bookings within the reporting window.",
    source: "Booking.startDate and Booking.endDate clipped to date range",
    formula: "SUM(nights where startDate <= date < endDate AND status = 'CONFIRMED')",
    includedStatuses: ["CONFIRMED", "COMPLETED"],
    excludedStatuses: ["CANCELLED", "PENDING"],
    dateDimension: "STAY_CALENDAR_DATE",
    missingDataPolicy: "Zero if no stays span the period.",
    comparisonPolicy: "Percentage delta vs prior window.",
  },
  OCCUPANCY_RATE: {
    id: "occupancy_rate",
    name: "Marketplace Occupancy Rate",
    category: "OCCUPANCY",
    unit: "PERCENTAGE",
    description: "Proportion of available bookable inventory nights occupied by confirmed guests.",
    source: "Derived from Booked Nights and Bookable Nights",
    formula: "(Booked Nights / Bookable Nights) * 100",
    includedStatuses: ["CONFIRMED", "ACTIVE"],
    excludedStatuses: [],
    dateDimension: "STAY_CALENDAR_DATE",
    missingDataPolicy: "Null if bookable nights = 0 (never returns artificial 0%).",
    comparisonPolicy: "Absolute percentage point change.",
  },
  AVERAGE_DAILY_RATE: {
    id: "average_daily_rate",
    name: "Average Daily Rate (ADR)",
    category: "OCCUPANCY",
    unit: "CURRENCY_CENTS",
    description: "Average realized accommodation price per sold room night.",
    source: "Booking.nightlyPrice or base accommodation subtotal",
    formula: "Eligible Accommodation Revenue / Sold Room Nights",
    includedStatuses: ["CONFIRMED", "COMPLETED"],
    excludedStatuses: ["CANCELLED", "PENDING"],
    dateDimension: "STAY_CALENDAR_DATE",
    missingDataPolicy: "Null if sold nights = 0.",
    comparisonPolicy: "Percentage delta vs prior window.",
  },
  REVPAR: {
    id: "revpar",
    name: "Revenue Per Available Room (RevPAR)",
    category: "OCCUPANCY",
    unit: "CURRENCY_CENTS",
    description: "Total accommodation revenue divided by total bookable room inventory.",
    source: "Derived from Accommodation Revenue and Bookable Nights",
    formula: "Eligible Accommodation Revenue / Bookable Nights = ADR * Occupancy Rate",
    includedStatuses: ["CONFIRMED", "ACTIVE"],
    excludedStatuses: [],
    dateDimension: "STAY_CALENDAR_DATE",
    missingDataPolicy: "Null if bookable nights = 0.",
    comparisonPolicy: "Percentage delta vs prior window.",
  },

  // OPERATIONAL KPIS
  TOTAL_SUPPORT_CASES: {
    id: "total_support_cases",
    name: "Total Support Cases Created",
    category: "OPERATIONAL",
    unit: "COUNT",
    description: "Total guest and host customer service cases opened within the reporting period.",
    source: "SupportCase.createdAt",
    formula: "COUNT(SupportCase.id)",
    includedStatuses: ["ALL"],
    excludedStatuses: [],
    dateDimension: "CASE_TIMESTAMP",
    missingDataPolicy: "Exact database count.",
    comparisonPolicy: "Percentage delta vs prior window.",
  },
  ACTIVE_BACKLOG_CASES: {
    id: "active_backlog_cases",
    name: "Active Support Backlog",
    category: "OPERATIONAL",
    unit: "COUNT",
    description: "Support cases currently pending agent action or investigation.",
    source: "SupportCase.status",
    formula: "COUNT(SupportCase.id) WHERE status NOT IN ('RESOLVED', 'CLOSED')",
    includedStatuses: ["OPEN", "IN_REVIEW", "WAITING_FOR_ADMIN", "WAITING_FOR_USER", "REOPENED", "ESCALATED"],
    excludedStatuses: ["RESOLVED", "CLOSED"],
    dateDimension: "CASE_TIMESTAMP",
    missingDataPolicy: "Exact database count.",
    comparisonPolicy: "Current backlog count.",
  },
  OVERDUE_SLA_CASES: {
    id: "overdue_sla_cases",
    name: "Overdue SLA Cases",
    category: "OPERATIONAL",
    unit: "COUNT",
    description: "Active cases that have breached their target resolution deadline.",
    source: "SupportCase.slaDueAt and SupportCase.status",
    formula: "COUNT(SupportCase.id) WHERE slaDueAt < NOW() AND status NOT IN ('RESOLVED', 'CLOSED')",
    includedStatuses: ["OPEN", "IN_REVIEW", "REOPENED", "ESCALATED"],
    excludedStatuses: ["RESOLVED", "CLOSED"],
    dateDimension: "CASE_TIMESTAMP",
    missingDataPolicy: "Zero if no overdue cases.",
    comparisonPolicy: "Current point-in-time count.",
  },
  FIRST_RESPONSE_SLA_COMPLIANCE: {
    id: "first_response_sla_compliance",
    name: "First Response SLA Compliance",
    category: "OPERATIONAL",
    unit: "PERCENTAGE",
    description: "Percentage of cases where the first administrative reply was delivered before firstResponseDueAt.",
    source: "SupportCase.firstResponseDueAt and SupportCaseMessage.createdAt",
    formula: "(Cases Responded On-Time / Total Cases with Due Date) * 100",
    includedStatuses: ["ALL"],
    excludedStatuses: [],
    dateDimension: "CASE_TIMESTAMP",
    missingDataPolicy: "Null if no cases require first response.",
    comparisonPolicy: "Absolute percentage point change.",
  },
  RESOLUTION_SLA_COMPLIANCE: {
    id: "resolution_sla_compliance",
    name: "Resolution SLA Compliance",
    category: "OPERATIONAL",
    unit: "PERCENTAGE",
    description: "Percentage of resolved cases that met the target resolution SLA deadline.",
    source: "SupportCase.resolvedAt and SupportCase.slaDueAt",
    formula: "(Cases Resolved On-Time / Total Resolved Cases with Due Date) * 100",
    includedStatuses: ["RESOLVED", "CLOSED"],
    excludedStatuses: [],
    dateDimension: "CASE_TIMESTAMP",
    missingDataPolicy: "Null if no resolved cases in period.",
    comparisonPolicy: "Absolute percentage point change.",
  },
};

// SHARED ANALYTICS TYPES
export type ComparisonMode = "previous_period" | "previous_year" | "none";

export interface MetricDelta<T = number> {
  current: T;
  previous: T | null;
  absoluteChange: T;
  percentageChange: number | null;
  isPositive?: boolean;
  isPercentagePoint?: boolean;
}

export interface TimeframeContext {
  period: string;
  label: string;
  startDateKey: string;
  endDateKey: string;
  startIso: string;
  endIso: string;
  comparisonLabel: string;
  comparisonMode?: ComparisonMode;
  previousStartDateKey: string | null;
  previousEndDateKey: string | null;
}

export interface AnalyticsFilterInput {
  period?: "today" | "yesterday" | "7d" | "30d" | "this_month" | "last_month" | "90d" | "this_year" | "custom";
  startDate?: string;
  endDate?: string;
  comparisonMode?: ComparisonMode;
  listingId?: string;
  hostId?: string;
  city?: string;
  country?: string;
  currency?: string;
  status?: string;
}

export interface DataQualityWarning {
  code: string;
  message: string;
  affectedMetrics: string[];
  scope?: "overview" | "revenue" | "occupancy" | "operations" | "global" | string;
  isEstimated?: boolean;
}

export interface UnifiedAnalyticsResponse<TData> {
  timeframe: TimeframeContext;
  filters: Record<string, string | undefined>;
  currency: string;
  data: TData;
  dataQualityWarnings: DataQualityWarning[];
  generatedAt: string;
}

// ============================================================================
// PHASE 5 — ENTERPRISE REPORTING, ALERTS, SCHEDULER & COHORT CONTRACTS
// ============================================================================

// 1. CANONICAL FINANCIAL RECONCILIATION CONTRACT
export interface CanonicalFinancialSnapshot {
  grossBookingValueCents: number;
  accommodationRevenueCents: number;
  guestServiceFeeCents: number;
  hostServiceFeeCents: number;
  platformCommissionCents: number;
  taxesCollectedCents: number;
  cleaningFeesCents: number;
  discountsGrantedCents: number;
  capturedPaymentVolumeCents: number;
  successfulRefundVolumeCents: number;
  netCollectedCashCents: number;
  netHostPayoutCents: number;
  outstandingPayoutLiabilityCents: number;
  settledHostPayoutsCents: number;
  currency: string;
}

// 2. CUSTOM REPORT BUILDER CONTRACTS
export type EnterpriseReportType =
  | "EXECUTIVE_SUMMARY"
  | "REVENUE_AND_FINANCE"
  | "BOOKINGS"
  | "OCCUPANCY"
  | "PROPERTY_PERFORMANCE"
  | "HOST_PERFORMANCE"
  | "PAYMENTS"
  | "REFUNDS"
  | "PAYOUTS"
  | "COMPLAINTS"
  | "DISPUTES"
  | "OPERATIONAL_PERFORMANCE";

export type ReportExportFormat = "CSV" | "XLSX" | "PDF";

export interface CustomReportFilterConfig {
  reportType: EnterpriseReportType;
  period?: "today" | "yesterday" | "7d" | "30d" | "this_month" | "last_month" | "90d" | "this_year" | "custom";
  startDate?: string;
  endDate?: string;
  comparisonMode?: ComparisonMode;
  listingId?: string;
  hostId?: string;
  city?: string;
  country?: string;
  currency?: string;
  bookingStatus?: string;
  columns?: string[];
  outputFormat?: ReportExportFormat;
}

export interface SavedReportConfig {
  id: string;
  name: string;
  description?: string;
  reportType: EnterpriseReportType;
  filters: CustomReportFilterConfig;
  outputFormat: ReportExportFormat;
  ownerId: string;
  ownerName?: string;
  isPublic?: boolean;
  scheduleId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReportPreviewResult {
  title: string;
  reportType: EnterpriseReportType;
  timeframe: TimeframeContext;
  filters: CustomReportFilterConfig;
  summaryKpis: Array<{
    id: string;
    label: string;
    value: string | number;
    delta?: MetricDelta<number> | null;
  }>;
  columns: Array<{ key: string; label: string; align?: "left" | "right" | "center" }>;
  previewRows: Array<Record<string, any>>;
  totalRecords: number;
  dataQualityWarnings: DataQualityWarning[];
}

// 3. SCHEDULED AUTOMATED REPORTS CONTRACTS
export type ScheduleFrequency = "DAILY" | "WEEKLY" | "MONTHLY";
export type ScheduleStatus = "ACTIVE" | "PAUSED" | "DISABLED";

export interface ReportScheduleConfig {
  id: string;
  name: string;
  reportType: EnterpriseReportType;
  filters: CustomReportFilterConfig;
  outputFormat: ReportExportFormat;
  frequency: ScheduleFrequency;
  deliveryTimeUtc: string; // "HH:MM" e.g. "06:00"
  deliveryDayOfWeek?: number; // 1 (Mon) to 7 (Sun)
  deliveryDayOfMonth?: number; // 1 to 28/31
  deliveryTimezone: string;
  recipientEmails: string[];
  status: ScheduleStatus;
  lastRunAt?: string | null;
  nextRunAt: string;
  lastStatus?: "SUCCESS" | "FAILED" | "PENDING";
  lastErrorMessage?: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleExecutionRecord {
  id: string;
  scheduleId: string;
  scheduleName: string;
  executedAt: string;
  status: "SUCCESS" | "FAILED";
  recipientCount: number;
  outputFormat: ReportExportFormat;
  downloadUrl?: string;
  errorMessage?: string | null;
  durationMs: number;
}

// 4. ALERTS & ANOMALY DETECTION CONTRACTS
export type AlertMetric =
  | "REVENUE_DROP"
  | "REFUND_SPIKE"
  | "PAYMENT_FAILURE_SPIKE"
  | "COMMISSION_DISCREPANCY"
  | "UNSETTLED_PAYOUT_ACCUMULATION"
  | "BOOKING_CANCELLATION_SPIKE"
  | "BOOKING_DROP"
  | "REJECTION_SPIKE"
  | "OCCUPANCY_DROP"
  | "ADR_DECLINE"
  | "OVERDUE_SLA_SURGE"
  | "SLA_COMPLIANCE_DROP";

export type AlertSeverity = "INFO" | "WARNING" | "CRITICAL";
export type AlertLifecycleStatus = "TRIGGERED" | "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";

export interface AlertRuleConfig {
  id: string;
  name: string;
  metric: AlertMetric;
  evaluationWindow: "24h" | "7d" | "30d";
  thresholdValue: number; // e.g. -20 for 20% drop, or 10 for 10% refund spike
  comparisonBasis: "PREVIOUS_PERIOD" | "PREVIOUS_YEAR" | "FIXED_TARGET";
  severity: AlertSeverity;
  notificationChannels: Array<"IN_APP" | "EMAIL">;
  cooldownHours: number;
  isEnabled: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertInstance {
  id: string;
  ruleId: string;
  ruleName: string;
  metric: AlertMetric;
  severity: AlertSeverity;
  status: AlertLifecycleStatus;
  whatChanged: string;
  currentValue: number;
  referenceValue: number;
  threshold: number;
  evaluationPeriod: string;
  dataSource: string;
  limitationsNote?: string;
  triggeredAt: string;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  resolvedAt?: string | null;
}

// 5. COHORT, RETENTION & MARKETPLACE GROWTH CONTRACTS
export interface HostCohortEntry {
  cohortMonth: string; // YYYY-MM
  totalHostsRegistered: number;
  publishedFirstListing: number;
  firstBookingReceived: number;
  retained30d: number;
  retained60d: number;
  retained90d: number;
  retentionRate30d: number; // percentage
  retentionRate60d: number;
  retentionRate90d: number;
}

export interface GuestRetentionData {
  totalUniqueGuests: number;
  firstTimeGuests: number;
  repeatGuests: number;
  repeatRatePercentage: number;
  secondBookingConversionRate: number;
  averageBookingsPerGuest: number;
  repeatCohortTrends: Array<{
    cohortMonth: string;
    guestCount: number;
    repeatCount: number;
    repeatRate: number;
  }>;
}

export interface MarketplaceGrowthInsights {
  hostAcquisitionTrend: Array<{ dateKey: string; count: number }>;
  listingPublicationFunnel: {
    registeredHosts: number;
    createdListingDraft: number;
    publishedListings: number;
    bookedListings: number;
  };
  hostCohorts: HostCohortEntry[];
  guestRetention: GuestRetentionData;
}


