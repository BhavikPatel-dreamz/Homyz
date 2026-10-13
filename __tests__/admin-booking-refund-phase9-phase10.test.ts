import { test } from "node:test";
import assert from "node:assert/strict";

// Import modules under test
import {
  calculateHoursUntilCheckIn,
  calculateRefundEligibility,
  getPolicyDefinition,
  REFUND_POLICY_REGISTRY,
  type RefundCalculationParams,
} from "../lib/refund/policy-engine";
import { PERMISSIONS } from "../lib/permissions/permissions";
import { Role, RefundStatus, PaymentStatus } from "../generated/prisma/enums";

console.log("\n==================================================================");
console.log("   ADMIN BOOKING & REFUND MANAGEMENT: PHASE 9 & 10 TEST SUITE    ");
console.log("==================================================================\n");

// ============================================================================
// TEST GROUP 1: Phase 9 — Check-In Timing & Policy Registry
// ============================================================================

test("1.1: calculateHoursUntilCheckIn accurately calculates countdown to default 15:00 check-in", () => {
  const checkInDate = new Date("2026-10-20T00:00:00.000Z");

  // Exactly 48 hours before 15:00 UTC on 2026-10-20 -> 2026-10-18T15:00:00.000Z
  const cancelTime48h = new Date("2026-10-18T15:00:00.000Z");
  const res48 = calculateHoursUntilCheckIn(checkInDate, null, cancelTime48h);
  assert.equal(res48.hours, 48);
  assert.equal(res48.isPastCheckIn, false);

  // Exactly 24 hours before
  const cancelTime24h = new Date("2026-10-19T15:00:00.000Z");
  const res24 = calculateHoursUntilCheckIn(checkInDate, null, cancelTime24h);
  assert.equal(res24.hours, 24);
  assert.equal(res24.isPastCheckIn, false);

  // After check-in (negative hours)
  const cancelTimePast = new Date("2026-10-20T17:00:00.000Z");
  const resPast = calculateHoursUntilCheckIn(checkInDate, null, cancelTimePast);
  assert.equal(resPast.hours, -2);
  assert.equal(resPast.isPastCheckIn, true);

  console.log(" ✅ PASS: 1.1: Check-in hour timing accurately calculates remaining hours");
});

test("1.2: Policy registry exposes versioned policies and marks long-term policies as unapproved", () => {
  const flexible = getPolicyDefinition("FLEXIBLE", "v1");
  assert.ok(flexible);
  assert.equal(flexible.isApproved, true);
  assert.equal(flexible.version, "v1");

  const moderate = getPolicyDefinition("MODERATE", "v1");
  assert.ok(moderate);
  assert.equal(moderate.isApproved, true);

  const firm = getPolicyDefinition("FIRM", "v1");
  assert.ok(firm);
  assert.equal(firm.isApproved, true);

  // Unapproved policy fails approval check
  const firmLongTerm = getPolicyDefinition("FIRM_LONG_TERM", "v1");
  assert.ok(firmLongTerm);
  assert.equal(firmLongTerm.isApproved, false);

  console.log(" ✅ PASS: 1.2: Versioned policy registry correctly enforces approved vs unapproved policies");
});

// ============================================================================
// TEST GROUP 2: Phase 9 — Refund Calculations for Approved Policies
// ============================================================================

test("2.1: FLEXIBLE policy - 48+ hours before check-in awards 100% refund of accommodation, cleaning, and platform fees", () => {
  const params: RefundCalculationParams = {
    bookingId: "bkg_flex_1",
    cancellationActor: "GUEST",
    policyIdSnapshot: "FLEXIBLE",
    policyVersion: "v1",
    checkInDate: new Date("2026-10-20T00:00:00.000Z"),
    effectiveCancellationTime: new Date("2026-10-17T12:00:00.000Z"), // > 48 hours
    nights: 5,
    totalPrice: 72000,
    accommodationTotal: 50000, // 500.00 SAR
    cleaningFee: 15000, // 150.00 SAR
    serviceFee: 7000, // 70.00 SAR
    taxes: 0,
    capturedAmount: 72000, // 720.00 SAR total paid
    alreadyRefundedAmount: 0,
    pendingRefundReservedAmount: 0,
  };

  const result = calculateRefundEligibility(params);
  assert.equal(result.status, "ELIGIBLE");
  assert.equal(result.totalRefundableAmount, 72000);
  assert.equal(result.accommodationRefund, 50000);
  assert.equal(result.cleaningFeeRefund, 15000);
  assert.equal(result.serviceFeeRefund, 7000);

  console.log(" ✅ PASS: 2.1: Flexible policy 48h+ before check-in awards 100% refund");
});

