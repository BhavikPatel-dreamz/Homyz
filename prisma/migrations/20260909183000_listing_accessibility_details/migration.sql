-- Store host-uploaded evidence photos for individual accessibility features.
ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "accessibilityDetails" JSONB;
