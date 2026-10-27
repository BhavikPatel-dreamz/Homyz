-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TravelProfileVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'FOLLOWERS_ONLY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable TravelProfile
CREATE TABLE IF NOT EXISTS "TravelProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "handle" TEXT,
    "displayName" TEXT,
    "bio" TEXT,
    "homeLocation" TEXT,
    "coverUrl" TEXT,
    "coverMediaId" TEXT,
    "visibility" "TravelProfileVisibility" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable ProfileLike
CREATE TABLE IF NOT EXISTS "ProfileLike" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfileLike_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TravelProfile_userId_key" ON "TravelProfile"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "TravelProfile_handle_key" ON "TravelProfile"("handle");
CREATE INDEX IF NOT EXISTS "TravelProfile_handle_idx" ON "TravelProfile"("handle");
CREATE INDEX IF NOT EXISTS "TravelProfile_visibility_idx" ON "TravelProfile"("visibility");

CREATE UNIQUE INDEX IF NOT EXISTS "ProfileLike_actorId_targetUserId_key" ON "ProfileLike"("actorId", "targetUserId");
CREATE INDEX IF NOT EXISTS "ProfileLike_targetUserId_idx" ON "ProfileLike"("targetUserId");
CREATE INDEX IF NOT EXISTS "ProfileLike_actorId_idx" ON "ProfileLike"("actorId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "TravelProfile" ADD CONSTRAINT "TravelProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "TravelProfile" ALTER COLUMN "visibility" DROP DEFAULT;
    ALTER TABLE "TravelProfile" ALTER COLUMN "visibility" TYPE "TravelProfileVisibility" USING "visibility"::text::"TravelProfileVisibility";
    ALTER TABLE "TravelProfile" ALTER COLUMN "visibility" SET DEFAULT 'PUBLIC'::"TravelProfileVisibility";
EXCEPTION
    WHEN undefined_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "ProfileLike" ADD CONSTRAINT "ProfileLike_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "ProfileLike" ADD CONSTRAINT "ProfileLike_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

