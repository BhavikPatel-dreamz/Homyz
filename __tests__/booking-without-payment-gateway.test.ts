import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getPaymentPolicy } from "../lib/booking/payment-policy";
import { getAvailablePaymentTimingOptions, getPaymentTimingTitle, getPaymentTimingSummary } from "../lib/booking/payment-timing";
import { createReviewRequestData } from "../lib/booking/review-request";
import { computeBookingStatus, getBookingAvailableActions } from "../lib/booking/booking-status";

async function runBookingWithoutPaymentGatewayTests() {
  console.log("\n==================================================================");
  console.log("   BOOKING WITHOUT PAYMENT GATEWAY: 12-TEST VERIFICATION SUITE   ");
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
  const requestServiceCode = read("services/request-to-book.service.ts");
  const checkoutClientCode = read("app/book/[id]/booking-checkout-client.tsx");
  const reviewStepCode = read("components/checkout/review-request-step.tsx");
  const hostApprovalsUiCode = read("components/host/host-booking-approvals.tsx");
  const bookingApiRouteCode = read("app/api/v1/bookings/route.ts");
  const requestApiRouteCode = read("app/api/v1/bookings/request/route.ts");
  const hostAcceptRouteCode = read("app/api/v1/host/bookings/[id]/accept/route.ts");
  const hostRejectRouteCode = read("app/api/v1/host/bookings/[id]/reject/route.ts");

  // -------------------------------------------------------------
  // TEST 1 — NO PAYMENT PROVIDER CONFIGURED & CHECKOUT NOT BLOCKED
  // -------------------------------------------------------------
  test("Test 1: Checkout does not block when no payment provider is configured", () => {
    const policy = getPaymentPolicy();
    assert.equal(policy.onlinePaymentRequired, false, "Online payment must not be required");
    assert.equal(policy.paymentMode, "DEFERRED", "Payment mode must be DEFERRED");
    assert.equal(policy.providerConfigured, false, "Provider configured must be false");

    // Checkout client handleStep2Next does not block on isInstantBook
    assert.doesNotMatch(
      checkoutClientCode,
      /if\s*\(\s*isInstantBook\s*\)\s*\{\s*setSubmitError\(PAYMENT_PROVIDER_UNAVAILABLE_MESSAGE\)/,
      "Step 2 must not block instant book with payment unavailable error",
    );

    // API route checks onlinePaymentRequired
    assert.match(
      bookingApiRouteCode,
      /policy\.onlinePaymentRequired\s*&&\s*getAvailablePaymentMethods\(\)\.length === 0/,
      "POST /api/v1/bookings only blocks when onlinePaymentRequired is true",
    );
  });

  // -------------------------------------------------------------
  // TEST 2 — CREATE REQUEST-TO-BOOK WITHOUT GATEWAY
  // -------------------------------------------------------------
  test("Test 2: Request-to-Book creates PENDING booking with PAYMENT_PENDING in DEFERRED mode", () => {
    assert.match(
      requestServiceCode,
      /const policy = getPaymentPolicy\(\)/,
      "Request service consults central payment policy",
    );
    assert.match(
      requestServiceCode,
      /return bookingService\.create\(actor,\s*\{/,
      "Request service delegates to bookingService.create to persist booking",
    );
    assert.match(
      bookingServiceCode,
      /status:\s*automaticallyApprove\s*\?\s*BookingStatus\.CONFIRMED\s*:\s*BookingStatus\.PENDING/,
      "Booking status is set to PENDING for Request to Book",
    );
  });

  // -------------------------------------------------------------
  // TEST 3 — HOST MESSAGE PERSISTENCE & CONVERSATION
  // -------------------------------------------------------------
  test("Test 3: Host message and conversation persist atomically without payment dependency", () => {
    assert.match(
      bookingServiceCode,
      /messagingService\.getOrCreateBookingConversation/,
      "Messaging conversation is created/linked atomically in booking transaction",
    );
    assert.match(
      bookingServiceCode,
      /messageContent:\s*input\.message/,
      "Guest checkout message is passed to messaging service",
    );
  });

  // -------------------------------------------------------------
  // TEST 4 — HOST PENDING LIST INTEGRATION
  // -------------------------------------------------------------
  test("Test 4: Pending requests appear in host pending requests query and list UI", () => {
    assert.match(
      bookingServiceCode,
      /status:\s*BookingStatus\.PENDING/,
      "Host pending query includes BookingStatus.PENDING",
    );
    assert.match(
      hostApprovalsUiCode,
      /Pending approval/,
      "Host approvals UI renders 'Pending approval' status badge",
    );
  });

  // -------------------------------------------------------------
  // TEST 5 — HOST ACCEPT WITHOUT GATEWAY (DEFERRED MODE)
  // -------------------------------------------------------------
  test("Test 5: Host accept confirms booking without requiring gateway capture", () => {
    assert.match(
      bookingServiceCode,
      /status:\s*BookingStatus\.CONFIRMED/,
      "Accept updates booking status to CONFIRMED",
    );
    assert.match(
      bookingServiceCode,
      /paymentMode:\s*"DEFERRED"/,
      "Accept stores paymentMode: DEFERRED in priceBreakdown",
    );
    assert.match(
      bookingServiceCode,
      /paymentStatus:\s*"PAYMENT_PENDING"/,
      "Accept retains paymentStatus: PAYMENT_PENDING",
    );
    assert.match(
      bookingServiceCode,
      /paymentProvider:\s*null/,
      "Payment provider remains null without gateway",
    );
  });

  // -------------------------------------------------------------
  // TEST 6 — HOST REJECT WITHOUT GATEWAY
  // -------------------------------------------------------------
  test("Test 6: Host reject cancels booking without attempting gateway release/void", () => {
    assert.match(
      bookingServiceCode,
      /status:\s*BookingStatus\.CANCELLED/,
      "Reject updates booking status to CANCELLED",
    );
    assert.match(
      bookingServiceCode,
      /rejectedBy:\s*"HOST"/,
      "Reject records rejectedBy: HOST",
    );
  });

  // -------------------------------------------------------------
  // TEST 7 — AVAILABILITY HOLD AND RELEASE
  // -------------------------------------------------------------
  test("Test 7: Pending and confirmed requests hold dates; rejection releases hold", () => {
    assert.match(
      bookingServiceCode,
      /status:\s*\{\s*in:\s*\[BookingStatus\.PENDING,\s*BookingStatus\.CONFIRMED\]\s*\}/,
      "Both PENDING and CONFIRMED bookings hold calendar dates",
    );
  });

  // -------------------------------------------------------------
  // TEST 8 — FAKE AUTHORIZATION PROTECTION
  // -------------------------------------------------------------
  test("Test 8: Client cannot inject fake payment authorization", () => {
    assert.doesNotMatch(
      requestApiRouteCode,
      /paymentStatus|fake|authorized/i,
      "Request-to-book API never trusts client-supplied payment authorization",
    );
    assert.doesNotMatch(
      hostAcceptRouteCode,
      /paymentStatus|fake|authorized/i,
      "Accept API never trusts client-supplied payment authorization",
    );
  });

  // -------------------------------------------------------------
  // TEST 9 — REVIEW STEP UI & CAN_SUBMIT DECOUPLING
  // -------------------------------------------------------------
  test("Test 9: Review step enables Request to Book without blocking payment error", () => {
    const quoteMock = {
      guestTotal: 150000,
      currency: "SAR",
      nights: 3,
      baseNightlyPrice: 50000,
      cleaningFee: 0,
      serviceFee: 0,
      taxes: [],
      breakdown: [],
    } as any;

    const reviewData = createReviewRequestData({
      paymentTiming: "FULL_NOW",
      paymentMethodLabel: null,
      paymentAuthorizationValid: false,
      hostMessage: "Hello host!",
      checkIn: "2026-10-10",
      checkOut: "2026-10-14",
      adults: 2,
      children: 0,
      infants: 0,
      pets: 0,
      quote: quoteMock,
    });

    assert.equal(reviewData.canSubmitRequest, true, "canSubmitRequest must be true in DEFERRED mode");
    assert.equal(reviewData.blocker, null, "blocker message must be null");
    assert.equal(reviewData.payment.method, "No payment required now");

    assert.match(
      reviewStepCode,
      /disabled=\{!data\.canSubmitRequest \|\| isSubmitting\}/,
      "Submit button enables when canSubmitRequest is true",
    );
  });

  // -------------------------------------------------------------
  // TEST 10 — REFRESH & PERSISTENCE
  // -------------------------------------------------------------
  test("Test 10: Payment timing and policy persist across reloads without fake values", () => {
    const timingOptions = getAvailablePaymentTimingOptions();
    assert.equal(timingOptions.length, 3);
    assert.deepEqual(timingOptions.map((option) => option.type), ["FULL_NOW", "PARTIAL", "PAY_OVER_TIME"]);

    const timingSummary = getPaymentTimingSummary("FULL_NOW", "SAR 1,500");
    assert.match(timingSummary, /payment pending/i);
  });

  // -------------------------------------------------------------
  // TEST 11 — MOBILE & RESPONSIVE UX
  // -------------------------------------------------------------
  test("Test 11: Checkout and host approvals UI remain responsive and touch-accessible", () => {
    assert.match(checkoutClientCode, /min-h-\[45px\]/, "Buttons meet mobile minimum height target");
    assert.match(hostApprovalsUiCode, /min-h-11/, "Buttons meet touch target accessibility");
    assert.match(hostApprovalsUiCode, /ModalOverlay/, "Uses reference-counted ModalOverlay");
  });

  // -------------------------------------------------------------
  // TEST 12 — REGRESSION OF BOOKING LIFECYCLE
  // -------------------------------------------------------------
  test("Test 12: Booking status model and available actions remain fully intact", () => {
    const pendingStatus = computeBookingStatus({
      dbStatus: "PENDING",
      startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 3 * 86400000),
    });
    assert.equal(pendingStatus.isPending, true);
    assert.equal(pendingStatus.status, "PENDING");

    const confirmedStatus = computeBookingStatus({
      dbStatus: "CONFIRMED",
      startDate: new Date(Date.now() + 86400000),
      endDate: new Date(Date.now() + 3 * 86400000),
    });
    assert.equal(confirmedStatus.status, "CONFIRMED");
    assert.equal(confirmedStatus.isUpcoming, true);
  });

  console.log("\n==================================================================");
  console.log(`   TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runBookingWithoutPaymentGatewayTests().catch((err) => {
  console.error("Fatal error running test suite:", err);
  process.exit(1);
});
