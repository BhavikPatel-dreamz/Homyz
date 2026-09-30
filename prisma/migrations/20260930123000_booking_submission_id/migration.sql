-- A nullable unique checkout key provides database-enforced idempotency for
-- new submissions without changing historical bookings.
ALTER TABLE "Booking" ADD COLUMN "submissionId" TEXT;
CREATE UNIQUE INDEX "Booking_submissionId_key" ON "Booking"("submissionId");
