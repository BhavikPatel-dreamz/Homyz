-- Phase 11: additive, inactive-by-default activity projection and durable
-- notification idempotency. This migration must be applied only to a verified
-- development/staging database with a consistent migration chain.

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "deduplicationKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_deduplicationKey_key"
  ON "Notification"("deduplicationKey");

DO $$ BEGIN
  CREATE TYPE "LoyaltyActivityType" AS ENUM (
    'ACHIEVEMENT_EARNED', 'ACHIEVEMENT_REVOKED', 'TIER_CHANGED',
    'TIER_CORRECTED', 'REFERRAL_REWARD_PENDING',
    'REFERRAL_REWARD_APPROVED', 'REFERRAL_REWARD_REJECTED'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "LoyaltyActivity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "LoyaltyActivityType" NOT NULL,
  "eventKey" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL,
  "link" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LoyaltyActivity_userId_eventKey_key" ON "LoyaltyActivity"("userId", "eventKey");
CREATE INDEX IF NOT EXISTS "LoyaltyActivity_userId_occurredAt_idx" ON "LoyaltyActivity"("userId", "occurredAt");
CREATE INDEX IF NOT EXISTS "LoyaltyActivity_userId_type_occurredAt_idx" ON "LoyaltyActivity"("userId", "type", "occurredAt");
CREATE INDEX IF NOT EXISTS "LoyaltyActivity_sourceType_sourceId_idx" ON "LoyaltyActivity"("sourceType", "sourceId");

ALTER TABLE "LoyaltyActivity" DROP CONSTRAINT IF EXISTS "LoyaltyActivity_userId_fkey";
ALTER TABLE "LoyaltyActivity" ADD CONSTRAINT "LoyaltyActivity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
