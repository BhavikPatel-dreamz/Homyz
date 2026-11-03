ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "propertyTimeZone" TEXT NOT NULL DEFAULT 'UTC';

UPDATE "Listing"
SET "propertyTimeZone" = CASE
  WHEN lower(coalesce("city", '')) IN ('riyadh', 'jeddah') THEN 'Asia/Riyadh'
  WHEN lower(coalesce("country", '')) IN ('saudi arabia', 'saudi arabia - sa') THEN 'Asia/Riyadh'
  WHEN lower(coalesce("city", '')) = 'dubai' OR lower(coalesce("country", '')) = 'united arab emirates' THEN 'Asia/Dubai'
  WHEN lower(coalesce("city", '')) = 'doha' OR lower(coalesce("country", '')) = 'qatar' THEN 'Asia/Qatar'
  WHEN lower(coalesce("country", '')) = 'india' THEN 'Asia/Kolkata'
  WHEN lower(coalesce("country", '')) = 'united kingdom' THEN 'Europe/London'
  ELSE "propertyTimeZone"
END
WHERE "propertyTimeZone" = 'UTC';

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "propertyTimeZone" TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "checkInTime" TEXT NOT NULL DEFAULT '15:00';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "checkInEndTime" TEXT NOT NULL DEFAULT '22:00';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "checkOutTime" TEXT NOT NULL DEFAULT '11:00';
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "scheduledCheckInAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "scheduledCheckOutAt" TIMESTAMP(3);

-- Existing reservations keep the schedule that was configured when this
-- migration was introduced. New reservations snapshot it in the service.
UPDATE "Booking" AS booking
SET
  "propertyTimeZone" = listing."propertyTimeZone",
  "checkInTime" = coalesce(listing."checkInStart", '15:00'),
  "checkInEndTime" = coalesce(listing."checkInEnd", '22:00'),
  "checkOutTime" = coalesce(listing."checkOutTime", '11:00')
FROM "Listing" AS listing
WHERE booking."listingId" = listing.id
  AND booking."scheduledCheckInAt" IS NULL;