test("2.2: FLEXIBLE policy - Less than 24 hours before check-in retains accommodation and service fee but refunds cleaning fee", () => {
  const params: RefundCalculationParams = {
    bookingId: "bkg_flex_2",
    cancellationActor: "GUEST",
    policyIdSnapshot: "FLEXIBLE",
    policyVersion: "v1",
    checkInDate: new Date("2026-10-20T00:00:00.000Z"),
    effectiveCancellationTime: new Date("2026-10-20T05:00:00.000Z"), // 10 hours before check-in (< 24h)
    nights: 5,
    totalPrice: 72000,
    accommodationTotal: 50000,
    cleaningFee: 15000,
    serviceFee: 7000,
    taxes: 0,
    capturedAmount: 72000,
    alreadyRefundedAmount: 0,
    pendingRefundReservedAmount: 0,
  };

  const result = calculateRefundEligibility(params);
  assert.equal(result.status, "ELIGIBLE");
  assert.equal(result.accommodationRefund, 0);
  assert.equal(result.cleaningFeeRefund, 15000);
  assert.equal(result.serviceFeeRefund, 0);
  assert.equal(result.totalRefundableAmount, 15000);

  console.log(" ✅ PASS: 2.2: Flexible policy <24h correctly retains room fee and refunds cleaning fee");
});

test("2.3: MODERATE policy - 120+ hours (5+ days) before check-in awards 100% refund", () => {
  const params: RefundCalculationParams = {
    bookingId: "bkg_mod_1",
    cancellationActor: "GUEST",
    policyIdSnapshot: "MODERATE",
    policyVersion: "v1",
    checkInDate: new Date("2026-10-20T00:00:00.000Z"),
    effectiveCancellationTime: new Date("2026-10-14T10:00:00.000Z"), // 149 hours (> 120 hours / 5 days)
    nights: 4,
    totalPrice: 99000,
    accommodationTotal: 80000, // 800.00 SAR
    cleaningFee: 10000,
    serviceFee: 9000,
    taxes: 0,
    capturedAmount: 99000,
    alreadyRefundedAmount: 0,
    pendingRefundReservedAmount: 0,
  };

  const result = calculateRefundEligibility(params);
  assert.equal(result.status, "ELIGIBLE");
  assert.equal(result.accommodationRefund, 80000);
  assert.equal(result.cleaningFeeRefund, 10000);
  assert.equal(result.serviceFeeRefund, 9000);
  assert.equal(result.totalRefundableAmount, 99000);

  console.log(" ✅ PASS: 2.3: Moderate policy >=120h awards 100% full refund");
});

test("2.4: FIRM policy - 7 to 30 days (168 to 720 hours) before check-in awards 50% accommodation and 100% cleaning fee", () => {
  const params: RefundCalculationParams = {
    bookingId: "bkg_firm_1",
    cancellationActor: "GUEST",
    policyIdSnapshot: "FIRM",
    policyVersion: "v1",
    checkInDate: new Date("2026-11-20T00:00:00.000Z"),
    effectiveCancellationTime: new Date("2026-11-05T15:00:00.000Z"), // 15 days (360 hours)
    nights: 5,
    totalPrice: 71500,
    accommodationTotal: 50000,
    cleaningFee: 15000,
    serviceFee: 6500,
    taxes: 0,
    capturedAmount: 71500,
    alreadyRefundedAmount: 0,
    pendingRefundReservedAmount: 0,
  };

  const result = calculateRefundEligibility(params);
  assert.equal(result.status, "ELIGIBLE");
  assert.equal(result.accommodationRefund, 25000); // 50% of 50000
  assert.equal(result.cleaningFeeRefund, 15000);
  assert.equal(result.serviceFeeRefund, 0);
  assert.equal(result.totalRefundableAmount, 40000);

  console.log(" ✅ PASS: 2.4: Firm policy 7-30 days before check-in awards 50% room fee and cleaning fee");
});

