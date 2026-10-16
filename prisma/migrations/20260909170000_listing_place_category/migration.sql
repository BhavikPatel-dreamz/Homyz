-- Persist the broad category selected by hosts in “Which is most like your place?”
ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "placeCategory" TEXT;
