-- Non-refundable reservations are immutable terms chosen by the guest at booking time.
ALTER TABLE "Booking"
  ADD COLUMN IF NOT EXISTS "isNonRefundable" BOOLEAN NOT NULL DEFAULT false;
