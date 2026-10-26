-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "RoutingRuleStatus" AS ENUM ('ACTIVE', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "RoutingRuleType" AS ENUM ('LISTING_DEFAULT', 'PERCENTAGE_SPLIT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "DistributionStatus" AS ENUM ('SCHEDULED', 'ELIGIBLE_SETTLEMENT', 'ON_HOLD', 'PROCESSING', 'EXPORTED', 'PAID', 'FAILED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable PayoutRoutingRule
CREATE TABLE IF NOT EXISTS "PayoutRoutingRule" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "payoutMethodId" TEXT NOT NULL,
    "ruleType" "RoutingRuleType" NOT NULL DEFAULT 'PERCENTAGE_SPLIT',
    "allocationPercentage" DOUBLE PRECISION NOT NULL,
    "status" "RoutingRuleStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutRoutingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable BookingPayoutDistribution
CREATE TABLE IF NOT EXISTS "BookingPayoutDistribution" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "recipientUserId" TEXT NOT NULL,
    "payoutMethodId" TEXT NOT NULL,
    "routingRuleId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "percentage" DOUBLE PRECISION NOT NULL,
    "status" "DistributionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "isHeld" BOOLEAN NOT NULL DEFAULT false,
    "holdType" TEXT,
    "holdReason" TEXT,
    "heldAt" TIMESTAMP(3),
    "heldBy" TEXT,
    "batchReference" TEXT,
    "settlementReference" TEXT,
    "exportedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingPayoutDistribution_pkey" PRIMARY KEY ("id")
);

-- Indexes for PayoutRoutingRule
CREATE INDEX IF NOT EXISTS "PayoutRoutingRule_hostId_listingId_idx" ON "PayoutRoutingRule"("hostId", "listingId");
CREATE INDEX IF NOT EXISTS "PayoutRoutingRule_listingId_status_idx" ON "PayoutRoutingRule"("listingId", "status");
CREATE INDEX IF NOT EXISTS "PayoutRoutingRule_recipientUserId_idx" ON "PayoutRoutingRule"("recipientUserId");
CREATE INDEX IF NOT EXISTS "PayoutRoutingRule_payoutMethodId_idx" ON "PayoutRoutingRule"("payoutMethodId");

-- Indexes for BookingPayoutDistribution
CREATE INDEX IF NOT EXISTS "BookingPayoutDistribution_bookingId_idx" ON "BookingPayoutDistribution"("bookingId");
CREATE INDEX IF NOT EXISTS "BookingPayoutDistribution_recipientUserId_status_idx" ON "BookingPayoutDistribution"("recipientUserId", "status");
CREATE INDEX IF NOT EXISTS "BookingPayoutDistribution_listingId_idx" ON "BookingPayoutDistribution"("listingId");
CREATE INDEX IF NOT EXISTS "BookingPayoutDistribution_batchReference_idx" ON "BookingPayoutDistribution"("batchReference");
CREATE INDEX IF NOT EXISTS "BookingPayoutDistribution_status_idx" ON "BookingPayoutDistribution"("status");

-- Foreign Keys for PayoutRoutingRule
DO $$ BEGIN
  ALTER TABLE "PayoutRoutingRule" ADD CONSTRAINT "PayoutRoutingRule_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PayoutRoutingRule" ADD CONSTRAINT "PayoutRoutingRule_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PayoutRoutingRule" ADD CONSTRAINT "PayoutRoutingRule_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PayoutRoutingRule" ADD CONSTRAINT "PayoutRoutingRule_payoutMethodId_fkey" FOREIGN KEY ("payoutMethodId") REFERENCES "HostPayoutMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Foreign Keys for BookingPayoutDistribution
DO $$ BEGIN
  ALTER TABLE "BookingPayoutDistribution" ADD CONSTRAINT "BookingPayoutDistribution_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BookingPayoutDistribution" ADD CONSTRAINT "BookingPayoutDistribution_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BookingPayoutDistribution" ADD CONSTRAINT "BookingPayoutDistribution_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BookingPayoutDistribution" ADD CONSTRAINT "BookingPayoutDistribution_payoutMethodId_fkey" FOREIGN KEY ("payoutMethodId") REFERENCES "HostPayoutMethod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BookingPayoutDistribution" ADD CONSTRAINT "BookingPayoutDistribution_routingRuleId_fkey" FOREIGN KEY ("routingRuleId") REFERENCES "PayoutRoutingRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

