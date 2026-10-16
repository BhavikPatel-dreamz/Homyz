-- Persist Smart Pricing settings used by the listing editor.
ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "smartPricing" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "smartPricingMinPrice" INTEGER,
  ADD COLUMN IF NOT EXISTS "smartPricingMaxPrice" INTEGER;
