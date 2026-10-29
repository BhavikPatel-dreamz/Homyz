-- StayElite Phase 6/10 foundation. This is additive and deliberately does not
-- seed balances, rewards, redemptions, campaigns, or price adjustments.

CREATE TYPE "PointsLedgerEntryType" AS ENUM ('PENDING_EARN', 'EARN', 'REDEEM_RESERVE', 'REDEEM_COMMIT', 'REDEEM_RELEASE', 'EXPIRE', 'REVERSE', 'ADMIN_ADJUSTMENT');
CREATE TYPE "RewardDefinitionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "RewardRedemptionStatus" AS ENUM ('ISSUED', 'AVAILABLE', 'RESERVED', 'REDEEMED', 'EXPIRED', 'REVERSED', 'CANCELLED');
CREATE TYPE "LoyaltyCampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'PAUSED', 'ARCHIVED');

CREATE TABLE "PointsAccount" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "availableBalance" INTEGER NOT NULL DEFAULT 0,
  "pendingBalance" INTEGER NOT NULL DEFAULT 0,
  "reservedBalance" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PointsAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PointsAccount_availableBalance_nonnegative" CHECK ("availableBalance" >= 0),
  CONSTRAINT "PointsAccount_pendingBalance_nonnegative" CHECK ("pendingBalance" >= 0),
  CONSTRAINT "PointsAccount_reservedBalance_nonnegative" CHECK ("reservedBalance" >= 0)
);

CREATE TABLE "PointsLedgerEntry" (
  "id" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "PointsLedgerEntryType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "availableDelta" INTEGER NOT NULL DEFAULT 0,
  "pendingDelta" INTEGER NOT NULL DEFAULT 0,
  "reservedDelta" INTEGER NOT NULL DEFAULT 0,
  "sourceType" TEXT NOT NULL,
  "sourceReference" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "policyVersion" TEXT,
  "reason" TEXT,
  "metadata" JSONB,
  "reversalOfEntryId" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PointsLedgerEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PointsLedgerEntry_amount_positive" CHECK ("amount" > 0),
  CONSTRAINT "PointsLedgerEntry_nonzero_delta" CHECK (("availableDelta" <> 0) OR ("pendingDelta" <> 0) OR ("reservedDelta" <> 0))
);

CREATE TABLE "RewardDefinition" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "status" "RewardDefinitionStatus" NOT NULL DEFAULT 'DRAFT',
  "pointsCost" INTEGER,
  "policyVersion" TEXT,
  "fulfillmentConfig" JSONB,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RewardDefinition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RewardDefinition_pointsCost_positive" CHECK ("pointsCost" IS NULL OR "pointsCost" > 0)
);

CREATE TABLE "RewardRedemption" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "rewardDefinitionId" TEXT NOT NULL,
  "status" "RewardRedemptionStatus" NOT NULL DEFAULT 'ISSUED',
  "pointsCostSnapshot" INTEGER NOT NULL,
  "policyVersion" TEXT,
  "reservationLedgerEntryId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "fulfillmentReference" TEXT,
  "failureReason" TEXT,
  "expiresAt" TIMESTAMP(3),
  "reservedAt" TIMESTAMP(3),
  "redeemedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RewardRedemption_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RewardRedemption_pointsCostSnapshot_positive" CHECK ("pointsCostSnapshot" > 0)
);

CREATE TABLE "LoyaltyCampaign" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "status" "LoyaltyCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "eligibilityConfig" JSONB NOT NULL,
  "benefitConfig" JSONB NOT NULL,
  "policyVersion" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdById" TEXT,
  "publishedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoyaltyCampaign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LoyaltyCampaign_dates_valid" CHECK ("endsAt" IS NULL OR "startsAt" IS NULL OR "endsAt" > "startsAt")
);

CREATE UNIQUE INDEX "PointsAccount_userId_key" ON "PointsAccount"("userId");
CREATE INDEX "PointsAccount_availableBalance_idx" ON "PointsAccount"("availableBalance");
CREATE UNIQUE INDEX "PointsLedgerEntry_idempotencyKey_key" ON "PointsLedgerEntry"("idempotencyKey");
CREATE UNIQUE INDEX "PointsLedgerEntry_reversalOfEntryId_key" ON "PointsLedgerEntry"("reversalOfEntryId");
CREATE INDEX "PointsLedgerEntry_accountId_createdAt_idx" ON "PointsLedgerEntry"("accountId", "createdAt");
CREATE INDEX "PointsLedgerEntry_userId_createdAt_idx" ON "PointsLedgerEntry"("userId", "createdAt");
CREATE INDEX "PointsLedgerEntry_sourceType_sourceReference_idx" ON "PointsLedgerEntry"("sourceType", "sourceReference");
CREATE UNIQUE INDEX "RewardDefinition_code_key" ON "RewardDefinition"("code");
CREATE INDEX "RewardDefinition_status_startsAt_endsAt_idx" ON "RewardDefinition"("status", "startsAt", "endsAt");
CREATE UNIQUE INDEX "RewardRedemption_reservationLedgerEntryId_key" ON "RewardRedemption"("reservationLedgerEntryId");
CREATE UNIQUE INDEX "RewardRedemption_idempotencyKey_key" ON "RewardRedemption"("idempotencyKey");
CREATE INDEX "RewardRedemption_userId_status_createdAt_idx" ON "RewardRedemption"("userId", "status", "createdAt");
CREATE INDEX "RewardRedemption_rewardDefinitionId_status_idx" ON "RewardRedemption"("rewardDefinitionId", "status");
CREATE UNIQUE INDEX "LoyaltyCampaign_code_key" ON "LoyaltyCampaign"("code");
CREATE INDEX "LoyaltyCampaign_status_startsAt_endsAt_idx" ON "LoyaltyCampaign"("status", "startsAt", "endsAt");

ALTER TABLE "PointsAccount" ADD CONSTRAINT "PointsAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointsLedgerEntry" ADD CONSTRAINT "PointsLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PointsAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PointsLedgerEntry" ADD CONSTRAINT "PointsLedgerEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PointsLedgerEntry" ADD CONSTRAINT "PointsLedgerEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_rewardDefinitionId_fkey" FOREIGN KEY ("rewardDefinitionId") REFERENCES "RewardDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RewardRedemption" ADD CONSTRAINT "RewardRedemption_reservationLedgerEntryId_fkey" FOREIGN KEY ("reservationLedgerEntryId") REFERENCES "PointsLedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "LoyaltyCampaign" ADD CONSTRAINT "LoyaltyCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ledger history must never be edited or deleted. Corrections use a distinct,
-- source-linked REVERSE entry and balance update in one transaction.
CREATE OR REPLACE FUNCTION stayelite_prevent_points_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'PointsLedgerEntry is append-only; create a compensating ledger entry instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PointsLedgerEntry_no_update"
  BEFORE UPDATE ON "PointsLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION stayelite_prevent_points_ledger_mutation();
CREATE TRIGGER "PointsLedgerEntry_no_delete"
  BEFORE DELETE ON "PointsLedgerEntry"
  FOR EACH ROW EXECUTE FUNCTION stayelite_prevent_points_ledger_mutation();
