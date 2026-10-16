import assert from "node:assert/strict";
import { bookingDateKey, formatBookingDate, formatBookingDateRange, parseBookingDate, parseBookingDateParts } from "../lib/booking/booking-date";
import { computeBookingStatus, isUpcomingBookingStatus, getBookingAvailableActions, getBookingStatusTimeline } from "../lib/booking/booking-status";
import { resolveBookingMode } from "../lib/booking/booking-mode";
import { getPaymentPolicy, getPaymentMode } from "../lib/booking/payment-policy";
import { validateHostMessage } from "../lib/booking/host-message";
import { validateMockCard, detectCardBrand, createSafePaymentSelection } from "../lib/booking/payment-method";
import { isBookingRequestExpired, getAuthoritativeExpiryDate, getExpiryThresholdDate } from "../lib/booking/booking-expiry";
import { toReservationCardData } from "../lib/profile/reservation-data";

async function runEndToEndAuditFlows() {
  console.log("\n==================================================================");
  console.log("   HOMYZ BOOKING SYSTEM: COMPLETE FLOW AUDIT (FLOWS A - F)       ");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void | Promise<void>) {
    try {
      fn();
      console.log(` ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(` ❌ FAIL: ${name}`);
      console.error(err);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // FLOW A: REQUEST TO BOOK -> HOST ACCEPT
  // -------------------------------------------------------------
  test("Flow A: Request-to-Book lifecycle through Host Accept", () => {
    // 1. Search selection
    const checkIn = "2026-10-12";
    const checkOut = "2026-10-14";
    const guests = 2;

    // 2. Listing configuration governs booking mode
    const listing = {
      id: "listing_rtb_1",
      hostId: "host_user_1",
      bookingApprovalMode: "MANUAL",
      instantBook: false,
    };
    const mode = resolveBookingMode(listing);
    assert.equal(mode, "REQUEST_TO_BOOK");

    // 3. Checkout payment method (mock card validation & safe storage)
    const cardValidation = validateMockCard({
      number: "4242 4242 4242 4242",
      name: "Test Guest",
      expiry: "12/30",
      cvc: "123",
    });
    assert.equal(cardValidation.valid, true);
    assert.equal(detectCardBrand("4242 4242 4242 4242"), "Visa");

    const safePayment = createSafePaymentSelection("card", "Visa", "4242");
    assert.equal(safePayment.brand, "Visa");
    assert.equal(safePayment.last4, "4242");
    assert.equal(safePayment.paymentMode, "DEFERRED");
    assert.equal(safePayment.paymentStatus, "PAYMENT_PENDING");
    assert.equal((safePayment as any).cardNumber, undefined);
    assert.equal((safePayment as any).cvc, undefined);

    // 4. Host message validation
    const messageRes = validateHostMessage("Hello host, looking forward to staying!");
    assert.equal(messageRes.valid, true);

    // 5. Booking creation state (PENDING)
    const createdAt = new Date("2026-10-01T10:00:00Z");
    const expiresAt = getAuthoritativeExpiryDate(createdAt);
    const mockCreatedBooking: any = {
      id: "bk_req_101",
      userId: "guest_user_1",
      listingId: listing.id,
      status: "PENDING",
      startDate: checkIn,
      endDate: checkOut,
      guests,
      priceBreakdown: {
        paymentMode: "DEFERRED",
        paymentStatus: "PAYMENT_PENDING",
        expiresAt: expiresAt.toISOString(),
      },
      createdAt,
      updatedAt: createdAt,
      listing: {
        id: listing.id,
        hostId: listing.hostId,
        title: "Seaside Villa",
        city: "Jeddah",
        country: "Saudi Arabia",
        photos: ["https://example.com/photo.jpg"],
        checkInStart: "15:00",
        checkOutTime: "11:00",
      },
    };

    // 6. Upcoming Tab shows PENDING card
    const cardData = toReservationCardData(mockCreatedBooking);
    assert.equal(cardData.status, "PENDING");
    assert.equal(isUpcomingBookingStatus(cardData.status), true);

    // 7. Host Accept transition
    const mockConfirmedBooking = {
      ...mockCreatedBooking,
      status: "CONFIRMED",
      priceBreakdown: {
        ...mockCreatedBooking.priceBreakdown,
        acceptance: {
          acceptedAt: new Date("2026-10-01T14:00:00Z").toISOString(),
          acceptedBy: "HOST",
          hostId: listing.hostId,
        },
      },
      updatedAt: new Date("2026-10-01T14:00:00Z"),
    };

    // 8. Upcoming Tab remains active and updates to CONFIRMED
    const confirmedCardData = toReservationCardData(mockConfirmedBooking);
    assert.equal(confirmedCardData.status, "CONFIRMED");
    assert.equal(isUpcomingBookingStatus(confirmedCardData.status), true);
    assert.equal(confirmedCardData.totalPrice, mockCreatedBooking.totalPrice);

    // 9. Payment remains DEFERRED / PAYMENT_PENDING
    assert.equal(mockConfirmedBooking.priceBreakdown.paymentMode, "DEFERRED");
    assert.equal(mockConfirmedBooking.priceBreakdown.paymentStatus, "PAYMENT_PENDING");

    // 10. Timeline verification
    const timeline = getBookingStatusTimeline({
      createdAt: mockConfirmedBooking.createdAt,
      updatedAt: mockConfirmedBooking.updatedAt,
      statusDetails: computeBookingStatus({
        dbStatus: mockConfirmedBooking.status,
        startDate: mockConfirmedBooking.startDate,
        endDate: mockConfirmedBooking.endDate,
        createdAt: mockConfirmedBooking.createdAt,
      }),
      priceBreakdown: mockConfirmedBooking.priceBreakdown,
    });
    assert.equal(timeline[0].type, "REQUEST_CREATED");
    assert.equal(timeline[1].type, "HOST_ACCEPTED");
  });

  // -------------------------------------------------------------
  // FLOW B: REQUEST TO BOOK -> HOST REJECT
  // -------------------------------------------------------------
  test("Flow B: Request-to-Book lifecycle through Host Reject", () => {
    const mockBooking: any = {
      id: "bk_req_102",
      userId: "guest_user_1",
      listingId: "listing_rtb_1",
      status: "CANCELLED",
      startDate: "2026-10-12",
      endDate: "2026-10-14",
      guests: 2,
      priceBreakdown: {
        paymentMode: "DEFERRED",
        paymentStatus: "PAYMENT_PENDING",
        rejection: {
          rejectedAt: "2026-10-01T12:00:00Z",
          rejectedBy: "HOST",
          reason: "Property undergoing maintenance",
        },
      },
      createdAt: new Date("2026-10-01T10:00:00Z"),
      updatedAt: new Date("2026-10-01T12:00:00Z"),
      listing: {
        id: "listing_rtb_1",
        hostId: "host_user_1",
        title: "Seaside Villa",
        city: "Jeddah",
        country: "Saudi Arabia",
        photos: [],
      },
    };

    const cardData = toReservationCardData(mockBooking);
    assert.equal(cardData.status, "DECLINED");
    // Must be removed from upcoming
    assert.equal(isUpcomingBookingStatus(cardData.status), false);

    // Available in All/History
    const statusDetails = computeBookingStatus({
      dbStatus: mockBooking.status,
      startDate: mockBooking.startDate,
      endDate: mockBooking.endDate,
      rejectionReason: "Property undergoing maintenance",
      rejectionBy: "HOST",
    });
    assert.equal(statusDetails.isDeclinedOrExpired, true);
    assert.equal(statusDetails.badgeLabel, "Declined");
  });

  // -------------------------------------------------------------
  // FLOW C: REQUEST TO BOOK -> REQUEST EXPIRY
  // -------------------------------------------------------------
  test("Flow C: Request-to-Book lifecycle through Expiry", () => {
    const createdAt = new Date("2026-10-01T10:00:00Z");
    const checkOut = "2026-10-14";
    // 25 hours later -> expired
    const now = new Date("2026-10-02T11:00:00Z");
    const isExpired = isBookingRequestExpired(createdAt, now, checkOut);
    assert.equal(isExpired, true);

    const mockExpiredBooking: any = {
      id: "bk_req_103",
      userId: "guest_user_1",
      listingId: "listing_rtb_1",
      status: "CANCELLED",
      startDate: "2026-10-12",
      endDate: checkOut,
      guests: 2,
      priceBreakdown: {
        paymentMode: "DEFERRED",
        paymentStatus: "PAYMENT_PENDING",
        rejection: {
          rejectedAt: now.toISOString(),
          rejectedBy: "SYSTEM",
          reason: "EXPIRED",
        },
        expiredAt: now.toISOString(),
      },
      createdAt,
      updatedAt: now,
      listing: {
        id: "listing_rtb_1",
        hostId: "host_user_1",
        title: "Seaside Villa",
        city: "Jeddah",
        country: "Saudi Arabia",
        photos: [],
      },
    };

    const cardData = toReservationCardData(mockExpiredBooking);
    assert.equal(cardData.status, "EXPIRED");
    // Must be removed from upcoming
    assert.equal(isUpcomingBookingStatus(cardData.status), false);

    const statusDetails = computeBookingStatus({
      dbStatus: mockExpiredBooking.status,
      startDate: mockExpiredBooking.startDate,
      endDate: mockExpiredBooking.endDate,
      isExpired: true,
      rejectionReason: "EXPIRED",
    });
    assert.equal(statusDetails.badgeLabel, "Expired");
  });

  // -------------------------------------------------------------
  // FLOW D: INSTANT BOOK
  // -------------------------------------------------------------
  test("Flow D: Instant Book direct confirmation", () => {
    const listing = {
      id: "listing_instant_1",
      hostId: "host_user_1",
      bookingApprovalMode: "INSTANT",
      instantBook: true,
    };
    const mode = resolveBookingMode(listing);
    assert.equal(mode, "INSTANT_BOOK");

    // Instantly confirmed
    const mockInstantBooking: any = {
      id: "bk_inst_104",
      userId: "guest_user_1",
      listingId: listing.id,
      status: "CONFIRMED",
      startDate: "2026-10-12",
      endDate: "2026-10-14",
      guests: 2,
      priceBreakdown: {
        bookingMode: "INSTANT_BOOK",
        paymentMode: "DEFERRED",
        paymentStatus: "PAYMENT_PENDING",
        expiresAt: null,
      },
      createdAt: new Date("2026-10-01T10:00:00Z"),
      updatedAt: new Date("2026-10-01T10:00:00Z"),
      listing: {
        id: listing.id,
        hostId: listing.hostId,
        title: "Luxury Condo",
        city: "Riyadh",
        country: "Saudi Arabia",
        photos: [],
      },
    };

    const cardData = toReservationCardData(mockInstantBooking);
    assert.equal(cardData.status, "CONFIRMED");
    assert.equal(isUpcomingBookingStatus(cardData.status), true);

    const timeline = getBookingStatusTimeline({
      createdAt: mockInstantBooking.createdAt,
      updatedAt: mockInstantBooking.updatedAt,
      statusDetails: computeBookingStatus({
        dbStatus: mockInstantBooking.status,
        startDate: mockInstantBooking.startDate,
        endDate: mockInstantBooking.endDate,
        createdAt: mockInstantBooking.createdAt,
      }),
      priceBreakdown: mockInstantBooking.priceBreakdown,
    });
    assert.equal(timeline[0].type, "REQUEST_CREATED");
    assert.equal(timeline[1].type, "HOST_ACCEPTED");
    // No decline or expiry step
    assert.equal(timeline.some((t) => t.type === "HOST_REJECTED" || t.type === "REQUEST_EXPIRED"), false);
  });

  // -------------------------------------------------------------
  // FLOW E: UPCOMING PENDING + CONFIRMED
  // -------------------------------------------------------------
  test("Flow E: Upcoming tab filters and separates Pending vs Confirmed", () => {
    const bookingA: any = {
      id: "bk_pending",
      userId: "guest_1",
      listingId: "listing_1",
      status: "PENDING",
      startDate: "2026-10-12",
      endDate: "2026-10-14",
      listing: { title: "Pending Stay", city: "Jeddah", photos: [] },
    };

    const bookingB: any = {
      id: "bk_confirmed",
      userId: "guest_1",
      listingId: "listing_2",
      status: "CONFIRMED",
      startDate: "2026-10-15",
      endDate: "2026-10-18",
      listing: { title: "Confirmed Stay", city: "Riyadh", photos: [] },
    };

    const cardA = toReservationCardData(bookingA);
    const cardB = toReservationCardData(bookingB);

    assert.equal(cardA.status, "PENDING");
    assert.equal(isUpcomingBookingStatus(cardA.status), true);

    assert.equal(cardB.status, "CONFIRMED");
    assert.equal(isUpcomingBookingStatus(cardB.status), true);
  });

  // -------------------------------------------------------------
  // FLOW F: DATE CONSISTENCY ACROSS ALL LAYERS
  // -------------------------------------------------------------
  test("Flow F: Dates remain Oct 12 -> Oct 14 consistently across all formatting layers", () => {
    const inputStart = "2026-10-12";
    const inputEnd = "2026-10-14";

    // 1. Parsing parts
    const startParts = parseBookingDateParts(inputStart);
    const endParts = parseBookingDateParts(inputEnd);
    assert.deepEqual(startParts, { year: 2026, month: 10, day: 12 });
    assert.deepEqual(endParts, { year: 2026, month: 10, day: 14 });

    // 2. Transport key
    assert.equal(bookingDateKey(inputStart), "2026-10-12");
    assert.equal(bookingDateKey(inputEnd), "2026-10-14");

    // 3. Format Date
    const formattedStart = formatBookingDate(inputStart);
    const formattedEnd = formatBookingDate(inputEnd);
    assert.match(formattedStart, /Oct 12, 2026/);
    assert.match(formattedEnd, /Oct 14, 2026/);

    // 4. Format Range
    const range = formatBookingDateRange(inputStart, inputEnd);
    assert.equal(range, "Oct 12 – Oct 14, 2026");

    // 5. Weekday format
    const weekdayStart = formatBookingDate(inputStart, { weekday: true });
    const weekdayEnd = formatBookingDate(inputEnd, { weekday: true });
    assert.match(weekdayStart, /Mon, Oct 12, 2026/);
    assert.match(weekdayEnd, /Wed, Oct 14, 2026/);
  });

  console.log(`\nFLOW AUDIT RESULTS: ${passed} PASSED, ${failed} FAILED`);
  if (failed > 0) process.exitCode = 1;
}

runEndToEndAuditFlows().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
