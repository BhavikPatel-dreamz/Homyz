-- Additive migration for TravelTrip, TravelPhoto, and TravelPhotoLike
DO $$ BEGIN
    CREATE TYPE "TravelTripStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Ensure TravelProfile columns exist
ALTER TABLE "TravelProfile" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "TravelProfile" ADD COLUMN IF NOT EXISTS "homeLocation" TEXT;
ALTER TABLE "TravelProfile" ADD COLUMN IF NOT EXISTS "coverUrl" TEXT;

-- 2. Create or Alter TravelTrip
CREATE TABLE IF NOT EXISTS "TravelTrip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "destinationId" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "coverPhotoId" TEXT,
    "status" "TravelTripStatus" NOT NULL DEFAULT 'PUBLISHED',
    "visibility" "TravelProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelTrip_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TravelTrip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "TravelTrip" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "TravelTrip" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);
ALTER TABLE "TravelTrip" ADD COLUMN IF NOT EXISTS "coverPhotoId" TEXT;
ALTER TABLE "TravelTrip" ADD COLUMN IF NOT EXISTS "status" "TravelTripStatus" NOT NULL DEFAULT 'PUBLISHED';
ALTER TABLE "TravelTrip" ADD COLUMN IF NOT EXISTS "visibility" "TravelProfileVisibility" NOT NULL DEFAULT 'PUBLIC';

DO $$ BEGIN
    UPDATE "TravelTrip" SET "startDate" = "startedAt" WHERE "startDate" IS NULL AND "startedAt" IS NOT NULL;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    UPDATE "TravelTrip" SET "endDate" = "endedAt" WHERE "endDate" IS NULL AND "endedAt" IS NOT NULL;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "TravelTrip_userId_status_idx" ON "TravelTrip"("userId", "status");
CREATE INDEX IF NOT EXISTS "TravelTrip_createdAt_idx" ON "TravelTrip"("createdAt");

-- 3. Create or Alter TravelPhoto
CREATE TABLE IF NOT EXISTS "TravelPhoto" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tripId" TEXT,
    "url" TEXT NOT NULL DEFAULT '',
    "thumbnailUrl" TEXT,
    "mediumUrl" TEXT,
    "caption" TEXT,
    "location" TEXT,
    "destinationId" TEXT,
    "visibility" "TravelProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelPhoto_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TravelPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TravelPhoto_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TravelTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE "TravelPhoto" ADD COLUMN IF NOT EXISTS "url" TEXT NOT NULL DEFAULT '';
ALTER TABLE "TravelPhoto" ADD COLUMN IF NOT EXISTS "thumbnailUrl" TEXT;
ALTER TABLE "TravelPhoto" ADD COLUMN IF NOT EXISTS "mediumUrl" TEXT;
ALTER TABLE "TravelPhoto" ADD COLUMN IF NOT EXISTS "order" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TravelPhoto" ADD COLUMN IF NOT EXISTS "visibility" "TravelProfileVisibility" NOT NULL DEFAULT 'PUBLIC';
ALTER TABLE "TravelPhoto" ADD COLUMN IF NOT EXISTS "destinationId" TEXT;
ALTER TABLE "TravelPhoto" ADD COLUMN IF NOT EXISTS "tripId" TEXT;

DO $$ BEGIN
    BEGIN
        ALTER TABLE "TravelPhoto" ALTER COLUMN "mediaAssetId" DROP NOT NULL;
    EXCEPTION WHEN undefined_column THEN null; END;
    BEGIN
        ALTER TABLE "TravelPhoto" ALTER COLUMN "tripId" DROP NOT NULL;
    EXCEPTION WHEN undefined_column THEN null; END;
END $$;

CREATE INDEX IF NOT EXISTS "TravelPhoto_userId_createdAt_idx" ON "TravelPhoto"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "TravelPhoto_tripId_idx" ON "TravelPhoto"("tripId");

-- 4. Create or Alter TravelPhotoLike
CREATE TABLE IF NOT EXISTS "TravelPhotoLike" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelPhotoLike_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TravelPhotoLike_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "TravelPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

ALTER TABLE "TravelPhotoLike" ADD COLUMN IF NOT EXISTS "actorId" TEXT;

DO $$ BEGIN
    UPDATE "TravelPhotoLike" SET "actorId" = "userId" WHERE "actorId" IS NULL AND "userId" IS NOT NULL;
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TravelPhotoLike" ALTER COLUMN "actorId" SET NOT NULL;
EXCEPTION
    WHEN others THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "TravelPhotoLike_actorId_photoId_key" ON "TravelPhotoLike"("actorId", "photoId");
CREATE INDEX IF NOT EXISTS "TravelPhotoLike_photoId_idx" ON "TravelPhotoLike"("photoId");
CREATE INDEX IF NOT EXISTS "TravelPhotoLike_actorId_idx" ON "TravelPhotoLike"("actorId");
