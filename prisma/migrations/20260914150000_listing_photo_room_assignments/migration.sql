-- Preserve the existing Listing.photos URL array and store optional room
-- categorization separately for the host-only Photo Tour editor.
ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "photoRoomAssignments" JSONB;
