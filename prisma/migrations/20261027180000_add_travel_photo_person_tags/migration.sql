-- Photo-scoped people tags for current TravelPhoto records.
CREATE TABLE IF NOT EXISTS "TravelPhotoPersonTag" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "taggedUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TravelPhotoPersonTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TravelPhotoPersonTag_photoId_taggedUserId_key"
  ON "TravelPhotoPersonTag"("photoId", "taggedUserId");
CREATE INDEX IF NOT EXISTS "TravelPhotoPersonTag_taggedUserId_idx"
  ON "TravelPhotoPersonTag"("taggedUserId");

ALTER TABLE "TravelPhotoPersonTag" DROP CONSTRAINT IF EXISTS "TravelPhotoPersonTag_photoId_fkey";
ALTER TABLE "TravelPhotoPersonTag" ADD CONSTRAINT "TravelPhotoPersonTag_photoId_fkey"
  FOREIGN KEY ("photoId") REFERENCES "TravelPhoto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TravelPhotoPersonTag" DROP CONSTRAINT IF EXISTS "TravelPhotoPersonTag_taggedUserId_fkey";
ALTER TABLE "TravelPhotoPersonTag" ADD CONSTRAINT "TravelPhotoPersonTag_taggedUserId_fkey"
  FOREIGN KEY ("taggedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
