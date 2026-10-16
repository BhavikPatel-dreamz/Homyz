CREATE TABLE "ListingFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingFavorite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ListingFavorite_userId_listingId_key" ON "ListingFavorite"("userId", "listingId");
CREATE INDEX "ListingFavorite_listingId_idx" ON "ListingFavorite"("listingId");

ALTER TABLE "ListingFavorite" ADD CONSTRAINT "ListingFavorite_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ListingFavorite" ADD CONSTRAINT "ListingFavorite_listingId_fkey"
  FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
