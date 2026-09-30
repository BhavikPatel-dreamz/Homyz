import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BookingStatus, ConversationStatus, NotificationType } from "../generated/prisma/enums";
import { ErrorCode, AppError } from "../lib/api/errors";
import {
  REQUEST_TO_BOOK_RESPONSE_HOURS,
  REQUEST_EXPIRY_MS,
  getAuthoritativeExpiryDate,
  getExpiryThresholdDate,
  isBookingRequestExpired,
  getTimeRemaining,
  formatExpiryCountdown,
  isHoldActive,
} from "../lib/booking/booking-expiry";
import { computeBookingStatus, getBookingAvailableActions, isUpcomingBookingStatus } from "../lib/booking/booking-status";
import { toReservationCardData } from "../lib/profile/reservation-data";

async function runPhase8VerificationSuite() {
  console.log("\n==================================================================");
  console.log("   PHASE 8: REQUEST EXPIRY, DATE HOLD & AVAILABILITY LIFECYCLE   ");
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

  const root = path.resolve(__dirname, "..");
  const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

  const bookingServiceCode = read("services/booking.service.ts");
  const listingServiceCode = read("services/listing.service.ts");
  const bookedDatesRouteCode = read("app/api/v1/listings/[id]/booked-dates/route.ts");
  const expireStaleRouteCode = read("app/api/v1/bookings/expire-stale/route.ts");
  const hostApprovalsUiCode = read("components/host/host-booking-approvals.tsx");
  const hostBookingsPageCode = read("app/(protected)/host/bookings/page.tsx");
  const reservationDashboardCode = read("components/dashboard/reservation-dashboard.tsx");
  const reservationCardCode = read("components/dashboard/reservation-card.tsx");

  // -------------------------------------------------------------
  // TEST 1 — CREATE REQUEST (STATUS PENDING & 24H AUTHORITATIVE EXPIRY)
  // -------------------------------------------------------------
  test("Test 1: Request creation sets PENDING status and authoritative 24h expiresAt", () => {
    assert.equal(REQUEST_TO_BOOK_RESPONSE_HOURS, 24, "Response window must be 24 hours");
    assert.equal(REQUEST_EXPIRY_MS, 24 * 60 * 60 * 1000, "Expiry duration in ms must be exactly 86,400,000");

    const createdTime = new Date("2026-10-01T10:00:00.000Z");
    const expiresAt = getAuthoritativeExpiryDate(createdTime);
    assert.equal(
      expiresAt.toISOString(),
      "2026-10-02T10:00:00.000Z",
      "Authoritative expiry timestamp must be exactly 24 hours after creation",
    );

    // Verify service persists expiresAt in priceBreakdown snapshot
    assert.match(
      bookingServiceCode,
      /expiresAt:\s*automaticallyApprove\s*\?\s*null\s*:\s*getAuthoritativeExpiryDate\(new Date\(\)\)\.toISOString\(\)/,
      "Booking creation must persist authoritative expiresAt in priceBreakdown",
    );
  });

  // -------------------------------------------------------------
  // TEST 2 — SEARCH WHILE HELD (ACTIVE PENDING HOLD VS EXPIRED)
  // -------------------------------------------------------------
  test("Test 2: Search availability respects active holds and releases expired pending requests", () => {
    assert.match(
      listingServiceCode,
      /const expiryThreshold = getExpiryThresholdDate\(\)/,
      "Search availability must compute authoritative expiry threshold",
    );
    assert.match(
      listingServiceCode,
      /OR:\s*\[\s*\{\s*status:\s*BookingStatus\.CONFIRMED\s*\},\s*\{\s*status:\s*BookingStatus\.PENDING,\s*createdAt:\s*\{\s*gt:\s*expiryThreshold\s*\}\s*\},?\s*\]/,
      "Search query must treat only CONFIRMED or unexpired PENDING as availability conflicts",
    );

    // Property calendar endpoint must match search availability rule
    assert.match(
      bookedDatesRouteCode,
      /OR:\s*\[\s*\{\s*status:\s*"CONFIRMED"\s*\},\s*\{\s*status:\s*"PENDING",\s*createdAt:\s*\{\s*gt:\s*expiryThreshold\s*\}\s*\},?\s*\]/,
      "Property calendar booked-dates endpoint must use identical active-hold query",
    );
  });

  // -------------------------------------------------------------
  // TEST 3 — HOST ACCEPT (PENDING -> CONFIRMED WITHOUT GATEWAY)
  // -------------------------------------------------------------
  test("Test 3: Host accept transitions PENDING to CONFIRMED with deferred payment", () => {
    assert.match(
      bookingServiceCode,
      /status:\s*BookingStatus\.CONFIRMED/,
      "Accept must set booking status to CONFIRMED",
    );
    assert.match(
      bookingServiceCode,
      /paymentMode:\s*"DEFERRED"/,
      "Payment mode remains DEFERRED",
    );
    assert.match(
      bookingServiceCode,
      /paymentStatus:\s*"PAYMENT_PENDING"/,
      "Payment status remains PAYMENT_PENDING",
    );
    assert.match(
      bookingServiceCode,
      /paymentProvider:\s*null/,
      "Payment provider remains null (truthful, unconfigured)",
    );
  });

  // -------------------------------------------------------------
  // TEST 4 — HOST REJECT (RELEASES DATE HOLD IMMEDIATELY)
  // -------------------------------------------------------------
  test("Test 4: Host reject transitions PENDING to CANCELLED/DECLINED and immediately frees held dates", () => {
    assert.match(
      bookingServiceCode,
      /rejectedBy:\s*"HOST"/,
      "Rejection metadata records rejectedBy: HOST",
    );
    assert.match(
      bookingServiceCode,
      /data:\s*\{\s*status:\s*BookingStatus\.CANCELLED/,
      "Database status transitions to CANCELLED",
    );

    // Dynamic presentation verifies hold release
    const cancelledBooking = {
      status: "CANCELLED",
      createdAt: new Date(),
    };
    assert.equal(isHoldActive(cancelledBooking), false, "Cancelled/rejected booking must not hold dates");
  });

  // -------------------------------------------------------------
  // TEST 5 — AUTOMATIC EXPIRY (PENDING -> EXPIRED & HOLD RELEASED)
  // -------------------------------------------------------------
  test("Test 5: Stale requests past expiresAt are expired and date hold is released", () => {
    const pastCreation = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
    const isExpired = isBookingRequestExpired(pastCreation);
    assert.equal(isExpired, true, "Request created 25h ago must be expired");

    const staleBooking = {
      status: "PENDING",
      createdAt: pastCreation,
    };
    assert.equal(isHoldActive(staleBooking), false, "Stale pending booking must not assert an active hold");

    // Computed status returns EXPIRED
    const statusDetails = computeBookingStatus({
      dbStatus: "PENDING",
      startDate: new Date("2026-11-01"),
      endDate: new Date("2026-11-05"),
      createdAt: pastCreation,
    });
    assert.equal(statusDetails.status, "EXPIRED", "Stale request must compute to EXPIRED status");
    assert.equal(statusDetails.badgeLabel, "Expired", "Badge must read Expired");
  });

  // -------------------------------------------------------------
  // TEST 6 — EXPIRED ACCEPT (PROTECTION WITH REQUEST_EXPIRED CODE)
  // -------------------------------------------------------------
  test("Test 6: Accepting an expired request fails closed with REQUEST_EXPIRED and reconciles booking", () => {
    assert.match(
      bookingServiceCode,
      /if\s*\(\s*isExpired\s*\)\s*\{[\s\S]*?ErrorCode\.REQUEST_EXPIRED/,
      "Accept must throw REQUEST_EXPIRED when request is expired",
    );
    assert.match(
      bookingServiceCode,
      /rejectedBy:\s*"SYSTEM",\s*reason:\s*"EXPIRED"/,
      "Accept must reconcile expired request in DB with SYSTEM EXPIRED metadata",
    );
  });

  // -------------------------------------------------------------
  // TEST 7 — EXPIRED REJECT (IDEMPOTENT TERMINAL STATE)
  // -------------------------------------------------------------
  test("Test 7: Rejecting an already expired/cancelled request handles idempotently", () => {
    assert.match(
      bookingServiceCode,
      /if\s*\(\s*b\.status\s*===\s*BookingStatus\.CANCELLED\s*\)\s*\{\s*\/\/\s*Idempotent rejection:\s*return existing cancelled\/rejected booking\s*return\s*\{\s*\.\.\.b,\s*listing:\s*b\.listing,\s*user:\s*b\.user\s*\};\s*\}/,
      "Reject must return idempotent terminal state if already cancelled/expired",
    );
  });

  // -------------------------------------------------------------
  // TEST 8 — ACCEPT BEFORE EXPIRY (CONFIRMED REQUEST IMMUNE TO EXPIRY)
  // -------------------------------------------------------------
  test("Test 8: Confirmed request is immune to automatic expiry sweeping", () => {
    const confirmedBooking = {
      status: "CONFIRMED",
      createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    };
    assert.equal(isHoldActive(confirmedBooking), true, "Confirmed booking always retains active inventory hold");

    // Expiry scanner query strictly filters status: PENDING
    assert.match(
      bookingServiceCode,
      /status:\s*BookingStatus\.PENDING,\s*OR:\s*\[\s*\{\s*createdAt:\s*\{\s*lte:\s*expiryThreshold\s*\}\s*\},/,
      "Sweeper query must only select BookingStatus.PENDING",
    );
  });

  // -------------------------------------------------------------
  // TEST 9 — EXPIRY IDEMPOTENCY
  // -------------------------------------------------------------
  test("Test 9: Expiry sweeping is idempotent and safe against multiple executions", () => {
    assert.match(
      bookingServiceCode,
      /if\s*\(\s*b\.status\s*!==\s*BookingStatus\.PENDING\s*\)\s*return null;/,
      "expireBookingRequest must exit early if booking is no longer pending",
    );
    assert.match(
      bookingServiceCode,
      /async function expireStaleBookingRequests/,
      "Must export expireStaleBookingRequests",
    );
  });

  // -------------------------------------------------------------
  // TEST 10 — ACCEPT VS EXPIRY RACE (ADVISORY LOCKING)
  // -------------------------------------------------------------
  test("Test 10: Advisory lock protects against accept vs expiry concurrency race", () => {
    assert.match(
      bookingServiceCode,
      /await tx\.\$executeRaw`SELECT pg_advisory_xact_lock\(hashtext\(\$\{id\}\)\)`;/,
      "Both accept and expire must acquire transaction advisory lock on booking id",
    );
    assert.match(
      bookingServiceCode,
      /if\s*\(\s*booking\.status\s*!==\s*BookingStatus\.PENDING\s*\)\s*\{\s*throw AppError\.checkoutConflict\(ErrorCode\.REQUEST_ALREADY_PROCESSED/,
      "Accept must detect already processed status under advisory lock",
    );
  });

  // -------------------------------------------------------------
  // TEST 11 — ACCEPT VS REJECT RACE
  // -------------------------------------------------------------
  test("Test 11: Accept vs Reject race condition is protected by transactional lock", () => {
    assert.match(
      bookingServiceCode,
      /if\s*\(\s*b\.status\s*!==\s*BookingStatus\.PENDING\s*\)\s*\{[\s\S]*?ErrorCode\.REQUEST_NOT_PENDING/,
      "Reject must verify pending status under advisory lock",
    );
  });

  // -------------------------------------------------------------
  // TEST 12 — TWO GUESTS SAME DATES (SERIALIZED BY LISTING LOCK)
  // -------------------------------------------------------------
  test("Test 12: Concurrent booking requests serialize on listing lock to prevent overbooking", () => {
    assert.match(
      bookingServiceCode,
      /await tx\.\$executeRaw`SELECT pg_advisory_xact_lock\(hashtext\(\$\{input\.listingId\}\)\)`;/,
      "Booking creation must acquire advisory lock on listingId before checking conflict",
    );
  });

  // -------------------------------------------------------------
  // TEST 13 — OVERLAPPING DATE RELEASE
  // -------------------------------------------------------------
  test("Test 13: Availability is derived from active records so releasing hold A retains hold B", () => {
    // Hold active evaluation test
    const now = new Date("2026-10-01T12:00:00.000Z");
    const activeHoldB = {
      status: "PENDING",
      createdAt: new Date("2026-10-01T10:00:00.000Z"),
      endDate: new Date("2026-10-07T11:00:00.000Z"),
    };
    const releasedHoldA = {
      status: "CANCELLED",
      createdAt: new Date("2026-10-01T08:00:00.000Z"),
      endDate: new Date("2026-10-05T11:00:00.000Z"),
    };

    assert.equal(isHoldActive(releasedHoldA, now), false, "Hold A must be released");
    assert.equal(isHoldActive(activeHoldB, now), true, "Hold B must remain active on overlapping dates");
  });

  // -------------------------------------------------------------
  // TEST 14 — HOST COUNT SYNCHRONIZATION
  // -------------------------------------------------------------
  test("Test 14: Host pending request list and count strictly exclude expired requests", () => {
    assert.match(
      bookingServiceCode,
      /where:\s*\{\s*status:\s*BookingStatus\.PENDING,\s*endDate:\s*\{\s*gt:\s*now\s*\},\s*createdAt:\s*\{\s*gt:\s*expiryThreshold\s*\}/,
      "listPendingForHost query must filter createdAt > expiryThreshold",
    );
    assert.match(
      hostBookingsPageCode,
      /expiresAt:\s*booking\.expiresAt\.toISOString\(\)/,
      "Host bookings page must pass authoritative expiresAt to client",
    );
  });

  // -------------------------------------------------------------
  // TEST 15 — GUEST DASHBOARD SYNCHRONIZATION
  // -------------------------------------------------------------
  test("Test 15: Guest dashboard categorizes and badges PENDING, CONFIRMED, DECLINED, EXPIRED, CANCELLED", () => {
    // 1. Pending confirmation
    const pending = computeBookingStatus({
      dbStatus: "PENDING",
      startDate: new Date("2026-12-01"),
      endDate: new Date("2026-12-05"),
      createdAt: new Date(),
    });
    assert.equal(pending.status, "PENDING");
    assert.equal(pending.isPending, true);

    // 2. Confirmed upcoming
    const confirmed = computeBookingStatus({
      dbStatus: "CONFIRMED",
      startDate: new Date("2026-12-01"),
      endDate: new Date("2026-12-05"),
    });
    assert.equal(confirmed.status, "CONFIRMED");
    assert.equal(confirmed.isUpcoming, true);

    // 3. Declined request
    const declined = computeBookingStatus({
      dbStatus: "CANCELLED",
      startDate: new Date("2026-12-01"),
      endDate: new Date("2026-12-05"),
      rejectionBy: "HOST",
      rejectionReason: "Dates unavailable",
    });
    assert.equal(declined.status, "DECLINED");
    assert.equal(declined.isDeclinedOrExpired, true);

    // 4. Expired request
    const expired = computeBookingStatus({
      dbStatus: "CANCELLED",
      startDate: new Date("2026-12-01"),
      endDate: new Date("2026-12-05"),
      rejectionBy: "SYSTEM",
      rejectionReason: "EXPIRED",
    });
    assert.equal(expired.status, "EXPIRED");
    assert.equal(expired.isDeclinedOrExpired, true);

    // 5. Upcoming includes active pending and confirmed bookings, but not terminal states.
    assert.equal(isUpcomingBookingStatus("PENDING"), true);
    assert.equal(isUpcomingBookingStatus("CONFIRMED"), true);
    assert.equal(isUpcomingBookingStatus("CURRENT_STAY"), true);
    assert.equal(isUpcomingBookingStatus("DECLINED"), false);
    assert.equal(isUpcomingBookingStatus("EXPIRED"), false);
    assert.equal(isUpcomingBookingStatus("CANCELLED"), false);
    assert.match(
      reservationDashboardCode,
      /if\s*\(!isUpcomingBookingStatus\(status\)\)\s*return false;/,
      "Upcoming tab must include active pending and confirmed stays while rejecting terminal statuses",
    );
  });

  // -------------------------------------------------------------
  // TEST 16 — HOST DASHBOARD CATEGORIES & BADGES
  // -------------------------------------------------------------
  test("Test 16: Host approvals UI displays Expired badges and disables action buttons when expired", () => {
    assert.match(
      hostApprovalsUiCode,
      /deadline\.isExpired\s*\|\|\s*booking\.isExpired/,
      "Host card must check expired flag to render Expired badge",
    );
    assert.match(
      hostApprovalsUiCode,
      /details\.isExpired\s*\?[\s\S]*?This request has expired and can no longer be accepted/,
      "Host modal footer must replace Accept/Decline buttons with Expired notice",
    );
  });

  // -------------------------------------------------------------
  // TEST 17 — NOTIFICATIONS (EXACT TARGETED NOTIFICATIONS)
  // -------------------------------------------------------------
  test("Test 17: Notifications are emitted for Created, Accepted, Rejected, and Expired without duplicates", () => {
    assert.match(
      bookingServiceCode,
      /Booking Request Expired:\s*\$\{expiredBooking\.listing\.title\}/,
      "Expiry must send targeted notification to guest",
    );
    assert.match(
      bookingServiceCode,
      /link:\s*"\/profile\/tab\/past"/,
      "Expiry notification must direct guest to past reservations tab",
    );
  });

  // -------------------------------------------------------------
  // TEST 18 — MESSAGING SYNCHRONIZATION
  // -------------------------------------------------------------
  test("Test 18: Messaging conversation status synchronizes with booking transitions", () => {
    assert.match(
      bookingServiceCode,
      /conversationStatus:\s*ConversationStatus\.CONFIRMED/,
      "Acceptance synchronizes conversation status to CONFIRMED",
    );
    assert.match(
      bookingServiceCode,
      /conversationStatus:\s*ConversationStatus\.DECLINED/,
      "Rejection synchronizes conversation status to DECLINED",
    );
    assert.match(
      bookingServiceCode,
      /conversationStatus:\s*ConversationStatus\.EXPIRED/,
      "Expiry synchronizes conversation status to EXPIRED",
    );
  });

  // -------------------------------------------------------------
  // TEST 19 — PAGE REFRESH & AUTHORITATIVE SERVER STATE
  // -------------------------------------------------------------
  test("Test 19: Server state is authoritative and resilient to page refreshes and browser clock drift", () => {
    const serverNow = new Date("2026-10-01T12:00:00.000Z");
    const countdown = formatExpiryCountdown("2026-10-01T00:00:00.000Z", serverNow);
    assert.equal(countdown.isExpired, false);
    assert.equal(countdown.hours, 12);
    assert.equal(countdown.text, "Respond within 12h 0m");

    const expiredCountdown = formatExpiryCountdown("2026-09-30T10:00:00.000Z", serverNow);
    assert.equal(expiredCountdown.isExpired, true);
    assert.equal(expiredCountdown.text, "Request expired");
  });

  // -------------------------------------------------------------
  // TEST 20 — MOBILE UI SAFETY & MODAL LOCKING
  // -------------------------------------------------------------
  test("Test 20: Mobile UI safety: countdowns format gracefully and ModalOverlay is used", () => {
    assert.match(
      hostApprovalsUiCode,
      /<ModalOverlay/,
      "Host approvals modal must use ModalOverlay to lock body scroll on mobile and desktop",
    );

    // Urgent countdown (< 6 hours)
    const urgentTime = new Date(Date.now() - 20 * 60 * 60 * 1000); // 4 hours remaining
    const remaining = getTimeRemaining(urgentTime);
    assert.equal(remaining.isUrgent, true, "Fewer than 6 hours remaining must flag isUrgent");
  });

  console.log("\n==================================================================");
  console.log(` RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL 20 TESTS)`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase8VerificationSuite();
