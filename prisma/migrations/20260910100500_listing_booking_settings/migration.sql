-- Store the Instant Book guest-history requirement selected by a host.
ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "requireGoodTrackRecord" BOOLEAN NOT NULL DEFAULT false;
