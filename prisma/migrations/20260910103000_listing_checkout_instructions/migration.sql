-- Add checkOutInstructions to Listing
ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "checkOutInstructions" TEXT;
