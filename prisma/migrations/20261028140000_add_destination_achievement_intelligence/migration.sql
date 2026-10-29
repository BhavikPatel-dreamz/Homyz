-- Phase 3: versioned destination intelligence. Additive only; no traveler
-- awards, user destinations, stamps, or booking data are modified.

ALTER TYPE "TravelAchievementStatus" ADD VALUE IF NOT EXISTS 'ELIGIBLE';

DO $$ BEGIN
  CREATE TYPE "DestinationClassificationSubject" AS ENUM ('DESTINATION', 'LISTING', 'COUNTRY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "DestinationClassificationType" AS ENUM ('BEACH', 'MOUNTAIN', 'METROPOLITAN', 'NATURE', 'CULTURAL', 'CONTINENT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "TaxonomyRecordStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RETIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "CountryLanguageKind" AS ENUM ('PRIMARY_NATIVE', 'NATIVE', 'OFFICIAL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "DestinationAlias" (
  "id" TEXT NOT NULL,
  "destinationId" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "alias" TEXT NOT NULL,
  "normalizedAlias" TEXT NOT NULL,
  "locale" TEXT,
  "datasetVersion" TEXT NOT NULL,
  "sourceReference" TEXT NOT NULL,
  "status" "TaxonomyRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DestinationAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DestinationClassification" (
  "id" TEXT NOT NULL,
  "subject" "DestinationClassificationSubject" NOT NULL,
  "destinationId" TEXT,
  "listingId" TEXT,
  "countryCode" TEXT,
  "classificationType" "DestinationClassificationType" NOT NULL,
  "classificationValue" TEXT,
  "datasetVersion" TEXT NOT NULL,
  "sourceReference" TEXT NOT NULL,
  "status" "TaxonomyRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "revisionKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DestinationClassification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CountryLanguageMapping" (
  "id" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "languageCode" TEXT NOT NULL,
  "languageName" TEXT NOT NULL,
  "kind" "CountryLanguageKind" NOT NULL,
  "datasetVersion" TEXT NOT NULL,
  "sourceReference" TEXT NOT NULL,
  "status" "TaxonomyRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CountryLanguageMapping_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DestinationAlias_countryCode_normalizedAlias_datasetVersion_key" ON "DestinationAlias"("countryCode", "normalizedAlias", "datasetVersion");
CREATE INDEX IF NOT EXISTS "DestinationAlias_countryCode_normalizedAlias_status_idx" ON "DestinationAlias"("countryCode", "normalizedAlias", "status");
CREATE INDEX IF NOT EXISTS "DestinationAlias_destinationId_status_idx" ON "DestinationAlias"("destinationId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "DestinationClassification_revisionKey_key" ON "DestinationClassification"("revisionKey");
CREATE INDEX IF NOT EXISTS "DestinationClassification_subject_classificationType_status_idx" ON "DestinationClassification"("subject", "classificationType", "status");
CREATE INDEX IF NOT EXISTS "DestinationClassification_destinationId_classificationType_status_idx" ON "DestinationClassification"("destinationId", "classificationType", "status");
CREATE INDEX IF NOT EXISTS "DestinationClassification_listingId_classificationType_status_idx" ON "DestinationClassification"("listingId", "classificationType", "status");
CREATE INDEX IF NOT EXISTS "DestinationClassification_countryCode_classificationType_status_idx" ON "DestinationClassification"("countryCode", "classificationType", "status");
CREATE INDEX IF NOT EXISTS "DestinationClassification_datasetVersion_status_idx" ON "DestinationClassification"("datasetVersion", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "CountryLanguageMapping_countryCode_languageCode_kind_datasetVersion_key" ON "CountryLanguageMapping"("countryCode", "languageCode", "kind", "datasetVersion");
CREATE INDEX IF NOT EXISTS "CountryLanguageMapping_countryCode_kind_status_idx" ON "CountryLanguageMapping"("countryCode", "kind", "status");
CREATE INDEX IF NOT EXISTS "CountryLanguageMapping_datasetVersion_status_idx" ON "CountryLanguageMapping"("datasetVersion", "status");

ALTER TABLE "DestinationAlias" DROP CONSTRAINT IF EXISTS "DestinationAlias_destinationId_fkey";
ALTER TABLE "DestinationAlias" ADD CONSTRAINT "DestinationAlias_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DestinationClassification" DROP CONSTRAINT IF EXISTS "DestinationClassification_destinationId_fkey";
ALTER TABLE "DestinationClassification" ADD CONSTRAINT "DestinationClassification_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DestinationClassification" DROP CONSTRAINT IF EXISTS "DestinationClassification_listingId_fkey";
ALTER TABLE "DestinationClassification" ADD CONSTRAINT "DestinationClassification_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
