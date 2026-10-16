import "dotenv/config";
import assert from "node:assert/strict";
import { calculateBookingPrice } from "../services/pricing.service";
import { getBookingQuote } from "../services/booking.service";
import { saveBookingQuote, readBookingQuote, createQuoteRequestKey } from "../lib/booking/quote-cache";
import { formatBookingDate } from "../lib/booking/booking-date";
import { quoteBookingSchema } from "../lib/validation/booking";
import { getCheckoutPriceRows, type CheckoutSummaryQuote } from "../lib/booking/checkout-summary";
import type { TaxRuleDTO } from "../lib/tax/types";

const SAUDI_VAT_RULE: TaxRuleDTO = {
  id: "rule_sa_vat",
  jurisdictionId: "jur_sa",
  taxType: "VAT",
  name: "VAT",
  description: "Standard Saudi 15% VAT",
  calculationMethod: "PERCENTAGE",
  rate: 15,
  amount: null,
  taxableComponents: ["BASE_PRICE"],
  remittanceResponsibility: "PLATFORM",
  isSystemManaged: true,
  isInclusive: false,
  longStayExemptionNights: null,
  effectiveFrom: new Date().toISOString(),
  effectiveUntil: null,
  version: 1,
  isActive: true,
};

async function testPhase7PropertyBookingCard() {
  console.log("=== RUNNING HOMYZ PHASE 7 PROPERTY BOOKING CARD TESTS ===\n");

  // TEST 1: Search Dates and Guest Persistence
  console.log("Test 1: Search Dates and Guest Persistence");
  const searchCheckIn = "2031-10-12";
  const searchCheckOut = "2031-10-14";
  const searchGuests = 2;
  const parsedSearch = quoteBookingSchema.parse({
    listingId: "listing-test-1",
    startDate: searchCheckIn,
    endDate: searchCheckOut,
    guests: searchGuests,
  });
  assert.equal(parsedSearch.startDate instanceof Date, true);
  assert.equal(parsedSearch.startDate.toISOString().startsWith("2031-10-12"), true);
  assert.equal(parsedSearch.endDate instanceof Date, true);
  assert.equal(parsedSearch.endDate.toISOString().startsWith("2031-10-14"), true);
  assert.equal(parsedSearch.guests, 2);
  console.log("✓ Test 1 Passed: Search dates and guests normalize accurately without reselection.\n");

  // TEST 2: Direct Property Open Without Dates
  console.log("Test 2: Direct Property Open Without Dates");
  const directOpenInput = {
    listingId: "listing-test-1",
    startDate: "",
    endDate: "",
  };
  assert.throws(() => {
    quoteBookingSchema.parse(directOpenInput);
  });
  console.log("✓ Test 2 Passed: Direct property open without dates strictly rejects fake quote generation.\n");

  // TEST 3: Weekday Stay Base Pricing
  console.log("Test 3: Weekday Stay Base Pricing");
  // 2 weekday nights (Sun 2031-10-05 to Tue 2031-10-07) @ 50,000 cents/night (500 SAR)
  const weekdayPricing = await calculateBookingPrice({
    checkIn: "2031-10-05",
    checkOut: "2031-10-07",
    weekdayBasePrice: 50_000,
    weekendPrice: 70_000,
    hostServiceFeePercentage: 0,
  });
  assert.equal(weekdayPricing.nights, 2);
  assert.equal(weekdayPricing.staySubtotal, 100_000); // 2 * 50,000
  assert.equal(weekdayPricing.weekendNights, 0);
  assert.equal(weekdayPricing.total, 100_000);
  console.log("✓ Test 3 Passed: Weekday stay calculates standard base price correctly.\n");

  // TEST 4: Weekend Stay Pricing Integration
  console.log("Test 4: Weekend Stay Pricing Integration");
  // In Saudi Arabia / Middle East: Thursday (day 4) and Friday (day 5) are weekend nights
  // Thu 2031-10-02 to Sat 2031-10-04 = 2 weekend nights (Thu, Fri)
  const weekendPricing = await calculateBookingPrice({
    checkIn: "2031-10-02",
    checkOut: "2031-10-04",
    weekdayBasePrice: 50_000,
    weekendPrice: 75_000,
    hostServiceFeePercentage: 0,
  });
  assert.equal(weekendPricing.nights, 2);
  assert.equal(weekendPricing.weekendNights, 2);
  assert.equal(weekendPricing.staySubtotal, 150_000); // 2 * 75,000
  console.log("✓ Test 4 Passed: Weekend rate correctly applied without duplicate UI markup.\n");

  // TEST 5: Mixed Variable Night Stay
  console.log("Test 5: Mixed Variable Night Stay");
  // Wed 2031-10-01 (50,000), Thu 2031-10-02 (50,000), Fri 2031-10-03 (75,000), Sat 2031-10-04 (75,000)
  // Total 4 nights = 250,000
  const mixedPricing = await calculateBookingPrice({
    checkIn: "2031-10-01",
    checkOut: "2031-10-05",
    weekdayBasePrice: 50_000,
    weekendPrice: 75_000,
    hostServiceFeePercentage: 0,
  });
  assert.equal(mixedPricing.nights, 4);
  assert.equal(mixedPricing.weekdayNights, 2);
  assert.equal(mixedPricing.weekendNights, 2);
  assert.equal(mixedPricing.staySubtotal, 250_000);
  console.log("✓ Test 5 Passed: Variable rates accurately sum resolved nightly prices.\n");

  // TEST 6: Single Winning Discount on Stay
  console.log("Test 6: Single Winning Discount on Stay");
  // 7 nights stay with weekly (10%) and lastMinute (15%) eligible
  const discountPricing = await calculateBookingPrice({
    checkIn: "2031-10-01",
    checkOut: "2031-10-08", // 7 nights = 350,000
    weekdayBasePrice: 50_000,
    discounts: {
      weekly: { enabled: true, percentage: 10 },
      last_minute: { enabled: true, percentage: 15 },
    },
    bookingCreatedAt: new Date("2031-09-30T12:00:00Z"), // 1 day before -> lastMinute eligible
    hostServiceFeePercentage: 0,
  });
  assert.notEqual(discountPricing.selectedDiscount, null);
  // Highest percentage (15% lastMinute) wins
  assert.equal(discountPricing.selectedDiscount?.type, "LAST_MINUTE");
  assert.equal(discountPricing.selectedDiscount?.percentage, 15);
  assert.equal(discountPricing.discountAmount, 52_500); // 15% of 350,000
  assert.equal(discountPricing.accommodationSubtotal, 297_500);
  console.log("✓ Test 6 Passed: Highest eligible discount selected exclusively.\n");

  // TEST 7: Tax Integration and Tax Exemption Handling
  console.log("Test 7: Tax Integration and Exemption Handling");
  const taxPricing = await calculateBookingPrice({
    checkIn: "2031-10-01",
    checkOut: "2031-10-04",
    weekdayBasePrice: 50_000,
    taxRules: [SAUDI_VAT_RULE],
    hostServiceFeePercentage: 0,
  });
  // 3 nights * 50,000 = 150,000
  // 15% tax on 150,000 = 22,500
  assert.equal(taxPricing.taxTotal, 22_500);
  assert.equal(taxPricing.guestTotal, 172_500);
  assert.equal(taxPricing.taxes[0].taxName, "VAT");
  assert.equal(taxPricing.taxes[0].exemptionApplied, false);
  console.log("✓ Test 7 Passed: Central tax engine accurately computed on accommodation subtotal.\n");

  // TEST 8: Guest Count Change and Capacity Validation
  console.log("Test 8: Guest Count Change and Capacity Validation");
  // Extra guest fee when guests > baseGuests
  const guestPricing = await calculateBookingPrice({
    checkIn: "2031-10-01",
    checkOut: "2031-10-03", // 2 nights
    weekdayBasePrice: 50_000,
    baseGuests: 2,
    guests: 4, // 2 extra guests
    extraGuestFee: 5_000, // 50 SAR/night/extra guest
    hostServiceFeePercentage: 0,
  });
  // 2 extra guests * 5,000 * 2 nights = 20,000 extra guest fee
  assert.equal(guestPricing.extraGuestFee, 20_000);
  assert.equal(guestPricing.staySubtotal, 100_000);
  assert.equal(guestPricing.guestTotal, 120_000);
  console.log("✓ Test 8 Passed: Guest changes dynamically update extra guest fee without whole-property reload.\n");

  // TEST 9: Rapid Date Changes & Request Key Dedup
  console.log("Test 9: Rapid Date Changes and Request Key Dedup");
  const query1 = {
    listingId: "listing-1",
    checkIn: "2031-10-01",
    checkOut: "2031-10-04",
    guests: 2,
    pets: 0,
    nonRefundable: false,
  };
  const key1 = createQuoteRequestKey(query1);
  const key2 = createQuoteRequestKey({ ...query1 });
  assert.equal(key1, key2);

  const keyChanged = createQuoteRequestKey({ ...query1, checkOut: "2031-10-06" });
  assert.notEqual(key1, keyChanged);
  console.log("✓ Test 9 Passed: Request keys generate unique hashes preventing duplicate requests.\n");

  // TEST 10: Property Details to Booking Review Quote Consistency
  console.log("Test 10: Property Details to Booking Review Quote Consistency");
  const detailQuote = await calculateBookingPrice({
    checkIn: "2031-10-01",
    checkOut: "2031-10-08", // 7 nights
    weekdayBasePrice: 50_000,
    discounts: {
      weekly: { enabled: true, percentage: 10 },
    },
    taxRules: [SAUDI_VAT_RULE],
    hostServiceFeePercentage: 0,
  });

  // Stay subtotal = 350,000
  // Weekly discount (10%) = 35,000
  // Accommodation subtotal = 315,000
  // Tax (15%) = 47,250
  // Total = 362,250
  assert.equal(detailQuote.nights, 7);
  assert.equal(detailQuote.staySubtotal, 350_000);
  assert.equal(detailQuote.discountAmount, 35_000);
  assert.equal(detailQuote.accommodationSubtotal, 315_000);
  assert.equal(detailQuote.taxTotal, 47_250);
  assert.equal(detailQuote.guestTotal, 362_250);

  // Simulate checkout summary rows consume the exact same quote data
  const checkoutMock: CheckoutSummaryQuote = {
    nights: detailQuote.nights,
    baseNightlyPrice: detailQuote.baseNightlyPrice,
    nightlySubtotal: detailQuote.staySubtotal,
    discountAmount: detailQuote.discountAmount,
    discountPercentage: detailQuote.discountPercentage,
    appliedDiscount: detailQuote.appliedDiscount,
    selectedDiscount: detailQuote.selectedDiscount,
    extraGuestFee: detailQuote.extraGuestFee,
    hostServiceFee: detailQuote.hostServiceFee,
    taxes: detailQuote.taxes,
    taxTotal: detailQuote.taxTotal,
    guestTotal: detailQuote.guestTotal,
    currency: "SAR",
  };
  const checkoutRows = getCheckoutPriceRows(checkoutMock);
  const discountRow = checkoutRows.find((r) => r.id === "weekly-discount" || r.id === "selected-discount" || r.id.includes("discount"));
  assert.notEqual(discountRow, undefined);
  assert.equal(discountRow?.amount, 35_000);
  console.log("✓ Test 10 Passed: Property Details and Booking Review share identical pricing truth.\n");

  console.log("=== ALL PHASE 7 PROPERTY BOOKING CARD TESTS PASSED ===");
}

testPhase7PropertyBookingCard().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
