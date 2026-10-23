import test from "node:test";
import assert from "node:assert/strict";
import { BookingStatus } from "@/generated/prisma/enums";
import { calculateBookingPayout } from "@/services/payout.service";
import { calculateDashboardInventory } from "@/lib/dashboard/host-inventory";

const verifiedMethod = [{
  id: "pm_1",
  accountHolderName: "Host",
  bankName: "Bank",
  ibanMasked: "SA00 ****",
  ibanLast4: "0000",
  currency: "SAR",
  isDefault: true,
  status: "VERIFIED" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
}];

function confirmedBooking(priceBreakdown: Record<string, unknown>) {
  return {
    id: "booking_1",
    status: BookingStatus.CONFIRMED,
    startDate: new Date("2026-01-10T00:00:00.000Z"),
    endDate: new Date("2026-01-12T00:00:00.000Z"),
    currency: "SAR",
    priceBreakdown,
    payments: [{ status: "CAPTURED", capturedAmount: 90000 }],
    refunds: [],
    qualityIncidents: [],
  };
}

test("payout classification distinguishes realized earnings from completed settlement", () => {
  const snapshot = {
    payoutBreakdown: {
      accommodationSubtotal: 80000,
      extraGuestFee: 0,
      petFee: 0,
      cleaningFee: 10000,
      hostServiceFee: 9000,
      taxesCollectedForHost: 0,
      netHostPayout: 81000,
      currency: "SAR",
    },
  };
  const ready = calculateBookingPayout(confirmedBooking(snapshot), {
    now: new Date("2026-02-01T00:00:00.000Z"),
    hostPayoutMethods: verifiedMethod,
  });
  assert.equal(ready.status, "ELIGIBLE_SETTLEMENT");
  assert.equal(ready.netPayout, 81000);

  const paid = calculateBookingPayout(confirmedBooking({
    ...snapshot,
    payoutExecution: {
      status: "PAID",
      settlementReference: "SARIE-1",
      amount: 81000,
      currency: "SAR",
      payoutMethodMasked: "SA00 ****",
      executedAt: "2026-01-13T00:00:00.000Z",
      executedBy: "admin_1",
      idempotencyKey: "settlement_1",
      channel: "SARIE",
    },
  }), {
    now: new Date("2026-02-01T00:00:00.000Z"),
    hostPayoutMethods: verifiedMethod,
  });
  assert.equal(paid.status, "PAID");
});

test("occupancy excludes checkout day and a booking overrides a manual block", () => {
  const inventory = calculateDashboardInventory({
    listings: [{ id: "listing_1", blockedDates: ["2026-01-11"] }],
    bookings: [{
      listingId: "listing_1",
      status: BookingStatus.CONFIRMED,
      startDate: new Date("2026-01-10T00:00:00.000Z"),
      endDate: new Date("2026-01-12T00:00:00.000Z"),
    }],
    startDateKey: "2026-01-10",
    endDateKeyExclusive: "2026-01-13",
  });

  assert.equal(inventory.bookedNights, 2);
  assert.equal(inventory.blockedNights, 0);
  assert.equal(inventory.bookableNights, 3);
  assert.equal(inventory.availableNights, 1);
  assert.equal(inventory.ratePercentage, 66.7);
});
