import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolvePropertyCurrency,
  getCurrencyForCountry,
  formatMoney,
  LISTING_CURRENCY,
  DEFAULT_CURRENCY,
} from "@/lib/currency";
import { calculatePriceTips } from "@/lib/pricing/price-tips";

describe("Host Property Dynamic Currency Architecture Suite", () => {
  it("RULE 1: Exactly ONE authoritative source — prioritizes property.currency when set", () => {
    assert.equal(
      resolvePropertyCurrency({ currency: "EUR", country: "Saudi Arabia" }),
      "EUR",
      "Explicit property.currency EUR must take precedence over country Saudi Arabia"
    );
    assert.equal(
      resolvePropertyCurrency({ currency: "USD", country: "France" }),
      "USD",
      "Explicit property.currency USD must take precedence over country France"
    );
    assert.equal(
      resolvePropertyCurrency({ currency: "JPY", country: "United States" }),
      "JPY",
      "Explicit property.currency JPY must take precedence"
    );
  });

  it("RULE 2: Country fallback when property.currency is undefined or null", () => {
    assert.equal(
      resolvePropertyCurrency({ currency: undefined, country: "France" }),
      "EUR"
    );
    assert.equal(
      resolvePropertyCurrency({ currency: null, country: "United States" }),
      "USD"
    );
    assert.equal(
      resolvePropertyCurrency({ country: "United Kingdom" }),
      "GBP"
    );
    assert.equal(
      resolvePropertyCurrency({ country: "United Arab Emirates" }),
      "AED"
    );
    assert.equal(
      resolvePropertyCurrency({ country: "Saudi Arabia" }),
      "SAR"
    );
  });

  it("RULE 3: Safe default fallback when both currency and country are absent", () => {
    assert.equal(resolvePropertyCurrency({}), "SAR");
    assert.equal(resolvePropertyCurrency(null), "SAR");
    assert.equal(resolvePropertyCurrency(undefined), "SAR");
    assert.equal(resolvePropertyCurrency({ country: "Unknown Land" }), "SAR");
  });

  it("RULE 4: formatMoney formats natively without FX conversion distortion", () => {
    // 500.00 EUR in minor units (50000 cents) -> "€500.00"
    const formattedEur = formatMoney(50000, "EUR", 2);
    assert.equal(formattedEur, "€500.00");

    // 1500.50 SAR in minor units (150050 halalas) -> "SAR 1,500.50"
    const formattedSar = formatMoney(150050, "SAR", 2);
    assert.equal(formattedSar, "SAR 1,500.50");

    // 75 USD in minor units (7500 cents) -> "$75.00"
    const formattedUsd = formatMoney(7500, "USD", 2);
    assert.equal(formattedUsd, "$75.00");

    // Zero fraction digits when requested
    const formattedNoDecimals = formatMoney(50000, "EUR", 0);
    assert.equal(formattedNoDecimals, "€500");
  });

  it("RULE 5: Price tips recommendation preserves listing currency without conversion", () => {
    const eurListing = {
      id: "eur-prop-1",
      currency: "EUR",
      country: "France",
      price: 25000, // 250.00 EUR
      weekdayBasePrice: 25000,
      weekendPrice: 30000, // 300.00 EUR
      smartPricingMinPrice: 18000,
      smartPricingMaxPrice: 40000,
      customPrices: {},
    };

    const resolved = resolvePropertyCurrency(eurListing);
    assert.equal(resolved, "EUR");

    const tips = calculatePriceTips({
      listing: eurListing,
      dateKeys: ["2026-11-15"],
      bookings: [],
      todayKey: "2026-10-01",
    });

    const rec = tips.recommendations[0];
    assert.equal(rec.currentPrice, 25000);
    // Formatting rec.currentPrice in resolved currency:
    assert.equal(formatMoney(rec.currentPrice, resolved, 2), "€250.00");
  });

  it("RULE 6: Multi-property isolation — different currencies remain distinct", () => {
    const listingA = { id: "p-a", currency: "SAR", country: "Saudi Arabia", price: 100000 };
    const listingB = { id: "p-b", currency: "EUR", country: "France", price: 100000 };
    const listingC = { id: "p-c", currency: "USD", country: "United States", price: 100000 };

    assert.equal(resolvePropertyCurrency(listingA), "SAR");
    assert.equal(resolvePropertyCurrency(listingB), "EUR");
    assert.equal(resolvePropertyCurrency(listingC), "USD");

    assert.equal(formatMoney(listingA.price, resolvePropertyCurrency(listingA), 2), "SAR 1,000.00");
    assert.equal(formatMoney(listingB.price, resolvePropertyCurrency(listingB), 2), "€1,000.00");
    assert.equal(formatMoney(listingC.price, resolvePropertyCurrency(listingC), 2), "$1,000.00");
  });

  it("RULE 7: Constants LISTING_CURRENCY and DEFAULT_CURRENCY are uniform", () => {
    assert.equal(LISTING_CURRENCY, "SAR");
    assert.equal(DEFAULT_CURRENCY, "SAR");
  });

  it("RULE 8: one selected display currency wins while switching property countries", () => {
    const displayCurrency = "SAR";
    const properties = [
      { currency: "AED", country: "United Arab Emirates", price: 50000 },
      { currency: "GBP", country: "United Kingdom", price: 50000 },
      { currency: "INR", country: "India", price: 50000 },
      { currency: "SAR", country: "Saudi Arabia", price: 50000 },
    ];

    const displayed = properties.map((property) =>
      formatMoney(
        property.price,
        resolvePropertyCurrency(property),
        displayCurrency,
        2,
      ),
    );

    assert(displayed.every((price) => price.startsWith("SAR ")));
    assert.notEqual(displayed[0], "SAR 500.00", "AED must be converted, not relabeled");
    assert.notEqual(displayed[1], "SAR 500.00", "GBP must be converted, not relabeled");
    assert.notEqual(displayed[2], "SAR 500.00", "INR must be converted, not relabeled");
    assert.equal(displayed[3], "SAR 500.00");
  });

  it("RULE 9: every seeded property-country currency has a real FX path", () => {
    for (const [country, expectedCurrency] of [
      ["Singapore", "SGD"],
      ["Thailand", "THB"],
      ["Brazil", "BRL"],
      ["South Africa", "ZAR"],
      ["Turkey", "TRY"],
      ["Malaysia", "MYR"],
      ["Indonesia", "IDR"],
    ] as const) {
      assert.equal(getCurrencyForCountry(country), expectedCurrency);
      assert.notEqual(
        formatMoney(10000, expectedCurrency, "SAR", 2),
        "SAR 100.00",
        `${expectedCurrency} must be converted rather than relabeled`,
      );
    }
  });
});
