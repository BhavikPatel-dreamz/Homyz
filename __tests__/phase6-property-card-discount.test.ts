/**
 * HOMYZ — PHASE 6 VERIFICATION TEST SUITE
 * Search & Property Card Discount Display (Airbnb-Style UI)
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  toPropertyCardPricingViewModel,
  type PropertyCardPricingViewModel,
} from "../lib/booking/property-card-pricing";

describe("Phase 6: Search & Property Card Discount Display", () => {
  // ── 1. No Discount (Base Price Only) ──────────────────────────────────────
  test("Case 1: No discount applies -> base price only, no strike-through, no label", () => {
    const listing = {
      id: "listing-no-discount",
      price: 350,
      country: "SA",
      discounts: {},
    };

    const vm = toPropertyCardPricingViewModel(listing);

    assert.equal(vm.currency, "SAR");
    assert.equal(vm.baseDisplayPrice, 350);
    assert.equal(vm.discountedDisplayPrice, null);
    assert.equal(vm.hasDiscount, false);
    assert.equal(vm.discountType, null);
    assert.equal(vm.discountLabel, null);
    assert.equal(vm.discountPercentage, null);
  });

  // ── 2. Weekly Discount with 7+ Nights Stay ─────────────────────────────────
  test("Case 2: Weekly discount eligible for 7+ nights -> strike-through base, discounted price, 'Weekly discount' label", () => {
    const listing = {
      id: "listing-weekly",
      price: 350,
      country: "SA",
      discounts: {
        weekly: {
          enabled: true,
          percentage: 10,
        },
      },
    };

    // 7-night search
    const vm = toPropertyCardPricingViewModel(listing, {
      checkIn: "2026-10-10",
      checkOut: "2026-10-17",
    });

    assert.equal(vm.hasDiscount, true);
    assert.equal(vm.currency, "SAR");
    assert.equal(vm.baseDisplayPrice, 350);
    assert.equal(vm.discountedDisplayPrice, 315);
    assert.equal(vm.discountPercentage, 10);
    assert.equal(vm.discountType, "WEEKLY");
    assert.equal(vm.discountLabel, "Weekly discount");
  });

  // ── 3. Monthly Discount with 28+ Nights Stay ────────────────────────────────
  test("Case 3: Monthly discount eligible for 28+ nights -> strike-through base, discounted price, 'Monthly discount' label", () => {
    const listing = {
      id: "listing-monthly",
      price: 200,
      country: "SA",
      discounts: {
        monthly: {
          enabled: true,
          percentage: 25,
        },
      },
    };

    // 28-night stay
    const vm = toPropertyCardPricingViewModel(listing, {
      checkIn: "2026-11-01",
      checkOut: "2026-11-29",
    });

    assert.equal(vm.hasDiscount, true);
    assert.equal(vm.baseDisplayPrice, 200);
    assert.equal(vm.discountedDisplayPrice, 150);
    assert.equal(vm.discountPercentage, 25);
    assert.equal(vm.discountType, "MONTHLY");
    assert.equal(vm.discountLabel, "Monthly discount");
  });

  // ── 4. New Listing Promotion (Works Without Dates) ─────────────────────────
  test("Case 4: New Listing Promotion applies without stay dates for first 3 bookings", () => {
    const listing = {
      id: "listing-new",
      price: 400,
      country: "SA",
      isNewListing: true,
      completedBookingsCount: 1,
      discounts: {
        new_listing: {
          enabled: true,
          percentage: 20,
        },
      },
    };

    // No dates provided (Case B browse)
    const vm = toPropertyCardPricingViewModel(listing);

    assert.equal(vm.hasDiscount, true);
    assert.equal(vm.baseDisplayPrice, 400);
    assert.equal(vm.discountedDisplayPrice, 320);
    assert.equal(vm.discountPercentage, 20);
    assert.equal(vm.discountType, "NEW_LISTING");
    assert.equal(vm.discountLabel, "New listing promotion");
  });

  // ── 5. Last-Minute Discount within Window ──────────────────────────────────
  test("Case 5: Last-minute discount applies within booking window", () => {
    const listing = {
      id: "listing-last-minute",
      price: 350,
      country: "SA",
      discounts: {
        last_minute: {
          enabled: true,
          percentage: 15,
        },
      },
    };

    // Check-in tomorrow, booking today
    const vm = toPropertyCardPricingViewModel(listing, {
      checkIn: "2026-10-02",
      checkOut: "2026-10-05",
      bookingDate: "2026-10-01",
    });

    assert.equal(vm.hasDiscount, true);
    assert.equal(vm.baseDisplayPrice, 350);
    assert.equal(vm.discountedDisplayPrice, 297.5);
    assert.equal(vm.discountPercentage, 15);
    assert.equal(vm.discountType, "LAST_MINUTE");
    assert.equal(vm.discountLabel, "Last-minute discount");
  });

  // ── 6. Multiple Eligible Discounts -> Exactly ONE Winner (No Stacking) ─────
  test("Case 6: Multiple eligible discounts resolve to exactly ONE winning discount", () => {
    const listing = {
      id: "listing-multi",
      price: 500,
      country: "SA",
      isNewListing: true,
      completedBookingsCount: 0,
      discounts: {
        new_listing: {
          enabled: true,
          percentage: 20,
        },
        weekly: {
          enabled: true,
          percentage: 10,
        },
      },
    };

    // 7-night booking qualifies for both 20% New Listing and 10% Weekly
    const vm = toPropertyCardPricingViewModel(listing, {
      checkIn: "2026-10-10",
      checkOut: "2026-10-17",
    });

    // Highest discount wins: 20% > 10%
    assert.equal(vm.hasDiscount, true);
    assert.equal(vm.discountType, "NEW_LISTING");
    assert.equal(vm.discountLabel, "New listing promotion");
    assert.equal(vm.discountPercentage, 20);
    assert.equal(vm.discountedDisplayPrice, 400); // 500 * (1 - 0.20)
  });

  // ── 7. Date Changes & Date-Dependent Removal ──────────────────────────────
  test("Case 7: Clearing dates or shortening stay immediately removes date-dependent discounts", () => {
    const listing = {
      id: "listing-dates-change",
      price: 300,
      country: "SA",
      discounts: {
        weekly: {
          enabled: true,
          percentage: 15,
        },
      },
    };

    // 1. With 7 nights -> weekly applies
    const vmWithDates = toPropertyCardPricingViewModel(listing, {
      checkIn: "2026-10-10",
      checkOut: "2026-10-17",
    });
    assert.equal(vmWithDates.hasDiscount, true);
    assert.equal(vmWithDates.discountedDisplayPrice, 255);

    // 2. Clear dates -> weekly discount removed
    const vmNoDates = toPropertyCardPricingViewModel(listing, {});
    assert.equal(vmNoDates.hasDiscount, false);
    assert.equal(vmNoDates.discountedDisplayPrice, null);
    assert.equal(vmNoDates.baseDisplayPrice, 300);

    // 3. Shorten stay to 3 nights -> weekly discount removed
    const vmShortStay = toPropertyCardPricingViewModel(listing, {
      checkIn: "2026-10-10",
      checkOut: "2026-10-13",
    });
    assert.equal(vmShortStay.hasDiscount, false);
    assert.equal(vmShortStay.discountedDisplayPrice, null);
  });

  // ── 8. Map Marker Price Synchronization ────────────────────────────────────
  test("Case 8: Map marker price strictly synchronizes with card view model", () => {
    const listing = {
      id: "listing-map-sync",
      price: 400,
      country: "SA",
      discounts: {
        weekly: {
          enabled: true,
          percentage: 10,
        },
      },
    };

    const searchContext = {
      checkIn: "2026-10-10",
      checkOut: "2026-10-17",
    };

    // Compute card pricing
    const cardPricing = toPropertyCardPricingViewModel(listing, searchContext);

    // Simulate search-map marker calculation
    const stayNights = 7;
    const activeNightlyPrice =
      cardPricing.hasDiscount && cardPricing.discountedDisplayPrice != null
        ? cardPricing.discountedDisplayPrice
        : cardPricing.baseDisplayPrice;

    const mapMarkerTotal = activeNightlyPrice * stayNights;
    const cardTotal = (cardPricing.discountedDisplayPrice ?? cardPricing.baseDisplayPrice) * stayNights;

    assert.equal(activeNightlyPrice, 360);
    assert.equal(mapMarkerTotal, cardTotal);
    assert.equal(mapMarkerTotal, 2520); // 360 * 7
  });

  // ── 9. Safe Fallbacks & Pre-computed Quote Adaptation ───────────────────────
  test("Case 9: Adapts pre-computed Phase 1/5 quote and safely handles missing data", () => {
    // 1. Adapting a pre-computed Phase 5 quote
    const precomputedQuote = {
      currency: "SAR",
      nights: 7,
      accommodationSubtotal: 3500,
      selectedDiscount: {
        type: "WEEKLY",
        label: "Weekly discount",
        percentage: 10,
        amount: 350,
      },
      discountedAccommodationSubtotal: 3150,
    };

    const vmFromQuote = toPropertyCardPricingViewModel(precomputedQuote);
    assert.equal(vmFromQuote.hasDiscount, true);
    assert.equal(vmFromQuote.baseDisplayPrice, 500); // 3500 / 7
    assert.equal(vmFromQuote.discountedDisplayPrice, 450); // 3150 / 7
    assert.equal(vmFromQuote.discountPercentage, 10);
    assert.equal(vmFromQuote.discountLabel, "Weekly discount");

    // 2. Null/empty safety
    const vmNull = toPropertyCardPricingViewModel(null);
    assert.equal(vmNull.hasDiscount, false);
    assert.equal(vmNull.baseDisplayPrice, 0);
    assert.equal(vmNull.discountedDisplayPrice, null);

    // 3. String discounts JSON
    const vmJsonStr = toPropertyCardPricingViewModel(
      {
        price: 200,
        country: "SA",
        discounts: JSON.stringify({ weekly: { enabled: true, percentage: 20 } }),
      },
      {
        checkIn: "2026-10-10",
        checkOut: "2026-10-17",
      },
    );
    assert.equal(vmJsonStr.hasDiscount, true);
    assert.equal(vmJsonStr.discountedDisplayPrice, 160);
  });

  // ── 10. Component Static Contract Verification ─────────────────────────────
  test("Case 10: Static contracts across ListingCard, SearchMap, and PropertyCard", () => {
    const listingCardPath = path.resolve(__dirname, "../components/listings/listing-card.tsx");
    const searchMapPath = path.resolve(__dirname, "../components/listings/search-map.tsx");
    const propertyCardPath = path.resolve(__dirname, "../components/home/property-card.tsx");

    const listingCardSrc = fs.readFileSync(listingCardPath, "utf-8");
    const searchMapSrc = fs.readFileSync(searchMapPath, "utf-8");
    const propertyCardSrc = fs.readFileSync(propertyCardPath, "utf-8");

    // 1. All use toPropertyCardPricingViewModel
    assert(
      listingCardSrc.includes("toPropertyCardPricingViewModel"),
      "ListingCard must integrate toPropertyCardPricingViewModel",
    );
    assert(
      searchMapSrc.includes("toPropertyCardPricingViewModel"),
      "SearchMap must integrate toPropertyCardPricingViewModel",
    );
    assert(
      propertyCardSrc.includes("toPropertyCardPricingViewModel"),
      "PropertyCard must integrate toPropertyCardPricingViewModel",
    );

    // 2. ListingCard displays line-through and discount badge
    assert(
      listingCardSrc.includes("line-through"),
      "ListingCard must support strike-through display",
    );
    assert(
      listingCardSrc.includes("formattedDiscountedPrice"),
      "ListingCard must render formattedDiscountedPrice",
    );

    // 3. SearchMap price marker sync
    assert(
      searchMapSrc.includes("activeNightlyPrice"),
      "SearchMap must calculate activeNightlyPrice from cardPricing",
    );
  });
});

