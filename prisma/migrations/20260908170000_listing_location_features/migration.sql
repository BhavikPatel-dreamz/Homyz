-- Reconciles the Prisma Listing.locationFeatures field with the live schema.
-- Existing listings receive the schema default (an empty array), preserving all rows.
ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "locationFeatures" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
