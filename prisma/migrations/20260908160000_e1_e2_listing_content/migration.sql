-- Additive E1/E2 listing content fields. These values are host-authored
-- public listing content and intentionally remain nullable for legacy listings.
ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "descriptionSections" JSONB,
  ADD COLUMN IF NOT EXISTS "neighborhoodDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "gettingAround" TEXT;
