-- CreateTable
CREATE TABLE IF NOT EXISTS "HostEntitlementGrant" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL DEFAULT 'DASHBOARD_PLUS',
    "source" TEXT NOT NULL DEFAULT 'ADMIN',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "grantedById" TEXT,
    "revokedById" TEXT,
    "revokedAt" TIMESTAMP(3),
    "reason" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HostEntitlementGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "HostEntitlementGrant_hostId_idx" ON "HostEntitlementGrant"("hostId");
CREATE INDEX IF NOT EXISTS "HostEntitlementGrant_hostId_featureKey_status_idx" ON "HostEntitlementGrant"("hostId", "featureKey", "status");
CREATE INDEX IF NOT EXISTS "HostEntitlementGrant_status_idx" ON "HostEntitlementGrant"("status");
CREATE INDEX IF NOT EXISTS "HostEntitlementGrant_expiresAt_idx" ON "HostEntitlementGrant"("expiresAt");
CREATE INDEX IF NOT EXISTS "HostEntitlementGrant_createdAt_idx" ON "HostEntitlementGrant"("createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "HostEntitlementGrant" ADD CONSTRAINT "HostEntitlementGrant_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "HostEntitlementGrant" ADD CONSTRAINT "HostEntitlementGrant_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "HostEntitlementGrant" ADD CONSTRAINT "HostEntitlementGrant_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

