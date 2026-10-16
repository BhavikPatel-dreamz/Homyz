-- CreateEnum
CREATE TYPE "QualityIncidentStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "QualityIncidentCategory" AS ENUM ('PROPERTY_CONDITION', 'LISTING_ACCURACY', 'CLEANLINESS', 'SAFETY_HAZARD', 'HOST_SERVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "QualityIncidentSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- AlterTable
ALTER TABLE "GuestFavoriteEvaluation" ADD COLUMN "qualityIncidentCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ListingQualityIncident" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "bookingId" TEXT,
    "reportedById" TEXT,
    "category" "QualityIncidentCategory" NOT NULL,
    "status" "QualityIncidentStatus" NOT NULL DEFAULT 'PENDING',
    "severity" "QualityIncidentSeverity",
    "description" TEXT,
    "resolutionNotes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingQualityIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingQualityIncident_listingId_idx" ON "ListingQualityIncident"("listingId");

-- CreateIndex
CREATE INDEX "ListingQualityIncident_listingId_status_idx" ON "ListingQualityIncident"("listingId", "status");

-- CreateIndex
CREATE INDEX "ListingQualityIncident_bookingId_idx" ON "ListingQualityIncident"("bookingId");

-- CreateIndex
CREATE INDEX "ListingQualityIncident_createdAt_idx" ON "ListingQualityIncident"("createdAt");

-- AddForeignKey
ALTER TABLE "ListingQualityIncident" ADD CONSTRAINT "ListingQualityIncident_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingQualityIncident" ADD CONSTRAINT "ListingQualityIncident_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingQualityIncident" ADD CONSTRAINT "ListingQualityIncident_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

