import "dotenv/config";
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  calculateBookingPrice,
  calculateSpecialOffer,
  resolveNightlyRate,
  resolveNightlyPrice,
  isWeekendNight,
} from "../services/pricing.service";
import { formatMoney } from "../lib/currency";
import { createQuoteRequestKey } from "../lib/booking/quote-cache";
import { getAuthoritativePriceBreakdown } from "../lib/booking/booking-price";
import { getCheckoutPriceRows, type CheckoutSummaryQuote } from "../lib/booking/checkout-summary";
import { createReviewRequestData } from "../lib/booking/review-request";
import type { ListingTaxDTO, TaxRuleDTO } from "../lib/tax/types";

const SAUDI_VAT_TAX: ListingTaxDTO = {
  id: "tax_vat_15",
  listingId: "listing_test_1",
  taxRuleId: null,
  customName: "Saudi VAT (15%)",
  taxType: "VAT",
  calculationMethod: "PERCENTAGE",
  rate: 15,
  amount: null,
  taxableComponents: ["BASE_PRICE", "GUEST_FEE"],
  remittanceResponsibility: "HOST",
  maximumAmountPerPersonPerNight: null,
  partialStayExemptionNights: null,
  fullStayExemptionNights: null,
  longStayExemptionNights: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("HOMYZ — Phase 1 Central Pricing Engine Verification Suite", () => {
  // Test 1: 1 normal weekday night
  it("Test 1: 1 normal weekday night", async () => {
    // 2026-10-04 (Sun) to 2026-10-05 (Mon) = 1 weekday night
    const result = await calculateBookingPrice({
      checkIn: "2026-10-04",
      checkOut: "2026-10-05",
      weekdayBasePrice: 50_000, // 500.00 SAR
      weekendPrice: 65_000,
      hostServiceFeePercentage: 15,
    });

    assert.equal(result.nights, 1);
    assert.equal(result.weekdayNights, 1);
    assert.equal(result.weekendNights, 0);
    assert.equal(result.staySubtotal, 50_000);
    assert.equal(result.accommodationSubtotal, 50_000);
    assert.equal(result.discountedAccommodationSubtotal, 50_000);
    assert.equal(result.total, 50_000);
    assert.equal(result.nightlyBreakdown.length, 1);
    assert.equal(result.nightlyBreakdown[0].rate, 50_000);
    assert.equal(result.nightlyBreakdown[0].rateType, "WEEKDAY");
  });

  // Test 2: 5 weekday nights
  it("Test 2: 5 weekday nights", async () => {
    // 2026-10-10 (Sat) to 2026-10-15 (Thu) = 5 weekday nights (Sat, Sun, Mon, Tue, Wed)
    // Note: in Saudi weekend calendar, Thursday & Friday nights are weekend.
    const result = await calculateBookingPrice({
      checkIn: "2026-10-10",
      checkOut: "2026-10-15",
      baseNightlyPrice: 40_000, // tests baseNightlyPrice alias
      weekendPrice: 55_000,
      hostServiceFeePercentage: 15,
    });

    assert.equal(result.nights, 5);
    assert.equal(result.weekdayNights, 5);
    assert.equal(result.weekendNights, 0);
    assert.equal(result.staySubtotal, 200_000);
    assert.equal(result.accommodationSubtotal, 200_000);
    assert.equal(result.total, 200_000);
  });

  // Test 3: weekday + weekend mixed stay
  it("Test 3: weekday + weekend mixed stay", async () => {
    // 2026-10-07 (Wed) to 2026-10-11 (Sun) = 4 nights:
    // Wed night (weekday = 500)
    // Thu night (weekend = 650)
    // Fri night (weekend = 650)
    // Sat night (weekday = 500)
    // Total = 500 + 650 + 650 + 500 = 2,300 SAR (230,000 cents)
    const result = await calculateBookingPrice({
      checkIn: "2026-10-07",
      checkOut: "2026-10-11",
      weekdayBasePrice: 50_000,
      weekendPrice: 65_000,
      hostServiceFeePercentage: 15,
    });

    assert.equal(result.nights, 4);
    assert.equal(result.weekdayNights, 2);
    assert.equal(result.weekendNights, 2);
    assert.equal(result.staySubtotal, 230_000);
    assert.equal(result.accommodationSubtotal, 230_000);
    assert.equal(result.nightlyBreakdown[0].rateType, "WEEKDAY");
    assert.equal(result.nightlyBreakdown[1].rateType, "WEEKEND");
    assert.equal(result.nightlyBreakdown[2].rateType, "WEEKEND");
    assert.equal(result.nightlyBreakdown[3].rateType, "WEEKDAY");
  });

  // Test 4: weekend-only booking
  it("Test 4: weekend-only booking", async () => {
    // 2026-10-08 (Thu) to 2026-10-10 (Sat) = 2 weekend nights (Thu, Fri)
    const result = await calculateBookingPrice({
      checkIn: "2026-10-08",
      checkOut: "2026-10-10",
      weekdayBasePrice: 50_000,
      weekendPrice: 70_000,
      hostServiceFeePercentage: 15,
    });

    assert.equal(result.nights, 2);
    assert.equal(result.weekdayNights, 0);
    assert.equal(result.weekendNights, 2);
    assert.equal(result.staySubtotal, 140_000);
    assert.equal(result.accommodationSubtotal, 140_000);
  });

  // Test 5: variable nightly prices (Map and Record overrides)
  it("Test 5: variable nightly prices using Map and custom date overrides", async () => {
    const priceMap = new Map<string, number>([
      ["2026-10-05", 55_000],
      ["2026-10-06", 60_000],
    ]);

    const result = await calculateBookingPrice({
      checkIn: "2026-10-04",
      checkOut: "2026-10-07",
      weekdayBasePrice: 50_000,
      customPrices: priceMap,
      hostServiceFeePercentage: 15,
    });

    // 2026-10-04: default weekday (50,000)
    // 2026-10-05: custom (55,000)
    // 2026-10-06: custom (60,000)
    // Total = 165,000 cents
    assert.equal(result.nights, 3);
    assert.equal(result.customPricedNights, 2);
    assert.equal(result.staySubtotal, 165_000);
    assert.equal(result.breakdown[0].price, 50_000);
    assert.equal(result.breakdown[1].price, 55_000);
    assert.equal(result.breakdown[2].price, 60_000);
  });

  // Test 6: date changed after initial calculation
  it("Test 6: date changed after initial calculation produces isolated accurate quotes", async () => {
    const quote1 = await calculateBookingPrice({
      checkIn: "2026-10-16",
      checkOut: "2026-10-20", // 4 nights
      weekdayBasePrice: 50_000,
      weekendPrice: 60_000,
      hostServiceFeePercentage: 15,
    });

    const quote2 = await calculateBookingPrice({
      checkIn: "2026-10-16",
      checkOut: "2026-10-21", // 5 nights
      weekdayBasePrice: 50_000,
      weekendPrice: 60_000,
      hostServiceFeePercentage: 15,
    });

    assert.equal(quote1.nights, 4);
    assert.equal(quote2.nights, 5);
    assert.notEqual(quote1.staySubtotal, quote2.staySubtotal);
  });

  // Test 7: guest count changed
  it("Test 7: guest count changed applies extra guest fee correctly", async () => {
    const quote1Guest = await calculateBookingPrice({
      checkIn: "2026-10-04",
      checkOut: "2026-10-07",
      weekdayBasePrice: 50_000,
      baseGuests: 2,
      guests: 2,
      extraGuestFee: 5_000,
      hostServiceFeePercentage: 15,
    });

    const quote3Guests = await calculateBookingPrice({
      checkIn: "2026-10-04",
      checkOut: "2026-10-07",
      weekdayBasePrice: 50_000,
      baseGuests: 2,
      adults: 2,
      children: 1, // total 3 guests = 1 extra guest
      extraGuestFee: 5_000,
      hostServiceFeePercentage: 15,
    });

    assert.equal(quote1Guest.extraGuestFee, 0);
    assert.equal(quote3Guests.extraGuestFee, 15_000); // 1 extra * 50 SAR * 3 nights = 150 SAR
    assert.equal(quote3Guests.feeTotal, 15_000);
    assert.equal(quote3Guests.feeBreakdown.length, 1);
  });

  // Test 8: Instant Book & Request to Book calculation parity
  it("Test 8 & 9: Instant Book & Request to Book share identical pricing truth", async () => {
    const instantBookParams = {
      checkIn: "2026-10-04",
      checkOut: "2026-10-07",
      weekdayBasePrice: 50_000,
      weekendPrice: 60_000,
      hostTaxes: [SAUDI_VAT_TAX],
      hostServiceFeePercentage: 15,
    };

    const requestToBookParams = {
      ...instantBookParams,
    };

    const instantQuote = await calculateBookingPrice(instantBookParams);
    const requestQuote = await calculateBookingPrice(requestToBookParams);

    assert.equal(instantQuote.nights, requestQuote.nights);
    assert.equal(instantQuote.staySubtotal, requestQuote.staySubtotal);
    assert.equal(instantQuote.accommodationSubtotal, requestQuote.accommodationSubtotal);
    assert.equal(instantQuote.taxTotal, requestQuote.taxTotal);
    assert.equal(instantQuote.guestTotal, requestQuote.guestTotal);
    assert.equal(instantQuote.total, requestQuote.total);
  });

  // Test 10: Cross-screen parity (Property Details -> Booking Review -> Checkout)
  it("Test 10: Cross-screen parity between Property Details, Checkout, and Booking Review", async () => {
    const pricing = await calculateBookingPrice({
      checkIn: "2026-10-04",
      checkOut: "2026-10-07",
      weekdayBasePrice: 50_000,
      extraGuestFee: 5_000,
      baseGuests: 1,
      guests: 2,
      hostTaxes: [SAUDI_VAT_TAX],
      hostServiceFeePercentage: 15,
    });

    // 1. Property Details values
    const detailAccommodation = pricing.accommodationSubtotal;
    const detailExtraGuests = pricing.extraGuestFee;
    const detailTaxes = pricing.taxTotal;
    const detailTotal = pricing.guestTotal;

    // 2. Checkout Summary Quote representation
    const checkoutQuote: CheckoutSummaryQuote = {
      nights: pricing.nights,
      baseNightlyPrice: pricing.effectiveBasePrice,
      nightlySubtotal: pricing.staySubtotal,
      discountAmount: pricing.discountAmount,
      extraGuestFee: pricing.extraGuestFee,
      petFee: pricing.petFee,
      hostServiceFee: pricing.hostServiceFee,
      taxes: pricing.taxes.map((t) => ({ taxName: t.taxName, taxAmount: t.taxAmount })),
      taxTotal: pricing.taxTotal,
      guestTotal: pricing.guestTotal,
      currency: pricing.currency,
      breakdown: pricing.breakdown.map((b) => ({ date: b.date, price: b.price })),
    };

    const checkoutRows = getCheckoutPriceRows(checkoutQuote);
    const checkoutAccommodationRow = checkoutRows.find((r) => r.id === "accommodation")!;
    const checkoutExtraGuestsRow = checkoutRows.find((r) => r.id === "extra-guests")!;
    const checkoutTaxesRow = checkoutRows.find((r) => r.id === "taxes")!;
    const checkoutTotal = checkoutRows.reduce((sum, r) => sum + (r.subtract ? -r.amount : r.amount), 0);

    // 3. Step 4 "Review your request" representation
    const reviewData = createReviewRequestData({
      paymentTiming: "FULL_NOW",
      paymentMethodLabel: "Credit Card",
      paymentAuthorizationValid: true,
      hostMessage: "Hello host",
      checkIn: "2026-10-04",
      checkOut: "2026-10-07",
      adults: 2,
      children: 0,
      infants: 0,
      pets: 0,
      quote: checkoutQuote,
    });

    const reviewTotal = reviewData.pricing.total;

    // Parity assertion: Difference = 0 across all screens!
    assert.equal(detailAccommodation, checkoutAccommodationRow.amount, "Accommodation parity");
    assert.equal(detailExtraGuests, checkoutExtraGuestsRow.amount, "Extra guests parity");
    assert.equal(detailTaxes, checkoutTaxesRow.amount, "Taxes parity");
    assert.equal(detailTotal, checkoutTotal, "Detail == Checkout total");
    assert.equal(detailTotal, reviewTotal, "Detail == Review total");
    assert.equal(checkoutTotal, reviewTotal, "Checkout == Review total");
  });

  // Test: Universal nightly price resolver
  it("Universal nightly price resolver works for listing and date", () => {
    const listing = {
      weekdayBasePrice: 50_000,
      weekendPrice: 65_000,
      customPrices: { "2026-10-05": 75_000 },
    };

    // Sunday (weekday in Saudi): 50,000
    const sun = resolveNightlyPrice(listing, "2026-10-04");
    assert.equal(sun.price, 50_000);
    assert.equal(sun.rateSource, "WEEKDAY");

    // Thursday (weekend in Saudi): 65,000
    const thu = resolveNightlyPrice(listing, "2026-10-08");
    assert.equal(thu.price, 65_000);
    assert.equal(thu.rateSource, "WEEKEND");

    // Custom date override: 75,000
    const custom = resolveNightlyPrice(listing, "2026-10-05");
    assert.equal(custom.price, 75_000);
    assert.equal(custom.rateSource, "CUSTOM");
  });

  // Test: Request key deduplication generator
  it("Request key deduplication generates deterministic keys", () => {
    const sel1 = {
      listingId: "listing_123",
      checkIn: "2026-10-04",
      checkOut: "2026-10-07",
      guests: 2,
      pets: 0,
      nonRefundable: false,
    };

    const sel2 = {
      listingId: "listing_123",
      checkIn: "2026-10-04",
      checkOut: "2026-10-07",
      guests: 2,
      pets: 0,
      nonRefundable: false,
    };

    assert.equal(createQuoteRequestKey(sel1), createQuoteRequestKey(sel2));
  });

  // Test: formatMoney helper
  it("formatMoney helper formats correctly with minor units", () => {
    assert.equal(formatMoney(50_000, "SAR"), "SAR 500");
    assert.equal(formatMoney(150_25, "SAR", 2), "SAR 150.25");
    assert.equal(formatMoney(10_000, "USD"), "$100");
  });

  // Test: Cleaning fee is strictly 0 and absent from quote calculation
  it("Cleaning fee is strictly absent from quote and totals", async () => {
    const result = await calculateBookingPrice({
      checkIn: "2026-10-04",
      checkOut: "2026-10-07",
      weekdayBasePrice: 50_000,
      hostServiceFeePercentage: 15,
    });

    assert.equal("cleaningFee" in result, false);
  });
});

