-- Saudi licence tracking is deliberately separate from listing approval so
-- manual review continues to work while production provider access is gated.
CREATE TYPE "PropertyLicenseStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'REVOKED', 'SUSPENDED', 'INVALID', 'UNKNOWN', 'UNAVAILABLE');
CREATE TYPE "LicenseAuthorizationStatus" AS ENUM ('PENDING', 'AUTHORIZED', 'REJECTED', 'REVOKED');
CREATE TYPE "ListingLicenseEligibilityStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'ELIGIBLE', 'INELIGIBLE', 'EXPIRED', 'AUTHORIZATION_REQUIRED', 'PROVIDER_UNAVAILABLE');
CREATE TYPE "ListingApprovalMethod" AS ENUM ('MANUAL_REVIEW', 'SAUDI_LICENSE_AUTOMATIC');
CREATE TYPE "LicenseVerificationSource" AS ENUM ('SANDBOX', 'SAUDI_GOVERNMENT');

ALTER TABLE "Listing"
  ADD COLUMN "licenseEligibilityStatus" "ListingLicenseEligibilityStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  ADD COLUMN "approvalMethod" "ListingApprovalMethod",
  ADD COLUMN "licenseUnlistedAt" TIMESTAMP(3),
  ADD COLUMN "licenseUnlistingReason" TEXT;

CREATE TABLE "PropertyLicense" (
  "id" TEXT NOT NULL,
  "licenseNumber" TEXT NOT NULL,
  "countryCode" TEXT NOT NULL DEFAULT 'SA',
  "licenseCategory" TEXT,
  "facilityName" TEXT,
  "verifiedEntity" TEXT,
  "status" "PropertyLicenseStatus" NOT NULL DEFAULT 'PENDING',
  "issueDate" DATE,
  "expiryDate" DATE,
  "verificationSource" "LicenseVerificationSource" NOT NULL,
  "verificationMethod" TEXT,
  "lastVerifiedAt" TIMESTAMP(3),
  "lastAttemptedAt" TIMESTAMP(3),
  "nextVerificationAt" TIMESTAMP(3),
  "verificationError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyLicense_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LicenseOwnership" (
  "id" TEXT NOT NULL,
  "licenseId" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "authorizationStatus" "LicenseAuthorizationStatus" NOT NULL DEFAULT 'PENDING',
  "authorizationMethod" TEXT,
  "evidenceReference" TEXT,
  "verifiedById" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LicenseOwnership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PropertyLicenseLink" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "licenseId" TEXT NOT NULL,
  "eligibilityStatus" "ListingLicenseEligibilityStatus" NOT NULL DEFAULT 'PENDING',
  "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PropertyLicenseLink_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LicenseVerificationHistory" (
  "id" TEXT NOT NULL,
  "licenseId" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "listingId" TEXT,
  "previousStatus" "PropertyLicenseStatus",
  "newStatus" "PropertyLicenseStatus" NOT NULL,
  "providerResultCategory" TEXT NOT NULL,
  "errorReason" TEXT,
  "requestId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LicenseVerificationHistory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PropertyLicense_licenseNumber_countryCode_key" ON "PropertyLicense"("licenseNumber", "countryCode");
CREATE INDEX "PropertyLicense_status_nextVerificationAt_idx" ON "PropertyLicense"("status", "nextVerificationAt");
CREATE INDEX "PropertyLicense_expiryDate_idx" ON "PropertyLicense"("expiryDate");
CREATE UNIQUE INDEX "LicenseOwnership_licenseId_hostId_key" ON "LicenseOwnership"("licenseId", "hostId");
CREATE INDEX "LicenseOwnership_hostId_authorizationStatus_idx" ON "LicenseOwnership"("hostId", "authorizationStatus");
CREATE UNIQUE INDEX "PropertyLicenseLink_listingId_key" ON "PropertyLicenseLink"("listingId");
CREATE INDEX "PropertyLicenseLink_licenseId_eligibilityStatus_idx" ON "PropertyLicenseLink"("licenseId", "eligibilityStatus");
CREATE INDEX "LicenseVerificationHistory_licenseId_createdAt_idx" ON "LicenseVerificationHistory"("licenseId", "createdAt");
CREATE INDEX "LicenseVerificationHistory_hostId_createdAt_idx" ON "LicenseVerificationHistory"("hostId", "createdAt");
CREATE INDEX "LicenseVerificationHistory_listingId_createdAt_idx" ON "LicenseVerificationHistory"("listingId", "createdAt");
CREATE INDEX "Listing_licenseEligibilityStatus_idx" ON "Listing"("licenseEligibilityStatus");

ALTER TABLE "LicenseOwnership" ADD CONSTRAINT "LicenseOwnership_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "PropertyLicense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseOwnership" ADD CONSTRAINT "LicenseOwnership_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseOwnership" ADD CONSTRAINT "LicenseOwnership_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PropertyLicenseLink" ADD CONSTRAINT "PropertyLicenseLink_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PropertyLicenseLink" ADD CONSTRAINT "PropertyLicenseLink_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "PropertyLicense"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LicenseVerificationHistory" ADD CONSTRAINT "LicenseVerificationHistory_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "PropertyLicense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseVerificationHistory" ADD CONSTRAINT "LicenseVerificationHistory_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LicenseVerificationHistory" ADD CONSTRAINT "LicenseVerificationHistory_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
