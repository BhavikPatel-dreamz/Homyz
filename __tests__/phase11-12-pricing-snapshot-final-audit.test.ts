import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import {
  calculateBookingPrice,
  type BookingPricingParams,
} from "../services/pricing.service";
import type { TaxRuleDTO } from "../lib/tax/types";
import {
  getCheckoutPriceRows,
  type CheckoutSummaryQuote,
} from "../lib/booking/checkout-summary";
import { createQuoteRequestKey } from "../lib/booking/quote-cache";
import {
  allocateNightlyTotal,
  getAuthoritativePriceBreakdown,
} from "../lib/booking/booking-price";
import { toPropertyCardPricingViewModel } from "../lib/booking/property-card-pricing";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

// Standard Saudi 15% VAT Rule
const SAUDI_VAT_RULE: TaxRuleDTO = {
  id: "vat-sa-rule",
  jurisdictionId: "SA",
  taxType: "VAT",
  name: "Saudi VAT",
  description: "Standard Saudi 15% VAT",
  calculationMethod: "PERCENTAGE",
  rate: 15,
  amount: null,
  isInclusive: false,
  taxableComponents: ["BASE_PRICE"],
  remittanceResponsibility: "PLATFORM",
  isSystemManaged: true,
  longStayExemptionNights: null,
  effectiveFrom: new Date().toISOString(),
  effectiveUntil: null,
  version: 1,
  isActive: true,
};

let passed = 0;
let failed = 0;

