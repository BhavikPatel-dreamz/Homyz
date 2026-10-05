import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { calculateBookingPrice } from "../services/pricing.service";
import { getAuthoritativePriceBreakdown } from "../lib/booking/booking-price";
import type { ListingTaxDTO } from "../lib/tax/types";

function percentageTax(rate: number): ListingTaxDTO {
  return {
    id: `tax-${rate}`,
    listingId: "listing-1",
    taxRuleId: null,
    customName: "Saudi Value-Added Tax (VAT)",
    taxType: "VAT",
    calculationMethod: "PERCENTAGE",
    rate,
    amount: null,
    taxableComponents: ["BASE_PRICE"],
    remittanceResponsibility: "HOST",
    maximumAmountPerPersonPerNight: null,
    partialStayExemptionNights: null,
    fullStayExemptionNights: null,
    longStayExemptionNights: null,
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("central booking pricing without cleaning fees", () => {
  it("case 1: 45 SAR x 3 plus host-configured 15% VAT is 155.25 SAR", async () => {
    const quote = await calculateBookingPrice({
      checkIn: "2026-11-16",
      checkOut: "2026-11-19",
      weekdayBasePrice: 4_500,
      hostServiceFeePercentage: 15,
      hostTaxes: [percentageTax(15)],
    });

    assert.equal(quote.staySubtotal, 13_500);
    assert.equal("cleaningFee" in quote, false);
    assert.equal(quote.taxTotal, 2_025);
    assert.equal(quote.guestTotal, 15_525);
  });

  it("case 2: date-specific 45 + 50 + 55 pricing totals 172.50 SAR with VAT", async () => {
    const quote = await calculateBookingPrice({
      checkIn: "2026-11-16",
      checkOut: "2026-11-19",
      weekdayBasePrice: 4_500,
      customPrices: { "2026-11-17": 5_000, "2026-11-18": 5_500 },
      hostServiceFeePercentage: 15,
      hostTaxes: [percentageTax(15)],
    });

    assert.deepEqual(quote.breakdown.map((night) => night.price), [4_500, 5_000, 5_500]);
    assert.equal(quote.staySubtotal, 15_000);
    assert.equal(quote.taxTotal, 2_250);
    assert.equal(quote.guestTotal, 17_250);
  });

  it("case 3: a listing without configured taxes pays accommodation only", async () => {
    const quote = await calculateBookingPrice({
      checkIn: "2026-11-16",
      checkOut: "2026-11-19",
      weekdayBasePrice: 4_500,
      hostServiceFeePercentage: 15,
      hostTaxes: [],
    });

    assert.equal(quote.taxTotal, 0);
    assert.equal(quote.guestTotal, 13_500);
  });

  it("case 4: uses the configured listing tax rate instead of a hardcoded rate", async () => {
    const quote = await calculateBookingPrice({
      checkIn: "2026-11-16",
      checkOut: "2026-11-19",
      weekdayBasePrice: 4_500,
      hostServiceFeePercentage: 15,
      hostTaxes: [percentageTax(5)],
    });

    assert.equal(quote.taxes[0].rate, 5);
    assert.equal(quote.taxTotal, 675);
    assert.equal(quote.guestTotal, 14_175);
  });

  it("case 5: both quote clients cancel stale requests and retain the painted quote", () => {
    const detail = fs.readFileSync(path.resolve("app/listings/[id]/public-listing-detail-client.tsx"), "utf8");
    const checkout = fs.readFileSync(path.resolve("app/book/[id]/booking-checkout-client.tsx"), "utf8");
    assert.match(detail, /controller\.abort\(\)/);
    assert.match(checkout, /controller\.abort\(\)/);
    assert.doesNotMatch(detail, /previous result before loading[\s\S]{0,100}setQuote\(null\)/);
    assert.match(checkout, /readBookingQuote/);
  });

  it("cases 6 and 7: detail, checkout, instant book, and request-to-book share the authoritative quote", () => {
    const detail = fs.readFileSync(path.resolve("app/listings/[id]/public-listing-detail-client.tsx"), "utf8");
    const checkout = fs.readFileSync(path.resolve("app/book/[id]/booking-checkout-client.tsx"), "utf8");
    const booking = fs.readFileSync(path.resolve("services/booking.service.ts"), "utf8");
    const request = fs.readFileSync(path.resolve("services/request-to-book.service.ts"), "utf8");
    assert.match(detail, /quote\.guestTotal/);
    assert.match(checkout, /expectedGuestTotal: quote\.guestTotal/);
    assert.match(booking, /totalPrice: quote\.guestTotal/);
    assert.match(request, /}, quote, listing\);/);
    assert.match(request, /preloadedListing: listing/);
  });

  it("case 8: historical reservations use their immutable saved total", () => {
    const historical = getAuthoritativePriceBreakdown({
      startDate: "2026-11-16",
      endDate: "2026-11-19",
      nightlyPrice: 4_500,
      totalPrice: 16_400,
      currency: "SAR",
      priceBreakdown: {
        nightlySubtotal: 13_500,
        taxTotal: 2_100,
        cleaningFee: 400,
      },
    });

    assert.equal(historical.totalPrice, 16_400);
    assert.equal(historical.isMathConsistent, true);
    assert.equal(historical.otherCharges, 800);
  });
});
