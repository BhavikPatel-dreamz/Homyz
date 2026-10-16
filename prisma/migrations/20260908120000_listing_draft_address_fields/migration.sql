-- Preserve the address fields independently so draft resume can restore the
-- host's exact form values rather than attempting to parse a formatted string.
ALTER TABLE "Listing"
  ADD COLUMN "locationSearch" TEXT,
  ADD COLUMN "shortAddress" TEXT,
  ADD COLUMN "apartment" TEXT;
