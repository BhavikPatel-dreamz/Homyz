-- CreateEnum
CREATE TYPE "TravelTagStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- AlterTable TravelPhoto: Add location and destinationId
ALTER TABLE "TravelPhoto" ADD COLUMN IF NOT EXISTS "location" TEXT;
ALTER TABLE "TravelPhoto" ADD COLUMN IF NOT EXISTS "destinationId" TEXT;

-- CreateTable TravelPhotoTag
CREATE TABLE IF NOT EXISTS "TravelPhotoTag" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "taggedUserId" TEXT NOT NULL,
    "status" "TravelTagStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelPhotoTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TravelPhotoTag_photoId_taggedUserId_key" ON "TravelPhotoTag"("photoId", "taggedUserId");
CREATE INDEX IF NOT EXISTS "TravelPhotoTag_taggedUserId_status_idx" ON "TravelPhotoTag"("taggedUserId", "status");
CREATE INDEX IF NOT EXISTS "TravelPhotoTag_photoId_idx" ON "TravelPhotoTag"("photoId");
CREATE INDEX IF NOT EXISTS "TravelPhoto_destinationId_idx" ON "TravelPhoto"("destinationId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TravelPhoto_destinationId_fkey') THEN
        ALTER TABLE "TravelPhoto" ADD CONSTRAINT "TravelPhoto_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "Destination"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TravelPhotoTag_photoId_fkey') THEN
        ALTER TABLE "TravelPhotoTag" ADD CONSTRAINT "TravelPhotoTag_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "TravelPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'TravelPhotoTag_taggedUserId_fkey') THEN
        ALTER TABLE "TravelPhotoTag" ADD CONSTRAINT "TravelPhotoTag_taggedUserId_fkey" FOREIGN KEY ("taggedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

