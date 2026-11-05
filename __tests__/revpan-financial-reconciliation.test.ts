import test from "node:test";
import assert from "node:assert/strict";
import { BookingStatus } from "@/generated/prisma/enums";
import {
  calculateDashboardInventory,
  calculateDashboardInventoryByDate,
  type DashboardInventoryBooking,
  type DashboardInventoryListing,
} from "@/lib/dashboard/host-inventory";
import {
  extractStoredHostPayout,
  extractStoredGuestTotal,
  isStoredBookingPayoutEligible,
} from "@/lib/booking/booking-financials";
import {
  differenceInBookingNights,
  parseBookingDate,
  bookingDateKey,
  shiftBookingDateKey,
} from "@/lib/booking/booking-date";

function moneyPer(total: number, divisor: number) {
  return divisor > 0 ? Math.round(total / divisor) : null;
}

test("RevPAN core mathematical invariant: RevPAN = ADR * (Occupancy / 100)", () => {
  const accommodationRevenueCents = 1_342_400; // SAR 13,424.00
  const bookableNights = 120;
  const bookedNights = 23;

  const revpanCents = moneyPer(accommodationRevenueCents, bookableNights)!; // 11,187 (SAR 111.87)
  const adrCents = moneyPer(accommodationRevenueCents, bookedNights)!; // 58,365 (SAR 583.65)
  const occupancyPercentage = Math.round((bookedNights / bookableNights) * 1000) / 10; // 19.2%

  assert.equal(revpanCents, 11187);
  assert.equal(adrCents, 58365);
  assert.equal(occupancyPercentage, 19.2);

  // Invariant verification within integer rounding (less than 1 SAR / 100 cents discrepancy)
  const revpanFromFormula = Math.round(adrCents * (occupancyPercentage / 100));
  assert.ok(Math.abs(revpanCents - revpanFromFormula) <= 20); // within 20 halalas (0.2 SAR)
});

test("Payment eligibility: deferred and captured payments on confirmed reservations are eligible", () => {
  // 1. Deferred booking (Instant Book / Pay at property)
  const deferredBooking = {
    priceBreakdown: {
      paymentMode: "DEFERRED",
      paymentStatus: "PAYMENT_PENDING",
      payoutBreakdown: {
        accommodationSubtotal: 80000,
        netHostPayout: 77200,
      },
    },
    payments: [{ status: "PENDING", provider: "DEFERRED" }],
  };
  assert.equal(isStoredBookingPayoutEligible(deferredBooking), true);

  // 2. Captured payment
  const capturedBooking = {
    priceBreakdown: {
      paymentStatus: "CAPTURED",
      payoutBreakdown: {
        accommodationSubtotal: 150000,
        netHostPayout: 145000,
      },
    },
    payments: [{ status: "CAPTURED", provider: "STRIPE" }],
  };
  assert.equal(isStoredBookingPayoutEligible(capturedBooking), true);

  // 3. Failed payment
  const failedBooking = {
    priceBreakdown: {
      paymentStatus: "FAILED",
      payoutBreakdown: {
        accommodationSubtotal: 50000,
        netHostPayout: 48000,
      },
    },
    payments: [{ status: "FAILED", provider: "STRIPE" }],
  };
  assert.equal(isStoredBookingPayoutEligible(failedBooking), false);

  // 4. Cancelled/Refunded payment
  const refundedBooking = {
    priceBreakdown: {
      paymentStatus: "REFUNDED",
      payoutBreakdown: {
        accommodationSubtotal: 50000,
        netHostPayout: 48000,
      },
    },
    payments: [{ status: "REFUNDED", provider: "STRIPE" }],
  };
  assert.equal(isStoredBookingPayoutEligible(refundedBooking), false);
});

