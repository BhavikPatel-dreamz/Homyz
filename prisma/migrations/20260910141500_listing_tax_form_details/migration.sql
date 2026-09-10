-- Store all host-configured tax fields shown in the tax preferences form.
ALTER TABLE "ListingTax"
  ADD COLUMN IF NOT EXISTS "maximumAmountPerPersonPerNight" INTEGER,
  ADD COLUMN IF NOT EXISTS "partialStayExemptionNights" INTEGER,
  ADD COLUMN IF NOT EXISTS "fullStayExemptionNights" INTEGER;

-- Hosts can configure more than one tax with the same broad tax type (for
-- example, a hotel tax and a room tax). The name selected in the form is the
-- per-listing identity used for duplicate prevention.
DROP INDEX IF EXISTS "ListingTax_listingId_taxType_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ListingTax_listingId_customName_key"
  ON "ListingTax"("listingId", "customName");
