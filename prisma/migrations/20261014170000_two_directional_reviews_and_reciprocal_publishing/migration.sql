-- Phase 3: Two-directional reviews, reciprocal blind publishing, and review responses.

-- 1. Create ReviewDirection enum
CREATE TYPE "ReviewDirection" AS ENUM ('GUEST_TO_PROPERTY', 'HOST_TO_GUEST');

-- 2. Add values to ReviewStatus enum
ALTER TYPE "ReviewStatus" ADD VALUE 'PRIVATE';
ALTER TYPE "ReviewStatus" ADD VALUE 'EXPIRED';

-- 3. Upgrade Review table with direction, target user, ratings, deadlines, and moderation fields
ALTER TABLE "Review"
  ALTER COLUMN "listingId" DROP NOT NULL,
  ADD COLUMN "direction" "ReviewDirection" NOT NULL DEFAULT 'GUEST_TO_PROPERTY',
  ADD COLUMN "targetUserId" TEXT,
  ADD COLUMN "houseRulesRating" INTEGER,
  ADD COLUMN "privateNoteToGuest" TEXT,
  ADD COLUMN "recommendGuest" BOOLEAN,
  ADD COLUMN "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "publishedAt" TIMESTAMP(3),
  ADD COLUMN "reviewDeadline" TIMESTAMP(3),
  ADD COLUMN "editDeadline" TIMESTAMP(3),
  ADD COLUMN "moderationNotes" TEXT,
  ADD COLUMN "moderationCaseId" TEXT;

-- 4. Create ReviewResponse table
CREATE TABLE "ReviewResponse" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "comment" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewResponse_pkey" PRIMARY KEY ("id")
);

-- 5. Drop old 1:1 unique constraint on bookingId and create compound unique constraint on (bookingId, direction)
DROP INDEX IF EXISTS "Review_bookingId_key";
CREATE UNIQUE INDEX "Review_bookingId_direction_key" ON "Review"("bookingId", "direction");

-- 6. Add indexes
CREATE UNIQUE INDEX "ReviewResponse_reviewId_key" ON "ReviewResponse"("reviewId");
CREATE INDEX "ReviewResponse_authorId_idx" ON "ReviewResponse"("authorId");
CREATE INDEX "Review_targetUserId_idx" ON "Review"("targetUserId");
CREATE INDEX "Review_direction_status_idx" ON "Review"("direction", "status");
CREATE INDEX "Review_status_reviewDeadline_idx" ON "Review"("status", "reviewDeadline");
CREATE INDEX "Review_moderationCaseId_idx" ON "Review"("moderationCaseId");

-- 7. Add foreign keys
ALTER TABLE "Review"
  ADD CONSTRAINT "Review_targetUserId_fkey"
  FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_moderationCaseId_fkey"
  FOREIGN KEY ("moderationCaseId") REFERENCES "ModerationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ReviewResponse"
  ADD CONSTRAINT "ReviewResponse_reviewId_fkey"
  FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewResponse"
  ADD CONSTRAINT "ReviewResponse_authorId_fkey"
  FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 8. Safe Historical Backfill
-- Preserve existing reviews as GUEST_TO_PROPERTY with original timestamps intact
UPDATE "Review"
SET "publishedAt" = "createdAt"
WHERE "status" = 'PUBLISHED' AND "publishedAt" IS NULL;

UPDATE "Review"
SET "submittedAt" = "createdAt"
WHERE "submittedAt" IS NULL;

UPDATE "Review" r
SET "targetUserId" = l."hostId"
FROM "Listing" l
WHERE r."listingId" = l."id" AND r."targetUserId" IS NULL;

