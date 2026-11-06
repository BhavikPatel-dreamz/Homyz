/**
 * Automated Financial Reconciliation & Self-Healing Contracts - Phase 10
 * Types and interfaces for financial discrepancy detection, self-healing execution, and audit logging.
 */

export type ReconciliationDiscrepancyType =
  | "MISSING_PAYMENT_WEBHOOK"
  | "DUPLICATE_WEBHOOK_EVENT"
  | "CAPTURED_AMOUNT_MISMATCH"
  | "REFUND_STATUS_MISMATCH"
  | "STALE_PENDING_TRANSACTION"
  | "PAYOUT_STATUS_DESYNC"
  | "UNKNOWN_GATEWAY_OUTCOME";

export type ReconciliationEntityType = "PAYMENT" | "REFUND" | "PAYOUT" | "BOOKING";

export type DiscrepancyResolutionStatus = "DETECTED" | "HEALED" | "REQUIRES_MANUAL_REVIEW" | "DISMISSED";

export interface ReconciliationDiscrepancy {
  id: string;
  discrepancyType: ReconciliationDiscrepancyType;
  entityType: ReconciliationEntityType;
  referenceId: string; // paymentId, refundId, payoutId
  bookingId: string;
  provider: "STRIPE" | "MADA" | "SARIE" | "INTERNAL";
  localStatus: string;
  providerStatus: string | null;
  localAmountCents: number;
  providerAmountCents: number | null;
  currency: string;
  isEligibleForAutoHealing: boolean;
  remediationAction: string;
  status: DiscrepancyResolutionStatus;
  evidence: Record<string, unknown>;
  detectedAt: string;
  resolvedAt?: string | null;
  resolvedByActorId?: string | null;
}

export interface ReconciliationAuditEntry {
  jobId: string;
  discrepancyId: string;
  referenceId: string;
  actionApplied: string;
  previousState: string;
  newState: string;
  evidenceSource: string;
  timestamp: string;
  actorId: string;
}

export interface ReconciliationSummary {
  totalScanned: number;
  discrepanciesFoundCount: number;
  autoHealedCount: number;
  manualReviewRequiredCount: number;
  unresolvedExceptionsCount: number;
  lastRunAt: string;
}

