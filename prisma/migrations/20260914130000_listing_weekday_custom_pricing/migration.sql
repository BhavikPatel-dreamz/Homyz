-- AlterTable
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "weekdayBasePrice" INTEGER;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "customPrices" JSONB;
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "extraGuestFee" INTEGER DEFAULT 0;

-- Backfill weekdayBasePrice from existing price
UPDATE "Listing" SET "weekdayBasePrice" = "price" WHERE "weekdayBasePrice" IS NULL;

