CREATE TABLE IF NOT EXISTS "ListingSearchRankingObservation" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "checkIn" TEXT NOT NULL,
  "checkOut" TEXT NOT NULL,
  "guests" INTEGER NOT NULL,
  "filters" JSONB,
  "sortBy" TEXT NOT NULL,
  "resultPosition" INTEGER,
  "resultCount" INTEGER NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ListingSearchRankingObservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ListingSearchRankingObservation_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ListingSearchRankingObservation_listingId_observedAt_idx"
  ON "ListingSearchRankingObservation"("listingId", "observedAt");
CREATE INDEX IF NOT EXISTS "ListingSearchRankingObservation_hostId_observedAt_idx"
  ON "ListingSearchRankingObservation"("hostId", "observedAt");
