-- AlterTable
ALTER TABLE "Listing" ADD COLUMN "deletedAt" TIMESTAMP(3),
ADD COLUMN "removalReason" JSONB;

-- CreateTable
CREATE TABLE "ListingRemovalFeedback" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "listingTitle" TEXT NOT NULL,
    "categories" TEXT[],
    "reasons" TEXT[],
    "customFeedback" TEXT,
    "actionTaken" TEXT NOT NULL DEFAULT 'PERMANENT_DELETE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingRemovalFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ListingRemovalFeedback_listingId_idx" ON "ListingRemovalFeedback"("listingId");

-- CreateIndex
CREATE INDEX "ListingRemovalFeedback_hostId_idx" ON "ListingRemovalFeedback"("hostId");

-- AddForeignKey
ALTER TABLE "ListingRemovalFeedback" ADD CONSTRAINT "ListingRemovalFeedback_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

