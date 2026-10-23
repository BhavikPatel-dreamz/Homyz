-- Dashboard Plus: optional trip-purpose, host operational records, recorded
-- operating costs, and contextual comparable-price observations. This migration
-- is additive and does not alter historical booking or payout records.

DO $$ BEGIN
  CREATE TYPE "TripPurpose" AS ENUM ('BUSINESS', 'FAMILY', 'LEISURE', 'OTHER', 'PREFER_NOT_TO_SAY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OperationalTaskStatus" AS ENUM ('PENDING', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OperatingExpenseCategory" AS ENUM ('CLEANING', 'MAINTENANCE', 'LAUNDRY', 'GUEST_SUPPLIES', 'UTILITIES', 'PROPERTY_MANAGEMENT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "OperatingExpenseStatus" AS ENUM ('ACTIVE', 'VOIDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "tripPurpose" "TripPurpose";

CREATE TABLE IF NOT EXISTS "CleaningTask" (
  "id" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "bookingId" TEXT,
  "status" "OperationalTaskStatus" NOT NULL DEFAULT 'PENDING',
  "title" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "responsibleUserId" TEXT,
  "actualExpenseCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'SAR',
  "notes" TEXT,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CleaningTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MaintenanceRecord" (
  "id" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "status" "OperationalTaskStatus" NOT NULL DEFAULT 'PENDING',
  "equipmentReference" TEXT,
  "title" TEXT NOT NULL,
  "serviceDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "nextServiceDate" TIMESTAMP(3),
  "usageReading" INTEGER,
  "usageUnit" TEXT,
  "actualExpenseCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'SAR',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OperatingExpense" (
  "id" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "bookingId" TEXT,
  "category" "OperatingExpenseCategory" NOT NULL,
  "status" "OperatingExpenseStatus" NOT NULL DEFAULT 'ACTIVE',
  "amountCents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'SAR',
  "expenseDate" DATE NOT NULL,
  "description" TEXT,
  "sourceReference" TEXT,
  "idempotencyKey" TEXT,
  "voidedAt" TIMESTAMP(3),
  "voidReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperatingExpense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ComparablePriceObservation" (
  "id" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "sourceListingId" TEXT NOT NULL,
  "comparableListingId" TEXT NOT NULL,
  "checkIn" DATE NOT NULL,
  "checkOut" DATE NOT NULL,
  "currency" TEXT NOT NULL,
  "nightlyPriceCents" INTEGER NOT NULL,
  "pricingBasis" TEXT NOT NULL DEFAULT 'AVERAGE_NIGHTLY_PRICE',
  "observationKey" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComparablePriceObservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CleaningTask_idempotencyKey_key" ON "CleaningTask"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "OperatingExpense_idempotencyKey_key" ON "OperatingExpense"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "ComparablePriceObservation_observationKey_key" ON "ComparablePriceObservation"("observationKey");
CREATE INDEX IF NOT EXISTS "CleaningTask_hostId_status_scheduledFor_idx" ON "CleaningTask"("hostId", "status", "scheduledFor");
CREATE INDEX IF NOT EXISTS "CleaningTask_listingId_scheduledFor_idx" ON "CleaningTask"("listingId", "scheduledFor");
CREATE INDEX IF NOT EXISTS "CleaningTask_bookingId_idx" ON "CleaningTask"("bookingId");
CREATE INDEX IF NOT EXISTS "MaintenanceRecord_hostId_status_serviceDate_idx" ON "MaintenanceRecord"("hostId", "status", "serviceDate");
CREATE INDEX IF NOT EXISTS "MaintenanceRecord_listingId_nextServiceDate_idx" ON "MaintenanceRecord"("listingId", "nextServiceDate");
CREATE INDEX IF NOT EXISTS "OperatingExpense_hostId_expenseDate_status_idx" ON "OperatingExpense"("hostId", "expenseDate", "status");
CREATE INDEX IF NOT EXISTS "OperatingExpense_listingId_expenseDate_category_idx" ON "OperatingExpense"("listingId", "expenseDate", "category");
CREATE INDEX IF NOT EXISTS "OperatingExpense_bookingId_idx" ON "OperatingExpense"("bookingId");
CREATE INDEX IF NOT EXISTS "ComparablePriceObservation_hostId_sourceListingId_observedAt_idx" ON "ComparablePriceObservation"("hostId", "sourceListingId", "observedAt");
CREATE INDEX IF NOT EXISTS "ComparablePriceObservation_comparableListingId_checkIn_checkOut_observedAt_idx" ON "ComparablePriceObservation"("comparableListingId", "checkIn", "checkOut", "observedAt");

ALTER TABLE "CleaningTask" ADD CONSTRAINT "CleaningTask_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CleaningTask" ADD CONSTRAINT "CleaningTask_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CleaningTask" ADD CONSTRAINT "CleaningTask_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OperatingExpense" ADD CONSTRAINT "OperatingExpense_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ComparablePriceObservation" ADD CONSTRAINT "ComparablePriceObservation_sourceListingId_fkey" FOREIGN KEY ("sourceListingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComparablePriceObservation" ADD CONSTRAINT "ComparablePriceObservation_comparableListingId_fkey" FOREIGN KEY ("comparableListingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