test("Cross-month stay allocation: stay nights and accommodation revenue prorate accurately", () => {
  // Stay spans Oct 28 to Nov 5 (8 nights total)
  const booking = {
    startDate: new Date("2026-10-28T00:00:00.000Z"),
    endDate: new Date("2026-11-05T00:00:00.000Z"),
    priceBreakdown: {
      payoutBreakdown: {
        accommodationSubtotal: 160000, // SAR 1,600 (SAR 200/night)
        netHostPayout: 154000,
      },
    },
  };

  const totalNights = differenceInBookingNights(booking.startDate, booking.endDate);
  assert.equal(totalNights, 8);

  // Reporting period: November 2026 (2026-11-01 to 2026-11-30)
  const startKey = "2026-11-01";
  const endKeyEx = "2026-12-01";

  let nightsInNovember = 0;
  for (let c = parseBookingDate(booking.startDate); bookingDateKey(c) < bookingDateKey(booking.endDate); c.setUTCDate(c.getUTCDate() + 1)) {
    const k = bookingDateKey(c);
    if (k >= startKey && k < endKeyEx) {
      nightsInNovember++;
    }
  }

  // 4 nights in November (Nov 1, 2, 3, 4; check-out Nov 5 is exclusive)
  assert.equal(nightsInNovember, 4);

  const payout = extractStoredHostPayout(booking)!;
  const novemberAccommodation = Math.round(payout.accommodationSubtotal * (nightsInNovember / totalNights));
  const novemberNet = Math.round(payout.netHostPayout * (nightsInNovember / totalNights));

  assert.equal(novemberAccommodation, 80000); // exactly SAR 800
  assert.equal(novemberNet, 77000); // exactly SAR 770
});

test("Portfolio totals reconcile with sum of individual listings", () => {
  const listings: DashboardInventoryListing[] = [
    { id: "prop_1", blockedDates: ["2026-11-15"] }, // 1 blocked date -> 29 bookable
    { id: "prop_2", blockedDates: [] },             // 30 bookable
    { id: "prop_3", blockedDates: [] },             // 30 bookable
  ];

  const bookings: DashboardInventoryBooking[] = [
    {
      listingId: "prop_1",
      status: BookingStatus.CONFIRMED,
      startDate: new Date("2026-11-05T00:00:00.000Z"),
      endDate: new Date("2026-11-10T00:00:00.000Z"), // 5 nights
    },
    {
      listingId: "prop_2",
      status: BookingStatus.CONFIRMED,
      startDate: new Date("2026-11-01T00:00:00.000Z"),
      endDate: new Date("2026-11-08T00:00:00.000Z"), // 7 nights
    },
    {
      listingId: "prop_3",
      status: BookingStatus.CONFIRMED,
      startDate: new Date("2026-11-20T00:00:00.000Z"),
      endDate: new Date("2026-11-23T00:00:00.000Z"), // 3 nights
    },
  ];

  const accommodationByListing = {
    prop_1: 250000, // SAR 2,500
    prop_2: 350000, // SAR 3,500
    prop_3: 150000, // SAR 1,500
  };

  const startKey = "2026-11-01";
  const endKeyEx = "2026-12-01";

  // Portfolio level calculation
  const portfolioInventory = calculateDashboardInventory({
    listings,
    bookings,
    startDateKey: startKey,
    endDateKeyExclusive: endKeyEx,
  });

  let sumBookable = 0;
  let sumBooked = 0;
  let sumAccommodation = 0;

  for (const listing of listings) {
    const listingInventory = calculateDashboardInventory({
      listings: [listing],
      bookings,
      startDateKey: startKey,
      endDateKeyExclusive: endKeyEx,
    });

    sumBookable += listingInventory.bookableNights;
    sumBooked += listingInventory.bookedNights;
    sumAccommodation += accommodationByListing[listing.id as keyof typeof accommodationByListing];
  }

  // Verification 1: Bookable nights reconcile exactly
  assert.equal(sumBookable, portfolioInventory.bookableNights);
  assert.equal(portfolioInventory.bookableNights, 89); // 30 + 30 + 29

  // Verification 2: Booked nights reconcile exactly
  assert.equal(sumBooked, portfolioInventory.bookedNights);
  assert.equal(portfolioInventory.bookedNights, 15); // 5 + 7 + 3

  // Verification 3: Accommodation revenue reconciles exactly
  assert.equal(sumAccommodation, 750000); // SAR 7,500

  // Verification 4: Portfolio RevPAN and ADR
  const portfolioRevpan = moneyPer(sumAccommodation, portfolioInventory.bookableNights);
  const portfolioAdr = moneyPer(sumAccommodation, portfolioInventory.bookedNights);

  assert.equal(portfolioRevpan, 8427); // SAR 84.27
  assert.equal(portfolioAdr, 50000);   // SAR 500.00

  // Verification 5: Unbooked available nights
  assert.equal(portfolioInventory.availableNights, 89 - 15); // 74
});

