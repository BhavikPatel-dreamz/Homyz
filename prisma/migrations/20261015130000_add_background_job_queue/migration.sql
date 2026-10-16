-- Persistent queue storage for scheduled moderation and maintenance work.
-- Additive only: it does not modify bookings, payments, reviews, or existing moderation records.

CREATE TYPE "BackgroundJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'RETRY_SCHEDULED', 'FAILED');

CREATE TYPE "BackgroundJobType" AS ENUM (
  'REVIEW_EXPIRY_PUBLISH',
  'ACCOUNT_RESTRICTION_EXPIRY',
  'MODERATION_NOTIFICATION_DELIVERY',
  'AUDIT_LOG_ARCHIVE',
  'SYSTEM_MAINTENANCE'
);

CREATE TABLE "BackgroundJob" (
  "id" TEXT NOT NULL,
  "type" "BackgroundJobType" NOT NULL,
  "status" "BackgroundJobStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB,
  "idempotencyKey" TEXT,
  "priority" INTEGER NOT NULL DEFAULT 0,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "backoffSeconds" INTEGER NOT NULL DEFAULT 30,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "lastError" TEXT,
  "errorStack" TEXT,
  "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BackgroundJob_idempotencyKey_key" ON "BackgroundJob"("idempotencyKey");
CREATE INDEX "BackgroundJob_status_runAt_priority_idx" ON "BackgroundJob"("status", "runAt", "priority");
CREATE INDEX "BackgroundJob_type_status_idx" ON "BackgroundJob"("type", "status");
CREATE INDEX "BackgroundJob_lockedAt_idx" ON "BackgroundJob"("lockedAt");
CREATE INDEX "BackgroundJob_createdAt_idx" ON "BackgroundJob"("createdAt");
