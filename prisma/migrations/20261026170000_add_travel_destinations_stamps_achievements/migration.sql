-- Additive migration for Phase 4: Travel Destinations, Stamps & Achievements
DO $$ BEGIN
    CREATE TYPE "TravelEvidenceSource" AS ENUM ('VERIFIED_BOOKING', 'MANUAL_DECLARATION');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TravelVerificationStatus" AS ENUM ('VERIFIED', 'UNVERIFIED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TravelStampCategory" AS ENUM ('COUNTRY', 'CITY', 'THEME', 'MILESTONE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TravelAchievementCategory" AS ENUM ('STAYS', 'CITIES', 'COUNTRIES', 'STAMPS', 'EXPLORER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "TravelAchievementStatus" AS ENUM ('LOCKED', 'IN_PROGRESS', 'UNLOCKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable TravelProfile to add showStamps toggle
ALTER TABLE "TravelProfile" ADD COLUMN IF NOT EXISTS "showStamps" BOOLEAN NOT NULL DEFAULT true;

-- 1. Destination
CREATE TABLE IF NOT EXISTS "Destination" (
    "id" TEXT NOT NULL,
    "countryName" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL,
    "cityName" TEXT,
    "slug" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "parentCountryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Destination_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Destination_parentCountryId_fkey" FOREIGN KEY ("parentCountryId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "Destination" ADD COLUMN IF NOT EXISTS "cityName" TEXT;
ALTER TABLE "Destination" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "Destination" ADD COLUMN IF NOT EXISTS "parentCountryId" TEXT;

DO $$ BEGIN
    UPDATE "Destination" SET "cityName" = "name" WHERE "cityName" IS NULL AND "name" IS NOT NULL;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    UPDATE "Destination" SET "slug" = LOWER("countryCode") || '-' || LOWER(COALESCE("cityName", COALESCE("name", 'country'))) WHERE "slug" IS NULL;
EXCEPTION
    WHEN others THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "Destination" ALTER COLUMN "slug" SET NOT NULL;
EXCEPTION
    WHEN others THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Destination_slug_key" ON "Destination"("slug");
CREATE INDEX IF NOT EXISTS "Destination_countryCode_idx" ON "Destination"("countryCode");
CREATE INDEX IF NOT EXISTS "Destination_countryName_idx" ON "Destination"("countryName");
CREATE INDEX IF NOT EXISTS "Destination_cityName_idx" ON "Destination"("cityName");
CREATE INDEX IF NOT EXISTS "Destination_parentCountryId_idx" ON "Destination"("parentCountryId");

-- 2. UserDestination
CREATE TABLE IF NOT EXISTS "UserDestination" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "destinationId" TEXT NOT NULL,
    "evidenceSource" "TravelEvidenceSource" NOT NULL DEFAULT 'VERIFIED_BOOKING',
    "verificationStatus" "TravelVerificationStatus" NOT NULL DEFAULT 'VERIFIED',
    "firstQualifyingVisitDate" TIMESTAMP(3),
    "latestQualifyingVisitDate" TIMESTAMP(3),
    "qualifyingBookingId" TEXT,
    "visitCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserDestination_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserDestination_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserDestination_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserDestination_qualifyingBookingId_fkey" FOREIGN KEY ("qualifyingBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "UserDestination" ADD COLUMN IF NOT EXISTS "evidenceSource" "TravelEvidenceSource" NOT NULL DEFAULT 'VERIFIED_BOOKING';
ALTER TABLE "UserDestination" ADD COLUMN IF NOT EXISTS "verificationStatus" "TravelVerificationStatus" NOT NULL DEFAULT 'VERIFIED';
ALTER TABLE "UserDestination" ADD COLUMN IF NOT EXISTS "firstQualifyingVisitDate" TIMESTAMP(3);
ALTER TABLE "UserDestination" ADD COLUMN IF NOT EXISTS "latestQualifyingVisitDate" TIMESTAMP(3);
ALTER TABLE "UserDestination" ADD COLUMN IF NOT EXISTS "qualifyingBookingId" TEXT;
ALTER TABLE "UserDestination" ADD COLUMN IF NOT EXISTS "visitCount" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS "UserDestination_userId_destinationId_evidenceSource_key" ON "UserDestination"("userId", "destinationId", "evidenceSource");
CREATE INDEX IF NOT EXISTS "UserDestination_userId_verificationStatus_idx" ON "UserDestination"("userId", "verificationStatus");
CREATE INDEX IF NOT EXISTS "UserDestination_destinationId_idx" ON "UserDestination"("destinationId");
CREATE INDEX IF NOT EXISTS "UserDestination_qualifyingBookingId_idx" ON "UserDestination"("qualifyingBookingId");

-- 3. TravelStamp
CREATE TABLE IF NOT EXISTS "TravelStamp" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "countryCode" TEXT,
    "destinationId" TEXT,
    "iconUrl" TEXT,
    "category" "TravelStampCategory" NOT NULL DEFAULT 'COUNTRY',
    "eligibilityRule" TEXT NOT NULL DEFAULT 'COMPLETED_STAYS',
    "ruleThreshold" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelStamp_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TravelStamp_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "TravelStamp" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "TravelStamp" ADD COLUMN IF NOT EXISTS "iconUrl" TEXT;
ALTER TABLE "TravelStamp" ADD COLUMN IF NOT EXISTS "countryCode" TEXT;
ALTER TABLE "TravelStamp" ADD COLUMN IF NOT EXISTS "destinationId" TEXT;
ALTER TABLE "TravelStamp" ADD COLUMN IF NOT EXISTS "eligibilityRule" TEXT NOT NULL DEFAULT 'COMPLETED_STAYS';
ALTER TABLE "TravelStamp" ADD COLUMN IF NOT EXISTS "ruleThreshold" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "TravelStamp" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

DO $$ BEGIN
    UPDATE "TravelStamp" SET "displayName" = "title" WHERE "displayName" IS NULL AND "title" IS NOT NULL;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    UPDATE "TravelStamp" SET "iconUrl" = "imageUrl" WHERE "iconUrl" IS NULL AND "imageUrl" IS NOT NULL;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TravelStamp" ALTER COLUMN "displayName" SET NOT NULL;
EXCEPTION
    WHEN others THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "TravelStamp_slug_key" ON "TravelStamp"("slug");
CREATE INDEX IF NOT EXISTS "TravelStamp_countryCode_idx" ON "TravelStamp"("countryCode");
CREATE INDEX IF NOT EXISTS "TravelStamp_category_idx" ON "TravelStamp"("category");

-- 4. UserTravelStamp
CREATE TABLE IF NOT EXISTS "UserTravelStamp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stampId" TEXT NOT NULL,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "qualifyingBookingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTravelStamp_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserTravelStamp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserTravelStamp_stampId_fkey" FOREIGN KEY ("stampId") REFERENCES "TravelStamp"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserTravelStamp_qualifyingBookingId_fkey" FOREIGN KEY ("qualifyingBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "UserTravelStamp" ADD COLUMN IF NOT EXISTS "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "UserTravelStamp" ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "UserTravelStamp" ADD COLUMN IF NOT EXISTS "displayOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserTravelStamp" ADD COLUMN IF NOT EXISTS "qualifyingBookingId" TEXT;
ALTER TABLE "UserTravelStamp" ADD COLUMN IF NOT EXISTS "evidenceMetadata" JSONB;
ALTER TABLE "UserTravelStamp" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "UserTravelStamp" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "TravelStamp" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$ BEGIN
    UPDATE "UserTravelStamp" SET "awardedAt" = "earnedAt" WHERE "earnedAt" IS NOT NULL;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    UPDATE "UserTravelStamp" SET "isPinned" = "isDisplayed" WHERE "isDisplayed" IS NOT NULL;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "UserTravelStamp_userId_stampId_key" ON "UserTravelStamp"("userId", "stampId");
CREATE INDEX IF NOT EXISTS "UserTravelStamp_userId_isPinned_idx" ON "UserTravelStamp"("userId", "isPinned");
CREATE INDEX IF NOT EXISTS "UserTravelStamp_stampId_idx" ON "UserTravelStamp"("stampId");

-- 5. TravelAchievement
CREATE TABLE IF NOT EXISTS "TravelAchievement" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT,
    "category" "TravelAchievementCategory" NOT NULL DEFAULT 'EXPLORER',
    "eligibilityRule" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelAchievement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TravelAchievement_key_key" ON "TravelAchievement"("key");
CREATE INDEX IF NOT EXISTS "TravelAchievement_category_idx" ON "TravelAchievement"("category");

-- 6. UserTravelAchievement
CREATE TABLE IF NOT EXISTS "UserTravelAchievement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "achievementId" TEXT NOT NULL,
    "status" "TravelAchievementStatus" NOT NULL DEFAULT 'LOCKED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "awardedAt" TIMESTAMP(3),
    "auditMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserTravelAchievement_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserTravelAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserTravelAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "TravelAchievement"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserTravelAchievement_userId_achievementId_key" ON "UserTravelAchievement"("userId", "achievementId");
CREATE INDEX IF NOT EXISTS "UserTravelAchievement_userId_status_idx" ON "UserTravelAchievement"("userId", "status");
CREATE INDEX IF NOT EXISTS "UserTravelAchievement_achievementId_idx" ON "UserTravelAchievement"("achievementId");
