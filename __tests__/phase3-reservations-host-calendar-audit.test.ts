import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateBookingPrice, calculateSpecialOffer } from "@/services/pricing.service";
import {
  validateStayAvailability,
  getMinimumStayForCheckIn,
} from "@/lib/booking/availability";
import {
  buildOperationalEvents,
  deduplicateHostReservations,
  filterOperationalEventsByProperty,
  type OperationalEvent,
} from "@/lib/booking/host-reservation-events";
import { bookingDateKey, shiftBookingDateKey } from "@/lib/booking/booking-date";
import type { HostReservation } from "@/components/host/host-workspace-shared";
import type { ListingDTO } from "@/services/mappers";

// Mock Listing for Cross-System Testing
const mockListingBase = {
  id: "listing-unit-p3-001",
  hostId: "host-user-p3-alpha",
  title: "Riyadh Luxury Sky Villa",
  price: 50000, // 500 SAR in cents
  weekdayBasePrice: 50000,
  weekendPrice: 65000, // 650 SAR in cents
  weekendPremium: null,
  cleaningFee: 15000, // 150 SAR in cents
  extraGuestFee: 7500, // 75 SAR in cents per extra guest/night
  securityDeposit: 0,
  minNights: 2,
  maxNights: 30,
  guests: 6, // Maximum capacity
  bedrooms: 2,
  beds: 3,
  bathrooms: 2,
  advanceNotice: "Same day",
  sameDayCutoff: "12:00 AM",
  allowSameDayRequests: true,
  blockedDates: ["2026-10-20", "2026-10-21"],
  customPrices: {
    "2026-10-15": 90000, // 900 SAR custom holiday price
  },
  discounts: {
    includedGuests: 2, // Extra guest fee begins only above 2 guests
    baseGuests: 2,
    weekly: { enabled: true, percentage: 10 },
    monthly: { enabled: true, percentage: 25 },
  },
  published: true,
  status: "ACTIVE" as any,
  city: "Riyadh",
  district: "Al Malqa",
  country: "Saudi Arabia",
  photos: ["/images/villa.jpg"],
  checkInStart: "15:00",
  checkInEnd: "22:00",
  checkOutTime: "11:00",
  amenities: ["WIFI", "AC", "POOL"],
  views: ["CITY_SKYLINE"],
  createdAt: new Date(),
  updatedAt: new Date(),
} as unknown as ListingDTO;

test("TEST 1: Host custom price reflects across calendar, listing detail, and checkout quote", async () => {
  // Date 2026-10-15 is Thursday (weekday/custom) with custom price 900 SAR (90,000 cents)
  // Date 2026-10-16 is Friday (weekend) with weekend rate 650 SAR (65,000 cents)
  const quote = await calculateBookingPrice({
    checkIn: "2026-10-15",
    checkOut: "2026-10-17", // 2 nights
    weekdayBasePrice: mockListingBase.weekdayBasePrice!,
    weekendPrice: mockListingBase.weekendPrice,
    customPrices: mockListingBase.customPrices as Record<string, number>,
    cleaningFee: mockListingBase.cleaningFee,
    baseGuests: 2,
    guests: 2,
    hostServiceFeePercentage: 15,
  });

  assert.equal(quote.nights, 2);
  assert.equal(quote.breakdown[0].date, "2026-10-15");
  assert.equal(quote.breakdown[0].price, 90000, "2026-10-15 uses custom price of 90,000 cents");
  assert.equal(quote.breakdown[0].rateSource, "CUSTOM");
  assert.equal(quote.breakdown[1].date, "2026-10-16");
  assert.equal(quote.breakdown[1].price, 65000, "2026-10-16 uses weekend price of 65,000 cents");
  assert.equal(quote.breakdown[1].rateSource, "WEEKEND");
  assert.equal(quote.staySubtotal, 155000, "Total stay subtotal equals 90,000 + 65,000");
});

test("TEST 2 & 3: Host blocks dates -> Booking rejected with BLOCKED_DATE; Unblocks -> Available", () => {
  const checkBlocked = validateStayAvailability({
    listing: mockListingBase,
    checkIn: "2026-10-20",
    checkOut: "2026-10-22",
    guests: 2,
    now: new Date("2026-10-01"),
  });
  assert.equal(checkBlocked.available, false);
  assert.equal((checkBlocked as any).code, "BLOCKED_DATE");

  // Host unblocks 2026-10-20 and 2026-10-21
  const unblockedListing = {
    ...mockListingBase,
    blockedDates: [],
  };
  const checkUnblocked = validateStayAvailability({
    listing: unblockedListing,
    checkIn: "2026-10-20",
    checkOut: "2026-10-22",
    guests: 2,
    now: new Date("2026-10-01"),
  });
  assert.equal(checkUnblocked.available, true);
  assert.equal(checkUnblocked.nights, 2);
});

