-- Durable, per-listing co-host invitations. Tokens are stored only as hashes.
CREATE TYPE "ListingCoHostStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'REVOKED');

CREATE TABLE "ListingCoHost" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "inviterHostId" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT,
  "phone" TEXT,
  "status" "ListingCoHostStatus" NOT NULL DEFAULT 'PENDING',
  "tokenHash" TEXT,
  "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "acceptedAt" TIMESTAMP(3),
  "declinedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ListingCoHost_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ListingCoHost_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ListingCoHost_inviterHostId_fkey" FOREIGN KEY ("inviterHostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ListingCoHost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ListingCoHost_tokenHash_key" ON "ListingCoHost"("tokenHash");
CREATE UNIQUE INDEX "ListingCoHost_listingId_email_key" ON "ListingCoHost"("listingId", "email");
CREATE UNIQUE INDEX "ListingCoHost_listingId_phone_key" ON "ListingCoHost"("listingId", "phone");
CREATE UNIQUE INDEX "ListingCoHost_listingId_userId_key" ON "ListingCoHost"("listingId", "userId");
CREATE INDEX "ListingCoHost_listingId_status_idx" ON "ListingCoHost"("listingId", "status");
CREATE INDEX "ListingCoHost_email_status_idx" ON "ListingCoHost"("email", "status");
