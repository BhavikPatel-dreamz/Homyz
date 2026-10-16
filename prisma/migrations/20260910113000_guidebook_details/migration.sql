-- Guidebook-level introduction shown to guests beneath the cover image.
ALTER TABLE "Guidebook" ADD COLUMN IF NOT EXISTS "description" TEXT;
