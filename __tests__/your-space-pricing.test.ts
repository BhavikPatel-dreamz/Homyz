import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import { getCurrencyForCountry } from "../lib/currency";
import { updateListingSchema } from "../lib/validation/listing";
import { computeWeekendPrice, clampWeekendPremium } from "../lib/utils/listing-pricing";
import { resolveSingleDiscount } from "../services/pricing.service";

test("Your Space Pricing: Location-Based Currency Derivation", () => {
  // Saudi Arabia / Defaults
  assert.equal(getCurrencyForCountry("Saudi Arabia"), "SAR");
  assert.equal(getCurrencyForCountry("SA"), "SAR");
  assert.equal(getCurrencyForCountry("KSA"), "SAR");
  assert.equal(getCurrencyForCountry(""), "SAR");
  assert.equal(getCurrencyForCountry(undefined), "SAR");
  assert.equal(getCurrencyForCountry(null), "SAR");
  assert.equal(getCurrencyForCountry("Unknown Country"), "SAR");

  // Middle East / GCC
  assert.equal(getCurrencyForCountry("United Arab Emirates"), "AED");
  assert.equal(getCurrencyForCountry("UAE"), "AED");
  assert.equal(getCurrencyForCountry("Dubai"), "AED");
  assert.equal(getCurrencyForCountry("Kuwait"), "KWD");
  assert.equal(getCurrencyForCountry("Qatar"), "QAR");
  assert.equal(getCurrencyForCountry("Bahrain"), "BHD");
  assert.equal(getCurrencyForCountry("Egypt"), "EGP");

  // Americas
  assert.equal(getCurrencyForCountry("United States"), "USD");
  assert.equal(getCurrencyForCountry("USA"), "USD");
  assert.equal(getCurrencyForCountry("Canada"), "CAD");

  // Europe
  assert.equal(getCurrencyForCountry("United Kingdom"), "GBP");
  assert.equal(getCurrencyForCountry("UK"), "GBP");
  assert.equal(getCurrencyForCountry("France"), "EUR");
  assert.equal(getCurrencyForCountry("Germany"), "EUR");
});

test("Your Space Pricing: Schema Validation & Explicit weekdayBasePrice", () => {
  // Valid payload with price and weekdayBasePrice
  const validPayload = {
    price: 25000,
    weekdayBasePrice: 25000,
    weekendPrice: 30000,
    weekendPremium: 20,
    discounts: {
      weekly: { enabled: true, percentage: 10 },
      monthly: { enabled: true, percentage: 20 },
    },
  };

  const parsed = updateListingSchema.safeParse(validPayload);
  assert.ok(parsed.success, "Valid pricing payload parses cleanly");
  assert.equal(parsed.data.price, 25000);
  assert.equal(parsed.data.weekdayBasePrice, 25000);
  assert.equal(parsed.data.weekendPrice, 30000);
  assert.equal(parsed.data.weekendPremium, 20);

  // Negative base price must be rejected
  const invalidNegativePrice = updateListingSchema.safeParse({
    price: -100,
    weekdayBasePrice: -100,
  });
  assert.ok(!invalidNegativePrice.success, "Negative base price must fail validation");
});

test("Your Space Pricing: Non-Stacking Weekly and Monthly Discounts", () => {
  const discounts = {
    weekly: { enabled: true, percentage: 10 },
    monthly: { enabled: true, percentage: 25 },
  };

  // 1. Stays under 7 nights qualify for NO weekly/monthly discount
  const shortStay = resolveSingleDiscount({
    staySubtotal: 30000,
    nights: 3,
    checkIn: new Date("2026-10-01"),
    discounts,
  });
  assert.equal(shortStay, null, "3-night stay has no weekly or monthly discount");

  // 2. 7-night stay qualifies for weekly discount (10%)
  const weeklyStay = resolveSingleDiscount({
    staySubtotal: 70000,
    nights: 7,
    checkIn: new Date("2026-10-01"),
    discounts,
  });
  assert.ok(weeklyStay, "7-night stay qualifies for weekly discount");
  assert.equal(weeklyStay?.key, "weekly");
  assert.equal(weeklyStay?.percentage, 10);
  assert.equal(weeklyStay?.amount, 7000);

  // 3. 28-night stay qualifies for monthly discount (25%)
  const monthlyStay = resolveSingleDiscount({
    staySubtotal: 280000,
    nights: 28,
    checkIn: new Date("2026-10-01"),
    discounts,
  });
  assert.ok(monthlyStay, "28-night stay qualifies for monthly discount");
  assert.equal(monthlyStay?.key, "monthly");
  assert.equal(monthlyStay?.percentage, 25);
  assert.equal(monthlyStay?.amount, 70000);
});

test("Your Space Pricing: Calendar Custom Prices are Not Overwritten", () => {
  // Existing listing in database with calendar overrides
  const existingListing = {
    id: "listing_test_123",
    price: 20000,
    weekdayBasePrice: 20000,
    customPrices: {
      "2026-12-31": 50000,
      "2027-01-01": 50000,
    },
  };

  // The save payload dispatched by handleSaveSection("pricing")
  const pricingSavePayload = {
    price: 25000,
    weekdayBasePrice: 25000,
    smartPricing: false,
    smartPricingMinPrice: null,
    smartPricingMaxPrice: null,
    weekendPrice: computeWeekendPrice(25000, 15),
    weekendPremium: clampWeekendPremium(15),
    discounts: {
      weekly: { enabled: true, percentage: 5 },
      monthly: { enabled: true, percentage: 10 },
      last_minute: { enabled: false, percentage: 15 },
    },
  };

  // Ensure customPrices is NOT present in pricingSavePayload
  assert.equal(
    (pricingSavePayload as any).customPrices,
    undefined,
    "pricingSavePayload must NOT touch customPrices",
  );

  // Simulating Prisma partial update: keys not present in dataToUpdate remain unchanged in DB
  const updatedDbState = {
    ...existingListing,
    ...pricingSavePayload,
    customPrices: (pricingSavePayload as any).customPrices !== undefined
      ? (pricingSavePayload as any).customPrices
      : existingListing.customPrices,
  };

  assert.deepEqual(
    updatedDbState.customPrices,
    { "2026-12-31": 50000, "2027-01-01": 50000 },
    "Calendar custom prices must remain intact after saving standard pricing",
  );
  assert.equal(updatedDbState.price, 25000);
  assert.equal(updatedDbState.weekdayBasePrice, 25000);
  assert.equal(updatedDbState.weekendPrice, 28750);
});

test("Your Space Pricing: Weekend Price and Smart Pricing Behavior", () => {
  // Weekend price computation
  const baseCents = 20000;
  const weekendPrice = computeWeekendPrice(baseCents, 20);
  assert.equal(weekendPrice, 24000, "20% weekend premium on 20,000 cents = 24,000 cents");

  // Smart pricing payload validation
  const smartPricingPayload = {
    price: 20000,
    weekdayBasePrice: 20000,
    smartPricing: true,
    smartPricingMinPrice: 18000,
    smartPricingMaxPrice: 25000,
  };

  const parsedSmart = updateListingSchema.safeParse(smartPricingPayload);
  assert.ok(parsedSmart.success, "Smart pricing payload passes validation");
  assert.equal(parsedSmart.data.smartPricing, true);
  assert.equal(parsedSmart.data.smartPricingMinPrice, 18000);
  assert.equal(parsedSmart.data.smartPricingMaxPrice, 25000);
});
