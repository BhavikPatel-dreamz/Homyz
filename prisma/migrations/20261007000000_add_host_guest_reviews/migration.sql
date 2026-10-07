-- One host-side review record per reservation. Guest-authored reviews remain
-- in the existing Review table, which is also unique by booking.
CREATE TABLE "HostGuestReview" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "cleanlinessRating" INTEGER NOT NULL DEFAULT 5,
    "cleanlinessTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "houseRulesRating" INTEGER NOT NULL DEFAULT 5,
    "communicationRating" INTEGER NOT NULL DEFAULT 5,
    "communicationTags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "publicReview" TEXT,
    "recommendGuest" BOOLEAN NOT NULL DEFAULT true,
    "privateNote" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostGuestReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HostGuestReview_bookingId_key" ON "HostGuestReview"("bookingId");
CREATE INDEX "HostGuestReview_hostId_submittedAt_idx" ON "HostGuestReview"("hostId", "submittedAt");
CREATE INDEX "HostGuestReview_guestId_submittedAt_idx" ON "HostGuestReview"("guestId", "submittedAt");
CREATE INDEX "HostGuestReview_guestId_status_idx" ON "HostGuestReview"("guestId", "status");

ALTER TABLE "HostGuestReview"
  ADD CONSTRAINT "HostGuestReview_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HostGuestReview"
  ADD CONSTRAINT "HostGuestReview_hostId_fkey"
  FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HostGuestReview"
  ADD CONSTRAINT "HostGuestReview_guestId_fkey"
  FOREIGN KEY ("guestId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
