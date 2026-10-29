-- Phase 2: durable, inactive-by-default achievement/event foundation.
-- This migration is additive. Existing traveler-owned stamp rows remain
-- USER_MANAGED, and no rows are created for awards or achievements.

ALTER TYPE "BackgroundJobType" ADD VALUE IF NOT EXISTS 'ACHIEVEMENT_EVENT_PROCESSING';
ALTER TYPE "BackgroundJobType" ADD VALUE IF NOT EXISTS 'ACHIEVEMENT_RECONCILIATION';
ALTER TYPE "TravelAchievementStatus" ADD VALUE IF NOT EXISTS 'REVOKED';

DO $$ BEGIN
  CREATE TYPE "TravelStampOwnership" AS ENUM ('USER_MANAGED', 'SYSTEM_AWARDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "TravelAchievementDefinitionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AchievementEventType" AS ENUM (
    'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'STAY_COMPLETION_CANDIDATE',
    'BOOKING_REFUNDED', 'REVIEW_PUBLISHED', 'HOST_RATING_PUBLISHED',
    'REFERRAL_QUALIFICATION_CANDIDATE'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "AchievementEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'RETRY_SCHEDULED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "BookingVisitEvidenceStatus" AS ENUM ('CANDIDATE', 'QUALIFIED', 'INVALIDATED', 'UNSUPPORTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "SystemAwardStatus" AS ENUM ('ACTIVE', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "TravelStamp" ADD COLUMN IF NOT EXISTS "isUserSelectable" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "UserTravelStamp" ADD COLUMN IF NOT EXISTS "ownership" "TravelStampOwnership" NOT NULL DEFAULT 'USER_MANAGED';
ALTER TABLE "UserTravelStamp" ADD COLUMN IF NOT EXISTS "systemAwardId" TEXT;
ALTER TABLE "UserTravelStamp" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);
ALTER TABLE "UserTravelStamp" ADD COLUMN IF NOT EXISTS "revocationReason" TEXT;
ALTER TABLE "TravelAchievement" ADD COLUMN IF NOT EXISTS "definitionStatus" "TravelAchievementDefinitionStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "TravelAchievement" ADD COLUMN IF NOT EXISTS "ruleVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TravelAchievement" ADD COLUMN IF NOT EXISTS "eligibilityMetadata" JSONB;
ALTER TABLE "TravelAchievement" ADD COLUMN IF NOT EXISTS "awardEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TravelAchievement" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
ALTER TABLE "TravelAchievement" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "UserTravelAchievement" ADD COLUMN IF NOT EXISTS "ruleVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "UserTravelAchievement" ADD COLUMN IF NOT EXISTS "lastEvaluatedAt" TIMESTAMP(3);
ALTER TABLE "UserTravelAchievement" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);
ALTER TABLE "UserTravelAchievement" ADD COLUMN IF NOT EXISTS "revocationReason" TEXT;