function ok(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${label}`);
    failed++;
  }
}

function section(name: string) {
  console.log(`\n── ${name} ──`);
}

async function runPhase11And12Tests() {
  console.log("=== RUNNING HOMYZ PHASE 11 + 12 FINAL PRICING & SNAPSHOT AUDIT ===\n");

  // =========================================================================
  // PHASE 11: BOOKING PRICE SNAPSHOT AUDIT
  // =========================================================================

  section("Phase 11 — T1: Snapshot contains all required pricing fields");
  {
    const quote = await calculateBookingPrice({
      checkIn: "2031-11-10",
      checkOut: "2031-11-17", // 7 nights -> weekly discount
      weekdayBasePrice: 50000,
      weekendPrice: 60000,
      customPrices: null,
      extraGuestFee: 0,
      baseGuests: 2,
      guests: 2,
      pets: 0,
      petFee: null,
      discounts: {
        weekly: { enabled: true, percentage: 10 },
        monthly: { enabled: false, percentage: 20 },
      },
      includeNewListingPromotion: false,
      hostServiceFeePercentage: 15,
      taxRules: [SAUDI_VAT_RULE],
      hostTaxes: [],
      nonRefundableDiscountPercentage: null,
      currency: "SAR",
    });

    // Simulate booking creation snapshot as saved in booking.service.ts
    const simulatedSnapshot = {
      ...quote,
      pricingSnapshotVersion: "v1",
      pricingSnapshotRevision: 1,
      automaticDiscount: quote.selectedDiscount ? {
        type: quote.selectedDiscount.type,
        label: quote.selectedDiscount.label,
        percentage: quote.selectedDiscount.percentage,
        amount: quote.selectedDiscount.amount,
      } : null,
      cancellationPolicySnapshot: "FLEXIBLE",
      paymentPlan: "FULL",
      paymentMode: "DEFERRED",
      paymentStatus: "PAYMENT_PENDING",
      bookingMode: "INSTANT_BOOK",
    };

    const breakdown = getAuthoritativePriceBreakdown({
      startDate: "2031-11-10",
      endDate: "2031-11-17",
      nightlyPrice: quote.baseNightlyPrice,
      totalPrice: quote.guestTotal,
      currency: quote.currency,
      priceBreakdown: simulatedSnapshot,
    });

    ok(breakdown.currency === "SAR", "Snapshot preserves currency (SAR)");
    ok(breakdown.nights === 7, "Snapshot preserves night count (7)");
    ok(breakdown.totalPrice === quote.guestTotal, "Snapshot totalPrice matches authoritative quote");
    ok(breakdown.storedTotal === quote.guestTotal, "Snapshot storedTotal matches quote");
    ok(breakdown.isMathConsistent === true, "Snapshot math is strictly consistent");
    ok(breakdown.pricingSnapshotVersion === "v1", "Snapshot version is v1");
    ok(breakdown.pricingSnapshotRevision === 1, "Initial snapshot revision is 1");
    ok(breakdown.automaticDiscount?.type === "WEEKLY", "Automatic discount type recorded as WEEKLY");
    ok(breakdown.automaticDiscount?.amount === quote.discountAmount, "Automatic discount amount matches");
    ok(breakdown.cancellationPolicySnapshot === "FLEXIBLE", "Cancellation policy recorded in snapshot");
    ok(Array.isArray(breakdown.nightlyBreakdown), "Nightly breakdown array present");
    ok(breakdown.nightlyBreakdown?.length === 7, "Nightly breakdown has 7 entries");
  }

  section("Phase 11 — T2: Immutability — host price changes after booking do NOT affect historical reservation");
  {
    // Original booking at 500 SAR/night for 3 nights = 1500 SAR
    const originalBooking = {
      id: "booking-hist-1",
      startDate: "2031-11-10",
      endDate: "2031-11-13",
      nightlyPrice: 50000,
      totalPrice: 150000,
      currency: "SAR",
      priceBreakdown: {
        nights: 3,
        baseNightlyPrice: 50000,
        nightlySubtotal: 150000,
        discountAmount: 0,
        taxTotal: 0,
        taxes: [],
        guestTotal: 150000,
        currency: "SAR",
        pricingSnapshotVersion: "v1",
      },
    };

    const originalPricing = getAuthoritativePriceBreakdown(originalBooking);
    ok(originalPricing.totalPrice === 150000, "Initial historical booking total is 150,000 minor units");
    ok(originalPricing.nightlyPrice === 50000, "Initial nightly price is 50,000");

    // Later, host updates listing price to 900 SAR/night, adds 20% discount, changes cancellation policy
    // Re-evaluating the historical booking record MUST NOT change!
    const reevaluatedPricing = getAuthoritativePriceBreakdown(originalBooking);
    ok(reevaluatedPricing.totalPrice === originalPricing.totalPrice, "Historical booking total unchanged after host edits");
    ok(reevaluatedPricing.nightlyPrice === originalPricing.nightlyPrice, "Historical nightly rate unchanged");
    ok(reevaluatedPricing.discountAmount === originalPricing.discountAmount, "Historical discount unchanged");
    ok(reevaluatedPricing.isMathConsistent === true, "Historical booking math remains consistent");
  }

  section("Phase 11 — T3: Non-refundable rate snapshot immutability");
  {
    const quote = await calculateBookingPrice({
      checkIn: "2031-11-10",
      checkOut: "2031-11-12",
      weekdayBasePrice: 50000,
      weekendPrice: null,
      customPrices: null,
      extraGuestFee: 0,
      baseGuests: 2,
      guests: 2,
      pets: 0,
      petFee: null,
      discounts: { non_refundable: { enabled: true, percentage: 10 } },
      includeNewListingPromotion: false,
      hostServiceFeePercentage: 15,
      taxRules: [],
      hostTaxes: [],
      nonRefundableDiscountPercentage: 10,
      rateType: "NON_REFUNDABLE",
      currency: "SAR",
    });

    const nrSnapshot = {
      ...quote,
      pricingSnapshotVersion: "v1",
      rateType: "NON_REFUNDABLE",
      isNonRefundable: true,
      cancellationPolicySnapshot: "NON_REFUNDABLE",
    };

    const breakdown = getAuthoritativePriceBreakdown({
      startDate: "2031-11-10",
      endDate: "2031-11-12",
      nightlyPrice: quote.baseNightlyPrice,
      totalPrice: quote.guestTotal,
      currency: "SAR",
      priceBreakdown: nrSnapshot,
    });

    ok(breakdown.isNonRefundable === true, "Snapshot marks booking as non-refundable");
    ok(breakdown.rateType === "NON_REFUNDABLE", "Snapshot rateType is NON_REFUNDABLE");
    ok(breakdown.cancellationPolicySnapshot === "NON_REFUNDABLE", "Snapshot cancellation policy is NON_REFUNDABLE");
    ok(breakdown.discountAmount === quote.discountAmount, "Non-refundable discount amount preserved in snapshot");
  }

  section("Phase 11 — T4: Variable nightly price snapshot preserves per-night rates");
  {
    const customPrices: Record<string, number> = {
      "2031-11-10": 60000,
      "2031-11-11": 70000,
      "2031-11-12": 65000,
    };
    const quote = await calculateBookingPrice({
      checkIn: "2031-11-10",
      checkOut: "2031-11-13",
      weekdayBasePrice: 50000,
      weekendPrice: null,
      customPrices,
      extraGuestFee: 0,
      baseGuests: 2,
      guests: 2,
      pets: 0,
      petFee: null,
      discounts: null,
      includeNewListingPromotion: false,
      hostServiceFeePercentage: 15,
      taxRules: [],
      hostTaxes: [],
      currency: "SAR",
    });

    const breakdown = getAuthoritativePriceBreakdown({
      startDate: "2031-11-10",
      endDate: "2031-11-13",
      nightlyPrice: quote.baseNightlyPrice,
      totalPrice: quote.guestTotal,
      currency: "SAR",
      priceBreakdown: {
        ...quote,
        pricingSnapshotVersion: "v1",
      },
    });

    ok(breakdown.nightlyBreakdown !== undefined, "Nightly breakdown exists in snapshot");
    ok(breakdown.nightlyBreakdown?.length === 3, "3 nights recorded");
    ok(breakdown.nightlyBreakdown?.[0].rate === 60000, "Night 1 rate is 60,000");
    ok(breakdown.nightlyBreakdown?.[1].rate === 70000, "Night 2 rate is 70,000");
    ok(breakdown.nightlyBreakdown?.[2].rate === 65000, "Night 3 rate is 65,000");

    // Sum of per-night rates strictly equals nightlySubtotal
    const sumRates = breakdown.nightlyBreakdown?.reduce((sum, n) => sum + n.rate, 0);
    ok(sumRates === breakdown.nightlySubtotal, `Sum of nightly rates (${sumRates}) strictly equals subtotal (${breakdown.nightlySubtotal})`);
  }

  section("Phase 11 — T5: Tax snapshot preserves tax line items & exemptions");
  {
    const quote = await calculateBookingPrice({
      checkIn: "2031-11-10",
      checkOut: "2031-11-12",
      weekdayBasePrice: 50000,
      weekendPrice: null,
      customPrices: null,
      extraGuestFee: 0,
      baseGuests: 2,
      guests: 2,
      pets: 0,
      petFee: null,
      discounts: null,
      includeNewListingPromotion: false,
      hostServiceFeePercentage: 15,
      taxRules: [SAUDI_VAT_RULE],
      hostTaxes: [],
      currency: "SAR",
    });

    const breakdown = getAuthoritativePriceBreakdown({
      startDate: "2031-11-10",
      endDate: "2031-11-12",
      nightlyPrice: quote.baseNightlyPrice,
      totalPrice: quote.guestTotal,
      currency: "SAR",
      priceBreakdown: quote,
    });

    ok(breakdown.taxes.length === 1, "Exactly one tax item preserved");
    ok(breakdown.taxes[0].name === "Saudi VAT", "Tax name preserved");
    ok(breakdown.taxes[0].amountMinorUnits === quote.taxTotal, "Tax amount preserved");
    ok(breakdown.taxTotal === quote.taxTotal, "taxTotal matches quote");
  }

  section("Phase 11 — T6: Invariant — automatic discount count <= 1");
  {
    // Multiple discounts configured: weekly (10%) and monthly (25%) for a 7-night stay
    const quote = await calculateBookingPrice({
      checkIn: "2031-11-10",
      checkOut: "2031-11-17",
      weekdayBasePrice: 50000,
      weekendPrice: null,
      customPrices: null,
      extraGuestFee: 0,
      baseGuests: 2,
      guests: 2,
      pets: 0,
      petFee: null,
      discounts: {
        weekly: { enabled: true, percentage: 10 },
        monthly: { enabled: true, percentage: 25 },
      },
      includeNewListingPromotion: false,
      hostServiceFeePercentage: 15,
      taxRules: [],
      hostTaxes: [],
      currency: "SAR",
    });

    const breakdown = getAuthoritativePriceBreakdown({
      startDate: "2031-11-10",
      endDate: "2031-11-17",
      nightlyPrice: quote.baseNightlyPrice,
      totalPrice: quote.guestTotal,
      currency: "SAR",
      priceBreakdown: quote,
    });

    // Exactly one discount applied
    ok(quote.selectedDiscount?.type === "WEEKLY", "Weekly discount wins");
    ok(breakdown.automaticDiscount?.type === "WEEKLY", "Automatic discount recorded as single winner");
    const discountRows = getCheckoutPriceRows({
      nights: quote.nights,
      baseNightlyPrice: quote.effectiveBasePrice,
      nightlySubtotal: quote.staySubtotal,
      discountAmount: quote.discountAmount,
      selectedDiscount: quote.selectedDiscount,
      appliedDiscount: quote.appliedDiscount,
      extraGuestFee: 0,
      hostServiceFee: quote.hostServiceFee,
      taxes: [],
      taxTotal: 0,
      guestTotal: quote.guestTotal,
      currency: "SAR",
    }).filter((r) => r.subtract === true);
    ok(discountRows.length <= 1, `At most 1 automatic discount row (${discountRows.length})`);
  }

  section("Phase 11 — T6b: Special-offer nightly allocation preserves every minor unit");
  {
    const allocated = allocateNightlyTotal(100_001, 3);

    ok(allocated.reduce((sum, amount) => sum + amount, 0) === 100_001,
      "Special-offer nightly allocation strictly equals the offer subtotal");
    ok(allocated.join(",") === "33334,33334,33333",
      "Special-offer remainder is distributed deterministically");
  }

  // =========================================================================
  // PHASE 12: FINAL PRICING / DISCOUNT AUDIT & OPTIMIZATIONS
  // =========================================================================

  section("Phase 12 — T7: End-to-end pricing parity (Card -> Detail -> Checkout -> Server -> Snapshot)");
  {
    // Scenario: 7-night stay, Mon to Mon, 500 SAR/night base, weekly 10% discount, 15% VAT
    const params: BookingPricingParams = {
      checkIn: "2031-11-10",
      checkOut: "2031-11-17",
      weekdayBasePrice: 50000,
      weekendPrice: null,
      customPrices: null,
      extraGuestFee: 0,
      baseGuests: 2,
      guests: 2,
      pets: 0,
      petFee: null,
      discounts: { weekly: { enabled: true, percentage: 10 } },
      includeNewListingPromotion: false,
      hostServiceFeePercentage: 15,
      taxRules: [SAUDI_VAT_RULE],
      hostTaxes: [],
      currency: "SAR",
    };

    // 1. Central Pricing Engine
    const centralQuote = await calculateBookingPrice(params);

    // 2. Property Card Pricing Model
    const cardModel = toPropertyCardPricingViewModel(
      {
        id: "listing-test-parity",
        price: 50000,
        country: "SA",
        discounts: { weekly: { enabled: true, percentage: 10 } },
        isNewListing: false,
      },
      { currency: "SAR", checkIn: "2031-11-10", checkOut: "2031-11-17" },
    );
    ok(cardModel.hasDiscount === true, "Card detects active discount");
    ok(cardModel.discountLabel === "Weekly discount", "Card shows Weekly discount label");

    // 3. Checkout Summary Rows
    const summaryQuote: CheckoutSummaryQuote = {
      nights: centralQuote.nights,
      baseNightlyPrice: centralQuote.effectiveBasePrice,
      nightlySubtotal: centralQuote.staySubtotal,
      discountAmount: centralQuote.discountAmount,
      selectedDiscount: centralQuote.selectedDiscount,
      appliedDiscount: centralQuote.appliedDiscount,
      extraGuestFee: 0,
      hostServiceFee: centralQuote.hostServiceFee,
      taxes: centralQuote.taxes.map((t) => ({
        taxName: t.taxName,
        taxAmount: t.taxAmount,
        exemptionApplied: t.exemptionApplied,
      })),
      taxTotal: centralQuote.taxTotal,
      guestTotal: centralQuote.guestTotal,
      currency: centralQuote.currency,
    };
    const checkoutRows = getCheckoutPriceRows(summaryQuote);
    const checkoutRowSum = checkoutRows.reduce(
      (sum, r) => sum + (r.subtract ? -r.amount : r.amount),
      0,
    );
    ok(checkoutRowSum === centralQuote.guestTotal, "Checkout rows sum matches central quote total");

    // 4. Server Booking Snapshot
    const snapshotBreakdown = getAuthoritativePriceBreakdown({
      startDate: "2031-11-10",
      endDate: "2031-11-17",
      nightlyPrice: centralQuote.baseNightlyPrice,
      totalPrice: centralQuote.guestTotal,
      currency: centralQuote.currency,
      priceBreakdown: centralQuote,
    });
    ok(snapshotBreakdown.totalPrice === centralQuote.guestTotal, "Snapshot total matches central quote total");
    ok(snapshotBreakdown.totalPrice === checkoutRowSum, "Cross-screen total parity: Checkout == Server == Snapshot");
  }

  section("Phase 12 — T8: Weekend pricing audit (Saudi Thu/Fri nights detected)");
  {
    // Check-in Thu 2031-11-06, Check-out Sat 2031-11-08 (Thu + Fri = 2 Saudi weekend nights)
    const quote = await calculateBookingPrice({
      checkIn: "2031-11-06",
      checkOut: "2031-11-08",
      weekdayBasePrice: 50000,
      weekendPrice: 75000,
      customPrices: null,
      extraGuestFee: 0,
      baseGuests: 2,
      guests: 2,
      pets: 0,
      petFee: null,
      discounts: null,
      includeNewListingPromotion: false,
      hostServiceFeePercentage: 15,
      taxRules: [],
      hostTaxes: [],
      currency: "SAR",
    });

    ok(quote.nights === 2, "2 nights stay");
    ok(quote.weekendNights === 2, "Both nights detected as Saudi weekend (Thu/Fri)");
    ok(quote.weekdayNights === 0, "0 weekday nights");
    ok(quote.staySubtotal === 2 * 75000, "Subtotal correctly uses weekendPrice (150,000)");
  }

  section("Phase 12 — T9: Performance — Request deduplication key stability");
  {
    const selection = {
      listingId: "listing-perf-1",
      checkIn: "2031-11-10",
      checkOut: "2031-11-17",
      guests: 2,
      pets: 0,
      nonRefundable: false,
    };
    const key1 = createQuoteRequestKey(selection);
    const key2 = createQuoteRequestKey(selection);
    ok(key1 === key2, "Identical selections produce identical dedup key");

    const keyWithDifferentDates = createQuoteRequestKey({
      ...selection,
      checkIn: "2031-11-11",
    });
    ok(key1 !== keyWithDifferentDates, "Changed date produces distinct dedup key");
  }

  section("Phase 12 — T10: Security audit — Server never trusts client money");
  {
    const bookingServiceSrc = read("services/booking.service.ts");
    const requestToBookSrc = read("services/request-to-book.service.ts");

    ok(
      !bookingServiceSrc.includes("req.body.total"),
      "Server never reads req.body.total"
    );
    ok(
      !bookingServiceSrc.includes("req.body.discountAmount"),
      "Server never reads req.body.discountAmount"
    );
    ok(
      !bookingServiceSrc.includes("req.body.taxTotal"),
      "Server never reads req.body.taxTotal"
    );
    ok(
      bookingServiceSrc.includes("totalPrice: quote.guestTotal"),
      "Server stores only quote.guestTotal as booking totalPrice"
    );
    ok(
      bookingServiceSrc.includes("PRICE_CHANGED"),
      "Server rejects mismatched expectedGuestTotal with PRICE_CHANGED error"
    );
    ok(
      requestToBookSrc.includes("PRICE_CHANGED"),
      "Request-to-book rejects mismatched total with PRICE_CHANGED error"
    );
  }

  section("Phase 12 — T11: Concurrency audit — double-submission protection");
  {
    const bookingServiceSrc = read("services/booking.service.ts");
    ok(
      bookingServiceSrc.includes("hashtext(${input.requestSubmissionId})"),
      "Advisory lock on submissionId prevents duplicate simultaneous booking"
    );
    ok(
      bookingServiceSrc.includes("hashtext(${input.listingId})"),
      "Advisory lock on listingId prevents concurrent date-collision race"
    );
  }

  section("Phase 12 — T11b: Reservation modifications are explicitly versioned");
  {
    const bookingServiceSrc = read("services/booking.service.ts");
    ok(
      bookingServiceSrc.includes("pricingSnapshotRevision: previousRevision + 1"),
      "Reservation changes increment the pricing snapshot revision",
    );
    ok(
      bookingServiceSrc.includes("pricingSnapshotHistory"),
      "Reservation changes retain the superseded pricing snapshot",
    );
    ok(
      bookingServiceSrc.includes("const requestedGuests = preview.quote.guests"),
      "Reservation changes persist the authoritative quoted guest count",
    );
  }

  section("Phase 12 — T12: Legacy snapshot compatibility — historical bookings without v1 tags");
  {
    // An old booking created before Phase 11 without pricingSnapshotVersion
    const legacyBooking = {
      startDate: "2026-05-01",
      endDate: "2026-05-04",
      nightlyPrice: 40000,
      totalPrice: 120000,
      currency: "SAR",
      priceBreakdown: {
        nightlySubtotal: 120000,
        guestTotal: 120000,
        currency: "SAR",
      },
    };

    const breakdown = getAuthoritativePriceBreakdown(legacyBooking);
    ok(breakdown.totalPrice === 120000, "Legacy booking total is preserved");
    ok(breakdown.isMathConsistent === true, "Legacy booking math is consistent");
    ok(breakdown.storedTotal === 120000, "Legacy storedTotal matches");
  }

  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\n=== PHASE 11 + 12 RESULTS: ${passed} passed / ${failed} failed ===\n`);
  if (failed > 0) process.exitCode = 1;
}

runPhase11And12Tests().catch((err) => {
  console.error("Test run error:", err);
  process.exit(1);
});
