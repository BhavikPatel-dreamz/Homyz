-- PostgreSQL's AT TIME ZONE interprets these as property-local wall-clock
-- values and stores the resulting absolute instants in UTC.
UPDATE "Booking"
SET
  "scheduledCheckInAt" = ("startDate"::text || ' ' || "checkInTime")::timestamp AT TIME ZONE "propertyTimeZone",
  "scheduledCheckOutAt" = ("endDate"::text || ' ' || "checkOutTime")::timestamp AT TIME ZONE "propertyTimeZone"
WHERE "scheduledCheckInAt" IS NULL
   OR "scheduledCheckOutAt" IS NULL;
