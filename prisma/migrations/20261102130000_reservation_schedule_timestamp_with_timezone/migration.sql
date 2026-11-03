ALTER TABLE "Booking"
  ALTER COLUMN "scheduledCheckInAt" TYPE TIMESTAMPTZ(3)
    USING "scheduledCheckInAt" AT TIME ZONE 'UTC',
  ALTER COLUMN "scheduledCheckOutAt" TYPE TIMESTAMPTZ(3)
    USING "scheduledCheckOutAt" AT TIME ZONE 'UTC';
