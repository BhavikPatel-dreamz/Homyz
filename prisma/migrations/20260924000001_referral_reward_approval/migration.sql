-- Referral rewards now require an explicit administrative approval before they
-- are shown as credited. Existing rows were credited under the previous rule,
-- so preserve that state when moving to the review ledger.
CREATE TYPE "ReferralRewardStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

ALTER TABLE "ReferralReward"
  ADD COLUMN "status" "ReferralRewardStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "reviewedById" TEXT,
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "rejectionReason" TEXT;

UPDATE "ReferralReward"
SET "status" = 'APPROVED', "reviewedAt" = "createdAt";

CREATE INDEX "ReferralReward_status_createdAt_idx" ON "ReferralReward"("status", "createdAt");
CREATE INDEX "ReferralReward_reviewedById_idx" ON "ReferralReward"("reviewedById");

ALTER TABLE "ReferralReward"
  ADD CONSTRAINT "ReferralReward_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
