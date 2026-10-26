-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "HostPayoutMethodStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'REJECTED', 'DISABLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "PayoutMethodType" AS ENUM ('SAUDI_IBAN', 'INTERNATIONAL_SWIFT', 'PAYPAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "HostPayoutMethod" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "type" "PayoutMethodType" NOT NULL DEFAULT 'SAUDI_IBAN',
    "accountHolderName" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "bankCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'SA',
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "ibanMasked" TEXT NOT NULL,
    "ibanLast4" TEXT NOT NULL,
    "encryptedAccountReference" TEXT,
    "accountFingerprint" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "status" "HostPayoutMethodStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "rejectionReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "HostPayoutMethod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "HostPayoutMethod_hostId_accountFingerprint_key" ON "HostPayoutMethod"("hostId", "accountFingerprint");
CREATE INDEX IF NOT EXISTS "HostPayoutMethod_hostId_isDefault_idx" ON "HostPayoutMethod"("hostId", "isDefault");
CREATE INDEX IF NOT EXISTS "HostPayoutMethod_status_idx" ON "HostPayoutMethod"("status");
CREATE INDEX IF NOT EXISTS "HostPayoutMethod_hostId_status_idx" ON "HostPayoutMethod"("hostId", "status");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "HostPayoutMethod" ADD CONSTRAINT "HostPayoutMethod_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

