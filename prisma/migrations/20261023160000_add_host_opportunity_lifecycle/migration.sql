-- Durable lifecycle state for deterministic host opportunities. Rule evaluation
-- remains read-only; rows are created or updated only for explicit host actions.
DO $$ BEGIN
  CREATE TYPE "HostOpportunityStatus" AS ENUM ('ACTIVE', 'SNOOZED', 'DISMISSED', 'RESOLVED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "HostOpportunity" (
  "id" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "ruleKey" TEXT NOT NULL,
  "deduplicationKey" TEXT NOT NULL,
  "status" "HostOpportunityStatus" NOT NULL DEFAULT 'ACTIVE',
  "evidenceFingerprint" TEXT NOT NULL,
  "evidenceSnapshot" JSONB,
  "actionHref" TEXT,
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastEvaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "snoozedUntil" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HostOpportunity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HostOpportunity_hostId_deduplicationKey_key"
  ON "HostOpportunity"("hostId", "deduplicationKey");
CREATE INDEX IF NOT EXISTS "HostOpportunity_hostId_status_updatedAt_idx"
  ON "HostOpportunity"("hostId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "HostOpportunity_hostId_listingId_status_idx"
  ON "HostOpportunity"("hostId", "listingId", "status");
CREATE INDEX IF NOT EXISTS "HostOpportunity_listingId_ruleKey_idx"
  ON "HostOpportunity"("listingId", "ruleKey");

DO $$ BEGIN
  ALTER TABLE "HostOpportunity"
    ADD CONSTRAINT "HostOpportunity_hostId_fkey"
    FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "HostOpportunity"
    ADD CONSTRAINT "HostOpportunity_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
