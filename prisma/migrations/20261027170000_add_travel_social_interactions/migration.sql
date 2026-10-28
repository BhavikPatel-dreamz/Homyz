-- Additive migration for Travel Profile Social Interactions (Comments, Trip Likes)
ALTER TABLE "TravelPhotoLike" ADD COLUMN IF NOT EXISTS "userId" TEXT;
UPDATE "TravelPhotoLike" SET "userId" = "actorId" WHERE "userId" IS NULL;
ALTER TABLE "TravelPhotoLike" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "TravelPhotoLike" DROP CONSTRAINT IF EXISTS "TravelPhotoLike_userId_fkey";
ALTER TABLE "TravelPhotoLike" ADD CONSTRAINT "TravelPhotoLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TravelTripLike" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelTripLike_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TravelTripLike_actorId_tripId_key" ON "TravelTripLike"("actorId", "tripId");
CREATE INDEX IF NOT EXISTS "TravelTripLike_tripId_idx" ON "TravelTripLike"("tripId");
CREATE INDEX IF NOT EXISTS "TravelTripLike_actorId_idx" ON "TravelTripLike"("actorId");

ALTER TABLE "TravelTripLike" DROP CONSTRAINT IF EXISTS "TravelTripLike_tripId_fkey";
ALTER TABLE "TravelTripLike" ADD CONSTRAINT "TravelTripLike_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TravelTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TravelTripLike" DROP CONSTRAINT IF EXISTS "TravelTripLike_actorId_fkey";
ALTER TABLE "TravelTripLike" ADD CONSTRAINT "TravelTripLike_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TravelPhotoComment" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelPhotoComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TravelPhotoComment_photoId_createdAt_idx" ON "TravelPhotoComment"("photoId", "createdAt");
CREATE INDEX IF NOT EXISTS "TravelPhotoComment_userId_idx" ON "TravelPhotoComment"("userId");

ALTER TABLE "TravelPhotoComment" DROP CONSTRAINT IF EXISTS "TravelPhotoComment_photoId_fkey";
ALTER TABLE "TravelPhotoComment" ADD CONSTRAINT "TravelPhotoComment_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "TravelPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TravelPhotoComment" DROP CONSTRAINT IF EXISTS "TravelPhotoComment_userId_fkey";
ALTER TABLE "TravelPhotoComment" ADD CONSTRAINT "TravelPhotoComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