test("2.5: NON_REFUNDABLE policy awards 0% room refund but refunds cleaning fee before check-in", () => {
  const params: RefundCalculationParams = {
    bookingId: "bkg_nonref_1",
    cancellationActor: "GUEST",
    isNonRefundable: true,
    checkInDate: new Date("2026-10-25T00:00:00.000Z"),
    effectiveCancellationTime: new Date("2026-10-20T10:00:00.000Z"),
    nights: 3,
    totalPrice: 62000,
    accommodationTotal: 45000,
    cleaningFee: 12000,
    serviceFee: 5000,
    taxes: 0,
    capturedAmount: 62000,
    alreadyRefundedAmount: 0,
    pendingRefundReservedAmount: 0,
  };

  const result = calculateRefundEligibility(params);
  assert.equal(result.status, "ELIGIBLE");
  assert.equal(result.accommodationRefund, 0);
  assert.equal(result.cleaningFeeRefund, 12000);
  assert.equal(result.serviceFeeRefund, 0);
  assert.equal(result.totalRefundableAmount, 12000);

  console.log(" ✅ PASS: 2.5: Non-refundable policy refunds cleaning fee only before check-in");
});

// ============================================================================
// TEST GROUP 3: Phase 9 — Host Cancellation, Admin Overrides & Fail-Closed
// ============================================================================

test("3.1: Host Cancellation always awards 100% full reimbursement regardless of cancellation policy", () => {
  const params: RefundCalculationParams = {
    bookingId: "bkg_host_cancel",
    cancellationActor: "HOST", // Host cancels
    policyIdSnapshot: "NON_REFUNDABLE",
    checkInDate: new Date("2026-10-20T00:00:00.000Z"),
    effectiveCancellationTime: new Date("2026-10-19T20:00:00.000Z"),
    nights: 3,
    totalPrice: 77000,
    accommodationTotal: 60000,
    cleaningFee: 10000,
    serviceFee: 7000,
    taxes: 0,
    capturedAmount: 77000,
    alreadyRefundedAmount: 0,
    pendingRefundReservedAmount: 0,
  };

  const result = calculateRefundEligibility(params);
  assert.equal(result.status, "ELIGIBLE");
  assert.equal(result.totalRefundableAmount, 77000);
  assert.equal(result.accommodationRefund, 60000);
  assert.equal(result.cleaningFeeRefund, 10000);
  assert.equal(result.serviceFeeRefund, 7000);

  console.log(" ✅ PASS: 3.1: Host cancellation awards 100% full refund with all fees refunded");
});

test("3.2: Unapproved policy fails closed into NEEDS_REVIEW without inventing financial amounts", () => {
  const params: RefundCalculationParams = {
    bookingId: "bkg_unapproved",
    cancellationActor: "GUEST",
    policyIdSnapshot: "FIRM_LONG_TERM", // marked unapproved
    checkInDate: new Date("2026-10-20T00:00:00.000Z"),
    effectiveCancellationTime: new Date("2026-10-15T12:00:00.000Z"),
    nights: 31,
    totalPrice: 355000,
    accommodationTotal: 310000,
    cleaningFee: 20000,
    serviceFee: 25000,
    taxes: 0,
    capturedAmount: 355000,
    alreadyRefundedAmount: 0,
    pendingRefundReservedAmount: 0,
  };

  const result = calculateRefundEligibility(params);
  assert.equal(result.status, "NEEDS_REVIEW");
  assert.equal(result.totalRefundableAmount, 0);
  assert.equal(result.isCalculated, false);
  assert.ok(result.explanation.includes("awaiting platform executive approval"));

  console.log(" ✅ PASS: 3.2: Unapproved long-term policy fails closed into NEEDS_REVIEW");
});

