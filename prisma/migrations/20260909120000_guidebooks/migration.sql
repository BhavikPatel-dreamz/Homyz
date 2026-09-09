-- Host Guidebooks, Associations, and Recommendation Items
CREATE TABLE IF NOT EXISTS "Guidebook" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "coverImage" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "countryCode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "formattedAddress" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guidebook_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GuidebookListing" (
    "id" TEXT NOT NULL,
    "guidebookId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuidebookListing_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GuidebookItem" (
    "id" TEXT NOT NULL,
    "guidebookId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PLACE',
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "hostTip" TEXT,
    "photo" TEXT,
    "placeProviderId" TEXT,
    "address" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuidebookItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GuidebookListing_guidebookId_listingId_key" ON "GuidebookListing"("guidebookId", "listingId");
CREATE INDEX IF NOT EXISTS "Guidebook_hostId_idx" ON "Guidebook"("hostId");
CREATE INDEX IF NOT EXISTS "Guidebook_city_idx" ON "Guidebook"("city");
CREATE INDEX IF NOT EXISTS "Guidebook_published_idx" ON "Guidebook"("published");
CREATE INDEX IF NOT EXISTS "GuidebookListing_guidebookId_idx" ON "GuidebookListing"("guidebookId");
CREATE INDEX IF NOT EXISTS "GuidebookListing_listingId_idx" ON "GuidebookListing"("listingId");
CREATE INDEX IF NOT EXISTS "GuidebookItem_guidebookId_idx" ON "GuidebookItem"("guidebookId");
CREATE INDEX IF NOT EXISTS "GuidebookItem_guidebookId_sortOrder_idx" ON "GuidebookItem"("guidebookId", "sortOrder");

ALTER TABLE "Guidebook" DROP CONSTRAINT IF EXISTS "Guidebook_hostId_fkey";
ALTER TABLE "Guidebook" ADD CONSTRAINT "Guidebook_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuidebookListing" DROP CONSTRAINT IF EXISTS "GuidebookListing_guidebookId_fkey";
ALTER TABLE "GuidebookListing" ADD CONSTRAINT "GuidebookListing_guidebookId_fkey" FOREIGN KEY ("guidebookId") REFERENCES "Guidebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuidebookListing" DROP CONSTRAINT IF EXISTS "GuidebookListing_listingId_fkey";
ALTER TABLE "GuidebookListing" ADD CONSTRAINT "GuidebookListing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GuidebookItem" DROP CONSTRAINT IF EXISTS "GuidebookItem_guidebookId_fkey";
ALTER TABLE "GuidebookItem" ADD CONSTRAINT "GuidebookItem_guidebookId_fkey" FOREIGN KEY ("guidebookId") REFERENCES "Guidebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
