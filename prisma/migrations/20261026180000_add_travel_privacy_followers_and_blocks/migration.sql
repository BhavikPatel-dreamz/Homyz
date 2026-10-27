-- Additive migration for Phase 5: Privacy, Follower Controls & User Blocking
DO $$ BEGIN
    CREATE TYPE "TravelFollowStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- TravelFollow
CREATE TABLE IF NOT EXISTS "TravelFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "status" "TravelFollowStatus" NOT NULL DEFAULT 'ACCEPTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TravelFollow_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "TravelFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TravelFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "TravelFollow_followerId_followingId_key" ON "TravelFollow"("followerId", "followingId");
CREATE INDEX IF NOT EXISTS "TravelFollow_followerId_status_idx" ON "TravelFollow"("followerId", "status");
CREATE INDEX IF NOT EXISTS "TravelFollow_followingId_status_idx" ON "TravelFollow"("followingId", "status");

-- UserBlock
CREATE TABLE IF NOT EXISTS "UserBlock" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserBlock_blockerId_blockedId_key" ON "UserBlock"("blockerId", "blockedId");
CREATE INDEX IF NOT EXISTS "UserBlock_blockerId_idx" ON "UserBlock"("blockerId");
CREATE INDEX IF NOT EXISTS "UserBlock_blockedId_idx" ON "UserBlock"("blockedId");

