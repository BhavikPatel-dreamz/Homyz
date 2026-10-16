-- Create Tax Enums
DO $$ BEGIN
    CREATE TYPE "TaxType" AS ENUM ('VAT', 'GST', 'TOURIST_TAX', 'OCCUPANCY_TAX', 'LODGING_TAX', 'SALES_TAX', 'CITY_TAX', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TaxCalculationMethod" AS ENUM ('PERCENTAGE', 'FLAT_PER_BOOKING', 'AMOUNT_PER_NIGHT', 'AMOUNT_PER_GUEST', 'AMOUNT_PER_GUEST_PER_NIGHT');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TaxRemittanceResponsibility" AS ENUM ('PLATFORM', 'HOST', 'THIRD_PARTY', 'MANUAL');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TaxRegistrationStatus" AS ENUM ('UNVERIFIED', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create TaxJurisdiction
CREATE TABLE IF NOT EXISTS "TaxJurisdiction" (
    "id" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "region" TEXT,
    "city" TEXT,
    "postalPattern" TEXT,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxJurisdiction_pkey" PRIMARY KEY ("id")
);

-- Create TaxRule
CREATE TABLE IF NOT EXISTS "TaxRule" (
    "id" TEXT NOT NULL,
    "jurisdictionId" TEXT NOT NULL,
    "taxType" "TaxType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "calculationMethod" "TaxCalculationMethod" NOT NULL DEFAULT 'PERCENTAGE',
    "rate" DOUBLE PRECISION,
    "amount" INTEGER,
    "taxableComponents" TEXT[] DEFAULT ARRAY['BASE_PRICE', 'CLEANING_FEE']::TEXT[],
    "remittanceResponsibility" "TaxRemittanceResponsibility" NOT NULL DEFAULT 'PLATFORM',
    "isSystemManaged" BOOLEAN NOT NULL DEFAULT true,
    "isInclusive" BOOLEAN NOT NULL DEFAULT false,
    "longStayExemptionNights" INTEGER,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRule_pkey" PRIMARY KEY ("id")
);

-- Create ListingTax
CREATE TABLE IF NOT EXISTS "ListingTax" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "taxRuleId" TEXT,
    "customName" TEXT,
    "taxType" "TaxType" NOT NULL,
    "calculationMethod" "TaxCalculationMethod" NOT NULL DEFAULT 'PERCENTAGE',
    "rate" DOUBLE PRECISION,
    "amount" INTEGER,
    "taxableComponents" TEXT[] DEFAULT ARRAY['BASE_PRICE']::TEXT[],
    "remittanceResponsibility" "TaxRemittanceResponsibility" NOT NULL DEFAULT 'HOST',
    "longStayExemptionNights" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingTax_pkey" PRIMARY KEY ("id")
);

-- Create TaxRegistration
CREATE TABLE IF NOT EXISTS "TaxRegistration" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "jurisdictionId" TEXT,
    "taxType" TEXT NOT NULL,
    "registrationNumber" TEXT NOT NULL,
    "businessName" TEXT,
    "businessAddress" TEXT,
    "documentUrl" TEXT,
    "status" "TaxRegistrationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxRegistration_pkey" PRIMARY KEY ("id")
);

-- Create ReservationTax
CREATE TABLE IF NOT EXISTS "ReservationTax" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "taxRuleId" TEXT,
    "taxRuleVersion" INTEGER NOT NULL DEFAULT 1,
    "taxName" TEXT NOT NULL,
    "taxType" "TaxType" NOT NULL,
    "calculationMethod" "TaxCalculationMethod" NOT NULL,
    "rate" DOUBLE PRECISION,
    "amount" INTEGER,
    "taxableBase" INTEGER NOT NULL,
    "taxAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "remittanceResponsibility" "TaxRemittanceResponsibility" NOT NULL,
    "refundedTax" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationTax_pkey" PRIMARY KEY ("id")
);

-- Create TaxAuditLog
CREATE TABLE IF NOT EXISTS "TaxAuditLog" (
    "id" TEXT NOT NULL,
    "listingId" TEXT,
    "hostId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxAuditLog_pkey" PRIMARY KEY ("id")
);

-- Create Indices
CREATE INDEX IF NOT EXISTS "TaxJurisdiction_country_idx" ON "TaxJurisdiction"("country");
CREATE INDEX IF NOT EXISTS "TaxJurisdiction_country_city_idx" ON "TaxJurisdiction"("country", "city");
CREATE INDEX IF NOT EXISTS "TaxRule_jurisdictionId_idx" ON "TaxRule"("jurisdictionId");
CREATE INDEX IF NOT EXISTS "TaxRule_jurisdictionId_taxType_idx" ON "TaxRule"("jurisdictionId", "taxType");
CREATE UNIQUE INDEX IF NOT EXISTS "ListingTax_listingId_taxType_key" ON "ListingTax"("listingId", "taxType");
CREATE INDEX IF NOT EXISTS "ListingTax_listingId_idx" ON "ListingTax"("listingId");
CREATE INDEX IF NOT EXISTS "TaxRegistration_hostId_idx" ON "TaxRegistration"("hostId");
CREATE INDEX IF NOT EXISTS "TaxRegistration_hostId_taxType_idx" ON "TaxRegistration"("hostId", "taxType");
CREATE INDEX IF NOT EXISTS "ReservationTax_bookingId_idx" ON "ReservationTax"("bookingId");
CREATE INDEX IF NOT EXISTS "TaxAuditLog_listingId_idx" ON "TaxAuditLog"("listingId");
CREATE INDEX IF NOT EXISTS "TaxAuditLog_hostId_idx" ON "TaxAuditLog"("hostId");

-- Foreign Keys
ALTER TABLE "TaxRule" DROP CONSTRAINT IF EXISTS "TaxRule_jurisdictionId_fkey";
ALTER TABLE "TaxRule" ADD CONSTRAINT "TaxRule_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "TaxJurisdiction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ListingTax" DROP CONSTRAINT IF EXISTS "ListingTax_listingId_fkey";
ALTER TABLE "ListingTax" ADD CONSTRAINT "ListingTax_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ListingTax" DROP CONSTRAINT IF EXISTS "ListingTax_taxRuleId_fkey";
ALTER TABLE "ListingTax" ADD CONSTRAINT "ListingTax_taxRuleId_fkey" FOREIGN KEY ("taxRuleId") REFERENCES "TaxRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TaxRegistration" DROP CONSTRAINT IF EXISTS "TaxRegistration_hostId_fkey";
ALTER TABLE "TaxRegistration" ADD CONSTRAINT "TaxRegistration_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaxRegistration" DROP CONSTRAINT IF EXISTS "TaxRegistration_jurisdictionId_fkey";
ALTER TABLE "TaxRegistration" ADD CONSTRAINT "TaxRegistration_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "TaxJurisdiction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReservationTax" DROP CONSTRAINT IF EXISTS "ReservationTax_bookingId_fkey";
ALTER TABLE "ReservationTax" ADD CONSTRAINT "ReservationTax_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaxAuditLog" DROP CONSTRAINT IF EXISTS "TaxAuditLog_hostId_fkey";
ALTER TABLE "TaxAuditLog" ADD CONSTRAINT "TaxAuditLog_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TaxAuditLog" DROP CONSTRAINT IF EXISTS "TaxAuditLog_listingId_fkey";
ALTER TABLE "TaxAuditLog" ADD CONSTRAINT "TaxAuditLog_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

