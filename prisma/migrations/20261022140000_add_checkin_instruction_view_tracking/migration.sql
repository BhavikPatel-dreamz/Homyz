ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "checkInInstructionsViewedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Booking_listingId_checkInInstructionsViewedAt_idx"
  ON "Booking"("listingId", "checkInInstructionsViewedAt");
