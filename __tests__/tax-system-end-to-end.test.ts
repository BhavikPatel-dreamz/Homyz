import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { TaxCalculator, getTaxableGuestCount } from "../lib/tax/tax-calculator";
import type { ListingTaxDTO } from "../lib/tax/types";
import { createHostTaxSchema } from "../lib/validation/tax";

const NIGHTLY_RATES = [50_000, 50_000, 50_000, 53_000, 53_000];

function listingTax(overrides: Partial<ListingTaxDTO> = {}): ListingTaxDTO {
  return {
    id: "tax-1",
    listingId: "listing-1",
    taxRuleId: null,
    customName: "Other local tax",
    taxType: "OTHER",
    calculationMethod: "PERCENTAGE",
    rate: 18,
    amount: null,
    taxableComponents: ["BASE_PRICE"],
    remittanceResponsibility: "HOST",
    maximumAmountPerPersonPerNight: null,
    partialStayExemptionNights: null,
    fullStayExemptionNights: null,
    longStayExemptionNights: null,
    isActive: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

function calculate(taxes: ListingTaxDTO[], input: {
  nights?: number;
  nightlySubtotal?: number;
  nightlyRates?: number[];
  guests?: number;
  petFee?: number;
  extraGuestFee?: number;
  feeAmounts?: Record<string, number>;
} = {}) {
  return TaxCalculator.calculateTaxes({
    nights: input.nights ?? 5,
    nightlySubtotal: input.nightlySubtotal ?? 256_000,
    nightlyRates: input.nightlyRates ?? NIGHTLY_RATES,
    guests: input.guests ?? 5,
    petFee: input.petFee,
    extraGuestFee: input.extraGuestFee,
    feeAmounts: input.feeAmounts,
    hostTaxes: taxes,
    rules: [],
    hostServiceFeePercentage: 15,
    currency: "SAR",
  });
}

describe("HOMYZ authoritative host tax flow", () => {
  it("calculates the screenshot's 18% tax from the actual varying nightly subtotal", () => {
    const result = calculate([listingTax()]);
    const tax = result.taxes[0];
    assert.equal(tax.taxableBaseBeforeExemption, 256_000);
    assert.equal(tax.taxableBase, 256_000);
    assert.equal(tax.grossTax, 46_080);
    assert.equal(tax.finalTax, 46_080);
    assert.equal(tax.taxAmount, 46_080);
    assert.equal(result.taxTotal, 46_080);
    assert.equal(result.guestTotal, 302_080);
  });

  it("explains the exact saved 1-night full exemption that makes the screenshot tax zero", () => {
    const result = calculate([listingTax({
      maximumAmountPerPersonPerNight: 100,
      partialStayExemptionNights: 1,
      fullStayExemptionNights: 1,
      longStayExemptionNights: 1,
    })]);
    const tax = result.taxes[0];
    assert.equal(tax.grossTax, 46_080);
    assert.equal(tax.taxableNights, 0);
    assert.equal(tax.exemptNights, 5);
    assert.equal(tax.exemptionAmount, 46_080);
    assert.equal(tax.finalTax, 0);
    assert.equal(tax.zeroReason, "EXEMPTION_APPLIED");
    assert.equal(tax.exemptionReason, "Entire stay exempt at 1+ night");
  });

  it("defines partial exemption as tax on the first N actual-price nights", () => {
    const result = calculate([listingTax({ partialStayExemptionNights: 3 })]);
    const tax = result.taxes[0];
    assert.equal(tax.taxableBaseBeforeExemption, 256_000);
    assert.equal(tax.taxableBase, 150_000);
    assert.equal(tax.taxableNights, 3);
    assert.equal(tax.exemptNights, 2);
    assert.equal(tax.grossTax, 46_080);
    assert.equal(tax.finalTax, 27_000);
    assert.equal(tax.exemptionAmount, 19_080);
    assert.equal(tax.exemptionReason, "Tax applies to first 3 of 5 nights; 2 nights exempt");
  });

  it("applies full-stay exemption at the exact threshold and gives it precedence", () => {
    const below = calculate([listingTax({ fullStayExemptionNights: 6 })]);
    const exact = calculate([listingTax({
      partialStayExemptionNights: 3,
      fullStayExemptionNights: 5,
    })]);
    assert.equal(below.taxTotal, 46_080);
    assert.equal(exact.taxTotal, 0);
    assert.equal(exact.taxes[0].taxableNights, 0);
  });

  it("applies a per-person/per-night cap without turning tax into an unexplained zero", () => {
    const result = calculate([listingTax({ maximumAmountPerPersonPerNight: 100 })]);
    const tax = result.taxes[0];
    assert.equal(tax.grossTax, 46_080);
    assert.equal(tax.finalTax, 2_500);
    assert.equal(tax.capAdjustment, 43_580);
    assert.equal(tax.zeroReason, undefined);
  });

  it("supports every configured calculation method", () => {
    const cases = [
      [listingTax({ id: "percentage" }), 46_080],
      [listingTax({ id: "booking", calculationMethod: "FLAT_PER_BOOKING", rate: null, amount: 10_000 }), 10_000],
      [listingTax({ id: "night", calculationMethod: "AMOUNT_PER_NIGHT", rate: null, amount: 2_000 }), 10_000],
      [listingTax({ id: "guest", calculationMethod: "AMOUNT_PER_GUEST", rate: null, amount: 2_000 }), 10_000],
      [listingTax({ id: "guest-night", calculationMethod: "AMOUNT_PER_GUEST_PER_NIGHT", rate: null, amount: 500 }), 12_500],
    ] as const;
    for (const [tax, expected] of cases) assert.equal(calculate([tax]).taxTotal, expected);
  });

  it("uses only selected taxable bases and supports multiple fee bases", () => {
    const result = calculate([listingTax({
      rate: 10,
      taxableComponents: ["BASE_PRICE", "MANAGEMENT_FEE", "RESORT_FEE"],
    })], {
      nights: 1,
      nightlySubtotal: 100_000,
      nightlyRates: [100_000],
      guests: 1,
      feeAmounts: { MANAGEMENT_FEE: 5_000, RESORT_FEE: 3_000 },
    });
    assert.equal(result.taxes[0].taxableBase, 108_000);
    assert.equal(result.taxTotal, 10_800);

    const noBase = calculate([listingTax({ taxableComponents: [] })]);
    assert.equal(noBase.taxTotal, 0);
    assert.equal(noBase.taxes[0].zeroReason, "NO_TAXABLE_BASE");
  });

  it("calculates multiple taxes independently and deduplicates identical tax IDs", () => {
    const vat = listingTax({ id: "vat", customName: "VAT/GST", taxType: "VAT", rate: 15 });
    const tourism = listingTax({
      id: "tourism",
      customName: "Tourism fee",
      taxType: "TOURIST_TAX",
      calculationMethod: "AMOUNT_PER_NIGHT",
      rate: null,
      amount: 2_500,
    });
    const city = listingTax({
      id: "city",
      customName: "City tax",
      taxType: "CITY_TAX",
      calculationMethod: "AMOUNT_PER_GUEST_PER_NIGHT",
      rate: null,
      amount: 1_000,
    });
    const result = calculate([vat, tourism, city, { ...vat }]);
    assert.equal(result.taxes.length, 3);
    assert.deepEqual(result.taxes.map((tax) => tax.taxAmount), [38_400, 12_500, 25_000]);
    assert.equal(result.taxTotal, 75_900);
  });

  it("ignores disabled taxes and taxes adults plus children, not infants or pets", () => {
    assert.equal(getTaxableGuestCount({ guests: 5, infants: 2, pets: 3 }), 5);
    const result = calculate([listingTax({ isActive: false })]);
    assert.equal(result.taxes.length, 0);
    assert.equal(result.taxTotal, 0);
  });

  it("normalizes optional fields to null and rejects accidental zero thresholds", () => {
    const base = {
      listingId: "listing-1",
      taxType: "OTHER" as const,
      customName: "Other local tax",
      calculationMethod: "PERCENTAGE" as const,
      rate: 18,
      amount: null,
      taxableComponents: ["BASE_PRICE"] as const,
      remittanceResponsibility: "HOST" as const,
      maximumAmountPerPersonPerNight: null,
      partialStayExemptionNights: null,
      fullStayExemptionNights: null,
    };
    assert.equal(createHostTaxSchema.safeParse(base).success, true);
    assert.equal(createHostTaxSchema.safeParse({ ...base, partialStayExemptionNights: 0 }).success, false);
    assert.equal(createHostTaxSchema.safeParse({ ...base, maximumAmountPerPersonPerNight: 0 }).success, false);
  });

  it("keeps one authoritative quote path and transparent zero-tax display data", () => {
    const detail = fs.readFileSync(path.resolve("app/listings/[id]/public-listing-detail-client.tsx"), "utf8");
    const checkout = fs.readFileSync(path.resolve("app/book/[id]/booking-checkout-client.tsx"), "utf8");
    const booking = fs.readFileSync(path.resolve("services/booking.service.ts"), "utf8");
    const form = fs.readFileSync(path.resolve("app/(protected)/host/listings/[id]/components/TaxesManager.tsx"), "utf8");
    assert.match(detail, /fetchAuthoritativeQuote/); // URL encapsulated inside quote-cache helper
    assert.match(checkout, /\/api\/v1\/listings\/\$\{listing\.id\}\/quote/);
    assert.match(booking, /priceBreakdown: \{/);
    assert.match(booking, /reservationTax\.create/);
    assert.match(form, /longStayExemptionNights: null/);
    assert.match(form, /value="PERCENTAGE"/);
    assert.match(form, /setPartialStayExemption\(""\)/);
    assert.match(form, /setFullStayExemption\(""\)/);
  });
});
