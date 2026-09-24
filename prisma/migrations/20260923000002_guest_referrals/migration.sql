-- Persistent guest referral identity and idempotent referral reward ledger.
ALTER TABLE "User"
  ADD COLUMN "referralCode" TEXT,
  ADD COLUMN "referredById" TEXT;

CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
CREATE INDEX "User_referredById_idx" ON "User"("referredById");

ALTER TABLE "User"
  ADD CONSTRAINT "User_referredById_fkey"
  FOREIGN KEY ("referredById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ReferralReward" (
  "id" TEXT NOT NULL,
  "inviterId" TEXT NOT NULL,
  "referredUserId" TEXT NOT NULL,
  "qualifyingBookingId" TEXT NOT NULL,
  "points" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReferralReward_referredUserId_key" ON "ReferralReward"("referredUserId");
CREATE UNIQUE INDEX "ReferralReward_qualifyingBookingId_key" ON "ReferralReward"("qualifyingBookingId");
CREATE INDEX "ReferralReward_inviterId_createdAt_idx" ON "ReferralReward"("inviterId", "createdAt");

ALTER TABLE "ReferralReward"
  ADD CONSTRAINT "ReferralReward_inviterId_fkey"
  FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ReferralReward_referredUserId_fkey"
  FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ReferralReward_qualifyingBookingId_fkey"
  FOREIGN KEY ("qualifyingBookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Migrates the existing product rule into administrator-editable settings.
INSERT INTO "AppSettings" ("id", "key", "value", "description", "dataType", "category", "isPublic", "updatedAt")
VALUES (
  'referral-program-config',
  'REFERRAL_PROGRAM_CONFIG',
  '{"enabled":true,"inviterRewardPoints":250,"qualifyingCondition":"FIRST_COMPLETED_STAY"}',
  'Guest referral reward, credited after a referred guest completes their first stay.',
  'JSON',
  'REFERRAL',
  false,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
