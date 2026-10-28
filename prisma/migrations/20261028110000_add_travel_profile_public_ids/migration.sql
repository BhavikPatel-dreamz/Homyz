-- Permanent, opaque public identifiers for canonical Travel Profile links.
-- Existing records are backfilled deterministically without exposing their
-- primary keys. New records receive a database-generated value so direct
-- Prisma maintenance creates cannot omit the identifier.
ALTER TABLE "TravelProfile" ADD COLUMN IF NOT EXISTS "publicId" TEXT;

UPDATE "TravelProfile"
SET "publicId" = 'trv_' || substr(md5("id"), 1, 16)
WHERE "publicId" IS NULL;

ALTER TABLE "TravelProfile"
  ALTER COLUMN "publicId" SET DEFAULT ('trv_'::text || substr(md5(random()::text || clock_timestamp()::text), 1, 16));

ALTER TABLE "TravelProfile"
  ALTER COLUMN "publicId" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "TravelProfile_publicId_key"
  ON "TravelProfile"("publicId");

CREATE INDEX IF NOT EXISTS "TravelProfile_publicId_idx"
  ON "TravelProfile"("publicId");
