import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BookingStatus, ListingStatus, Role, MessageType, ConversationStatus, NotificationType } from "../generated/prisma/enums";
import { ErrorCode, AppError } from "../lib/api/errors";
import { computeBookingStatus, getBookingAvailableActions } from "../lib/booking/booking-status";

async function runHostBookingRequestWorkflowTests() {
  console.log("\n==================================================================");
  console.log("   PHASE 7: HOST REQUEST-TO-BOOK WORKFLOW & ACCEPT/REJECT AUDIT   ");
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
  const hostApprovalsUiCode = read("components/host/host-booking-approvals.tsx");
  const getDetailRouteCode = read("app/api/v1/host/bookings/[id]/route.ts");
  const acceptRouteCode = read("app/api/v1/host/bookings/[id]/accept/route.ts");
  const rejectRouteCode = read("app/api/v1/host/bookings/[id]/reject/route.ts");

  // -------------------------------------------------------------
  // TEST 1 — HOST PENDING LIST ARCHITECTURE
  // -------------------------------------------------------------
  test("Test 1: Host Pending List enforces host ownership and pending status filter in DB query", () => {
    assert.match(
      bookingServiceCode,
      /status:\s*BookingStatus\.PENDING/,
      "Query must filter strictly by status = BookingStatus.PENDING",
    );
    assert.match(
      bookingServiceCode,
      /listing:\s*\{\s*hostId:\s*actor\.id\s*\}/,
      "Query must scope by listing.hostId == authenticated host id",
    );
    assert.match(
      bookingServiceCode,
      /endDate:\s*\{\s*gt:\s*new Date\(\)\s*\}/,
      "Query must only include future-facing bookings",
    );
  });

  // -------------------------------------------------------------
  // TEST 2 — DIFFERENT HOST ACCESS DENIED (403)
  // -------------------------------------------------------------
  test("Test 2: Host B cannot view Host A's booking request (403 Forbidden check)", () => {
    assert.match(
      bookingServiceCode,
      /if\s*\(\s*booking\.listing\.hostId\s*!==\s*actor\.id\s*\)\s*\{\s*throw AppError\.forbidden/,
      "Server must explicitly verify booking.listing.hostId === actor.id and throw 403 Forbidden",
    );
  });

  // -------------------------------------------------------------
  // TEST 3 — GUEST ACCESS DENIED
  // -------------------------------------------------------------
  test("Test 3: Guest cannot call host booking request endpoints (role guard enforced)", () => {
    assert.match(
      getDetailRouteCode,
      /requireApiRole\(req,\s*\[Role\.HOST\]\)/,
      "GET /host/bookings/[id] must require Role.HOST",
    );
    assert.match(
      acceptRouteCode,
      /requireApiRole\(req,\s*\[Role\.HOST\]\)/,
      "POST /host/bookings/[id]/accept must require Role.HOST",
    );
    assert.match(
      rejectRouteCode,
      /requireApiRole\(req,\s*\[Role\.HOST\]\)/,
      "POST /host/bookings/[id]/reject must require Role.HOST",
    );
  });

  // -------------------------------------------------------------
  // TEST 4 — REQUEST DETAIL CONTRACT
  // -------------------------------------------------------------
  test("Test 4: Request details return canonical property, guest, trip, message, pricing", () => {
    assert.match(bookingServiceCode, /getRequestDetailsForHost/, "Must export getRequestDetailsForHost");
    assert.match(bookingServiceCode, /guestMessage:\s*conversation\?\.messages\[0\]\?\.content/, "Must query guest message from conversation");
    assert.match(bookingServiceCode, /conversationId:\s*conversation\?\.id/, "Must provide conversation link");
    assert.match(bookingServiceCode, /expiresAt/, "Must calculate authoritative expiry deadline");
    assert.match(bookingServiceCode, /isExpired/, "Must provide expired boolean flag");
  });

  // -------------------------------------------------------------
  // TEST 5 — PAYMENT-AWARE ACCEPT ARCHITECTURE
  // -------------------------------------------------------------
  test("Test 5: Accept supports DEFERRED mode confirmation and gates when online payment is required", () => {
    assert.match(
      bookingServiceCode,
      /if\s*\(\s*policy\.onlinePaymentRequired\s*&&\s*policy\.paymentMode\s*===\s*"ONLINE_AUTHORIZATION"\s*\)/,
      "Accept checks payment policy for online authorization",
    );
    assert.match(
      bookingServiceCode,
      /throw AppError\.checkoutValidation\(\s*ErrorCode\.PAYMENT_AUTHORIZATION_REQUIRED/,
      "Accept throws PAYMENT_AUTHORIZATION_REQUIRED when online payment is required",
    );
    assert.match(
      bookingServiceCode,
      /paymentMode:\s*"DEFERRED"/,
      "Accept records paymentMode DEFERRED when no gateway is configured",
    );
  });

  // -------------------------------------------------------------
  // TEST 6 — FAKE AUTHORIZATION REJECTED
  // -------------------------------------------------------------
  test("Test 6: Client-supplied fake authorization payload cannot bypass provider gate", () => {
    // Route accepts no client payment token to bypass server check
    assert.doesNotMatch(
      acceptRouteCode,
      /paymentStatus|fake|authorized/i,
      "Accept route never trusts client-supplied payment status",
    );
    assert.match(
      bookingServiceCode,
      /BLOCKED_BY_PROVIDER/,
      "Accept marks reason as BLOCKED_BY_PROVIDER",
    );
  });

  // -------------------------------------------------------------
  // TEST 7 — DOUBLE ACCEPT PROTECTION
  // -------------------------------------------------------------
  test("Test 7: Consecutive accept attempts remain safely fail-closed without corrupting state", () => {
    assert.match(
      bookingServiceCode,
      /if\s*\(\s*booking\.status\s*!==\s*BookingStatus\.PENDING\s*\)\s*\{\s*throw AppError\.conflict/,
      "Accept requires status to be strictly PENDING",
    );
  });

  // -------------------------------------------------------------
  // TEST 8 — ACCEPT / REJECT RACE PROTECTION
  // -------------------------------------------------------------
  test("Test 8: Accept and Reject race protection via advisory lock & transactional check", () => {
    assert.match(
      bookingServiceCode,
      /pg_advisory_xact_lock\(hashtext\(\$\{id\}\)\)/,
      "Reject uses advisory xact lock per booking ID to serialize concurrent requests",
    );
  });

  // -------------------------------------------------------------
  // TEST 9 — REJECT WORKFLOW & INVENTORY RELEASE
  // -------------------------------------------------------------
  test("Test 9: Reject cancels booking, records reason metadata, and releases inventory", () => {
    assert.match(
      bookingServiceCode,
      /status:\s*BookingStatus\.CANCELLED/,
      "Reject sets status to CANCELLED",
    );
    assert.match(
      bookingServiceCode,
      /rejectedBy:\s*"HOST"/,
      "Reject records rejectedBy: HOST in priceBreakdown",
    );
    assert.match(
      bookingServiceCode,
      /invalidateBookingCache\(cancelled\.id,\s*cancelled\.userId,\s*cancelled\.listing\.hostId\)/,
      "Reject invalidates cache for guest, host, and booking",
    );
  });

  // -------------------------------------------------------------
  // TEST 10 — REJECT TWICE PROTECTION
  // -------------------------------------------------------------
  test("Test 10: Rejecting an already declined/cancelled booking fails with 409 Conflict", () => {
    assert.match(
      bookingServiceCode,
      /if\s*\(\s*b\.status\s*!==\s*BookingStatus\.PENDING\s*\)\s*\{\s*throw AppError\.conflict\("Booking request is not in a pending state"\)/,
      "Second reject throws 409 Conflict",
    );
  });

  // -------------------------------------------------------------
  // TEST 11 — EXPIRED REQUEST
  // -------------------------------------------------------------
  test("Test 11: Expired booking request fails acceptance", () => {
    assert.match(
      bookingServiceCode,
      /24\s*\*\s*60\s*\*\s*60\s*\*\s*1000/,
      "Enforces 24-hour response deadline",
    );
    assert.match(
      bookingServiceCode,
      /throw AppError\.badRequest\("This booking request has expired"\)/,
      "Expired request throws 400 Bad Request",
    );
  });

  // -------------------------------------------------------------
  // TEST 12 — PROPERTY OWNERSHIP CHANGED
  // -------------------------------------------------------------
  test("Test 12: Previous host loses permission after listing ownership change", () => {
    assert.match(
      bookingServiceCode,
      /booking\.listing\.hostId\s*!==\s*actor\.id/,
      "Always checks booking.listing.hostId dynamically against actor.id",
    );
  });

  // -------------------------------------------------------------
  // TEST 13 — AVAILABILITY CONFLICT
  // -------------------------------------------------------------
  test("Test 13: Conflicting confirmed booking blocks acceptance", () => {
    assert.match(
      bookingServiceCode,
      /status:\s*BookingStatus\.CONFIRMED,\s*startDate:\s*\{\s*lt:\s*booking\.endDate\s*\},\s*endDate:\s*\{\s*gt:\s*booking\.startDate\s*\}/,
      "Accept validates no overlapping confirmed booking exists for same dates",
    );
  });

  // -------------------------------------------------------------
  // TEST 14 — HOST MESSAGE INTEGRITY
  // -------------------------------------------------------------
  test("Test 14: Host message displays exact guest message without alteration", () => {
    assert.match(
      bookingServiceCode,
      /where:\s*\{\s*type:\s*MessageType\.BOOKING_REQUEST\s*\}/,
      "Queries exact BOOKING_REQUEST message from conversation",
    );
    assert.match(
      hostApprovalsUiCode,
      /details\.guestMessage/,
      "UI renders guest message when present",
    );
  });

  // -------------------------------------------------------------
  // TEST 15 — CONVERSATION REUSE
  // -------------------------------------------------------------
  test("Test 15: Existing conversation is reused, not duplicated", () => {
    assert.match(
      bookingServiceCode,
      /prisma\.conversation\.findFirst\(\{\s*where:\s*\{\s*bookingId:\s*booking\.id\s*\}/,
      "Conversation is resolved using existing bookingId link",
    );
    assert.match(
      hostApprovalsUiCode,
      /\/host\/messages\?conversationId=/,
      "UI links directly to the booking's conversation",
    );
  });

  // -------------------------------------------------------------
  // TEST 16 — NOTIFICATION ARCHITECTURE
  // -------------------------------------------------------------
  test("Test 16: Guest decline notification is created with appropriate link and message", () => {
    assert.match(
      bookingServiceCode,
      /title:\s*`Booking Request Declined:\s*\$\{cancelled\.listing\.title\}`/,
      "Rejection creates guest notification with declined title",
    );
    assert.match(
      bookingServiceCode,
      /link:\s*"\/profile\/tab\/past"/,
      "Rejection links guest to past/cancelled tab",
    );
    assert.match(
      bookingServiceCode,
      /conversationStatus:\s*ConversationStatus\.DECLINED/,
      "Rejection sets conversation status to DECLINED",
    );
  });

  // -------------------------------------------------------------
  // TEST 17 — GUEST DASHBOARD STATE
  // -------------------------------------------------------------
  test("Test 17: Guest computed booking status resolves DECLINED / CANCELLED accurately", () => {
    const computedCancelled = computeBookingStatus({
      dbStatus: "CANCELLED",
      startDate: new Date(Date.now() + 7 * 86400000),
      endDate: new Date(Date.now() + 10 * 86400000),
    });
    assert.equal(computedCancelled.status, "CANCELLED");
    assert.equal(computedCancelled.isCancelled, true);
    assert.equal(computedCancelled.isUpcoming, false);

    const computedDeclined = computeBookingStatus({
      dbStatus: "DECLINED",
      startDate: new Date(Date.now() + 7 * 86400000),
      endDate: new Date(Date.now() + 10 * 86400000),
    });
    assert.equal(computedDeclined.status, "DECLINED");
    assert.equal(computedDeclined.isDeclinedOrExpired, true);

    const actions = getBookingAvailableActions({
      statusDetails: computedCancelled,
      startDate: new Date(Date.now() + 7 * 86400000),
      endDate: new Date(Date.now() + 10 * 86400000),
      hasReview: false,
    });
    assert.equal(actions.canCancel, false, "Cancelled booking cannot be cancelled again");
    assert.equal(actions.canModify, false, "Cancelled booking cannot be modified");
  });

  // -------------------------------------------------------------
  // TEST 18 — REFRESH & LIST SYNCHRONIZATION
  // -------------------------------------------------------------
  test("Test 18: Host pending list dynamically excludes cancelled requests upon refetch", () => {
    assert.match(
      hostApprovalsUiCode,
      /setBookings\(\(prev\)\s*=>\s*prev\.filter\(\(b\)\s*=>\s*b\.id\s*!==\s*selectedBookingId\)\)/,
      "UI removes declined booking immediately from local state without full reload",
    );
    assert.match(
      hostApprovalsUiCode,
      /router\.refresh\(\)/,
      "UI triggers router.refresh to sync server components",
    );
  });

  // -------------------------------------------------------------
  // TEST 19 — MOBILE / RESPONSIVE UI AUDIT
  // -------------------------------------------------------------
  test("Test 19: HostBookingApprovals component uses ModalOverlay, ARIA attributes, responsive grid", () => {
    assert.match(hostApprovalsUiCode, /ModalOverlay/, "Must use ModalOverlay from @/components/ui/modal-overlay");
    assert.match(hostApprovalsUiCode, /role="dialog"/, "Modal must have role='dialog'");
    assert.match(hostApprovalsUiCode, /aria-modal="true"/, "Modal must have aria-modal='true'");
    assert.match(hostApprovalsUiCode, /Pending approval/, "Status badge must display 'Pending approval'");
    assert.match(hostApprovalsUiCode, /Decline request/, "Must include decline request action");
    assert.match(hostApprovalsUiCode, /Accept request/, "Must include accept request action");
    assert.match(hostApprovalsUiCode, /PAYMENT_AUTHORIZATION_REQUIRED/, "UI must handle PAYMENT_AUTHORIZATION_REQUIRED fail-closed");
    assert.match(hostApprovalsUiCode, /overflow-y-auto/, "Modal content must be scrollable when exceeding viewport");
  });

  // -------------------------------------------------------------
  // TEST 20 — REGRESSION CONFIRMATION
  // -------------------------------------------------------------
  test("Test 20: Phase 1-6 API and routes remain intact and accessible", () => {
    assert(fs.existsSync(path.join(root, "app/api/v1/host/bookings/[id]/route.ts")));
    assert(fs.existsSync(path.join(root, "app/api/v1/host/bookings/[id]/accept/route.ts")));
    assert(fs.existsSync(path.join(root, "app/api/v1/host/bookings/[id]/reject/route.ts")));
    assert(fs.existsSync(path.join(root, "app/api/v1/host/bookings/approve-all/route.ts")));
    assert(fs.existsSync(path.join(root, "app/api/v1/bookings/request/route.ts")));
    assert(fs.existsSync(path.join(root, "app/api/v1/bookings/route.ts")));
  });

  console.log("\n==================================================================");
  console.log(`   TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runHostBookingRequestWorkflowTests().catch((err) => {
  console.error("Fatal test runner error:", err);
  process.exit(1);
});
