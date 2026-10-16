-- Persist availability notice and same-day request controls for each listing.
ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "advanceNotice" TEXT NOT NULL DEFAULT 'Same day',
  ADD COLUMN IF NOT EXISTS "sameDayCutoff" TEXT NOT NULL DEFAULT '12:00 AM',
  ADD COLUMN IF NOT EXISTS "allowSameDayRequests" BOOLEAN NOT NULL DEFAULT true;