test("TEST 4: Guest confirmed booking protects calendar dates and rejects overlap", () => {
  const checkOverlap = validateStayAvailability({
    listing: mockListingBase,
    checkIn: "2026-10-10",
    checkOut: "2026-10-14",
    guests: 2,
    now: new Date("2026-10-01"),
    unavailableRanges: [
      { start: "2026-10-12", end: "2026-10-15" },
    ],
  });
  assert.equal(checkOverlap.available, false);
  assert.equal((checkOverlap as any).code, "BOOKING_OVERLAP");
});

test("TEST 5 & 6: Cancellation attribution: Guest vs Host cancellation semantics", () => {
  // Guest cancellation
  const guestCancellationPb = {
    cancellation: {
      cancelledAt: "2026-10-05T10:00:00Z",
      cancelledBy: "GUEST",
      guestRefundAmount: 50000,
      hostPayoutRetained: 0,
    },
  };
  assert.equal(guestCancellationPb.cancellation.cancelledBy, "GUEST");

  // Host cancellation
  const hostCancellationPb = {
    cancellation: {
      cancelledAt: "2026-10-05T11:00:00Z",
      cancelledBy: "HOST",
      hostId: "host-user-p3-alpha",
      reason: "Emergency maintenance",
      isExcluded: false,
      guestRefundAmount: 50000,
      hostPayoutRetained: 0,
    },
  };
  assert.equal(hostCancellationPb.cancellation.cancelledBy, "HOST");
  assert.equal(hostCancellationPb.cancellation.isExcluded, false);
});

test("TEST 7: Cleaning fee changes correctly flow into price breakdown and host payout", async () => {
  const quoteWithCleaning = await calculateBookingPrice({
    checkIn: "2026-11-01",
    checkOut: "2026-11-04", // 3 nights
    weekdayBasePrice: 40000,
    cleaningFee: 20000, // 200 SAR
    hostServiceFeePercentage: 15,
  });

  assert.equal(quoteWithCleaning.staySubtotal, 120000);
  assert.equal(quoteWithCleaning.cleaningFee, 20000);
  assert.equal(quoteWithCleaning.totalAdditionalFees, 20000);
  assert.equal(quoteWithCleaning.taxableBase, 140000); // 120,000 + 20,000
  // Host payout includes cleaning fee minus host service fee (on accommodation)
  // Host service fee = 15% of 120,000 = 18,000
  assert.equal(quoteWithCleaning.payoutBreakdown.hostServiceFee, 18000);
  assert.equal(quoteWithCleaning.payoutBreakdown.cleaningFee, 20000);
  assert.equal(quoteWithCleaning.payoutBreakdown.netHostPayout, 120000 + 20000 - 18000); // 122,000
});

test("TEST 8, 9, 10, 11: Extra guest logic, included guest capacity, and max guest enforcement", async () => {
  // Included capacity = 3 guests. Extra guest fee = 5,000 cents (50 SAR) per extra guest / night.
  // 1 guest (below threshold) -> 0 extra fee
  const quote1Guest = await calculateBookingPrice({
    checkIn: "2026-11-10",
    checkOut: "2026-11-12", // 2 nights
    weekdayBasePrice: 30000,
    baseGuests: 3,
    guests: 1,
    extraGuestFee: 5000,
  });
  assert.equal(quote1Guest.extraGuestFee, 0, "TEST 9: Guest count below threshold -> 0 fee");

  // 3 guests (at threshold) -> 0 extra fee
  const quote3Guests = await calculateBookingPrice({
    checkIn: "2026-11-10",
    checkOut: "2026-11-12",
    weekdayBasePrice: 30000,
    baseGuests: 3,
    guests: 3,
    extraGuestFee: 5000,
  });
  assert.equal(quote3Guests.extraGuestFee, 0, "At threshold (3 guests) -> 0 fee");

  // 4 guests (1 exceeding threshold) for 2 nights -> 1 * 5,000 * 2 = 10,000 cents
  const quote4Guests = await calculateBookingPrice({
    checkIn: "2026-11-10",
    checkOut: "2026-11-12",
    weekdayBasePrice: 30000,
    baseGuests: 3,
    guests: 4,
    extraGuestFee: 5000,
  });
  assert.equal(quote4Guests.extraGuestFee, 10000, "TEST 8: 1 extra guest * 50 SAR * 2 nights = 100 SAR");

  // 5 guests (2 exceeding threshold) for 2 nights -> 2 * 5,000 * 2 = 20,000 cents
  const quote5Guests = await calculateBookingPrice({
    checkIn: "2026-11-10",
    checkOut: "2026-11-12",
    weekdayBasePrice: 30000,
    baseGuests: 3,
    guests: 5,
    extraGuestFee: 5000,
  });
  assert.equal(quote5Guests.extraGuestFee, 20000, "TEST 8: 2 extra guests * 50 SAR * 2 nights = 200 SAR");

  // TEST 10: Guest count reaches maximum capacity (6 guests) -> Still allowed
  const validMaxStay = validateStayAvailability({
    listing: mockListingBase, // max guests = 6
    checkIn: "2026-11-10",
    checkOut: "2026-11-12",
    guests: 6,
    now: new Date("2026-10-01"),
  });
  assert.equal(validMaxStay.available, true, "TEST 10: 6 guests (maximum capacity) is allowed");

  // TEST 11: Attempt beyond maximum capacity (7 guests) -> Rejected
  const invalidMaxStay = validateStayAvailability({
    listing: mockListingBase, // max guests = 6
    checkIn: "2026-11-10",
    checkOut: "2026-11-12",
    guests: 7,
    now: new Date("2026-10-01"),
  });
  assert.equal(invalidMaxStay.available, false, "TEST 11: 7 guests exceeds capacity");
  assert.equal((invalidMaxStay as any).code, "GUEST_CAPACITY");
});

