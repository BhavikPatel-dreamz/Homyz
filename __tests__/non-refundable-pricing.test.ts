import assert from "node:assert/strict";
import { createBookingSchema, quoteBookingSchema } from "../lib/validation/booking";
import { calculateBookingPrice } from "../services/pricing.service";

async function run() {
  const standard = await calculateBookingPrice({
    checkIn: "2031-10-01",
    checkOut: "2031-10-03",
    weekdayBasePrice: 10_000,
    discounts: { custom_promotion: { enabled: true, percentage: 10 } },
    hostServiceFeePercentage: 0,
  });
  const nonRefundable = await calculateBookingPrice({
    checkIn: "2031-10-01",
    checkOut: "2031-10-03",
    weekdayBasePrice: 10_000,
    discounts: { custom_promotion: { enabled: true, percentage: 10 } },
    nonRefundableDiscountPercentage: 20,
    hostServiceFeePercentage: 0,
  });

  assert.equal(standard.appliedDiscount?.amount, 2_000);
  assert.equal(standard.nonRefundableDiscount, null);
  assert.equal(nonRefundable.appliedDiscount?.amount, 2_000);
  assert.equal(nonRefundable.nonRefundableDiscount?.amount, 3_600);
  assert.equal(nonRefundable.discountAmount, 5_600);
  assert.equal(nonRefundable.accommodationSubtotal, 14_400);
  assert.equal(nonRefundable.taxes.length, 0);

  assert.equal(quoteBookingSchema.parse({
    listingId: "listing-1", startDate: "2031-10-01", endDate: "2031-10-03", nonRefundable: "true",
  }).nonRefundable, true);
  assert.equal(createBookingSchema.parse({
    listingId: "listing-1", startDate: "2031-10-01", endDate: "2031-10-03",
  }).nonRefundable, false);

  console.log("Non-refundable pricing applies after standard discounts and booking input captures the selected term.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
