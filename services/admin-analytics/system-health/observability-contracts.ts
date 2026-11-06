/**
 * Production Observability, SOC 2 & Disaster Recovery Contracts - Phase 10
 * Types and interfaces for system health, SOC 2 control evidence, and disaster recovery readiness.
 */

export type ServiceStatusGrade = "HEALTHY" | "DEGRADED" | "OUTAGE";

export interface ComponentHealthCheck {
  component: string;
  status: ServiceStatusGrade;
  latencyMs: number;
  lastCheckedAt: string;
  message?: string;
  metrics?: Record<string, number | string | boolean>;
}

export interface SystemHealthOverview {
  overallStatus: ServiceStatusGrade;
  components: ComponentHealthCheck[];
  activeIncidentCount: number;
  unresolvedFinancialExceptionsCount: number;
  workerQueueDepth: number;
  timestamp: string;
}

export type Soc2ControlStatus = "VERIFIED_READY" | "EXCEPTION_DETECTED" | "AUDITOR_EXAMINATION_PENDING";

export interface Soc2ControlEvidence {
  controlId: string; // e.g. CC6.1, CC6.6, CC7.1
  title: string;
  category: "ACCESS_CONTROL" | "DATA_PROTECTION" | "AUDIT_LOGGING" | "DISASTER_RECOVERY" | "SYSTEM_OPERATIONS";
  responsibleTeam: string;
  status: Soc2ControlStatus;
  lastVerifiedAt: string;
  evidenceSource: string;
  notes: string;
}

export interface DisasterRecoveryStatus {
  targetRpoMinutes: number; // Recovery Point Objective (e.g. 5 mins)
  targetRtoMinutes: number; // Recovery Time Objective (e.g. 30 mins)
  databaseBackup: {
    automatedDaily: boolean;
    pointInTimeRecoverySupported: boolean;
    encryptionAtRest: "AES-256";
    retentionDays: number;
    lastBackupTimestamp: string;
    lastRestoreVerificationDate: string;
    restoreVerificationResult: "PASS" | "FAIL";
  };
  databaseReplicas: {
    readReplicaAvailable: boolean;
    replicationLagSeconds: number;
    readDecisionsIsolatedFromPayments: boolean;
  };
  failoverSafety: {
    primaryWriteArchitecture: true;
    multiPrimaryAllowed: false; // Strict safety: no uncoordinated multi-primary writes
    replayDeduplicationActive: boolean;
    zeroDuplicateTransactionsGuaranteed: boolean;
  };
}

