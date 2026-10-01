import "dotenv/config";
import assert from "node:assert/strict";
import { calculateBookingPrice } from "../services/pricing.service";
import { getCheckoutPriceRows, type CheckoutSummaryQuote } from "../lib/booking/checkout-summary";
import { createReviewRequestData } from "../lib/booking/review-request";
import { discountsSchema } from "../lib/validation/listing";
import { quoteBookingSchema, createBookingSchema } from "../lib/validation/booking";

async function testPhase8NonRefundable() {
  console.log("=== RUNNING HOMYZ PHASE 8 NON-REFUNDABLE TESTS ===\n");

  // TEST 1: Disabled Listing (Default OFF)
  console.log("Test 1: Disabled listing - non-refundable option not available");
  const disabledPricing = await calculateBookingPrice({
    checkIn: "2031-10-01",
    checkOut: "2031-10-04", // 3 nights
    weekdayBasePrice: 10_000, // 100 SAR/night (minor units)
    weekendPrice: 10_000,
    discounts: {}, // no non-refundable setting
    hostServiceFeePercentage: 0,
  });
  assert.equal(disabledPricing.nonRefundable.enabled, false);
  assert.equal(disabledPricing.nonRefundable.selected, false);
  assert.equal(disabledPricing.nonRefundable.amount, 0);
  assert.equal(disabledPricing.rateType, "STANDARD");
  assert.equal(disabledPricing.isNonRefundable, false);
  assert.equal(disabledPricing.nonRefundableDiscount, null);
  assert.equal(disabledPricing.accommodationSubtotal, 30_000);
  console.log("✓ Test 1 Passed: Disabled listing defaults rate to STANDARD and zero non-refundable discount.\n");

  // TEST 2: Enabled Listing - Standard Selection vs Non-Refundable Selection
  console.log("Test 2: Enabled listing - Standard vs Non-refundable rate selection");
  const listingDiscounts = {
    non_refundable: { enabled: true, percentage: 15 },
  };

  const standardSelected = await calculateBookingPrice({
    checkIn: "2031-10-01",
    checkOut: "2031-10-04", // 3 nights = 30,000
    weekdayBasePrice: 10_000,
    weekendPrice: 10_000,
    discounts: listingDiscounts,
    rateType: "STANDARD",
    hostServiceFeePercentage: 0,
  });
  assert.equal(standardSelected.nonRefundable.enabled, true);
  assert.equal(standardSelected.nonRefundable.selected, false);
  assert.equal(standardSelected.nonRefundable.percentage, 15);
  assert.equal(standardSelected.nonRefundable.amount, 0);
  assert.equal(standardSelected.rateType, "STANDARD");
  assert.equal(standardSelected.isNonRefundable, false);
  assert.equal(standardSelected.nonRefundableDiscount, null);
  assert.equal(standardSelected.accommodationSubtotal, 30_000);

  const nonRefSelected = await calculateBookingPrice({
    checkIn: "2031-10-01",
    checkOut: "2031-10-04", // 3 nights = 30,000
    weekdayBasePrice: 10_000,
    weekendPrice: 10_000,
    discounts: listingDiscounts,
    rateType: "NON_REFUNDABLE",
    hostServiceFeePercentage: 0,
  });
  // 15% of 30,000 = 4,500
  assert.equal(nonRefSelected.nonRefundable.enabled, true);
  assert.equal(nonRefSelected.nonRefundable.selected, true);
  assert.equal(nonRefSelected.nonRefundable.percentage, 15);
  assert.equal(nonRefSelected.nonRefundable.amount, 4_500);
  assert.equal(nonRefSelected.rateType, "NON_REFUNDABLE");
  assert.equal(nonRefSelected.isNonRefundable, true);
  assert.notEqual(nonRefSelected.nonRefundableDiscount, null);
  assert.equal(nonRefSelected.nonRefundableDiscount?.amount, 4_500);
  assert.equal(nonRefSelected.accommodationSubtotal, 25_500); // 30,000 - 4,500
  console.log("✓ Test 2 Passed: Standard and Non-refundable rate selection calculates correctly.\n");

  // TEST 3: Compounding Promo Interaction (No Parallel Stacking Bug)
  console.log("Test 3: Promotional discount + Non-refundable compounding calculation");
  // 10 nights @ 10,000 = 100,000 staySubtotal.
  // Weekly discount = 10% -> 10,000 discount.
  // After weekly discount = 90,000.
  // Non-refundable discount = 10% of 90,000 = 9,000.
  // Total discount = 19,000 (NOT 20,000 parallel).
  // Accommodation Subtotal = 81,000.
  const compoundingResult = await calculateBookingPrice({
    checkIn: "2031-10-01",
    checkOut: "2031-10-11", // 10 nights
    weekdayBasePrice: 10_000,
    weekendPrice: 10_000,
    discounts: {
      weekly: { enabled: true, percentage: 10 },
      non_refundable: { enabled: true, percentage: 10 },
    },
    rateType: "NON_REFUNDABLE",
    hostServiceFeePercentage: 0,
  });
  assert.equal(compoundingResult.staySubtotal, 100_000);
  assert.equal(compoundingResult.appliedDiscount?.amount, 10_000);
  assert.equal(compoundingResult.nonRefundable.amount, 9_000);
  assert.equal(compoundingResult.discountAmount, 19_000);
  assert.equal(compoundingResult.accommodationSubtotal, 81_000);
  console.log("✓ Test 3 Passed: Compounding rule strictly enforced without parallel stacking.\n");

  // TEST 4: Variable Night & Weekend Pricing Support
  console.log("Test 4: Variable night and weekend pricing integration");
  // 2031-10-01 (Wednesday) = 10,000
  // 2031-10-02 (Thursday) = 10,000
  // 2031-10-03 (Friday - Weekend) = 15,000
  // 2031-10-04 (Saturday - Weekend) = 15,000
  // CheckOut 2031-10-05 (Sunday). Total 4 nights = 50,000 stay subtotal.
  const weekendPricing = await calculateBookingPrice({
    checkIn: "2031-10-01",
    checkOut: "2031-10-05",
    weekdayBasePrice: 10_000,
    weekendPrice: 15_000,
    discounts: {
      non_refundable: { enabled: true, percentage: 20 },
    },
    rateType: "NON_REFUNDABLE",
    hostServiceFeePercentage: 0,
  });
  assert.equal(weekendPricing.staySubtotal, 50_000);
  assert.equal(weekendPricing.nonRefundable.amount, 10_000); // 20% of 50,000
  assert.equal(weekendPricing.accommodationSubtotal, 40_000);
  console.log("✓ Test 4 Passed: Applies accurately across weekday and weekend rate variations.\n");

  // TEST 5: Checkout Price Rows Itemization
  console.log("Test 5: Checkout summary price rows itemization");
  const mockQuoteStandard: CheckoutSummaryQuote = {
    nights: 3,
    baseNightlyPrice: 100,
    nightlySubtotal: 300,
    guestTotal: 345,
    extraGuestFee: 0,
    hostServiceFee: 0,
    taxTotal: 45,
    discountAmount: 0,
    currency: "SAR",
    rateType: "STANDARD",
    isNonRefundable: false,
    taxes: [{ taxName: "VAT", taxAmount: 45 }],
  };
  const standardRows = getCheckoutPriceRows(mockQuoteStandard);
  assert.equal(standardRows.some((r) => r.id === "non-refundable-discount"), false);

  const mockQuoteNonRef: CheckoutSummaryQuote = {
    nights: 3,
    baseNightlyPrice: 100,
    nightlySubtotal: 300,
    guestTotal: 293.25,
    extraGuestFee: 0,
    hostServiceFee: 0,
    taxTotal: 38.25,
    discountAmount: 45,
    currency: "SAR",
    rateType: "NON_REFUNDABLE",
    isNonRefundable: true,
    nonRefundableDiscount: { name: "Non-refundable discount", percentage: 15, amount: 45 },
    taxes: [{ taxName: "VAT", taxAmount: 38.25 }],
  };
  const nonRefRows = getCheckoutPriceRows(mockQuoteNonRef);
  const discountRow = nonRefRows.find((r) => r.id === "non-refundable-discount");
  assert.notEqual(discountRow, undefined);
  assert.equal(discountRow?.amount, 45);
  assert.equal(discountRow?.subtract, true);
  console.log("✓ Test 5 Passed: Checkout summary correctly itemizes non-refundable row only when active.\n");

  // TEST 6: Review Request Data Integration
  console.log("Test 6: Review request step captures non-refundable acknowledgment terms");
  const reviewData = createReviewRequestData({
    paymentTiming: "FULL_NOW",
    paymentMethodLabel: "Visa ending in 4242",
    paymentAuthorizationValid: true,
    hostMessage: "Looking forward to our stay!",
    checkIn: "2031-10-01",
    checkOut: "2031-10-04",
    adults: 2,
    children: 0,
    infants: 0,
    pets: 0,
    quote: mockQuoteNonRef,
  });
  assert.equal(reviewData.isNonRefundable, true);
  assert.equal(reviewData.rateType, "NON_REFUNDABLE");
  assert.equal(reviewData.canSubmitRequest, true);
  console.log("✓ Test 6 Passed: Review request captures rate type and non-refundable terms.\n");

  // TEST 7: Validation Schema Rejections (Reject Negative, NaN, >100)
  console.log("Test 7: Host discount setting validation rules");
  assert.doesNotThrow(() => {
    discountsSchema.parse({
      non_refundable: { enabled: true, percentage: 10 },
    });
  });

  assert.doesNotThrow(() => {
    discountsSchema.parse({
      non_refundable: { enabled: false, percentage: null },
    });
  });

  // Invalid: negative percentage
  assert.throws(() => {
    discountsSchema.parse({
      non_refundable: { enabled: true, percentage: -5 },
    });
  });

  // Invalid: greater than 100
  assert.throws(() => {
    discountsSchema.parse({
      non_refundable: { enabled: true, percentage: 120 },
    });
  });

  // Invalid: NaN
  assert.throws(() => {
    discountsSchema.parse({
      non_refundable: { enabled: true, percentage: NaN },
    });
  });
  console.log("✓ Test 7 Passed: Invalid discount settings strictly rejected by validation schema.\n");

  // TEST 8: Quote & Booking Request Schema Parsing
  console.log("Test 8: Quote & Booking schema query/body parsing");
  const parsedQuoteTrue = quoteBookingSchema.parse({
    listingId: "listing-1",
    startDate: "2031-10-01",
    endDate: "2031-10-04",
    nonRefundable: "true",
  });
  assert.equal(parsedQuoteTrue.nonRefundable, true);

  const parsedQuoteFalse = quoteBookingSchema.parse({
    listingId: "listing-1",
    startDate: "2031-10-01",
    endDate: "2031-10-04",
    nonRefundable: "false",
  });
  assert.equal(parsedQuoteFalse.nonRefundable, false);

  const parsedBooking = createBookingSchema.parse({
    listingId: "listing-1",
    startDate: "2031-10-01",
    endDate: "2031-10-04",
    nonRefundable: true,
  });
  assert.equal(parsedBooking.nonRefundable, true);
  console.log("✓ Test 8 Passed: Booking schemas normalize nonRefundable boolean correctly.\n");

  // TEST 9: Backwards Compatibility (nonRefundableDiscountPercentage parameter)
  console.log("Test 9: Backwards compatibility with nonRefundableDiscountPercentage");
  const compatPricing = await calculateBookingPrice({
    checkIn: "2031-10-01",
    checkOut: "2031-10-04",
    weekdayBasePrice: 10_000,
    nonRefundableDiscountPercentage: 15,
    hostServiceFeePercentage: 0,
  });
  assert.equal(compatPricing.rateType, "NON_REFUNDABLE");
  assert.equal(compatPricing.isNonRefundable, true);
  assert.equal(compatPricing.nonRefundable.amount, 4_500);
  console.log("✓ Test 9 Passed: Backwards compatibility fully preserved.\n");

  console.log("=== ALL PHASE 8 NON-REFUNDABLE TESTS PASSED ===");
}

testPhase8NonRefundable().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
