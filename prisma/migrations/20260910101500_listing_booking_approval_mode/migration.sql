-- A host selects exactly one booking-approval policy.
ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "bookingApprovalMode" TEXT NOT NULL DEFAULT 'INSTANT';

-- Preserve each existing listing's Instant Book behaviour when introducing the explicit mode.
UPDATE "Listing"
SET "bookingApprovalMode" = CASE WHEN "instantBook" THEN 'INSTANT' ELSE 'MANUAL' END;
