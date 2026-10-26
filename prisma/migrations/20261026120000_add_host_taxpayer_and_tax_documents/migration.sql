-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TaxpayerType" AS ENUM ('INDIVIDUAL', 'BUSINESS');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TaxpayerVerificationStatus" AS ENUM ('DRAFT', 'PENDING_VERIFICATION', 'VERIFIED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "HostTaxDocumentType" AS ENUM ('ANNUAL_TAX_SUMMARY', 'BOOKING_TAX_INVOICE', 'VAT_CERTIFICATE', 'TAX_REGISTRATION_RECORD');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable TaxRegistration
ALTER TABLE "TaxRegistration" ADD COLUMN IF NOT EXISTS "taxpayerProfileId" TEXT;
ALTER TABLE "TaxRegistration" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

-- CreateTable HostTaxpayerProfile
CREATE TABLE IF NOT EXISTS "HostTaxpayerProfile" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "taxpayerType" "TaxpayerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "legalName" TEXT NOT NULL,
    "businessName" TEXT,
    "businessRegistrationNumber" TEXT,
    "countryCode" TEXT NOT NULL DEFAULT 'SA',
    "taxIdentifierType" TEXT NOT NULL DEFAULT 'NIN',
    "encryptedTaxIdentifier" TEXT NOT NULL,
    "maskedTaxIdentifier" TEXT NOT NULL,
    "taxIdentifierLast4" TEXT NOT NULL,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "jurisdictionId" TEXT,
    "status" "TaxpayerVerificationStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "rejectionReason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostTaxpayerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable HostTaxDocument
CREATE TABLE IF NOT EXISTS "HostTaxDocument" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "taxpayerProfileId" TEXT,
    "taxRegistrationId" TEXT,
    "bookingId" TEXT,
    "documentType" "HostTaxDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "taxYear" INTEGER NOT NULL,
    "taxPeriod" TEXT DEFAULT 'ANNUAL',
    "fileFormat" TEXT NOT NULL DEFAULT 'PDF',
    "fileSize" INTEGER,
    "storageReference" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY',
    "documentVersion" INTEGER NOT NULL DEFAULT 1,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostTaxDocument_pkey" PRIMARY KEY ("id")
);

-- Indexes for HostTaxpayerProfile
CREATE UNIQUE INDEX IF NOT EXISTS "HostTaxpayerProfile_hostId_key" ON "HostTaxpayerProfile"("hostId");
CREATE INDEX IF NOT EXISTS "HostTaxpayerProfile_hostId_idx" ON "HostTaxpayerProfile"("hostId");
CREATE INDEX IF NOT EXISTS "HostTaxpayerProfile_status_idx" ON "HostTaxpayerProfile"("status");
CREATE INDEX IF NOT EXISTS "HostTaxpayerProfile_countryCode_idx" ON "HostTaxpayerProfile"("countryCode");

-- Indexes for HostTaxDocument
CREATE INDEX IF NOT EXISTS "HostTaxDocument_hostId_taxYear_idx" ON "HostTaxDocument"("hostId", "taxYear");
CREATE INDEX IF NOT EXISTS "HostTaxDocument_hostId_documentType_idx" ON "HostTaxDocument"("hostId", "documentType");
CREATE INDEX IF NOT EXISTS "HostTaxDocument_bookingId_idx" ON "HostTaxDocument"("bookingId");
CREATE INDEX IF NOT EXISTS "HostTaxDocument_status_idx" ON "HostTaxDocument"("status");

-- Index for TaxRegistration
CREATE INDEX IF NOT EXISTS "TaxRegistration_taxpayerProfileId_idx" ON "TaxRegistration"("taxpayerProfileId");

-- Foreign Keys
DO $$ BEGIN
    ALTER TABLE "HostTaxpayerProfile" ADD CONSTRAINT "HostTaxpayerProfile_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "HostTaxpayerProfile" ADD CONSTRAINT "HostTaxpayerProfile_jurisdictionId_fkey" FOREIGN KEY ("jurisdictionId") REFERENCES "TaxJurisdiction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TaxRegistration" ADD CONSTRAINT "TaxRegistration_taxpayerProfileId_fkey" FOREIGN KEY ("taxpayerProfileId") REFERENCES "HostTaxpayerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "HostTaxDocument" ADD CONSTRAINT "HostTaxDocument_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "HostTaxDocument" ADD CONSTRAINT "HostTaxDocument_taxpayerProfileId_fkey" FOREIGN KEY ("taxpayerProfileId") REFERENCES "HostTaxpayerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "HostTaxDocument" ADD CONSTRAINT "HostTaxDocument_taxRegistrationId_fkey" FOREIGN KEY ("taxRegistrationId") REFERENCES "TaxRegistration"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "HostTaxDocument" ADD CONSTRAINT "HostTaxDocument_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

