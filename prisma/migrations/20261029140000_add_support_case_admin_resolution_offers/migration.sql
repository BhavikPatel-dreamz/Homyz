-- StayElite Phases 5 and 6. Additive only: no booking, payment, refund, or
-- payout state is changed by this migration.

CREATE TYPE "ResolutionOfferType" AS ENUM ('MONETARY_COMPENSATION', 'PROPERTY_DAMAGE', 'NON_FINANCIAL', 'AMENITY_ISSUE', 'OTHER');
CREATE TYPE "ResolutionOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'COUNTERED', 'WITHDRAWN', 'EXPIRED');

ALTER TABLE "SupportCase"
  ADD COLUMN "escalationLevel" INTEGER,
  ADD COLUMN "escalationOwnerId" TEXT,
  ADD COLUMN "firstResponseDueAt" TIMESTAMP(3),
  ADD COLUMN "nextResponseDueAt" TIMESTAMP(3),
  ADD COLUMN "slaPolicyVersion" TEXT;

ALTER TABLE "BookingRefund" ADD COLUMN "resolutionOfferId" TEXT;

ALTER TABLE "SupportCase"
  ADD CONSTRAINT "SupportCase_escalationLevel_range" CHECK ("escalationLevel" IS NULL OR ("escalationLevel" >= 1 AND "escalationLevel" <= 4));

CREATE TABLE "ResolutionOffer" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "parentOfferId" TEXT,
  "proposerId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "offerType" "ResolutionOfferType" NOT NULL,
  "amount" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'SAR',
  "description" TEXT NOT NULL,
  "status" "ResolutionOfferStatus" NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "withdrawnAt" TIMESTAMP(3),
  "idempotencyKey" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResolutionOffer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ResolutionOffer_amount_positive" CHECK ("amount" IS NULL OR "amount" > 0),
  CONSTRAINT "ResolutionOffer_version_positive" CHECK ("version" > 0),
  CONSTRAINT "ResolutionOffer_no_self_recipient" CHECK ("proposerId" <> "recipientId")
);

CREATE UNIQUE INDEX "ResolutionOffer_idempotencyKey_key" ON "ResolutionOffer"("idempotencyKey");
CREATE UNIQUE INDEX "BookingRefund_resolutionOfferId_key" ON "BookingRefund"("resolutionOfferId");
CREATE INDEX "ResolutionOffer_caseId_createdAt_idx" ON "ResolutionOffer"("caseId", "createdAt");
CREATE INDEX "ResolutionOffer_bookingId_status_idx" ON "ResolutionOffer"("bookingId", "status");
CREATE INDEX "ResolutionOffer_recipientId_status_createdAt_idx" ON "ResolutionOffer"("recipientId", "status", "createdAt");
CREATE INDEX "ResolutionOffer_proposerId_status_createdAt_idx" ON "ResolutionOffer"("proposerId", "status", "createdAt");
CREATE INDEX "ResolutionOffer_expiresAt_status_idx" ON "ResolutionOffer"("expiresAt", "status");
CREATE INDEX "SupportCase_escalationOwnerId_status_idx" ON "SupportCase"("escalationOwnerId", "status");

ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_escalationOwnerId_fkey" FOREIGN KEY ("escalationOwnerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResolutionOffer" ADD CONSTRAINT "ResolutionOffer_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResolutionOffer" ADD CONSTRAINT "ResolutionOffer_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResolutionOffer" ADD CONSTRAINT "ResolutionOffer_parentOfferId_fkey" FOREIGN KEY ("parentOfferId") REFERENCES "ResolutionOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResolutionOffer" ADD CONSTRAINT "ResolutionOffer_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResolutionOffer" ADD CONSTRAINT "ResolutionOffer_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingRefund" ADD CONSTRAINT "BookingRefund_resolutionOfferId_fkey" FOREIGN KEY ("resolutionOfferId") REFERENCES "ResolutionOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
