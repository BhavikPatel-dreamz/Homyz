ALTER TABLE "Listing"
  ADD COLUMN "licenseAccommodationType" TEXT,
  ADD COLUMN "encryptedLicenseNationalId" TEXT,
  ADD COLUMN "licenseNationalIdLast4" TEXT,
  ADD COLUMN "licenseRegistrationUpdatedAt" TIMESTAMP(3);
