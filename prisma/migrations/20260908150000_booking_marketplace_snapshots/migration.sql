-- AlterTable Listing indexes
CREATE INDEX IF NOT EXISTS "Listing_status_published_idx" ON "Listing"("status", "published");
CREATE INDEX IF NOT EXISTS "Listing_city_idx" ON "Listing"("city");

-- AlterTable Booking
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "guests" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "totalPrice" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "nightlyPrice" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "cleaningFee" INTEGER;
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'SAR';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "priceBreakdown" JSONB;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Booking_listingId_startDate_endDate_status_idx" ON "Booking"("listingId", "startDate", "endDate", "status");
