import assert from "node:assert/strict";
import test from "node:test";

import {
  extractRecordedCancellationRefund,
  extractStoredGuestTotal,
  extractStoredHostPayout,
  isStoredBookingPayoutEligible,
} from "../lib/booking/booking-financials";
import { calculateBookingPrice } from "../services/pricing.service";

test("Phase 4: stored payout breakdown reconciles guest and host financials", async () => {
  const quote = await calculateBookingPrice({
    checkIn: "2031-04-01",
    checkOut: "2031-04-03",
    weekdayBasePrice: 10_000,
    baseGuests: 3,
    guests: 5,
    extraGuestFee: 500,
    pets: 1,
    petFee: 300,
    cleaningFee: 1_000,
    hostServiceFeePercentage: 10,
  });

  assert.equal(quote.accommodationSubtotal, 20_000);
  assert.equal(quote.extraGuestFee, 2_000, "two extra guests are charged for both nights");
  assert.equal(quote.cleaningFee, 1_000, "cleaning is charged once per stay");
  assert.equal(quote.petFee, 300, "pet fee is charged once when a pet is booked");
  assert.equal(quote.guestTotal, 23_300);
  assert.deepEqual(quote.payoutBreakdown, {
    accommodationSubtotal: 20_000,
    extraGuestFee: 2_000,
    petFee: 300,
    cleaningFee: 1_000,
    taxesCollectedForHost: 0,
    taxesRemittedByPlatform: 0,
    platformServiceFee: 2_000,
    hostServiceFee: 2_000,
    netHostPayout: 21_300,
    currency: "SAR",
  });
});

test("Phase 4: a configured pet fee is absent when no pets are booked", async () => {
  const quote = await calculateBookingPrice({
    checkIn: "2031-05-01",
    checkOut: "2031-05-02",
    weekdayBasePrice: 10_000,
    pets: 0,
    petFee: 3_000,
    hostServiceFeePercentage: 0,
  });

  assert.equal(quote.petFee, 0);
  assert.equal(quote.guestTotal, 10_000);
  assert.equal(quote.payoutBreakdown.netHostPayout, 10_000);
});

test("Phase 4: financial readers preserve immutable booking snapshots", () => {
  const booking = {
    totalPrice: 99_999,
    cleaningFee: 99_999,
    priceBreakdown: {
      guestTotal: 23_300,
      paymentStatus: "PAID",
      payoutBreakdown: {
        accommodationSubtotal: 20_000,
        extraGuestFee: 2_000,
        petFee: 300,
        cleaningFee: 1_000,
        hostServiceFee: 2_000,
        taxesCollectedForHost: 0,
        netHostPayout: 21_300,
        currency: "SAR",
      },
    },
  };

  assert.equal(extractStoredGuestTotal(booking), 23_300);
  assert.deepEqual(extractStoredHostPayout(booking), {
    accommodationSubtotal: 20_000,
    extraGuestFee: 2_000,
    petFee: 300,
    cleaningFee: 1_000,
    hostServiceFee: 2_000,
    taxesCollectedForHost: 0,
    netHostPayout: 21_300,
    currency: "SAR",
  });
});

test("Phase 4: payment-pending and refunded snapshots are excluded from payout reporting", () => {
  assert.equal(isStoredBookingPayoutEligible({ priceBreakdown: { paymentStatus: "PAID" } }), true);
  assert.equal(isStoredBookingPayoutEligible({ priceBreakdown: { paymentStatus: "PAYMENT_PENDING" } }), false);
  assert.equal(isStoredBookingPayoutEligible({ priceBreakdown: { paymentStatus: "REFUNDED" } }), false);
  assert.equal(isStoredBookingPayoutEligible({ priceBreakdown: {} }), true, "legacy records have no payment-status signal");

  assert.equal(
    extractRecordedCancellationRefund({ priceBreakdown: { cancellation: { guestRefundAmount: 23_300 } } }),
    23_300,
  );
});