test("Edge cases: zero bookings, zero bookable nights, and cancelled reservations", () => {
  const startKey = "2026-11-01";
  const endKeyEx = "2026-12-01";

  // Case 1: Active listings with 0 bookings
  const zeroBookingsInventory = calculateDashboardInventory({
    listings: [{ id: "empty_prop", blockedDates: [] }],
    bookings: [],
    startDateKey: startKey,
    endDateKeyExclusive: endKeyEx,
  });

  assert.equal(zeroBookingsInventory.bookableNights, 30);
  assert.equal(zeroBookingsInventory.bookedNights, 0);
  assert.equal(zeroBookingsInventory.availableNights, 30);
  assert.equal(zeroBookingsInventory.ratePercentage, 0);

  const zeroRevpan = moneyPer(0, zeroBookingsInventory.bookableNights);
  const zeroAdr = moneyPer(0, zeroBookingsInventory.bookedNights);
  assert.equal(zeroRevpan, 0);
  assert.equal(zeroAdr, null); // ADR is null when 0 booked nights, not error

  // Case 2: Zero bookable nights (e.g. completely blocked month)
  const fullMonthBlocks = Array.from({ length: 30 }, (_, i) => {
    const day = String(i + 1).padStart(2, "0");
    return `2026-11-${day}`;
  });
  const zeroBookableInventory = calculateDashboardInventory({
    listings: [{ id: "blocked_prop", blockedDates: fullMonthBlocks }],
    bookings: [],
    startDateKey: startKey,
    endDateKeyExclusive: endKeyEx,
  });

  assert.equal(zeroBookableInventory.bookableNights, 0);
  assert.equal(zeroBookableInventory.bookedNights, 0);
  assert.equal(zeroBookableInventory.availableNights, 0);
  assert.equal(zeroBookableInventory.ratePercentage, 0);

  const nullRevpan = moneyPer(0, zeroBookableInventory.bookableNights);
  assert.equal(nullRevpan, null); // RevPAN is null when 0 bookable nights, avoids divide-by-zero

  // Case 3: Cancelled reservation does not count as booked nights
  const cancelledBooking: DashboardInventoryBooking = {
    listingId: "prop_with_cancellation",
    status: BookingStatus.CANCELLED,
    startDate: new Date("2026-11-05T00:00:00.000Z"),
    endDate: new Date("2026-11-10T00:00:00.000Z"),
  };
  const cancelledInventory = calculateDashboardInventory({
    listings: [{ id: "prop_with_cancellation", blockedDates: [] }],
    bookings: [cancelledBooking],
    startDateKey: startKey,
    endDateKeyExclusive: endKeyEx,
  });
  assert.equal(cancelledInventory.bookedNights, 0);
  assert.equal(cancelledInventory.availableNights, 30);
});

test("Host blocked dates vs confirmed bookings precedence", () => {
  const startKey = "2026-11-01";
  const endKeyEx = "2026-11-06"; // 5 days

  // Host blocked Nov 2 and Nov 3
  // Guest booked Nov 2 to Nov 4 (Nov 2, Nov 3)
  // Rule: confirmed booking overrides manual block (guest stay is honored and counted as booked)
  const inventory = calculateDashboardInventory({
    listings: [{ id: "p1", blockedDates: ["2026-11-02", "2026-11-03"] }],
    bookings: [
      {
        listingId: "p1",
        status: BookingStatus.CONFIRMED,
        startDate: new Date("2026-11-02T00:00:00.000Z"),
        endDate: new Date("2026-11-04T00:00:00.000Z"),
      },
    ],
    startDateKey: startKey,
    endDateKeyExclusive: endKeyEx,
  });

  assert.equal(inventory.bookedNights, 2); // Nov 2, Nov 3
  assert.equal(inventory.blockedNights, 0); // Both blocked days were booked
  assert.equal(inventory.bookableNights, 5);
  assert.equal(inventory.availableNights, 3); // Nov 1, Nov 4, Nov 5
});

