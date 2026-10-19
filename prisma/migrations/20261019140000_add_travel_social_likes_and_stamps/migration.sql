-- AlterTable TravelProfile
ALTER TABLE "TravelProfile" ADD COLUMN IF NOT EXISTS "stampsVisible" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable TravelProfileLike
CREATE TABLE IF NOT EXISTS "TravelProfileLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelProfileLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable TravelPhotoLike
CREATE TABLE IF NOT EXISTS "TravelPhotoLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelPhotoLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable TravelStamp
CREATE TABLE IF NOT EXISTS "TravelStamp" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'DESTINATION',
    "imageUrl" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelStamp_pkey" PRIMARY KEY ("id")
);

-- CreateTable UserTravelStamp
CREATE TABLE IF NOT EXISTS "UserTravelStamp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stampId" TEXT NOT NULL,
    "isDisplayed" BOOLEAN NOT NULL DEFAULT true,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTravelStamp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TravelProfileLike_userId_profileId_key" ON "TravelProfileLike"("userId", "profileId");
CREATE INDEX IF NOT EXISTS "TravelProfileLike_profileId_idx" ON "TravelProfileLike"("profileId");
CREATE INDEX IF NOT EXISTS "TravelProfileLike_userId_idx" ON "TravelProfileLike"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "TravelPhotoLike_userId_photoId_key" ON "TravelPhotoLike"("userId", "photoId");
CREATE INDEX IF NOT EXISTS "TravelPhotoLike_photoId_idx" ON "TravelPhotoLike"("photoId");
CREATE INDEX IF NOT EXISTS "TravelPhotoLike_userId_idx" ON "TravelPhotoLike"("userId");

CREATE UNIQUE INDEX IF NOT EXISTS "TravelStamp_slug_key" ON "TravelStamp"("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "UserTravelStamp_userId_stampId_key" ON "UserTravelStamp"("userId", "stampId");
CREATE INDEX IF NOT EXISTS "UserTravelStamp_userId_isDisplayed_idx" ON "UserTravelStamp"("userId", "isDisplayed");
CREATE INDEX IF NOT EXISTS "UserTravelStamp_stampId_idx" ON "UserTravelStamp"("stampId");

-- Foreign Keys
ALTER TABLE "TravelProfileLike" ADD CONSTRAINT "TravelProfileLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelProfileLike" ADD CONSTRAINT "TravelProfileLike_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TravelProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TravelPhotoLike" ADD CONSTRAINT "TravelPhotoLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelPhotoLike" ADD CONSTRAINT "TravelPhotoLike_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "TravelPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserTravelStamp" ADD CONSTRAINT "UserTravelStamp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserTravelStamp" ADD CONSTRAINT "UserTravelStamp_stampId_fkey" FOREIGN KEY ("stampId") REFERENCES "TravelStamp"("id") ON DELETE CASCADE ON UPDATE CASCADE;

