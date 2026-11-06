/**
 * Phase 11 — Controlled Two-Way ERP Synchronization Contracts
 * Defines data ownership, bidirectional sync payloads, conflict detection,
 * and safe write policies between Homyz and External ERPs (QuickBooks, Xero, NetSuite).
 */

import type { AccountingProvider, AccountingJournalEntry } from "./accounting-contracts";

/**
 * Data Ownership Model:
 * - HOMYZ_OWNED: Booking records, guest charges, refunds, host payout settlements. External ERP cannot overwrite.
 * - ERP_OWNED: External journal IDs, provider posting statuses, Chart of Accounts definitions, provider timestamps.
 * - SHARED_ADJUSTMENT: Manual adjustments, tax corrections. Requires explicit human CFO/Admin approval.
 */
export type ErpDataOwnershipType = "HOMYZ_OWNED" | "ERP_OWNED" | "SHARED_ADJUSTMENT";

export type ErpSyncDirection = "OUTBOUND" | "INBOUND";

export type ErpSyncTrigger = "SCHEDULED_BATCH" | "MANUAL_TRIGGER" | "WEBHOOK_EVENT" | "RETRY_CYCLE";

export type ErpSyncStatus =
  | "PENDING"
  | "IN_TRANSIT"
  | "SUCCESS"
  | "PARTIAL_SUCCESS"
  | "FAILED"
  | "CONFLICT_DETECTED"
  | "BLOCKED_BY_GUARDRAIL";

export type ErpConflictType =
  | "POST_EXPORT_MODIFICATION"      // Homyz record changed (e.g. refund/cancellation) after journal was exported to ERP
  | "MAPPING_DRIFT"                  // ERP Chart of Accounts changed or an account was deleted/renamed in ERP
  | "CLOSED_PERIOD_CONFLICT"        // Period was closed in Homyz or ERP, preventing retroactive writes
  | "BALANCE_MISMATCH"              // External ERP reported balance diverges from Homyz expected balance
  | "UNAUTHORIZED_FIELD_OVERWRITE"  // ERP inbound payload attempted to overwrite Homyz-owned core fields
  | "DUPLICATE_IDEMPOTENCY_KEY";    // Duplicate sync attempt detected with mismatched content

export type ErpConflictResolutionAction =
  | "CREATE_REVERSAL_JOURNAL"       // Post offsetting debits/credits in current open period
  | "ACCEPT_ERP_REFERENCE"          // Accept remote journal ID and sync metadata without modifying amounts
  | "REJECT_INBOUND_ADJUSTMENT"     // Reject remote proposed modification with logged audit trail
  | "POST_DIFFERENCE_ADJUSTMENT"    // Post minor variance to designated suspense/clearing account
  | "REMAP_CHART_OF_ACCOUNTS"       // Update Homyz ledger mapping to align with external ERP
  | "MANUAL_CFO_OVERRIDE";          // CFO manually signs off on resolution

export interface ErpConflictRecord {
  id: string;
  provider: AccountingProvider;
  entityId: string;
  sourceEntityType: string;
  sourceEntityId: string;
  journalEntryId?: string;
  conflictType: ErpConflictType;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  detectedAt: string;
  resolvedAt?: string | null;
  resolutionAction?: ErpConflictResolutionAction | null;
  resolvedByActorId?: string | null;
  description: string;
  homyzValue: Record<string, unknown>;
  erpValue: Record<string, unknown>;
  resolutionNotes?: string | null;
}

/**
 * Inbound Sync Record: Represents an incoming update or proposed adjustment from ERP.
 * Note: External ERP changes NEVER directly mutate Homyz booking, payment, refund, or payout records.
 */
export interface ErpInboundPayload {
  provider: AccountingProvider;
  entityId: string;
  externalTransactionId: string;
  externalJournalId?: string;
  externalPostingDate: string;
  idempotencyKey: string;
  journalEntryId?: string;
  syncStatus: "POSTED" | "VOIDED" | "ADJUSTED";
  proposedAdjustments?: Array<{
    accountCode: string;
    debitCents: number;
    creditCents: number;
    memo: string;
  }>;
  externalAuditInfo?: {
    auditorName?: string;
    modifiedAt?: string;
    changeReason?: string;
  };
}

export interface ErpSyncBatchSummary {
  batchId: string;
  direction: ErpSyncDirection;
  provider: AccountingProvider;
  entityId: string;
  trigger: ErpSyncTrigger;
  totalRecords: number;
  succeededRecords: number;
  failedRecords: number;
  conflictedRecords: number;
  startedAt: string;
  completedAt?: string | null;
  status: ErpSyncStatus;
  errors: Array<{
    recordId: string;
    errorCode: string;
    message: string;
  }>;
  conflicts: ErpConflictRecord[];
}

export interface TwoWaySyncState {
  provider: AccountingProvider;
  entityId: string;
  isTwoWaySyncEnabled: boolean;
  autoResolveMinorDrift: boolean;
  minorDriftThresholdCents: number; // e.g. 100 cents ($1 / 1 SAR)
  lastOutboundSyncAt: string | null;
  lastInboundSyncAt: string | null;
  pendingOutboundJournals: number;
  unresolvedConflictsCount: number;
  activeIdempotencyKeysCount: number;
}