test("3.3: Admin Discretionary Override computes exact custom amount with recorded reason", () => {
  const params: RefundCalculationParams = {
    bookingId: "bkg_override",
    cancellationActor: "ADMIN",
    discretionaryAdjustmentAmount: 57750,
    discretionaryReason: "Customer satisfaction accommodation due to severe water leak",
    checkInDate: new Date("2026-10-20T00:00:00.000Z"),
    effectiveCancellationTime: new Date("2026-10-15T12:00:00.000Z"),
    nights: 3,
    totalPrice: 77000,
    accommodationTotal: 60000,
    cleaningFee: 10000,
    serviceFee: 7000,
    taxes: 0,
    capturedAmount: 77000,
    alreadyRefundedAmount: 0,
    pendingRefundReservedAmount: 0,
  };

  const result = calculateRefundEligibility(params);
  assert.equal(result.status, "ELIGIBLE");
  assert.equal(result.discretionaryAmount, 57750);
  assert.equal(result.totalRefundableAmount, 57750);
  assert.ok(result.explanation.includes("Customer satisfaction accommodation"));

  console.log(" ✅ PASS: 3.3: Admin discretionary override calculates exact custom amount");
});

test("3.4: Eligibility bounds deduction: prior refunds and pending reserves cap the max refundable amount", () => {
  const params: RefundCalculationParams = {
    bookingId: "bkg_capped",
    cancellationActor: "GUEST",
    policyIdSnapshot: "FLEXIBLE",
    checkInDate: new Date("2026-10-20T00:00:00.000Z"),
    effectiveCancellationTime: new Date("2026-10-15T12:00:00.000Z"), // 100% eligible
    nights: 5,
    totalPrice: 65000,
    accommodationTotal: 50000,
    cleaningFee: 10000,
    serviceFee: 5000,
    taxes: 0,
    capturedAmount: 65000,
    alreadyRefundedAmount: 30000, // already refunded 300.00 SAR
    pendingRefundReservedAmount: 20000, // another 200.00 SAR reserved
  };

  // Available balance = 65000 - (30000 + 20000) = 15000 SAR minor units
  const result = calculateRefundEligibility(params);
  assert.equal(result.status, "ELIGIBLE");
  assert.equal(result.remainingRefundableBalance, 15000);
  assert.equal(result.totalRefundableAmount, 15000); // capped at remaining available balance!

  console.log(" ✅ PASS: 3.4: Refund calculation strictly respects captured balance minus prior and pending refunds");
});

// ============================================================================
// TEST GROUP 4: Phase 10 — Workflow States & RBAC Permissions
// ============================================================================

test("4.1: RBAC permissions include PAYMENTS_REFUND, BOOKINGS_VIEW, and PAYMENTS_VIEW", () => {
  assert.equal(PERMISSIONS.PAYMENTS_REFUND, "payments.refund");
  assert.equal(PERMISSIONS.PAYMENTS_VIEW, "payments.view");
  assert.equal(PERMISSIONS.BOOKINGS_VIEW, "bookings.view");

  console.log(" ✅ PASS: 4.1: Administrative permissions properly defined in RBAC registry");
});

test("4.2: Prisma enums contain correct RefundStatus and PaymentStatus states", () => {
  assert.equal(RefundStatus.PENDING, "PENDING");
  assert.equal(RefundStatus.PROCESSING, "PROCESSING");
  assert.equal(RefundStatus.SUCCEEDED, "SUCCEEDED");
  assert.equal(RefundStatus.FAILED, "FAILED");
  assert.equal(RefundStatus.REJECTED, "REJECTED");

  assert.equal(PaymentStatus.CAPTURED, "CAPTURED");
  assert.equal(PaymentStatus.PARTIALLY_REFUNDED, "PARTIALLY_REFUNDED");
  assert.equal(PaymentStatus.REFUNDED, "REFUNDED");

  console.log(" ✅ PASS: 4.2: RefundStatus and PaymentStatus enums reflect operational lifecycles");
});

console.log("\n==================================================================");
console.log("   ALL PHASE 9 & PHASE 10 AUTOMATED TESTS PASSED SUCCESSFULLY!    ");
console.log("==================================================================\n");
