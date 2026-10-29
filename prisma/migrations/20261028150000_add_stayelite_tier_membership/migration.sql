-- Phase 5: additive, inactive-by-default StayElite tier memberships. This
-- migration neither seeds memberships nor changes bookings, reviews, points,
-- rewards, checkout pricing, or existing referral records.

DO $$ BEGIN
  CREATE TYPE "StayEliteTierCode" AS ENUM ('TRAVELER', 'AMBASSADOR', 'ICON');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "StayEliteMembershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "StayEliteQualificationStatus" AS ENUM ('NOT_ELIGIBLE', 'IN_PROGRESS', 'QUALIFIED', 'POLICY_BLOCKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "StayEliteTierChangeType" AS ENUM ('INITIAL', 'PROMOTION', 'DOWNGRADE', 'ADMIN_CORRECTION', 'POLICY_REEVALUATION');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "StayEliteTierChangeDisposition" AS ENUM ('PROPOSED', 'APPLIED', 'BLOCKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "StayEliteTierDefinition" (
  "id" TEXT NOT NULL,
  "code" "StayEliteTierCode" NOT NULL,
  "displayName" TEXT NOT NULL,
  "displayOrder" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "qualificationConfig" JSONB NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "benefitMetadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StayEliteTierDefinition_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StayEliteMembership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "currentTier" "StayEliteTierCode",
  "status" "StayEliteMembershipStatus" NOT NULL DEFAULT 'PENDING',
  "qualificationStatus" "StayEliteQualificationStatus" NOT NULL DEFAULT 'NOT_ELIGIBLE',
  "policyVersion" TEXT NOT NULL,
  "lastEvaluatedAt" TIMESTAMP(3),
  "lastQualifiedAt" TIMESTAMP(3),
  "lastEvaluationReason" TEXT,
  "progressSnapshot" JSONB,
  "tierPubliclyVisible" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StayEliteMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StayEliteTierEvaluation" (
  "id" TEXT NOT NULL,
  "membershipId" TEXT,
  "userId" TEXT NOT NULL,
  "sourceEventId" TEXT,
  "sourceType" TEXT NOT NULL,
  "sourceReference" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "qualificationStatus" "StayEliteQualificationStatus" NOT NULL,
  "evaluatedTier" "StayEliteTierCode",
  "proposedTier" "StayEliteTierCode",
  "completedStayCount" INTEGER NOT NULL,
  "eligibleReviewCount" INTEGER NOT NULL,
  "averageGuestRating" DECIMAL(4,3),
  "qualifyingReferralCount" INTEGER NOT NULL,
  "policyBlockers" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "missingConditions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "evidenceSnapshot" JSONB NOT NULL,
  "resultSnapshot" JSONB NOT NULL,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StayEliteTierEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StayEliteTierHistory" (
  "id" TEXT NOT NULL,
  "membershipId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "evaluationId" TEXT,
  "previousTier" "StayEliteTierCode",
  "newTier" "StayEliteTierCode",
  "changeType" "StayEliteTierChangeType" NOT NULL,
  "disposition" "StayEliteTierChangeDisposition" NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "sourceEventId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "reason" TEXT,
  "authorizedById" TEXT,
  "snapshot" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StayEliteTierHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StayEliteTierDefinition_code_key" ON "StayEliteTierDefinition"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "StayEliteTierDefinition_displayOrder_key" ON "StayEliteTierDefinition"("displayOrder");
CREATE INDEX IF NOT EXISTS "StayEliteTierDefinition_enabled_displayOrder_idx" ON "StayEliteTierDefinition"("enabled", "displayOrder");
CREATE UNIQUE INDEX IF NOT EXISTS "StayEliteMembership_userId_key" ON "StayEliteMembership"("userId");
CREATE INDEX IF NOT EXISTS "StayEliteMembership_currentTier_status_idx" ON "StayEliteMembership"("currentTier", "status");
CREATE INDEX IF NOT EXISTS "StayEliteMembership_qualificationStatus_lastEvaluatedAt_idx" ON "StayEliteMembership"("qualificationStatus", "lastEvaluatedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "StayEliteTierEvaluation_idempotencyKey_key" ON "StayEliteTierEvaluation"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "StayEliteTierEvaluation_userId_evaluatedAt_idx" ON "StayEliteTierEvaluation"("userId", "evaluatedAt");
CREATE INDEX IF NOT EXISTS "StayEliteTierEvaluation_membershipId_evaluatedAt_idx" ON "StayEliteTierEvaluation"("membershipId", "evaluatedAt");
CREATE INDEX IF NOT EXISTS "StayEliteTierEvaluation_sourceEventId_idx" ON "StayEliteTierEvaluation"("sourceEventId");
CREATE UNIQUE INDEX IF NOT EXISTS "StayEliteTierHistory_idempotencyKey_key" ON "StayEliteTierHistory"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "StayEliteTierHistory_membershipId_occurredAt_idx" ON "StayEliteTierHistory"("membershipId", "occurredAt");
CREATE INDEX IF NOT EXISTS "StayEliteTierHistory_userId_occurredAt_idx" ON "StayEliteTierHistory"("userId", "occurredAt");
CREATE INDEX IF NOT EXISTS "StayEliteTierHistory_sourceEventId_idx" ON "StayEliteTierHistory"("sourceEventId");

ALTER TABLE "StayEliteMembership" DROP CONSTRAINT IF EXISTS "StayEliteMembership_userId_fkey";
ALTER TABLE "StayEliteMembership" ADD CONSTRAINT "StayEliteMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StayEliteTierEvaluation" DROP CONSTRAINT IF EXISTS "StayEliteTierEvaluation_membershipId_fkey";
ALTER TABLE "StayEliteTierEvaluation" ADD CONSTRAINT "StayEliteTierEvaluation_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "StayEliteMembership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StayEliteTierEvaluation" DROP CONSTRAINT IF EXISTS "StayEliteTierEvaluation_userId_fkey";
ALTER TABLE "StayEliteTierEvaluation" ADD CONSTRAINT "StayEliteTierEvaluation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StayEliteTierHistory" DROP CONSTRAINT IF EXISTS "StayEliteTierHistory_membershipId_fkey";
ALTER TABLE "StayEliteTierHistory" ADD CONSTRAINT "StayEliteTierHistory_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "StayEliteMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StayEliteTierHistory" DROP CONSTRAINT IF EXISTS "StayEliteTierHistory_userId_fkey";
ALTER TABLE "StayEliteTierHistory" ADD CONSTRAINT "StayEliteTierHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StayEliteTierHistory" DROP CONSTRAINT IF EXISTS "StayEliteTierHistory_evaluationId_fkey";
ALTER TABLE "StayEliteTierHistory" ADD CONSTRAINT "StayEliteTierHistory_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "StayEliteTierEvaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StayEliteTierHistory" DROP CONSTRAINT IF EXISTS "StayEliteTierHistory_authorizedById_fkey";
ALTER TABLE "StayEliteTierHistory" ADD CONSTRAINT "StayEliteTierHistory_authorizedById_fkey" FOREIGN KEY ("authorizedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
