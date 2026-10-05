-- Stay dates are calendar dates, not timestamps. The old application created
-- local-midnight values in Asia/Kolkata, which PostgreSQL received as 18:30 on
-- the previous UTC day. Repair that known legacy shape before enforcing DATE.
ALTER TABLE "Booking"
  ALTER COLUMN "startDate" TYPE DATE USING (
    CASE
      WHEN "startDate"::time = TIME '18:30:00'
        THEN ("startDate" + INTERVAL '5 hours 30 minutes')::date
      ELSE "startDate"::date
    END
  ),
  ALTER COLUMN "endDate" TYPE DATE USING (
    CASE
      WHEN "endDate"::time = TIME '18:30:00'
        THEN ("endDate" + INTERVAL '5 hours 30 minutes')::date
      ELSE "endDate"::date
    END
  );

ALTER TABLE "SpecialOffer"
  ALTER COLUMN "startDate" TYPE DATE USING ("startDate"::date),
  ALTER COLUMN "endDate" TYPE DATE USING ("endDate"::date);
