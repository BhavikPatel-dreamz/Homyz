UPDATE "Booking"
SET
  "scheduledCheckInAt" = make_timestamptz(
    EXTRACT(YEAR FROM "startDate")::int, EXTRACT(MONTH FROM "startDate")::int, EXTRACT(DAY FROM "startDate")::int,
    split_part("checkInTime", ':', 1)::int, split_part("checkInTime", ':', 2)::int, 0, "propertyTimeZone"
  ),
  "scheduledCheckOutAt" = make_timestamptz(
    EXTRACT(YEAR FROM "endDate")::int, EXTRACT(MONTH FROM "endDate")::int, EXTRACT(DAY FROM "endDate")::int,
    split_part("checkOutTime", ':', 1)::int, split_part("checkOutTime", ':', 2)::int, 0, "propertyTimeZone"
  );
