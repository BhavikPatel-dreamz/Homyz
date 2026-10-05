import "dotenv/config";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calculateBookingPrice,
  getDiscountFriendlyLabel,
  type BookingPricingResult,
} from "../services/pricing.service";
import { bookingService } from "../services/booking.service";
import { getCheckoutPriceRows, type CheckoutSummaryQuote } from "../lib/booking/checkout-summary";
import { createReviewRequestData } from "../lib/booking/review-request";
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

describe("Phase 5 — Airbnb-Style Discount Price Breakdown (One Pricing Truth)", () => {
  // -------------------------------------------------------------------------
  // 1. Zero Discount Breakdown (Section 6, 29)
  // -------------------------------------------------------------------------
  describe("1. Zero Discount Breakdown (Section 6, 29)", () => {
    it("produces correct price breakdown with no discount row when no discount qualifies", async () => {
      // 3 nights at 100 SAR/night (10,000 cents), tax = 15% VAT (4,500 cents), 0 discounts
      const res = await calculateBookingPrice({
        checkIn: "2026-10-04",
        checkOut: "2026-10-07",
        weekdayBasePrice: 10_000,
        hostTaxes: [percentageTax(15)],
        hostServiceFeePercentage: 15,
      });

      assert.equal(res.nights, 3);
      assert.equal(res.staySubtotal, 30_000);
      assert.equal(res.discountAmount, 0);
      assert.equal(res.discountPercentage, 0);
      assert.equal(res.appliedDiscount, null);
      assert.equal(res.selectedDiscount, null);
      assert.equal(res.accommodationSubtotal, 30_000);
      assert.equal(res.discountedAccommodationSubtotal, 30_000);
      assert.equal(res.taxTotal, 4_500); // 15% of 30,000
      assert.equal(res.guestTotal, 34_500);

      // Verify Checkout price rows: NO discount row
      const checkoutQuote: CheckoutSummaryQuote = {
        nights: res.nights,
        baseNightlyPrice: res.effectiveBasePrice,
        nightlySubtotal: res.staySubtotal,
        discountAmount: res.discountAmount,
        selectedDiscount: res.selectedDiscount,
        extraGuestFee: res.extraGuestFee,
        hostServiceFee: res.hostServiceFee,
        taxes: res.taxes.map((t) => ({ taxName: t.taxName, taxAmount: t.taxAmount })),
        taxTotal: res.taxTotal,
        guestTotal: res.guestTotal,
        currency: res.currency,
      };

      const rows = getCheckoutPriceRows(checkoutQuote);
      const discountRow = rows.find((r) => r.id === "discount");
      assert.equal(discountRow, undefined, "No discount row when discountAmount is 0");
    });
  });

  // -------------------------------------------------------------------------
  // 2. Weekly Discount Breakdown (Section 3, 7, 30)
  // -------------------------------------------------------------------------
  describe("2. Weekly Discount Breakdown (Section 3, 7, 30)", () => {
    it("calculates 10% weekly discount, discounted subtotal, and tax correctly", async () => {
      // 7 nights at 500 SAR/night (50,000 cents) = 350,000 cents subtotal
      // Weekly discount = 10% -> 35,000 cents discount
      // Discounted accommodation = 315,000 cents
      // 15% VAT on 315,000 = 47,250 cents
      // Total = 315,000 + 47,250 = 362,250 cents (3,622.50 SAR)
      const res = await calculateBookingPrice({
        checkIn: "2026-10-04",
        checkOut: "2026-10-11",
        weekdayBasePrice: 50_000,
        discounts: {
          weekly: { enabled: true, percentage: 10 },
        },
        hostTaxes: [percentageTax(15)],
        hostServiceFeePercentage: 15,
      });

      assert.equal(res.nights, 7);
      assert.equal(res.staySubtotal, 350_000);
      assert.equal(res.discountAmount, 35_000);
      assert.equal(res.discountPercentage, 10);
      assert.ok(res.selectedDiscount);
      assert.equal(res.selectedDiscount.type, "WEEKLY");
      assert.equal(res.selectedDiscount.label, "Weekly discount");
      assert.equal(res.selectedDiscount.percentage, 10);
      assert.equal(res.selectedDiscount.amount, 35_000);
      assert.equal(res.accommodationSubtotal, 315_000);
      assert.equal(res.discountedAccommodationSubtotal, 315_000);
      assert.equal(res.taxTotal, 47_250);
      assert.equal(res.guestTotal, 362_250);

      // Verify Checkout price rows: exactly ONE discount row with friendly label
      const checkoutQuote: CheckoutSummaryQuote = {
        nights: res.nights,
        baseNightlyPrice: res.effectiveBasePrice,
        nightlySubtotal: res.staySubtotal,
        discountAmount: res.discountAmount,
        selectedDiscount: res.selectedDiscount,
        extraGuestFee: res.extraGuestFee,
        hostServiceFee: res.hostServiceFee,
        taxes: res.taxes.map((t) => ({ taxName: t.taxName, taxAmount: t.taxAmount })),
        taxTotal: res.taxTotal,
        guestTotal: res.guestTotal,
        currency: res.currency,
      };

      const rows = getCheckoutPriceRows(checkoutQuote);
      const discountRows = rows.filter((r) => r.id === "discount");
      assert.equal(discountRows.length, 1, "Must have exactly 1 discount row");
      assert.equal(discountRows[0].label, "Weekly discount (10%)");
      assert.equal(discountRows[0].amount, 35_000);
      assert.equal(discountRows[0].subtract, true);
    });
  });

  // -------------------------------------------------------------------------
  // 3. New Listing Promotion Breakdown (Section 8, 31)
  // -------------------------------------------------------------------------
  describe("3. New Listing Promotion Breakdown (Section 8, 31)", () => {
    it("applies 20% New Listing Promotion with label 'New listing promotion (20%)'", async () => {
      const res = await calculateBookingPrice({
        checkIn: "2026-10-04",
        checkOut: "2026-10-07", // 3 nights
        weekdayBasePrice: 20_000, // 60,000 cents staySubtotal
        isNewListing: true,
        discounts: {
          new_listing: { enabled: true, percentage: 20 },
        },
        hostServiceFeePercentage: 15,
      });

      assert.equal(res.staySubtotal, 60_000);
      assert.equal(res.discountAmount, 12_000);
      assert.ok(res.selectedDiscount);
      assert.equal(res.selectedDiscount.type, "NEW_LISTING");
      assert.equal(res.selectedDiscount.label, "New listing promotion");
      assert.equal(res.selectedDiscount.percentage, 20);
      assert.equal(res.accommodationSubtotal, 48_000);

      const checkoutQuote: CheckoutSummaryQuote = {
        nights: res.nights,
        baseNightlyPrice: res.effectiveBasePrice,
        nightlySubtotal: res.staySubtotal,
        discountAmount: res.discountAmount,
        selectedDiscount: res.selectedDiscount,
        extraGuestFee: 0,
        hostServiceFee: res.hostServiceFee,
        taxes: [],
        taxTotal: 0,
        guestTotal: res.guestTotal,
        currency: "SAR",
      };

      const rows = getCheckoutPriceRows(checkoutQuote);
      const discountRow = rows.find((r) => r.id === "discount");
      assert.ok(discountRow);
      assert.equal(discountRow.label, "New listing promotion (20%)");
      assert.equal(discountRow.amount, 12_000);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Last-Minute Discount Breakdown (Section 8, 32)
  // -------------------------------------------------------------------------
  describe("4. Last-Minute Discount Breakdown (Section 8, 32)", () => {
    it("applies 15% Last-Minute Discount with label 'Last-minute discount (15%)'", async () => {
      const res = await calculateBookingPrice({
        checkIn: "2026-10-02",
        checkOut: "2026-10-04", // 2 nights
        bookingCreatedAt: "2026-10-01", // 1 day before -> last minute
        weekdayBasePrice: 50_000, // 100,000 cents staySubtotal
        discounts: {
          last_minute: { enabled: true, percentage: 15 },
        },
        hostServiceFeePercentage: 15,
      });

      assert.equal(res.staySubtotal, 100_000);
      assert.equal(res.discountAmount, 15_000);
      assert.ok(res.selectedDiscount);
      assert.equal(res.selectedDiscount.type, "LAST_MINUTE");
      assert.equal(res.selectedDiscount.label, "Last-minute discount");
      assert.equal(res.selectedDiscount.percentage, 15);
      assert.equal(res.accommodationSubtotal, 85_000);

      const checkoutQuote: CheckoutSummaryQuote = {
        nights: res.nights,
        baseNightlyPrice: res.effectiveBasePrice,
        nightlySubtotal: res.staySubtotal,
        discountAmount: res.discountAmount,
        selectedDiscount: res.selectedDiscount,
        extraGuestFee: 0,
        hostServiceFee: res.hostServiceFee,
        taxes: [],
        taxTotal: 0,
        guestTotal: res.guestTotal,
        currency: "SAR",
      };

      const rows = getCheckoutPriceRows(checkoutQuote);
      const discountRow = rows.find((r) => r.id === "discount");
      assert.ok(discountRow);
      assert.equal(discountRow.label, "Last-minute discount (15%)");
      assert.equal(discountRow.amount, 15_000);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Monthly Discount Breakdown (Section 8, 33)
  // -------------------------------------------------------------------------
  describe("5. Monthly Discount Breakdown (Section 8, 33)", () => {
    it("applies 25% Monthly Discount with label 'Monthly discount (25%)'", async () => {
      const res = await calculateBookingPrice({
        checkIn: "2026-10-01",
        checkOut: "2026-10-29", // 28 nights
        weekdayBasePrice: 10_000, // 280,000 cents staySubtotal
        discounts: {
          weekly: { enabled: true, percentage: 10 },
          monthly: { enabled: true, percentage: 25 },
        },
        hostServiceFeePercentage: 15,
      });

      assert.equal(res.staySubtotal, 280_000);
      assert.equal(res.discountAmount, 70_000); // 25% of 280,000
      assert.ok(res.selectedDiscount);
      assert.equal(res.selectedDiscount.type, "MONTHLY");
      assert.equal(res.selectedDiscount.label, "Monthly discount");
      assert.equal(res.selectedDiscount.percentage, 25);
      assert.equal(res.accommodationSubtotal, 210_000);

      const checkoutQuote: CheckoutSummaryQuote = {
        nights: res.nights,
        baseNightlyPrice: res.effectiveBasePrice,
        nightlySubtotal: res.staySubtotal,
        discountAmount: res.discountAmount,
        selectedDiscount: res.selectedDiscount,
        extraGuestFee: 0,
        hostServiceFee: res.hostServiceFee,
        taxes: [],
        taxTotal: 0,
        guestTotal: res.guestTotal,
        currency: "SAR",
      };

      const rows = getCheckoutPriceRows(checkoutQuote);
      const discountRow = rows.find((r) => r.id === "discount");
      assert.ok(discountRow);
      assert.equal(discountRow.label, "Monthly discount (25%)");
      assert.equal(discountRow.amount, 70_000);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Variable Nightly Pricing + Weekend + Discount (Section 4, 34)
  // -------------------------------------------------------------------------
  describe("6. Variable Nightly Pricing & Weekend + Discount (Section 4, 34)", () => {
    it("applies discount to actual accommodation subtotal from varying rates, NOT flat basePrice * nights", async () => {
      // 5 nights stay:
      // Night 1 (Thu, 2026-10-08): weekend price = 60,000
      // Night 2 (Fri, 2026-10-09): weekend price = 60,000
      // Night 3 (Sat, 2026-10-10): custom calendar rate = 75,000
      // Night 4 (Sun, 2026-10-11): weekday price = 40,000
      // Night 5 (Mon, 2026-10-12): weekday price = 40,000
      // Sum = 60,000 + 60,000 + 75,000 + 40,000 + 40,000 = 275,000 cents
      // 20% New Listing Promotion -> 20% of 275,000 = 55,000 cents discount
      // Discounted accommodation = 220,000 cents
      const res = await calculateBookingPrice({
        checkIn: "2026-10-08",
        checkOut: "2026-10-13",
        weekdayBasePrice: 40_000,
        weekendPrice: 60_000,
        customPrices: {
          "2026-10-10": 75_000,
        },
        isNewListing: true,
        discounts: {
          new_listing: { enabled: true, percentage: 20 },
        },
        hostServiceFeePercentage: 15,
      });

      assert.equal(res.nights, 5);
      assert.equal(res.staySubtotal, 275_000, "Must sum actual variable nights (60k+60k+75k+40k+40k)");
      assert.notEqual(res.staySubtotal, 40_000 * 5, "Must NOT calculate 40k * 5");
      assert.equal(res.discountAmount, 55_000, "Discount must be 20% of actual variable subtotal (275,000)");
      assert.equal(res.accommodationSubtotal, 220_000);
      assert.equal(res.selectedDiscount?.amount, 55_000);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Cross-Screen Consistency (Section 13, 16, 17, 35)
  // -------------------------------------------------------------------------
  describe("7. Cross-Screen Consistency (Section 13, 16, 17, 35)", () => {
    it("guarantees mathematically identical pricing across Server, Property Details, Review Request, and Checkout", async () => {
      // 7 nights stay with Weekly Discount (10%), Extra guest fee, and 15% VAT
      const serverQuote = await calculateBookingPrice({
        checkIn: "2026-10-04",
        checkOut: "2026-10-11",
        weekdayBasePrice: 30_000,
        baseGuests: 2,
        guests: 3,
        extraGuestFee: 5_000, // 1 extra guest * 5,000 * 7 = 35,000
        discounts: {
          weekly: { enabled: true, percentage: 10 },
        },
        hostTaxes: [percentageTax(15)],
        hostServiceFeePercentage: 15,
      });

      // Checkout Summary quote view
      const checkoutQuote: CheckoutSummaryQuote = {
        nights: serverQuote.nights,
        baseNightlyPrice: serverQuote.effectiveBasePrice,
        nightlySubtotal: serverQuote.staySubtotal,
        discountAmount: serverQuote.discountAmount,
        selectedDiscount: serverQuote.selectedDiscount,
        extraGuestFee: serverQuote.extraGuestFee,
        hostServiceFee: serverQuote.hostServiceFee,
        taxes: serverQuote.taxes.map((t) => ({ taxName: t.taxName, taxAmount: t.taxAmount })),
        taxTotal: serverQuote.taxTotal,
        guestTotal: serverQuote.guestTotal,
        currency: serverQuote.currency,
      };

      const checkoutRows = getCheckoutPriceRows(checkoutQuote);

      // Review Request view
      const reviewRequest = createReviewRequestData({
        paymentTiming: "FULL_NOW",
        paymentMethodLabel: "Credit Card",
        paymentAuthorizationValid: true,
        hostMessage: "Hello host",
        checkIn: "2026-10-04",
        checkOut: "2026-10-11",
        adults: 3,
        children: 0,
        infants: 0,
        pets: 0,
        quote: checkoutQuote,
      });

      // Assert identical values across all surfaces
      assert.equal(reviewRequest.pricing.total, serverQuote.guestTotal);
      assert.equal(checkoutQuote.guestTotal, serverQuote.guestTotal);

      // Verify line items match
      const discountRowCheckout = checkoutRows.find((r) => r.id === "discount");
      const discountRowReview = reviewRequest.pricing.rows.find((r) => r.id === "discount");

      assert.ok(discountRowCheckout);
      assert.ok(discountRowReview);
      assert.equal(discountRowCheckout.amount, serverQuote.discountAmount);
      assert.equal(discountRowReview.amount, serverQuote.discountAmount);
      assert.equal(discountRowCheckout.label, "Weekly discount (10%)");
      assert.equal(discountRowReview.label, "Weekly discount (10%)");
    });
  });

  // -------------------------------------------------------------------------
  // 8. Phase 6 Preparation Fields (Section 27)
  // -------------------------------------------------------------------------
  describe("8. Phase 6 Preparation Fields (Section 27)", () => {
    it("exposes originalDisplayPrice, discountedDisplayPrice, discountType, and discountLabel", async () => {
      const res = await calculateBookingPrice({
        checkIn: "2026-10-04",
        checkOut: "2026-10-11", // 7 nights at 40,000 cents/night
        weekdayBasePrice: 40_000,
        discounts: {
          weekly: { enabled: true, percentage: 10 },
        },
        hostServiceFeePercentage: 15,
      });

      assert.equal(res.originalDisplayPrice, 40_000);
      assert.equal(res.discountedDisplayPrice, 36_000); // 40k minus 10% = 36k
      assert.equal(res.discountType, "WEEKLY");
      assert.equal(res.discountLabel, "Weekly discount");
    });
  });

  // -------------------------------------------------------------------------
  // 9. Friendly Label Function (Section 8)
  // -------------------------------------------------------------------------
  describe("9. Friendly Label Function (Section 8)", () => {
    it("maps all documented discount types to friendly labels", () => {
      assert.equal(getDiscountFriendlyLabel("NEW_LISTING"), "New listing promotion");
      assert.equal(getDiscountFriendlyLabel("LAST_MINUTE"), "Last-minute discount");
      assert.equal(getDiscountFriendlyLabel("WEEKLY"), "Weekly discount");
      assert.equal(getDiscountFriendlyLabel("MONTHLY"), "Monthly discount");
      assert.equal(getDiscountFriendlyLabel("new_listing"), "New listing promotion");
      assert.equal(getDiscountFriendlyLabel("last_minute"), "Last-minute discount");
      assert.equal(getDiscountFriendlyLabel("weekly"), "Weekly discount");
      assert.equal(getDiscountFriendlyLabel("monthly"), "Monthly discount");
    });
  });
});
