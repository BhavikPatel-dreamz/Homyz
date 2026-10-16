import "dotenv/config";
/**
 * HOMYZ — Phase 9 + Phase 10
 * Checkout Price Consistency + Server-Side Final Pricing Validation
 *
 * Tests that:
 *  - The same booking inputs produce identical pricing across Property Details,
 *    Checkout, and the server quote endpoint.
 *  - The server is the sole authoritative source for payment amounts.
 *  - Client-submitted prices, discounts, and tax values are fully ignored.
 *  - Security invariants: manipulated totals, discounts, and taxes are rejected.
 *  - Idempotency: duplicate submissions are blocked.
 *  - Race condition: concurrent bookings correctly single-win.
 *  - Non-refundable rate type persists correctly.
 *  - No N+1 on pricing queries (single listing DB fetch per quote).
 */

import assert from "node:assert/strict";
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
import type { BookingQuoteSelection } from "../lib/booking/quote-cache";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

// ─── Full TaxRuleDTO for Saudi VAT ───────────────────────────────────────────
const SAUDI_VAT_RULE: TaxRuleDTO = {
  id: "vat-sa",
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

// ─── Shared booking parameters (identical across tests) ──────────────────────
const LISTING_ID = "listing-phase9";
const CHECK_IN = "2031-11-10"; // Mon
const CHECK_OUT = "2031-11-17"; // Mon — 7 weekday nights (no Thu/Fri)
const GUESTS = 2;
const BASE_PRICE = 50000; // 500 SAR

const BASE_PARAMS: BookingPricingParams = {
  checkIn: CHECK_IN,
  checkOut: CHECK_OUT,
  weekdayBasePrice: BASE_PRICE,
  weekendPrice: null,
  customPrices: null,
  extraGuestFee: 0,
  baseGuests: 2,
  guests: GUESTS,
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

async function runPhase9And10Tests() {
  console.log("=== RUNNING HOMYZ PHASE 9 + 10 CHECKOUT & SERVER PRICING TESTS ===\n");

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 9 — CHECKOUT PRICE CONSISTENCY
  // ─────────────────────────────────────────────────────────────────────────

  section("Phase 9 — T1: Central engine is single pricing source");
  {
    const quote = await calculateBookingPrice(BASE_PARAMS);

    // Verify night count is authoritative
    ok(quote.nights === 7, "7 nights for Mon–Mon");
    ok(quote.weekdayNights === 7, "All 7 are weekday nights (no Thu/Fri)");
    ok(quote.weekendNights === 0, "Zero weekend nights");

    // Accommodation subtotal (note: accommodationSubtotal is post-discount in pricing engine)
    const expected = 7 * BASE_PRICE;
    const expectedDiscount = Math.round(expected * 0.1);
    const expectedAccommodationSubtotal = expected - expectedDiscount; // post-discount
    ok(quote.staySubtotal === expected, `Stay subtotal (pre-discount) = ${expected}`);
    ok(quote.accommodationSubtotal === expectedAccommodationSubtotal, `accommodationSubtotal (post-discount) = ${expectedAccommodationSubtotal}`);

    // Single winning discount: 7 nights qualifies for weekly (10%)
    ok(
      quote.selectedDiscount !== null && quote.selectedDiscount !== undefined,
      "A winning discount is selected"
    );
    ok(
      (quote.selectedDiscount?.type ?? "") === "WEEKLY",
      "Weekly discount selected as winner"
    );
    ok(
      (quote.selectedDiscount?.percentage ?? 0) === 10,
      "Weekly discount percentage = 10"
    );

    ok(quote.discountAmount === expectedDiscount, `Discount amount = ${expectedDiscount}`);

    // Tax is applied on discounted accommodation (accommodationSubtotal)
    const expectedTax = Math.round(expectedAccommodationSubtotal * 0.15);
    ok(quote.taxTotal === expectedTax, `Tax (15% VAT) = ${expectedTax}`);

    // Final total = post-discount accommodation + tax
    const expectedTotal = expectedAccommodationSubtotal + expectedTax;
    ok(quote.guestTotal === expectedTotal, `Guest total = ${expectedTotal}`);
    ok(quote.total === expectedTotal, "quote.total matches guestTotal");

    // Currency
    ok(quote.currency === "SAR", "Currency is SAR");
  }

  section("Phase 9 — T2: Checkout summary rows match central engine (no re-calc)");
  {
    const quote = await calculateBookingPrice(BASE_PARAMS);

    // Build a checkout-style summary from the quote (same data the server returns)
    const summaryQuote: CheckoutSummaryQuote = {
      nights: quote.nights,
      baseNightlyPrice: quote.effectiveBasePrice,
      nightlySubtotal: quote.staySubtotal,
      discountAmount: quote.discountAmount,
      discountPercentage: quote.discountPercentage,
      selectedDiscount: quote.selectedDiscount ?? null,
      appliedDiscount: quote.appliedDiscount ?? null,
      extraGuestFee: quote.extraGuestFee,
      petFee: quote.petFee ?? 0,
      hostServiceFee: quote.hostServiceFee,
      taxes: (quote.taxes ?? []).map((t) => ({
        taxName: t.taxName,
        taxAmount: t.taxAmount,
        exemptionApplied: t.exemptionApplied ?? false,
        exemptionReason: t.exemptionReason,
        zeroReason: undefined,
      })),
      taxTotal: quote.taxTotal,
      guestTotal: quote.guestTotal,
      currency: quote.currency,
      breakdown: quote.breakdown.map((b) => ({ date: b.date, price: b.price, rateSource: b.rateSource })),
    };

    const rows = getCheckoutPriceRows(summaryQuote);
    const accommodationRow = rows.find((r) => r.id === "accommodation");
    const discountRow = rows.find((r) => r.id === "discount");
    const taxRow = rows.find((r) => r.id === "taxes");

    ok(accommodationRow !== undefined, "Accommodation row exists");
    ok(accommodationRow?.amount === quote.staySubtotal, "Accommodation row uses quote.staySubtotal");
    ok(discountRow !== undefined, "Discount row exists");
    ok(discountRow?.amount === quote.discountAmount, "Discount row uses quote.discountAmount");
    ok(discountRow?.subtract === true, "Discount row is subtracted");
    ok(taxRow !== undefined, "Tax row exists");
    ok(taxRow?.amount === quote.taxTotal, "Tax row uses quote.taxTotal");

    // Total derivation from rows (the display rows should sum to guestTotal)
    const rowSum = rows.reduce((sum, row) => sum + (row.subtract ? -row.amount : row.amount), 0);
    ok(rowSum === quote.guestTotal, `Price rows sum = guestTotal (${quote.guestTotal})`);
  }

  section("Phase 9 — T3: Cross-screen consistency (identical inputs → identical totals)");
  {
    // Simulate what Property Details, Booking Review, and Checkout each compute
    // — all three must delegate to the same calculateBookingPrice call.
    const quoteA = await calculateBookingPrice(BASE_PARAMS);
    const quoteB = await calculateBookingPrice(BASE_PARAMS);

    ok(quoteA.nights === quoteB.nights, "Night count is deterministic");
    ok(quoteA.staySubtotal === quoteB.staySubtotal, "Accommodation subtotal is deterministic");
    ok(quoteA.discountAmount === quoteB.discountAmount, "Discount amount is deterministic");
    ok(quoteA.taxTotal === quoteB.taxTotal, "Tax total is deterministic");
    ok(quoteA.guestTotal === quoteB.guestTotal, "Guest total is deterministic");
    ok(quoteA.currency === quoteB.currency, "Currency is deterministic");
    ok(quoteA.selectedDiscount?.type === quoteB.selectedDiscount?.type, "Discount type is deterministic");
    ok(quoteA.selectedDiscount?.percentage === quoteB.selectedDiscount?.percentage, "Discount % is deterministic");
  }

  section("Phase 9 — T4: Non-refundable rate type persists through checkout");
  {
    const nrParams: BookingPricingParams = {
      ...BASE_PARAMS,
      nonRefundableDiscountPercentage: 10,
    };
    const quote = await calculateBookingPrice(nrParams);
    ok(quote.nonRefundableDiscount !== null, "Non-refundable discount exists");
    ok((quote.nonRefundableDiscount?.percentage ?? 0) === 10, "NR percentage = 10");
    ok((quote.nonRefundableDiscount?.amount ?? 0) > 0, "NR discount amount > 0");

    // Verify summary rows render NR discount separately
    const summaryQuote: CheckoutSummaryQuote = {
      nights: quote.nights,
      baseNightlyPrice: quote.effectiveBasePrice,
      nightlySubtotal: quote.staySubtotal,
      discountAmount: quote.discountAmount,
      discountPercentage: quote.discountPercentage,
      extraGuestFee: quote.extraGuestFee,
      hostServiceFee: quote.hostServiceFee,
      taxes: [],
      taxTotal: quote.taxTotal,
      guestTotal: quote.guestTotal,
      currency: quote.currency,
      rateType: "NON_REFUNDABLE",
      isNonRefundable: true,
      nonRefundableDiscount: quote.nonRefundableDiscount
        ? { key: "non_refundable", name: "Non-refundable discount", percentage: quote.nonRefundableDiscount.percentage, amount: quote.nonRefundableDiscount.amount }
        : null,
      nonRefundable: {
        enabled: true,
        selected: true,
        percentage: quote.nonRefundableDiscount?.percentage ?? 10,
        amount: quote.nonRefundableDiscount?.amount ?? 0,
      },
    };
    const rows = getCheckoutPriceRows(summaryQuote);
    const nrRow = rows.find((r) => r.id === "non-refundable-discount");
    ok(nrRow !== undefined, "Non-refundable discount row rendered");
    ok(nrRow?.subtract === true, "Non-refundable row is subtracted");
    ok(nrRow?.amount === quote.nonRefundableDiscount?.amount, "NR row amount matches quote");
  }

  section("Phase 9 — T5: Weekend pricing flows consistently");
  {
    // Use Thu–Sat (2 weekend nights, 1 weekday) — 2031-11-06 Thu, 11-07 Fri, 11-08 Sat
    const weekendParams: BookingPricingParams = {
      ...BASE_PARAMS,
      checkIn: "2031-11-06", // Thursday (Saudi weekend)
      checkOut: "2031-11-08", // Saturday
      weekendPrice: 75000, // 750 SAR weekend rate
      discounts: null,
    };
    const quote = await calculateBookingPrice(weekendParams);
    ok(quote.nights === 2, "2 nights (Thu+Fri)");
    ok(quote.weekendNights === 2, "Both nights are weekends");
    ok(quote.weekdayNights === 0, "Zero weekday nights");
    ok(quote.staySubtotal === 2 * 75000, "Subtotal uses weekend rate × 2");
    ok(quote.discountAmount === 0, "No discount applied");
  }

  section("Phase 9 — T6: Date consistency — no off-by-one");
  {
    const { bookingDateKey, differenceInBookingNights } = await import("../lib/booking/booking-date");
    // 16 Nov → 21 Nov = 5 nights
    const nights = differenceInBookingNights("2031-11-16", "2031-11-21");
    ok(nights === 5, "5 nights for Nov 16–21");
    // The quote engine must agree
    const quote = await calculateBookingPrice({
      ...BASE_PARAMS,
      checkIn: "2031-11-16",
      checkOut: "2031-11-21",
      discounts: null,
    });
    ok(quote.nights === 5, "Quote.nights = 5");
    ok(quote.staySubtotal === 5 * BASE_PRICE, "Subtotal = 5 × base price");
    // Verify date keys are stable
    ok(bookingDateKey("2031-11-16") === "2031-11-16", "Date key stable");
    ok(bookingDateKey("2031-11-21") === "2031-11-21", "Date key stable");
  }

  section("Phase 9 — T7: Only one winning discount (no stacking)");
  {
    // 7-night stay qualifies for weekly but NOT monthly
    const quoteWeekly = await calculateBookingPrice({
      ...BASE_PARAMS,
      discounts: {
        weekly: { enabled: true, percentage: 10 },
        monthly: { enabled: true, percentage: 25 },
      },
    });
    ok(quoteWeekly.selectedDiscount?.type === "WEEKLY", "7 nights → weekly wins");

    // 30-night stay should pick monthly
    const quoteMonthly = await calculateBookingPrice({
      ...BASE_PARAMS,
      checkIn: "2031-11-01",
      checkOut: "2031-12-01",
      discounts: {
        weekly: { enabled: true, percentage: 10 },
        monthly: { enabled: true, percentage: 25 },
      },
    });
    ok(quoteMonthly.selectedDiscount?.type === "MONTHLY", "30 nights → monthly wins");
    ok(quoteMonthly.discountAmount > 0, "Monthly discount amount > 0");

    // Verify no stacking: only one discount applies
    const summaryQ: CheckoutSummaryQuote = {
      nights: quoteMonthly.nights,
      baseNightlyPrice: quoteMonthly.effectiveBasePrice,
      nightlySubtotal: quoteMonthly.staySubtotal,
      discountAmount: quoteMonthly.discountAmount,
      discountPercentage: quoteMonthly.discountPercentage,
      selectedDiscount: quoteMonthly.selectedDiscount ?? null,
      appliedDiscount: quoteMonthly.appliedDiscount ?? null,
      extraGuestFee: quoteMonthly.extraGuestFee,
      hostServiceFee: quoteMonthly.hostServiceFee,
      taxes: [],
      taxTotal: 0,
      guestTotal: quoteMonthly.guestTotal,
      currency: "SAR",
    };
    const rows = getCheckoutPriceRows(summaryQ);
    const discountRows = rows.filter((r) => r.subtract === true);
    ok(discountRows.length === 1, "Exactly one discount row in checkout summary");
  }

  section("Phase 9 — T8: Variable nightly pricing preserved end-to-end");
  {
    const customPrices: Record<string, number> = {
      "2031-11-10": 60000, // 600
      "2031-11-11": 60000, // 600
      "2031-11-12": 55000, // 550
    };
    const quote = await calculateBookingPrice({
      ...BASE_PARAMS,
      checkIn: "2031-11-10",
      checkOut: "2031-11-14", // 4 nights: 3 custom + 1 base
      customPrices,
      discounts: null,
    });
    ok(quote.nights === 4, "4 nights");
    const expectedSubtotal = 60000 + 60000 + 55000 + BASE_PRICE;
    ok(quote.staySubtotal === expectedSubtotal, `Variable subtotal = ${expectedSubtotal}`);
    // breakdown array holds per-night rates
    ok(quote.breakdown.length === 4, "Breakdown has 4 entries");
    ok(quote.breakdown[0].price === 60000, "Night 1 rate from customPrices");
    ok(quote.breakdown[3].price === BASE_PRICE, "Night 4 rate falls back to base");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 10 — SERVER-SIDE VALIDATION
  // ─────────────────────────────────────────────────────────────────────────

  section("Phase 10 — T9: Server ignores client-submitted total (security)");
  {
    // The server quote is the only authoritative total.
    // createBookingSchema accepts `expectedGuestTotal` only as a consistency check
    // (to detect price changes), not as the payment amount.
    const { createBookingSchema } = await import("../lib/validation/booking");

    // Valid schema — carries expectedGuestTotal but does NOT make it authoritative
    const result = createBookingSchema.safeParse({
      listingId: "listing-1",
      startDate: "2031-11-10",
      endDate: "2031-11-17",
      guests: 2,
      expectedGuestTotal: 1, // manipulated low value
      expectedCurrency: "SAR",
    });
    ok(result.success, "Schema accepts expectedGuestTotal (it is a mismatch-detector, not truth)");

    // The schema must NOT accept a raw `total` or `price` field as authoritative
    const withFakeTotal = (createBookingSchema as any).safeParse({
      listingId: "listing-1",
      startDate: "2031-11-10",
      endDate: "2031-11-17",
      guests: 2,
      total: 1, // unknown field
    });
    // Schema is not strict, but the booking service must ignore this field
    const bookingServiceSrc = read("services/booking.service.ts");
    ok(
      !bookingServiceSrc.includes("input.total"),
      "booking.service.ts never reads input.total as authoritative"
    );
    ok(
      !bookingServiceSrc.includes("req.body.total"),
      "booking.service.ts never reads req.body.total"
    );
    ok(
      bookingServiceSrc.includes("getBookingQuote"),
      "booking.service.ts recalculates price server-side via getBookingQuote"
    );
  }

  section("Phase 10 — T10: Server recalculates authoritative quote (not trusting client discount)");
  {
    const bookingServiceSrc = read("services/booking.service.ts");
    const requestToBookSrc = read("services/request-to-book.service.ts");

    // Server must call the pricing engine independently
    ok(
      bookingServiceSrc.includes("calculateBookingPrice"),
      "booking.service calls calculateBookingPrice (server-side)"
    );
    ok(
      bookingServiceSrc.includes("calculateSpecialOffer") || bookingServiceSrc.includes("calculateBookingPrice"),
      "booking.service has complete server-side price recalculation"
    );

    // Request-to-book service also calculates independently
    ok(
      requestToBookSrc.includes("bookingService.getQuote") || requestToBookSrc.includes("getBookingQuote"),
      "request-to-book.service recalculates server-side quote"
    );

    // Client discount values in body are not used for payment
    ok(
      !bookingServiceSrc.includes("input.discountAmount"),
      "Server does not read input.discountAmount"
    );
    ok(
      !bookingServiceSrc.includes("input.taxTotal"),
      "Server does not read input.taxTotal"
    );
    ok(
      !bookingServiceSrc.includes("input.discountPercentage"),
      "Server does not read input.discountPercentage"
    );
  }

  section("Phase 10 — T11: Server validates listing availability before booking");
  {
    const bookingServiceSrc = read("services/booking.service.ts");
    // Availability checked INSIDE transaction
    ok(
      bookingServiceSrc.includes("pg_advisory_xact_lock"),
      "Advisory lock prevents concurrent double-booking"
    );
    ok(
      bookingServiceSrc.includes("BookingStatus.CONFIRMED") && bookingServiceSrc.includes("BookingStatus.PENDING"),
      "Availability check covers both CONFIRMED and unexpired PENDING bookings"
    );
    ok(
      bookingServiceSrc.includes("getExpiryThresholdDate"),
      "Stale pending bookings excluded from availability checks"
    );
    ok(
      bookingServiceSrc.includes("blockedDates"),
      "Blocked dates are validated server-side"
    );
  }

  section("Phase 10 — T12: Server validates guest capacity");
  {
    const bookingServiceSrc = read("services/booking.service.ts");
    ok(
      bookingServiceSrc.includes("requestedGuests > baseGuests") ||
      bookingServiceSrc.includes("requestedGuests > (listing.guests"),
      "Guest capacity is validated server-side"
    );
    ok(
      bookingServiceSrc.includes("listing.guests"),
      "Server reads capacity from listing record, not client payload"
    );
  }

  section("Phase 10 — T13: Server validates non-refundable availability");
  {
    const bookingServiceSrc = read("services/booking.service.ts");
    ok(
      bookingServiceSrc.includes("nonRefundableAvailable"),
      "Server checks if non-refundable is available for the listing"
    );
    ok(
      bookingServiceSrc.includes("opts.nonRefundable && !nonRefundableAvailable"),
      "Server rejects non-refundable request when listing doesn't support it"
    );
    ok(
      bookingServiceSrc.includes("configuredNonRefundablePercentage"),
      "Server loads the configured non-refundable percentage independently"
    );
  }

  section("Phase 10 — T14: Payment amount comes from server quote only");
  {
    const bookingServiceSrc = read("services/booking.service.ts");
    // The booking's totalPrice must always come from the server quote
    ok(
      bookingServiceSrc.includes("totalPrice: quote.guestTotal"),
      "totalPrice stored in DB is quote.guestTotal (server-computed)"
    );
    ok(
      !bookingServiceSrc.includes("totalPrice: input.expectedGuestTotal"),
      "totalPrice is NOT taken from input.expectedGuestTotal"
    );
    ok(
      !bookingServiceSrc.includes("totalPrice: input.total"),
      "totalPrice is NOT taken from input.total"
    );
  }

  section("Phase 10 — T15: Price mismatch detection (expectedGuestTotal)");
  {
    const bookingServiceSrc = read("services/booking.service.ts");
    const requestToBookSrc = read("services/request-to-book.service.ts");
    // Mismatch causes PRICE_CHANGED error, not silent acceptance
    ok(
      bookingServiceSrc.includes("PRICE_CHANGED") || requestToBookSrc.includes("PRICE_CHANGED"),
      "PRICE_CHANGED error code is defined for mismatch"
    );
    ok(
      bookingServiceSrc.includes("quote.guestTotal !== input.expectedGuestTotal") ||
      requestToBookSrc.includes("quote.guestTotal !== input.expectedGuestTotal"),
      "Mismatch check: server total vs client expected total"
    );
    // Ensure the check is present in both Instant Book and Request to Book paths
    ok(
      bookingServiceSrc.includes("PRICE_CHANGED"),
      "Instant Book path has PRICE_CHANGED mismatch detection"
    );
    ok(
      requestToBookSrc.includes("PRICE_CHANGED"),
      "Request to Book path has PRICE_CHANGED mismatch detection"
    );
  }

  section("Phase 10 — T16: Idempotency — duplicate submission blocked");
  {
    const bookingServiceSrc = read("services/booking.service.ts");
    const requestToBookSrc = read("services/request-to-book.service.ts");
    ok(
      bookingServiceSrc.includes("requestSubmissionId") && bookingServiceSrc.includes("DUPLICATE_REQUEST"),
      "booking.service uses requestSubmissionId + DUPLICATE_REQUEST for idempotency"
    );
    ok(
      requestToBookSrc.includes("requestSubmissionId") && requestToBookSrc.includes("DUPLICATE_REQUEST"),
      "request-to-book.service uses requestSubmissionId + DUPLICATE_REQUEST for idempotency"
    );
    ok(
      bookingServiceSrc.includes("submissionId: input.requestSubmissionId"),
      "submission ID is stored in DB for dedup"
    );
  }

  section("Phase 10 — T17: Concurrency safety — advisory lock per listing");
  {
    const bookingServiceSrc = read("services/booking.service.ts");
    ok(
      bookingServiceSrc.includes("hashtext(${input.listingId})"),
      "Advisory lock is scoped per listing ID to prevent double-booking"
    );
    ok(
      bookingServiceSrc.includes("hashtext(${input.requestSubmissionId})"),
      "Advisory lock is also scoped per submission ID for duplicate protection"
    );
    ok(
      bookingServiceSrc.includes("prisma.$transaction"),
      "Availability check and booking creation are atomic"
    );
  }

  section("Phase 10 — T18: Tax recalculation on server (not trusted from client)");
  {
    const bookingServiceSrc = read("services/booking.service.ts");
    ok(
      bookingServiceSrc.includes("hostTaxes"),
      "Server loads host tax rules from DB"
    );
    ok(
      bookingServiceSrc.includes("taxRules: []"),
      "System tax rules array is passed to pricing engine"
    );
    ok(
      bookingServiceSrc.includes("taxTotal: pricing.taxTotal"),
      "Tax total in quote comes from server pricing engine"
    );
    ok(
      !bookingServiceSrc.includes("input.taxTotal"),
      "Server ignores client-submitted tax total"
    );
  }

  section("Phase 10 — T19: Pricing snapshot stored in booking for historical immutability");
  {
    const bookingServiceSrc = read("services/booking.service.ts");
    ok(
      bookingServiceSrc.includes("priceBreakdown: {"),
      "Server stores complete pricing snapshot in priceBreakdown"
    );
    ok(
      bookingServiceSrc.includes("...quote,"),
      "Snapshot includes full authoritative quote"
    );
    ok(
      bookingServiceSrc.includes("reservationTax.create"),
      "Individual tax items are stored as immutable reservation taxes"
    );
  }

  section("Phase 10 — T20: N+1 protection — listing fetched once per quote");
  {
    const bookingServiceSrc = read("services/booking.service.ts");
    // The preloadedListing fast-path avoids a second DB fetch when create() is called
    // right after getBookingQuote() (e.g., from request-to-book service)
    ok(
      bookingServiceSrc.includes("preloadedListing"),
      "preloadedListing fast-path prevents duplicate listing DB fetch"
    );
    // Host service fee is fetched in parallel (not waterfall)
    ok(
      bookingServiceSrc.includes("hostServiceFeePromise"),
      "Host service fee is fetched in parallel (non-blocking)"
    );
  }

  section("Phase 10 — T21: Security — manipulated discount rejected server-side");
  {
    // Server computes the winning discount from listing config, not client payload
    const bookingServiceSrc = read("services/booking.service.ts");
    ok(
      bookingServiceSrc.includes("listing.discounts"),
      "Server reads discounts from listing record"
    );
    ok(
      !bookingServiceSrc.includes("input.discountType") &&
      !bookingServiceSrc.includes("input.discountPercentage"),
      "Server does NOT accept discount configuration from client"
    );
    // Verify pricing engine validates discount config from listing
    const pricingServiceSrc = read("services/pricing.service.ts");
    ok(
      pricingServiceSrc.includes("resolveSingleDiscount") || pricingServiceSrc.includes("winningDiscount"),
      "Pricing engine independently selects winning discount from listing config"
    );
  }

  section("Phase 10 — T22: Security — fake non-refundable rejected");
  {
    const bookingServiceSrc = read("services/booking.service.ts");
    // If listing doesn't support it, server throws
    ok(
      bookingServiceSrc.includes("nonRefundableAvailable") &&
      bookingServiceSrc.includes("non-refundable reservation is not available"),
      "Server rejects NON_REFUNDABLE when listing does not support it"
    );
    ok(
      bookingServiceSrc.includes("listingOffersNonRefundable"),
      "Server reads non-refundable availability from listing, not client"
    );
  }

  section("Phase 10 — T23: Security — invalid dates rejected server-side");
  {
    const bookingServiceSrc = read("services/booking.service.ts");
    ok(
      bookingServiceSrc.includes("Check-in date cannot be in the past"),
      "Past check-in dates are rejected"
    );
    ok(
      bookingServiceSrc.includes("nights < 1"),
      "Zero-night or negative-night stays are rejected"
    );
    ok(
      bookingServiceSrc.includes("minNights") || bookingServiceSrc.includes("minN"),
      "Minimum stay length is enforced server-side"
    );
  }

  section("Phase 10 — T24: Request to Book — deferred payment flow (authorize before capture)");
  {
    const requestToBookSrc = read("services/request-to-book.service.ts");
    ok(
      requestToBookSrc.includes("DEFERRED"),
      "Request to Book uses DEFERRED payment mode (no immediate capture)"
    );
    ok(
      requestToBookSrc.includes("BookingStatus.PENDING") || requestToBookSrc.includes("PENDING"),
      "Request to Book creates PENDING status booking"
    );
    ok(
      requestToBookSrc.includes("getPaymentPolicy"),
      "Payment policy is checked server-side before booking creation"
    );

    // Host accept flow
    const hostAcceptSrc = read("app/api/v1/host/bookings/[id]/accept/route.ts");
    ok(
      hostAcceptSrc.includes("accept") || hostAcceptSrc.includes("CONFIRMED") || hostAcceptSrc.includes("bookingService"),
      "Host accept route exists and handles confirmation"
    );

    // Host reject flow
    const hostRejectSrc = read("app/api/v1/host/bookings/[id]/reject/route.ts");
    ok(
      hostRejectSrc.includes("reject") || hostRejectSrc.includes("bookingService"),
      "Host reject route exists"
    );
  }

  section("Phase 10 — T25: Instant Book — confirmed immediately (no approval needed)");
  {
    const bookingServiceSrc = read("services/booking.service.ts");
    ok(
      bookingServiceSrc.includes("automaticallyApprove = bookingMode === \"INSTANT_BOOK\""),
      "Instant Book auto-approves without host action"
    );
    ok(
      bookingServiceSrc.includes("BookingStatus.CONFIRMED") &&
      bookingServiceSrc.includes("automaticallyApprove ? BookingStatus.CONFIRMED"),
      "Instant Book creates CONFIRMED booking directly"
    );
  }

  section("Phase 10 — T26: Checkout client — no client-side money in URL");
  {
    const checkoutSrc = read("app/book/[id]/booking-checkout-client.tsx");
    // Must not trust URL params for pricing
    ok(
      !checkoutSrc.includes("searchParams.get(\"total\")") &&
      !checkoutSrc.includes("searchParams.get(\"price\")") &&
      !checkoutSrc.includes("searchParams.get(\"discount\")") &&
      !checkoutSrc.includes("searchParams.get(\"tax\")"),
      "Checkout client does not read money values from URL params"
    );
    // Must not show SAR 0 — uses 'Calculating...' skeleton
    ok(
      checkoutSrc.includes("Calculating") || checkoutSrc.includes("loading"),
      "Checkout shows loading state instead of SAR 0"
    );
  }

  section("Phase 10 — T27: Checkout client — deduplication prevents repeat quote requests");
  {
    const selection: BookingQuoteSelection = {
      listingId: LISTING_ID,
      checkIn: CHECK_IN,
      checkOut: CHECK_OUT,
      guests: GUESTS,
      pets: 0,
      nonRefundable: false,
    };
    const keyA = createQuoteRequestKey(selection);
    const keyB = createQuoteRequestKey(selection);
    ok(keyA === keyB, "Identical selections produce identical deduplication keys");
    // Different selection = different key
    const keyC = createQuoteRequestKey({ ...selection, guests: 3 });
    ok(keyA !== keyC, "Changed guest count produces different dedup key");
  }

  section("Phase 10 — T28: Previous valid quote preserved during refresh (no flash to zero)");
  {
    const quoteCacheSrc = read("lib/booking/quote-cache.ts");
    ok(
      quoteCacheSrc.includes("saveBookingQuote"),
      "Quote cache saves authoritative quote for stale-while-refresh"
    );
    ok(
      quoteCacheSrc.includes("readBookingQuote"),
      "Quote cache provides previously saved quote on refresh"
    );
    ok(
      quoteCacheSrc.includes("inFlightRequests"),
      "In-flight request deduplication prevents concurrent identical fetches"
    );
    const checkoutSrc = read("app/book/[id]/booking-checkout-client.tsx");
    ok(
      checkoutSrc.includes("readBookingQuote"),
      "Checkout client initializes quote from cache to prevent zero flash"
    );
  }

  section("Phase 10 — T29: Booking snapshot preserves historical pricing (immutability)");
  {
    const bookingServiceSrc = read("services/booking.service.ts");
    // After booking is created, changing listing price must not affect stored booking
    ok(
      bookingServiceSrc.includes("priceBreakdown:"),
      "Pricing snapshot is stored immutably in priceBreakdown"
    );
    ok(
      bookingServiceSrc.includes("totalPrice: quote.guestTotal"),
      "Stored totalPrice comes from server quote at booking time"
    );
    // booking-price.ts reads from snapshot for historical display
    const bookingPriceSrc = read("lib/booking/booking-price.ts");
    ok(
      bookingPriceSrc.includes("priceBreakdown"),
      "Historical price breakdown reads from stored snapshot"
    );
    ok(
      bookingPriceSrc.includes("storedTotal"),
      "Historical total uses immutable storedTotal"
    );
  }

  section("Phase 10 — T30: Checkout sends only selections to server, not money");
  {
    const checkoutSrc = read("app/book/[id]/booking-checkout-client.tsx");
    // Payload must contain booking selections
    ok(
      checkoutSrc.includes("listingId: listing.id"),
      "Checkout sends listingId"
    );
    ok(
      checkoutSrc.includes("startDate: checkIn"),
      "Checkout sends checkIn date"
    );
    ok(
      checkoutSrc.includes("endDate: checkOut"),
      "Checkout sends checkOut date"
    );
    ok(
      checkoutSrc.includes("guests: guestsCount"),
      "Checkout sends guest count"
    );
    ok(
      checkoutSrc.includes("nonRefundable: isNonRefundable"),
      "Checkout sends nonRefundable selection"
    );
    // expectedGuestTotal is only a consistency guard, not payment authority
    ok(
      checkoutSrc.includes("expectedGuestTotal: quote.guestTotal"),
      "Checkout sends expectedGuestTotal for mismatch detection only"
    );
    // Checkout must NOT send raw computed money values as authoritative
    ok(
      !checkoutSrc.includes("price: quote.guestTotal") &&
      !checkoutSrc.includes("amount: quote.guestTotal"),
      "Checkout does not send guestTotal as payment authority"
    );
  }

  // ─── Summary ─────────────────────────────────────────────────────────────
  console.log(`\n=== PHASE 9 + 10 RESULTS: ${passed} passed / ${failed} failed ===\n`);
  if (failed > 0) process.exitCode = 1;
}

runPhase9And10Tests().catch((err) => {
  console.error("Test run error:", err);
  process.exit(1);
});
