/**
 * Dispute Intelligence & Anomaly Management Contracts - Phase 9
 * Types and interfaces for explainable risk assessment, case summarization, and anomaly alerts.
 */

export type RiskEntityType = "SUPPORT_CASE" | "BOOKING" | "LISTING" | "USER";

export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type DataQualityGrade = "SUFFICIENT" | "LIMITED" | "INSUFFICIENT";

export interface OperationalRiskAssessment {
  entityType: RiskEntityType;
  entityId: string;
  score: number | null; // 0 to 100
  severity: RiskSeverity;
  reasons: string[];
  observedAt: string;
  dataQuality: DataQualityGrade;
  recommendedAction: string;
  requiresHumanReview: boolean;
}

export interface CaseTimelineEntry {
  timestamp: string;
  event: string;
  actorRole: "GUEST" | "HOST" | "ADMIN" | "SYSTEM";
  details?: string;
}

export interface DisputeCaseSummary {
  caseNumber: string;
  caseId: string;
  bookingReference: string;
  complaintCategory: string;
  timeline: CaseTimelineEntry[];
  priorEscalationHistory: Array<{
    escalatedAt: string;
    reason?: string;
    level?: number;
  }>;
  associatedRefundOrPayoutStatus: {
    refundAmountCents?: number;
    refundStatus?: string;
    payoutStatus?: string;
    eligibleBookingTotalCents?: number;
  };
  applicableSla: {
    slaDueAt?: string | null;
    isBreached: boolean;
    slaPolicyVersion?: string | null;
  };
  missingEvidence: string[];
  reasonForReview: string;
  isAIGenerated: boolean;
  sourceRecordsVerified: boolean;
}

export type AnomalyCategory = "PAYMENT" | "REFUND" | "BOOKING" | "SUPPORT" | "OCCUPANCY";

export type AnomalyAlertStatus = "ACTIVE" | "ACKNOWLEDGED" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";

export interface OperationalAnomalyAlert {
  alertId: string;
  category: AnomalyCategory;
  metric: string;
  actualValue: number;
  baselineValue: number;
  reportingPeriod: string;
  threshold: number;
  severity: RiskSeverity;
  relevantEntities: string[];
  explanation: string;
  dataQualityWarning?: string;
  status: AnomalyAlertStatus;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