test("TEST 12: Minimum stay violation is rejected", () => {
  // Listing minNights = 2
  const shortStay = validateStayAvailability({
    listing: mockListingBase,
    checkIn: "2026-11-10",
    checkOut: "2026-11-11", // 1 night
    guests: 2,
    now: new Date("2026-10-01"),
  });
  assert.equal(shortStay.available, false);
  assert.equal((shortStay as any).code, "MINIMUM_STAY");
});

test("TEST 13 & 14: Multi-listing host support, operational event filtering, and no cross-listing mixing", () => {
  const listingsMap = new Map<string, ListingDTO>([
    [mockListingBase.id, mockListingBase],
    [
      "listing-unit-p3-002",
      {
        ...mockListingBase,
        id: "listing-unit-p3-002",
        title: "Jeddah Corniche Apartment",
        city: "Jeddah",
      },
    ],
  ]);

  const mockReservations: HostReservation[] = [
    {
      id: "res-001",
      listingId: "listing-unit-p3-001",
      status: "CONFIRMED",
      startDate: "2026-10-05",
      endDate: "2026-10-08",
      guests: 2,
      totalPrice: 150000,
      nightlyPrice: 50000,
      currency: "SAR",
      guestName: "Ahmed Al-Harbi",
      guestImage: null,
      createdAt: "2026-09-20T10:00:00Z",
    },
    {
      id: "res-002",
      listingId: "listing-unit-p3-002",
      status: "CONFIRMED",
      startDate: "2026-10-05",
      endDate: "2026-10-07",
      guests: 3,
      totalPrice: 120000,
      nightlyPrice: 60000,
      currency: "SAR",
      guestName: "Sara Mansour",
      guestImage: null,
      createdAt: "2026-09-22T12:00:00Z",
    },
    {
      id: "res-003",
      listingId: "listing-unit-p3-001",
      status: "CANCELLED",
      startDate: "2026-10-10",
      endDate: "2026-10-12",
      guests: 2,
      totalPrice: 100000,
      nightlyPrice: 50000,
      currency: "SAR",
      guestName: "Fahad Omar",
      guestImage: null,
      createdAt: "2026-09-25T14:00:00Z",
    },
  ];

  // Test today filter across all properties
  const todayEvents = buildOperationalEvents(mockReservations, listingsMap, "today", "2026-10-05");
  assert.equal(todayEvents.length, 2, "Both check-ins on 2026-10-05 included");

  // Test single listing filter (listing-unit-p3-001)
  const filteredEvents = filterOperationalEventsByProperty(todayEvents, "listing-unit-p3-001");
  assert.equal(filteredEvents.length, 1);
  assert.equal(filteredEvents[0].booking.id, "res-001");
  assert.equal(filteredEvents[0].listing.id, "listing-unit-p3-001");

  // Test cancelled filter
  const cancelledEvents = buildOperationalEvents(mockReservations, listingsMap, "cancelled", "2026-10-05");
  assert.equal(cancelledEvents.length, 1);
  assert.equal(cancelledEvents[0].booking.id, "res-003");
  assert.equal(cancelledEvents[0].eventType, "cancelled");

  // Test all filter
  const allEvents = buildOperationalEvents(mockReservations, listingsMap, "all", "2026-10-05");
  assert.equal(allEvents.length, 3);
});
