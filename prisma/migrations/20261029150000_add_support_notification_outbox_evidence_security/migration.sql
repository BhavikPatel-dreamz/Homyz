-- StayElite Phases 9 + 10. Additive only; no existing evidence is deleted,
-- no financial state is changed, and no historical records are backfilled.

CREATE TYPE "NotificationOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DELIVERED', 'RETRY_PENDING', 'DEAD_LETTER');
CREATE TYPE "NotificationDeliveryChannel" AS ENUM ('IN_APP', 'EMAIL');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'DELIVERED', 'FAILED', 'RETRY_PENDING', 'PERMANENTLY_FAILED');
CREATE TYPE "SupportCaseEvidenceScanStatus" AS ENUM ('QUARANTINED', 'SCANNING', 'CLEAN', 'INFECTED', 'REJECTED', 'SCAN_FAILED');

CREATE TABLE "NotificationOutbox" (
  "id" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "eventVersion" INTEGER NOT NULL DEFAULT 1,
  "payload" JSONB NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" "NotificationOutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processingLeaseId" TEXT,
  "leaseExpiresAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "lastError" TEXT,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationOutbox_attempts_positive" CHECK ("attemptCount" >= 0 AND "maxAttempts" > 0)
);

CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "outboxEventId" TEXT NOT NULL,
  "notificationId" TEXT,
  "recipientUserId" TEXT NOT NULL,
  "channel" "NotificationDeliveryChannel" NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "providerMessageId" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastAttemptedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failureReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDeliveryAttempt" (
  "id" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "providerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationDeliveryAttempt_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SupportCaseEvidence"
  ADD COLUMN "scanStatus" "SupportCaseEvidenceScanStatus" NOT NULL DEFAULT 'QUARANTINED',
  ADD COLUMN "scanAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "scanLastError" TEXT,
  ADD COLUMN "scannedAt" TIMESTAMP(3),
  ADD COLUMN "quarantinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "legalHold" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "legalHoldReason" TEXT,
  ADD COLUMN "legalHoldAt" TIMESTAMP(3),
  ADD COLUMN "legalHoldById" TEXT;

CREATE TABLE "SupportCaseEvidenceHold" (
  "id" TEXT NOT NULL,
  "evidenceId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportCaseEvidenceHold_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationOutbox_idempotencyKey_key" ON "NotificationOutbox"("idempotencyKey");
CREATE INDEX "NotificationOutbox_status_nextAttemptAt_idx" ON "NotificationOutbox"("status", "nextAttemptAt");
CREATE INDEX "NotificationOutbox_leaseExpiresAt_idx" ON "NotificationOutbox"("leaseExpiresAt");
CREATE INDEX "NotificationOutbox_entityType_entityId_idx" ON "NotificationOutbox"("entityType", "entityId");
CREATE UNIQUE INDEX "NotificationDelivery_outboxEventId_recipientUserId_channel_key" ON "NotificationDelivery"("outboxEventId", "recipientUserId", "channel");
CREATE INDEX "NotificationDelivery_recipientUserId_status_createdAt_idx" ON "NotificationDelivery"("recipientUserId", "status", "createdAt");
CREATE INDEX "NotificationDelivery_status_updatedAt_idx" ON "NotificationDelivery"("status", "updatedAt");
CREATE UNIQUE INDEX "NotificationDeliveryAttempt_deliveryId_attemptNumber_key" ON "NotificationDeliveryAttempt"("deliveryId", "attemptNumber");
CREATE INDEX "NotificationDeliveryAttempt_deliveryId_createdAt_idx" ON "NotificationDeliveryAttempt"("deliveryId", "createdAt");
CREATE INDEX "SupportCaseEvidence_scanStatus_createdAt_idx" ON "SupportCaseEvidence"("scanStatus", "createdAt");
CREATE INDEX "SupportCaseEvidence_legalHold_retentionUntil_idx" ON "SupportCaseEvidence"("legalHold", "retentionUntil");
CREATE INDEX "SupportCaseEvidenceHold_evidenceId_createdAt_idx" ON "SupportCaseEvidenceHold"("evidenceId", "createdAt");
CREATE INDEX "SupportCaseEvidenceHold_actorId_createdAt_idx" ON "SupportCaseEvidenceHold"("actorId", "createdAt");

ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_outboxEventId_fkey" FOREIGN KEY ("outboxEventId") REFERENCES "NotificationOutbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDeliveryAttempt" ADD CONSTRAINT "NotificationDeliveryAttempt_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "NotificationDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportCaseEvidence" ADD CONSTRAINT "SupportCaseEvidence_legalHoldById_fkey" FOREIGN KEY ("legalHoldById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportCaseEvidenceHold" ADD CONSTRAINT "SupportCaseEvidenceHold_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "SupportCaseEvidence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportCaseEvidenceHold" ADD CONSTRAINT "SupportCaseEvidenceHold_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
