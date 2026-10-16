-- E4.1: persisted guest-facing booking note and long-stay policy, plus an
-- immutable cancellation-policy snapshot for each reservation.
ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "longTermCancellationPolicy" TEXT DEFAULT 'FIRM',
  ADD COLUMN IF NOT EXISTS "bookingMessage" TEXT;

UPDATE "Listing"
SET "longTermCancellationPolicy" = 'FIRM'
WHERE "longTermCancellationPolicy" IS NULL;

ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "cancellationPolicy" TEXT;
