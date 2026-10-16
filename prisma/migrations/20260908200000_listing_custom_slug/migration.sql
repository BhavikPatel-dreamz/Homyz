-- E5: custom slug for listings
ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "customSlug" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Listing_customSlug_key" ON "Listing"("customSlug");
