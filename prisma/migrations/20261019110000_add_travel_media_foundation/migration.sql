-- Phase 2 travel media foundation. Additive only; no legacy TripPhoto rows,
-- listing media, bookings, or payments are changed by this migration.

CREATE TYPE "TravelMediaType" AS ENUM ('TRAVEL_PHOTO', 'TRAVEL_COVER');
CREATE TYPE "TravelMediaUploadStatus" AS ENUM ('CREATED', 'UPLOADING', 'UPLOADED', 'PROCESSING', 'READY', 'FAILED', 'CANCELLED', 'DELETED');
CREATE TYPE "TravelMediaProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');
CREATE TYPE "TravelMediaVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

ALTER TYPE "BackgroundJobType" ADD VALUE IF NOT EXISTS 'TRAVEL_MEDIA_PROCESS';
ALTER TYPE "BackgroundJobType" ADD VALUE IF NOT EXISTS 'TRAVEL_MEDIA_CLEANUP';

CREATE TABLE "TravelMediaAsset" (
  "id" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "storageProvider" TEXT NOT NULL,
  "storageKey" TEXT,
  "originalFileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "mediaType" "TravelMediaType" NOT NULL,
  "uploadStatus" "TravelMediaUploadStatus" NOT NULL DEFAULT 'CREATED',
  "processingStatus" "TravelMediaProcessingStatus" NOT NULL DEFAULT 'PENDING',
  "moderationStatus" TEXT,
  "visibility" "TravelMediaVisibility" NOT NULL DEFAULT 'PRIVATE',
  "checksum" TEXT,
  "failureReason" TEXT,
  "cleanupAfter" TIMESTAMP(3),
  "deleteAttempts" INTEGER NOT NULL DEFAULT 0,
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TravelMediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TravelMediaUploadSession" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "mediaType" "TravelMediaType" NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "declaredMimeType" TEXT NOT NULL,
  "declaredFileSize" INTEGER NOT NULL,
  "status" "TravelMediaUploadStatus" NOT NULL DEFAULT 'CREATED',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "uploadedAt" TIMESTAMP(3),
  "finalizedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TravelMediaUploadSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TravelMediaVariant" (
  "id" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "variantName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TravelMediaVariant_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TravelMediaAsset_storageKey_key" ON "TravelMediaAsset"("storageKey");
CREATE INDEX "TravelMediaAsset_ownerId_createdAt_idx" ON "TravelMediaAsset"("ownerId", "createdAt");
CREATE INDEX "TravelMediaAsset_ownerId_uploadStatus_createdAt_idx" ON "TravelMediaAsset"("ownerId", "uploadStatus", "createdAt");
CREATE INDEX "TravelMediaAsset_uploadStatus_cleanupAfter_idx" ON "TravelMediaAsset"("uploadStatus", "cleanupAfter");
CREATE INDEX "TravelMediaAsset_processingStatus_updatedAt_idx" ON "TravelMediaAsset"("processingStatus", "updatedAt");
CREATE INDEX "TravelMediaAsset_deletedAt_idx" ON "TravelMediaAsset"("deletedAt");
CREATE UNIQUE INDEX "TravelMediaUploadSession_assetId_key" ON "TravelMediaUploadSession"("assetId");
CREATE INDEX "TravelMediaUploadSession_ownerId_createdAt_idx" ON "TravelMediaUploadSession"("ownerId", "createdAt");
CREATE INDEX "TravelMediaUploadSession_status_expiresAt_idx" ON "TravelMediaUploadSession"("status", "expiresAt");
CREATE INDEX "TravelMediaUploadSession_expiresAt_idx" ON "TravelMediaUploadSession"("expiresAt");
CREATE UNIQUE INDEX "TravelMediaVariant_storageKey_key" ON "TravelMediaVariant"("storageKey");
CREATE UNIQUE INDEX "TravelMediaVariant_assetId_variantName_key" ON "TravelMediaVariant"("assetId", "variantName");
CREATE INDEX "TravelMediaVariant_assetId_idx" ON "TravelMediaVariant"("assetId");

ALTER TABLE "TravelMediaAsset"
  ADD CONSTRAINT "TravelMediaAsset_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelMediaUploadSession"
  ADD CONSTRAINT "TravelMediaUploadSession_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "TravelMediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelMediaUploadSession"
  ADD CONSTRAINT "TravelMediaUploadSession_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelMediaVariant"
  ADD CONSTRAINT "TravelMediaVariant_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "TravelMediaAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
