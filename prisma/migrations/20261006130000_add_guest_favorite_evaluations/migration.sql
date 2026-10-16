-- Persisted listing-level Guest Favorite status plus an idempotent daily
-- evaluation snapshot. No guest-identifying review or booking data is stored.
ALTER TABLE "Listing"
  ADD COLUMN "isGuestFavorite" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "guestFavoriteSince" TIMESTAMP(3),
  ADD COLUMN "guestFavoriteLastEvaluatedAt" TIMESTAMP(3);

CREATE TABLE "GuestFavoriteEvaluation" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "evaluationDate" DATE NOT NULL,
  "publishedReviewCount" INTEGER NOT NULL,
  "overallRating" DOUBLE PRECISION,
  "subratings" JSONB,
  "totalBookings" INTEGER NOT NULL,
  "hostCancellationCount" INTEGER NOT NULL,
  "reliabilityFailureRatePercentage" DOUBLE PRECISION NOT NULL,
  "qualityIncidentDataStatus" TEXT NOT NULL,
  "qualified" BOOLEAN NOT NULL,
  "failureReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuestFavoriteEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Listing_isGuestFavorite_idx" ON "Listing"("isGuestFavorite");
CREATE UNIQUE INDEX "GuestFavoriteEvaluation_listingId_evaluationDate_key" ON "GuestFavoriteEvaluation"("listingId", "evaluationDate");
CREATE INDEX "GuestFavoriteEvaluation_evaluationDate_idx" ON "GuestFavoriteEvaluation"("evaluationDate");
CREATE INDEX "GuestFavoriteEvaluation_listingId_evaluationDate_idx" ON "GuestFavoriteEvaluation"("listingId", "evaluationDate");

ALTER TABLE "GuestFavoriteEvaluation"
  ADD CONSTRAINT "GuestFavoriteEvaluation_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
