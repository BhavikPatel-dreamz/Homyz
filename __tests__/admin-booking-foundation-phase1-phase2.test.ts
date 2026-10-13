import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  BOOKING_LIFECYCLE_STATUSES,
  PAYMENT_LIFECYCLE_STATUSES,
  REFUND_LIFECYCLE_STATUSES,
  validateBookingTransition,
  validatePaymentTransition,
  canCapturePayment,
  canReleasePaymentAuthorization,
  validateRefundEligibility,
  sanitizeListingSecrets,
} from "../lib/booking/booking-lifecycle";
import { PERMISSIONS, hasPermission, assertPermission } from "../lib/permissions/permissions";
import { Role } from "../generated/prisma/enums";
import type { AuthUser } from "../lib/auth/types";
import {
  getAuthoritativeExpiryDate,
  isBookingRequestExpired,
  isHoldActive,
} from "../lib/booking/booking-expiry";
import { validateStayAvailability } from "../lib/booking/availability";

async function runAdminBookingFoundationTests() {
  console.log("\n==================================================================");
  console.log("   ADMIN BOOKING & REFUND FOUNDATION (PHASE 1 + 2) TEST SUITE     ");
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

  // -------------------------------------------------------------
  // TEST GROUP 1: BOOKING LIFECYCLE & STATE MACHINE (Task 2.1 & 2.2)
  // -------------------------------------------------------------
  test("1.1: Standardized lifecycle states are comprehensively defined", () => {
    assert(BOOKING_LIFECYCLE_STATUSES.includes("PENDING"));
    assert(BOOKING_LIFECYCLE_STATUSES.includes("CONFIRMED"));
    assert(BOOKING_LIFECYCLE_STATUSES.includes("CANCELLED"));
    assert(BOOKING_LIFECYCLE_STATUSES.includes("DECLINED"));
    assert(BOOKING_LIFECYCLE_STATUSES.includes("EXPIRED"));
    assert(BOOKING_LIFECYCLE_STATUSES.includes("COMPLETED"));

    assert(PAYMENT_LIFECYCLE_STATUSES.includes("PENDING"));
    assert(PAYMENT_LIFECYCLE_STATUSES.includes("AUTHORIZED"));
    assert(PAYMENT_LIFECYCLE_STATUSES.includes("CAPTURED"));
    assert(PAYMENT_LIFECYCLE_STATUSES.includes("PARTIALLY_REFUNDED"));
    assert(PAYMENT_LIFECYCLE_STATUSES.includes("REFUNDED"));

    assert(REFUND_LIFECYCLE_STATUSES.includes("NONE"));
    assert(REFUND_LIFECYCLE_STATUSES.includes("REQUESTED"));
    assert(REFUND_LIFECYCLE_STATUSES.includes("APPROVED"));
    assert(REFUND_LIFECYCLE_STATUSES.includes("PROCESSING"));
    assert(REFUND_LIFECYCLE_STATUSES.includes("SUCCEEDED"));
    assert(REFUND_LIFECYCLE_STATUSES.includes("FAILED"));
  });

  test("1.2: Valid status transitions succeed and invalid transitions fail", () => {
    // Valid transitions
    assert.equal(validateBookingTransition("DRAFT", "PENDING").valid, true);
    assert.equal(validateBookingTransition("PENDING", "CONFIRMED").valid, true);
    assert.equal(validateBookingTransition("PENDING", "DECLINED").valid, true);
    assert.equal(validateBookingTransition("PENDING", "EXPIRED").valid, true);
    assert.equal(validateBookingTransition("CONFIRMED", "CANCELLED").valid, true);
    assert.equal(validateBookingTransition("CONFIRMED", "COMPLETED").valid, true);

    // Invalid transitions (Terminal jumps or backwards)
    assert.equal(validateBookingTransition("CANCELLED", "CONFIRMED").valid, false);
    assert.equal(validateBookingTransition("EXPIRED", "CONFIRMED").valid, false);
    assert.equal(validateBookingTransition("DECLINED", "CONFIRMED").valid, false);
    assert.equal(validateBookingTransition("COMPLETED", "PENDING").valid, false);
    assert.equal(validateBookingTransition("DRAFT", "COMPLETED").valid, false);
  });

  test("1.3: Payment capture guards require confirmed booking and reject duplicate capture", () => {
    assert.equal(canCapturePayment("CONFIRMED", "AUTHORIZED").allowed, true);
    assert.equal(canCapturePayment("CONFIRMED", "PENDING").allowed, true);
    assert.equal(canCapturePayment("PENDING", "AUTHORIZED").allowed, false, "Cannot capture unconfirmed booking");
    assert.equal(canCapturePayment("CONFIRMED", "CAPTURED").allowed, false, "Cannot double capture");
    assert.equal(canCapturePayment("CANCELLED", "AUTHORIZED").allowed, false, "Cannot capture cancelled booking");
  });

  test("1.4: Payment authorization release guards enforce terminal booking states", () => {
    assert.equal(canReleasePaymentAuthorization("CANCELLED", "AUTHORIZED").allowed, true);
    assert.equal(canReleasePaymentAuthorization("DECLINED", "AUTHORIZED").allowed, true);
    assert.equal(canReleasePaymentAuthorization("EXPIRED", "AUTHORIZED").allowed, true);
    assert.equal(canReleasePaymentAuthorization("CONFIRMED", "AUTHORIZED").allowed, false, "Cannot release active confirmed booking");
    assert.equal(canReleasePaymentAuthorization("CANCELLED", "CAPTURED").allowed, false, "Cannot release captured payment");
  });

  test("1.5: Refund eligibility enforces non-exceedance of captured funds without float errors", () => {
    // Exactly 10000 cents ($100) captured, 0 refunded, request 5000 cents ($50)
    const valid1 = validateRefundEligibility({
      paymentStatus: "CAPTURED",
      capturedAmount: 10000,
      alreadyRefundedAmount: 0,
      requestedRefundAmount: 5000,
    });
    assert.equal(valid1.eligible, true);
    assert.equal(valid1.maxRefundableAmount, 10000);

    // Partial refund already 4000 cents, requesting remaining 6000 cents
    const valid2 = validateRefundEligibility({
      paymentStatus: "PARTIALLY_REFUNDED",
      capturedAmount: 10000,
      alreadyRefundedAmount: 4000,
      requestedRefundAmount: 6000,
    });
    assert.equal(valid2.eligible, true);
    assert.equal(valid2.maxRefundableAmount, 6000);

    // Over-refund attempt: requesting 6001 cents when only 6000 cents available
    const invalidOver = validateRefundEligibility({
      paymentStatus: "PARTIALLY_REFUNDED",
      capturedAmount: 10000,
      alreadyRefundedAmount: 4000,
      requestedRefundAmount: 6001,
    });
    assert.equal(invalidOver.eligible, false);

    // Zero or negative refund attempt
    const invalidZero = validateRefundEligibility({
      paymentStatus: "CAPTURED",
      capturedAmount: 10000,
      alreadyRefundedAmount: 0,
      requestedRefundAmount: 0,
    });
    assert.equal(invalidZero.eligible, false);

    // Uncaptured payment refund attempt
    const invalidUncaptured = validateRefundEligibility({
      paymentStatus: "AUTHORIZED",
      capturedAmount: 10000,
      alreadyRefundedAmount: 0,
      requestedRefundAmount: 5000,
    });
    assert.equal(invalidUncaptured.eligible, false);
  });

  // -------------------------------------------------------------
  // TEST GROUP 2: SECURITY & PERMISSION TESTS (Task 1.7 & 2.8)
  // -------------------------------------------------------------
  test("2.1: Admin permissions system enforces RBAC and least privilege", () => {
    const adminUser: AuthUser = {
      id: "admin-1",
      email: "admin@homyz.internal",
      role: Role.ADMIN,
      name: "Admin User",
    };
    const hostUser: AuthUser = {
      id: "host-1",
      email: "host@homyz.internal",
      role: Role.HOST,
      name: "Host User",
    };
    const guestUser: AuthUser = {
      id: "guest-1",
      email: "guest@homyz.internal",
      role: Role.USER,
      name: "Guest User",
    };

    assert.equal(hasPermission(adminUser, PERMISSIONS.BOOKINGS_VIEW), true);
    assert.equal(hasPermission(hostUser, PERMISSIONS.BOOKINGS_VIEW), false);
    assert.equal(hasPermission(guestUser, PERMISSIONS.BOOKINGS_VIEW), false);
    assert.equal(hasPermission(hostUser, PERMISSIONS.PAYMENTS_REFUND), false);
    assert.equal(hasPermission(guestUser, PERMISSIONS.PAYMENTS_REFUND), false);

    assert.doesNotThrow(() => assertPermission(adminUser, PERMISSIONS.BOOKINGS_VIEW));
    assert.throws(() => assertPermission(hostUser, PERMISSIONS.BOOKINGS_VIEW), /Missing required permission/);
    assert.throws(() => assertPermission(guestUser, PERMISSIONS.PAYMENTS_REFUND), /Missing required permission/);
    assert.throws(() => assertPermission(null, PERMISSIONS.BOOKINGS_VIEW), /Authentication required/);
  });

  test("2.2: Sensitive arrival secrets are stripped from admin views", () => {
    const rawListing = {
      id: "list-1",
      title: "Luxury Beach Villa",
      address: "123 Coastal Way",
      wifiNetwork: "VillaGuest",
      wifiPassword: "SecretWifiPassword123!",
      doorCode: "9876",
      lockboxCode: "5432",
      city: "Jeddah",
      country: "Saudi Arabia",
    };

    const sanitized = sanitizeListingSecrets(rawListing);
    assert.equal((sanitized as any).wifiPassword, undefined);
    assert.equal((sanitized as any).doorCode, undefined);
    assert.equal((sanitized as any).lockboxCode, undefined);
    assert.equal(sanitized.title, "Luxury Beach Villa");
    assert.equal(sanitized.city, "Jeddah");
  });

  // -------------------------------------------------------------
  // TEST GROUP 3: REUSABLE ADMIN READ APIS (Task 2.9)
  // -------------------------------------------------------------
  test("3.1: Admin Booking Read API endpoints exist with proper guards", () => {
    const listRoute = read("app/api/v1/admin/bookings/route.ts");
    const summaryRoute = read("app/api/v1/admin/bookings/summary/route.ts");
    const detailRoute = read("app/api/v1/admin/bookings/[id]/route.ts");
    const activityRoute = read("app/api/v1/admin/bookings/[id]/activity/route.ts");

    assert.match(listRoute, /requireApiPermission\(req,\s*PERMISSIONS\.BOOKINGS_VIEW\)/);
    assert.match(listRoute, /bookingService\.listForAdmin/);
    assert.match(listRoute, /parsePagination/);
    assert.match(listRoute, /buildPagination/);

    assert.match(summaryRoute, /requireApiPermission\(req,\s*PERMISSIONS\.BOOKINGS_VIEW\)/);
    assert.match(summaryRoute, /bookingService\.getAdminBookingSummary/);

    assert.match(detailRoute, /requireApiPermission\(req,\s*PERMISSIONS\.BOOKINGS_VIEW\)/);
    assert.match(detailRoute, /bookingService\.getAdminBookingDetails/);

    assert.match(activityRoute, /requireApiPermission\(req,\s*\[[\s\S]*?PERMISSIONS\.BOOKINGS_VIEW[\s\S]*?PERMISSIONS\.ACTIVITY_LOGS_VIEW[\s\S]*?\]\)/);
    assert.match(activityRoute, /bookingService\.getAdminBookingActivity/);
  });

  test("3.2: Expire-stale endpoint is authenticated and protected", () => {
    const expireRoute = read("app/api/v1/bookings/expire-stale/route.ts");
    assert.match(expireRoute, /requireApiAuth\(req\)/, "expire-stale must require authentication");
    assert.match(expireRoute, /bookingService\.expireStaleBookingRequests/);
  });

  // -------------------------------------------------------------
  // TEST GROUP 4: DATABASE SCHEMA & MIGRATION READINESS (Task 2.3 & 2.7)
  // -------------------------------------------------------------
  test("4.1: Database schema includes BookingPayment, BookingRefund, and performance indexes", () => {
    const schema = read("prisma/schema.prisma");

    assert.match(schema, /model BookingPayment\s*\{/);
    assert.match(schema, /model BookingRefund\s*\{/);
    assert.match(schema, /enum PaymentStatus\s*\{/);
    assert.match(schema, /enum RefundStatus\s*\{/);

    // Foreign key RESTRICT rule protects financial history
    assert.match(schema, /booking\s+Booking\s+@relation\(fields:\s*\[bookingId\],\s*references:\s*\[id\],\s*onDelete:\s*Restrict\)/);

    // Performance indexes
    assert.match(schema, /@@index\(\[status\]\)/);
    assert.match(schema, /@@index\(\[status,\s*createdAt\]\)/);
    assert.match(schema, /@@index\(\[resourceType,\s*resourceId\]\)/);
  });

  test("4.2: SQL migration file is additive, backward-compatible, and uses RESTRICT constraints", () => {
    const migration = read("prisma/migrations/20261010140000_admin_booking_foundation/migration.sql");

    assert.match(migration, /CREATE TABLE IF NOT EXISTS "BookingPayment"/);
    assert.match(migration, /CREATE TABLE IF NOT EXISTS "BookingRefund"/);
    assert.match(migration, /CREATE TYPE "PaymentStatus"/);
    assert.match(migration, /CREATE TYPE "RefundStatus"/);
    assert.match(migration, /ON DELETE RESTRICT/);
    assert.match(migration, /CREATE INDEX IF NOT EXISTS "Booking_status_idx"/);
    assert.match(migration, /CREATE INDEX IF NOT EXISTS "AuditLog_resourceType_resourceId_idx"/);
  });

  // -------------------------------------------------------------
  // TEST GROUP 5: CENTRAL AUDIT LOGGING & CANCELLATION TRACEABILITY (Task 2.10)
  // -------------------------------------------------------------
  test("5.1: Booking service captures audit logs across all cancellation flows", () => {
    const bookingServiceCode = read("services/booking.service.ts");

    assert.match(
      bookingServiceCode,
      /action:\s*"BOOKING_CANCELLED_BY_GUEST"/,
      "Guest cancellation must record audit log",
    );
    assert.match(
      bookingServiceCode,
      /action:\s*"BOOKING_CANCELLED_BY_HOST"/,
      "Host cancellation must record audit log",
    );
    assert.match(
      bookingServiceCode,
      /action:\s*"BOOKING_REQUEST_CREATED"/,
      "Booking creation records audit log",
    );
    assert.match(
      bookingServiceCode,
      /action:\s*"BOOKING_REQUEST_ACCEPTED"/,
      "Acceptance records audit log",
    );
    assert.match(
      bookingServiceCode,
      /action:\s*"BOOKING_REQUEST_REJECTED"/,
      "Rejection records audit log",
    );
    assert.match(
      bookingServiceCode,
      /action:\s*"BOOKING_REQUEST_EXPIRED"/,
      "Expiry records audit log",
    );
  });

  // -------------------------------------------------------------
  // TEST GROUP 6: AVAILABILITY & HOLD INTEGRATION (Task 1.4 & 2.5)
  // -------------------------------------------------------------
  test("6.1: Active hold logic correctly releases expired and cancelled holds", () => {
    const now = new Date("2026-10-10T12:00:00.000Z");
    const freshCreated = new Date("2026-10-10T00:00:00.000Z"); // 12 hours ago
    const staleCreated = new Date("2026-10-08T00:00:00.000Z"); // 60 hours ago

    assert.equal(isHoldActive({ status: "CONFIRMED", createdAt: staleCreated }, now), true);
    assert.equal(isHoldActive({ status: "PENDING", createdAt: freshCreated }, now), true);
    assert.equal(isHoldActive({ status: "PENDING", createdAt: staleCreated }, now), false, "Stale pending does not hold inventory");
    assert.equal(isHoldActive({ status: "CANCELLED", createdAt: freshCreated }, now), false);
    assert.equal(isHoldActive({ status: "DECLINED", createdAt: freshCreated }, now), false);
  });

  console.log("\n==================================================================");
  console.log(`   TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runAdminBookingFoundationTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

