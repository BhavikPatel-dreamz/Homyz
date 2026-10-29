-- Additive only. This migration is intentionally not applied by Phase 12.
CREATE TYPE "StayEliteReconciliationDomain" AS ENUM (
  'BOOKING_EVIDENCE', 'ACHIEVEMENT_INTELLIGENCE', 'TIER_MEMBERSHIP', 'REFERRAL',
  'NOTIFICATION_ACTIVITY', 'ANALYTICS', 'POINTS_LEDGER', 'REWARD_REDEMPTION'
);

CREATE TYPE "StayEliteReconciliationMode" AS ENUM ('DRY_RUN', 'EVIDENCE_ONLY');

CREATE TYPE "StayEliteReconciliationStatus" AS ENUM (
  'CREATED', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_ISSUES', 'FAILED', 'CANCELLED'
);

CREATE TABLE "StayEliteReconciliationRun" (
  "id" TEXT NOT NULL,
  "domain" "StayEliteReconciliationDomain" NOT NULL,
  "mode" "StayEliteReconciliationMode" NOT NULL DEFAULT 'DRY_RUN',
  "status" "StayEliteReconciliationStatus" NOT NULL DEFAULT 'CREATED',
  "scope" JSONB,
  "correlationId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "initiatedById" TEXT,
  "cursor" TEXT,
  "batchSize" INTEGER NOT NULL DEFAULT 50,
  "scannedCount" INTEGER NOT NULL DEFAULT 0,
  "matchingCount" INTEGER NOT NULL DEFAULT 0,
  "missingCount" INTEGER NOT NULL DEFAULT 0,
  "inconsistentCount" INTEGER NOT NULL DEFAULT 0,
  "blockedCount" INTEGER NOT NULL DEFAULT 0,
  "correctedCount" INTEGER NOT NULL DEFAULT 0,
  "errorCount" INTEGER NOT NULL DEFAULT 0,
  "report" JSONB,
  "lastError" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StayEliteReconciliationRun_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StayEliteReconciliationRun_correlationId_key" ON "StayEliteReconciliationRun"("correlationId");
CREATE UNIQUE INDEX "StayEliteReconciliationRun_idempotencyKey_key" ON "StayEliteReconciliationRun"("idempotencyKey");
CREATE INDEX "StayEliteReconciliationRun_domain_status_createdAt_idx" ON "StayEliteReconciliationRun"("domain", "status", "createdAt");
CREATE INDEX "StayEliteReconciliationRun_initiatedById_createdAt_idx" ON "StayEliteReconciliationRun"("initiatedById", "createdAt");
ALTER TABLE "StayEliteReconciliationRun" ADD CONSTRAINT "StayEliteReconciliationRun_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