CREATE TABLE IF NOT EXISTS "AchievementEvent" (
  "id" TEXT NOT NULL,
  "type" "AchievementEventType" NOT NULL,
  "status" "AchievementEventStatus" NOT NULL DEFAULT 'PENDING',
  "sourceEntityType" TEXT NOT NULL,
  "sourceEntityId" TEXT NOT NULL,
  "userId" TEXT,
  "bookingId" TEXT,
  "reviewId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "sourceVersion" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "evidenceReference" TEXT,
  "metadata" JSONB,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lockedBy" TEXT,
  "processedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AchievementEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "BookingVisitEvidence" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "destinationId" TEXT,
  "countryCode" TEXT,
  "countryName" TEXT,
  "cityName" TEXT,
  "checkInDate" DATE NOT NULL,
  "checkOutDate" DATE NOT NULL,
  "bookingStatus" "BookingStatus" NOT NULL,
  "status" "BookingVisitEvidenceStatus" NOT NULL DEFAULT 'CANDIDATE',
  "sourceEventId" TEXT,
  "qualificationPolicyVersion" TEXT,
  "qualifiedAt" TIMESTAMP(3),
  "invalidatedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingVisitEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AchievementAward" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "achievementId" TEXT NOT NULL,
  "userAchievementId" TEXT,
  "sourceEventId" TEXT,
  "bookingEvidenceId" TEXT,
  "ruleVersion" INTEGER NOT NULL,
  "status" "SystemAwardStatus" NOT NULL DEFAULT 'ACTIVE',
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revocationReason" TEXT,
  "revokedByUserId" TEXT,
  "evidenceSnapshot" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AchievementAward_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AchievementReconciliationCheckpoint" (
  "id" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "cursor" TEXT,
  "scannedCount" INTEGER NOT NULL DEFAULT 0,
  "candidateCount" INTEGER NOT NULL DEFAULT 0,
  "unsupportedCount" INTEGER NOT NULL DEFAULT 0,
  "duplicateCount" INTEGER NOT NULL DEFAULT 0,
  "lastRunAt" TIMESTAMP(3),
  "summary" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AchievementReconciliationCheckpoint_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserTravelStamp_systemAwardId_key" ON "UserTravelStamp"("systemAwardId");
CREATE UNIQUE INDEX IF NOT EXISTS "AchievementEvent_idempotencyKey_key" ON "AchievementEvent"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "AchievementEvent_status_availableAt_idx" ON "AchievementEvent"("status", "availableAt");
CREATE INDEX IF NOT EXISTS "AchievementEvent_userId_occurredAt_idx" ON "AchievementEvent"("userId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AchievementEvent_sourceEntityType_sourceEntityId_idx" ON "AchievementEvent"("sourceEntityType", "sourceEntityId");
CREATE INDEX IF NOT EXISTS "AchievementEvent_bookingId_idx" ON "AchievementEvent"("bookingId");
CREATE INDEX IF NOT EXISTS "AchievementEvent_reviewId_idx" ON "AchievementEvent"("reviewId");
CREATE UNIQUE INDEX IF NOT EXISTS "BookingVisitEvidence_bookingId_key" ON "BookingVisitEvidence"("bookingId");
CREATE UNIQUE INDEX IF NOT EXISTS "BookingVisitEvidence_sourceEventId_key" ON "BookingVisitEvidence"("sourceEventId");
CREATE INDEX IF NOT EXISTS "BookingVisitEvidence_userId_status_idx" ON "BookingVisitEvidence"("userId", "status");
CREATE INDEX IF NOT EXISTS "BookingVisitEvidence_destinationId_status_idx" ON "BookingVisitEvidence"("destinationId", "status");
CREATE INDEX IF NOT EXISTS "BookingVisitEvidence_listingId_idx" ON "BookingVisitEvidence"("listingId");
CREATE UNIQUE INDEX IF NOT EXISTS "AchievementAward_userId_achievementId_ruleVersion_key" ON "AchievementAward"("userId", "achievementId", "ruleVersion");
CREATE INDEX IF NOT EXISTS "AchievementAward_userId_status_idx" ON "AchievementAward"("userId", "status");
CREATE INDEX IF NOT EXISTS "AchievementAward_achievementId_status_idx" ON "AchievementAward"("achievementId", "status");
CREATE INDEX IF NOT EXISTS "AchievementAward_sourceEventId_idx" ON "AchievementAward"("sourceEventId");
CREATE INDEX IF NOT EXISTS "AchievementAward_bookingEvidenceId_idx" ON "AchievementAward"("bookingEvidenceId");
CREATE UNIQUE INDEX IF NOT EXISTS "AchievementReconciliationCheckpoint_scope_key" ON "AchievementReconciliationCheckpoint"("scope");

ALTER TABLE "AchievementEvent" DROP CONSTRAINT IF EXISTS "AchievementEvent_userId_fkey";
ALTER TABLE "AchievementEvent" ADD CONSTRAINT "AchievementEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AchievementEvent" DROP CONSTRAINT IF EXISTS "AchievementEvent_bookingId_fkey";
ALTER TABLE "AchievementEvent" ADD CONSTRAINT "AchievementEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AchievementEvent" DROP CONSTRAINT IF EXISTS "AchievementEvent_reviewId_fkey";
ALTER TABLE "AchievementEvent" ADD CONSTRAINT "AchievementEvent_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingVisitEvidence" DROP CONSTRAINT IF EXISTS "BookingVisitEvidence_userId_fkey";
ALTER TABLE "BookingVisitEvidence" ADD CONSTRAINT "BookingVisitEvidence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingVisitEvidence" DROP CONSTRAINT IF EXISTS "BookingVisitEvidence_bookingId_fkey";
ALTER TABLE "BookingVisitEvidence" ADD CONSTRAINT "BookingVisitEvidence_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingVisitEvidence" DROP CONSTRAINT IF EXISTS "BookingVisitEvidence_destinationId_fkey";
ALTER TABLE "BookingVisitEvidence" ADD CONSTRAINT "BookingVisitEvidence_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingVisitEvidence" DROP CONSTRAINT IF EXISTS "BookingVisitEvidence_sourceEventId_fkey";
ALTER TABLE "BookingVisitEvidence" ADD CONSTRAINT "BookingVisitEvidence_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "AchievementEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AchievementAward" DROP CONSTRAINT IF EXISTS "AchievementAward_userId_fkey";
ALTER TABLE "AchievementAward" ADD CONSTRAINT "AchievementAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AchievementAward" DROP CONSTRAINT IF EXISTS "AchievementAward_achievementId_fkey";
ALTER TABLE "AchievementAward" ADD CONSTRAINT "AchievementAward_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "TravelAchievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AchievementAward" DROP CONSTRAINT IF EXISTS "AchievementAward_userAchievementId_fkey";
ALTER TABLE "AchievementAward" ADD CONSTRAINT "AchievementAward_userAchievementId_fkey" FOREIGN KEY ("userAchievementId") REFERENCES "UserTravelAchievement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AchievementAward" DROP CONSTRAINT IF EXISTS "AchievementAward_sourceEventId_fkey";
ALTER TABLE "AchievementAward" ADD CONSTRAINT "AchievementAward_sourceEventId_fkey" FOREIGN KEY ("sourceEventId") REFERENCES "AchievementEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AchievementAward" DROP CONSTRAINT IF EXISTS "AchievementAward_bookingEvidenceId_fkey";
ALTER TABLE "AchievementAward" ADD CONSTRAINT "AchievementAward_bookingEvidenceId_fkey" FOREIGN KEY ("bookingEvidenceId") REFERENCES "BookingVisitEvidence"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserTravelStamp" DROP CONSTRAINT IF EXISTS "UserTravelStamp_systemAwardId_fkey";
ALTER TABLE "UserTravelStamp" ADD CONSTRAINT "UserTravelStamp_systemAwardId_fkey" FOREIGN KEY ("systemAwardId") REFERENCES "AchievementAward"("id") ON DELETE SET NULL ON UPDATE CASCADE;
