-- Phase 3: Trips, Verified Destinations & Travel Albums Foundation
-- Additive only: preserves existing User, Booking, Listing, Review, TripPhoto, and TravelMedia records.

CREATE TYPE "TravelTripStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "TravelTripVisibility" AS ENUM ('PRIVATE', 'PUBLIC');
CREATE TYPE "TravelEvidenceSource" AS ENUM ('VERIFIED_BOOKING', 'MANUAL_DECLARATION');
CREATE TYPE "TravelEvidenceStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'REVOKED');

-- TravelProfile model
CREATE TABLE "TravelProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "handle" TEXT,
  "bio" TEXT,
  "homeDestinationId" TEXT,
  "visibility" "TravelTripVisibility" NOT NULL DEFAULT 'PRIVATE',
  "coverMediaId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TravelProfile_pkey" PRIMARY KEY ("id")
);

-- UserBlock safety edge
CREATE TABLE "UserBlock" (
  "id" TEXT NOT NULL,
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

-- Canonical Destination model
CREATE TABLE "Destination" (
  "id" TEXT NOT NULL,
  "canonicalKey" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalizedName" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL,
  "countryName" TEXT NOT NULL,
  "regionName" TEXT,
  "regionCode" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "providerPlaceId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Destination_pkey" PRIMARY KEY ("id")
);

-- User visited destinations
CREATE TABLE "UserDestination" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "destinationId" TEXT NOT NULL,
  "firstVisitedAt" TIMESTAMP(3),
  "lastVisitedAt" TIMESTAMP(3),
  "selfDeclared" BOOLEAN NOT NULL DEFAULT true,
  "visibility" "TravelTripVisibility" NOT NULL DEFAULT 'PRIVATE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserDestination_pkey" PRIMARY KEY ("id")
);

-- Auditable booking & manual visit evidence
CREATE TABLE "TravelVisitEvidence" (
  "id" TEXT NOT NULL,
  "userDestinationId" TEXT NOT NULL,
  "bookingId" TEXT,
  "source" "TravelEvidenceSource" NOT NULL DEFAULT 'VERIFIED_BOOKING',
  "status" "TravelEvidenceStatus" NOT NULL DEFAULT 'ACTIVE',
  "relevantDate" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TravelVisitEvidence_pkey" PRIMARY KEY ("id")
);

-- Travel Trip container
CREATE TABLE "TravelTrip" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "destinationId" TEXT,
  "startedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "visibility" "TravelTripVisibility" NOT NULL DEFAULT 'PRIVATE',
  "status" "TravelTripStatus" NOT NULL DEFAULT 'DRAFT',
  "coverPhotoId" TEXT,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TravelTrip_pkey" PRIMARY KEY ("id")
);

-- Active travel photos attached to trip (max 5 per trip enforced at application/transaction level)
CREATE TABLE "TravelPhoto" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "mediaAssetId" TEXT NOT NULL,
  "caption" TEXT,
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TravelPhoto_pkey" PRIMARY KEY ("id")
);

-- Unique indexes
CREATE UNIQUE INDEX "TravelProfile_userId_key" ON "TravelProfile"("userId");
CREATE UNIQUE INDEX "TravelProfile_handle_key" ON "TravelProfile"("handle");
CREATE INDEX "TravelProfile_handle_idx" ON "TravelProfile"("handle");

CREATE UNIQUE INDEX "UserBlock_blockerId_blockedId_key" ON "UserBlock"("blockerId", "blockedId");
CREATE INDEX "UserBlock_blockerId_idx" ON "UserBlock"("blockerId");
CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");

CREATE UNIQUE INDEX "Destination_canonicalKey_key" ON "Destination"("canonicalKey");
CREATE INDEX "Destination_normalizedName_idx" ON "Destination"("normalizedName");
CREATE INDEX "Destination_countryCode_idx" ON "Destination"("countryCode");
CREATE INDEX "Destination_countryName_idx" ON "Destination"("countryName");
CREATE INDEX "Destination_providerPlaceId_idx" ON "Destination"("providerPlaceId");

CREATE UNIQUE INDEX "UserDestination_userId_destinationId_key" ON "UserDestination"("userId", "destinationId");
CREATE INDEX "UserDestination_userId_selfDeclared_idx" ON "UserDestination"("userId", "selfDeclared");
CREATE INDEX "UserDestination_destinationId_idx" ON "UserDestination"("destinationId");

CREATE UNIQUE INDEX "TravelVisitEvidence_bookingId_key" ON "TravelVisitEvidence"("bookingId");
CREATE INDEX "TravelVisitEvidence_userDestinationId_status_idx" ON "TravelVisitEvidence"("userDestinationId", "status");
CREATE INDEX "TravelVisitEvidence_source_status_idx" ON "TravelVisitEvidence"("source", "status");

CREATE INDEX "TravelTrip_userId_deletedAt_createdAt_idx" ON "TravelTrip"("userId", "deletedAt", "createdAt");
CREATE INDEX "TravelTrip_destinationId_idx" ON "TravelTrip"("destinationId");
CREATE INDEX "TravelTrip_status_visibility_idx" ON "TravelTrip"("status", "visibility");

CREATE UNIQUE INDEX "TravelPhoto_tripId_mediaAssetId_key" ON "TravelPhoto"("tripId", "mediaAssetId");
CREATE INDEX "TravelPhoto_tripId_deletedAt_displayOrder_idx" ON "TravelPhoto"("tripId", "deletedAt", "displayOrder");
CREATE INDEX "TravelPhoto_userId_deletedAt_idx" ON "TravelPhoto"("userId", "deletedAt");
CREATE INDEX "TravelPhoto_mediaAssetId_idx" ON "TravelPhoto"("mediaAssetId");

-- Foreign key constraints
ALTER TABLE "TravelProfile"
  ADD CONSTRAINT "TravelProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TravelProfile"
  ADD CONSTRAINT "TravelProfile_homeDestinationId_fkey"
  FOREIGN KEY ("homeDestinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserBlock"
  ADD CONSTRAINT "UserBlock_blockerId_fkey"
  FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserBlock"
  ADD CONSTRAINT "UserBlock_blockedId_fkey"
  FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserDestination"
  ADD CONSTRAINT "UserDestination_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserDestination"
  ADD CONSTRAINT "UserDestination_destinationId_fkey"
  FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TravelVisitEvidence"
  ADD CONSTRAINT "TravelVisitEvidence_userDestinationId_fkey"
  FOREIGN KEY ("userDestinationId") REFERENCES "UserDestination"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TravelVisitEvidence"
  ADD CONSTRAINT "TravelVisitEvidence_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TravelTrip"
  ADD CONSTRAINT "TravelTrip_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TravelTrip"
  ADD CONSTRAINT "TravelTrip_destinationId_fkey"
  FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "TravelPhoto"
  ADD CONSTRAINT "TravelPhoto_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "TravelTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TravelPhoto"
  ADD CONSTRAINT "TravelPhoto_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TravelPhoto"
  ADD CONSTRAINT "TravelPhoto_mediaAssetId_fkey"
  FOREIGN KEY ("mediaAssetId") REFERENCES "TravelMediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TravelTrip"
  ADD CONSTRAINT "TravelTrip_coverPhotoId_fkey"
  FOREIGN KEY ("coverPhotoId") REFERENCES "TravelPhoto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

