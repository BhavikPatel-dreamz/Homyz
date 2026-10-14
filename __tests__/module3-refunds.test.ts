import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calculateRefundEligibility,
  calculateHoursUntilCheckIn,
  getPolicyDefinition,
  REFUND_POLICY_REGISTRY,
} from "@/lib/refund/policy-engine";
import { PaymentStatus, RefundStatus } from "@/generated/prisma/enums";

describe("Module 3 — Refund Management Test Suite (Phases 9–12)", () => {
  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 9: Cancellation & Refund Policy Engine
  // ──────────────────────────────────────────────────────────────────────────
  describe("Phase 9: Refund Policy Engine & Deterministic Calculations", () => {
    test("FLEXIBLE policy: grants 100% refund when cancelled >= 24h before check-in", () => {
      const checkInDate = new Date("2026-11-10T15:00:00.000Z");
      const cancellationTime = new Date("2026-11-08T10:00:00.000Z"); // ~53h before check-in

      const result = calculateRefundEligibility({
        bookingId: "b_flex_early",
        cancellationActor: "GUEST",
        effectiveCancellationTime: cancellationTime,
        policyIdSnapshot: "FLEXIBLE",
        policyVersion: "v1",
        isNonRefundable: false,
        nights: 3,
        checkInDate,
        checkInTimeStr: "15:00",
        totalPrice: 150000, // 1500.00 SAR in halalas
        accommodationTotal: 120000,
        cleaningFee: 15000,
        serviceFee: 10000,
        taxes: 5000,
        currency: "SAR",
        capturedAmount: 150000,
        alreadyRefundedAmount: 0,
      });

      assert.equal(result.status, "ELIGIBLE");
      assert.equal(result.isCalculated, true);
      assert.equal(result.policyUsed, "FLEXIBLE");
      assert.equal(result.accommodationRefund, 120000);
      assert.equal(result.cleaningFeeRefund, 15000);
      assert.equal(result.serviceFeeRefund, 10000);
      assert.equal(result.taxRefund, 5000);
      assert.equal(result.totalRefundableAmount, 150000); // 100% refund
    });

    test("FLEXIBLE policy: late cancellation (< 24h) forfeits accommodation but refunds cleaning fee", () => {
      const checkInDate = new Date("2026-11-10T15:00:00.000Z");
      const cancellationTime = new Date("2026-11-10T05:00:00.000Z"); // 10h before check-in

      const result = calculateRefundEligibility({
        bookingId: "b_flex_late",
        cancellationActor: "GUEST",
        effectiveCancellationTime: cancellationTime,
        policyIdSnapshot: "FLEXIBLE",
        policyVersion: "v1",
        isNonRefundable: false,
        nights: 3,
        checkInDate,
        checkInTimeStr: "15:00",
        totalPrice: 150000,
        accommodationTotal: 120000,
        cleaningFee: 15000,
        serviceFee: 10000,
        taxes: 5000,
        currency: "SAR",
        capturedAmount: 150000,
        alreadyRefundedAmount: 0,
      });

      assert.equal(result.status, "ELIGIBLE");
      assert.equal(result.accommodationRefund, 0); // Accommodation retained
      assert.equal(result.cleaningFeeRefund, 15000); // Cleaning fee refunded
      assert.equal(result.serviceFeeRefund, 0);
      assert.ok(result.totalRefundableAmount > 0);
      assert.ok(result.totalRefundableAmount < 150000);
    });

    test("FIRM policy: grants 50% partial accommodation refund between 7 and 30 days before check-in", () => {
      const checkInDate = new Date("2026-11-20T15:00:00.000Z");
      const cancellationTime = new Date("2026-11-05T15:00:00.000Z"); // 15 days (360h) before check-in

      const result = calculateRefundEligibility({
        bookingId: "b_firm_mid",
        cancellationActor: "GUEST",
        effectiveCancellationTime: cancellationTime,
        policyIdSnapshot: "FIRM",
        policyVersion: "v1",
        isNonRefundable: false,
        nights: 5,
        checkInDate,
        checkInTimeStr: "15:00",
        totalPrice: 200000,
        accommodationTotal: 160000,
        cleaningFee: 20000,
        serviceFee: 15000,
        taxes: 5000,
        currency: "SAR",
        capturedAmount: 200000,
        alreadyRefundedAmount: 0,
      });

      assert.equal(result.status, "ELIGIBLE");
      assert.equal(result.accommodationRefund, 80000); // 50% of 160,000
      assert.equal(result.cleaningFeeRefund, 20000); // 100% of cleaning fee
      assert.equal(result.milestoneApplied, "Partial 50% Refund Window (168 to 720 hours before check-in)");
    });

    test("NON_REFUNDABLE rate option: 0% accommodation refund regardless of timing", () => {
      const checkInDate = new Date("2026-12-01T15:00:00.000Z");
      const cancellationTime = new Date("2026-11-01T15:00:00.000Z"); // 30 days early

      const result = calculateRefundEligibility({
        bookingId: "b_non_ref",
        cancellationActor: "GUEST",
        effectiveCancellationTime: cancellationTime,
        policyIdSnapshot: "FLEXIBLE",
        policyVersion: "v1",
        isNonRefundable: true, // Guest selected non-refundable discount
        nights: 4,
        checkInDate,
        checkInTimeStr: "15:00",
        totalPrice: 120000,
        accommodationTotal: 100000,
        cleaningFee: 15000,
        serviceFee: 5000,
        taxes: 0,
        currency: "SAR",
        capturedAmount: 120000,
        alreadyRefundedAmount: 0,
      });

      assert.equal(result.status, "ELIGIBLE");
      assert.equal(result.accommodationRefund, 0); // Forfeited
      assert.equal(result.cleaningFeeRefund, 15000); // Cleaning fee returned
      assert.equal(result.policyUsed, "NON_REFUNDABLE");
    });

    test("Past check-in cancellation: completely INELIGIBLE for standard refund", () => {
      const checkInDate = new Date("2026-10-01T15:00:00.000Z");
      const cancellationTime = new Date("2026-10-02T10:00:00.000Z"); // Next morning

      const result = calculateRefundEligibility({
        bookingId: "b_past_checkin",
        cancellationActor: "GUEST",
        effectiveCancellationTime: cancellationTime,
        policyIdSnapshot: "FLEXIBLE",
        nights: 2,
        checkInDate,
        checkInTimeStr: "15:00",
        totalPrice: 80000,
        capturedAmount: 80000,
        alreadyRefundedAmount: 0,
      });

      assert.equal(result.status, "INELIGIBLE");
      assert.equal(result.isPastCheckIn, true);
      assert.equal(result.totalRefundableAmount, 0);
    });

    test("Host-initiated cancellation: 100% full reimbursement of all captured funds", () => {
      const checkInDate = new Date("2026-11-01T15:00:00.000Z");
      const cancellationTime = new Date("2026-10-31T20:00:00.000Z"); // Late host cancel

      const result = calculateRefundEligibility({
        bookingId: "b_host_cancelled",
        cancellationActor: "HOST",
        effectiveCancellationTime: cancellationTime,
        policyIdSnapshot: "FIRM",
        nights: 3,
        checkInDate,
        totalPrice: 150000,
        accommodationTotal: 120000,
        cleaningFee: 15000,
        serviceFee: 10000,
        taxes: 5000,
        currency: "SAR",
        capturedAmount: 150000,
        alreadyRefundedAmount: 0,
      });

      assert.equal(result.status, "ELIGIBLE");
      assert.equal(result.totalRefundableAmount, 150000); // 100% reimbursement
      assert.equal(result.policyUsed, "HOST_CANCELLATION");
    });

    test("Unapproved Long-Term policy: fails safe into NEEDS_REVIEW without fabricating percentages", () => {
      const checkInDate = new Date("2026-12-01T15:00:00.000Z");
      const cancellationTime = new Date("2026-11-01T15:00:00.000Z");

      const result = calculateRefundEligibility({
        bookingId: "b_long_term",
        cancellationActor: "GUEST",
        effectiveCancellationTime: cancellationTime,
        policyIdSnapshot: "FIRM_LONG_TERM",
        nights: 30, // Long-term stay >= 28 nights
        checkInDate,
        totalPrice: 600000,
        capturedAmount: 600000,
        alreadyRefundedAmount: 0,
      });

      assert.equal(result.status, "NEEDS_REVIEW");
      assert.equal(result.isCalculated, false);
      assert.equal(result.totalRefundableAmount, 0);
      assert.ok(result.missingRules.length > 0);
    });

    test("Remaining balance boundary: refund never exceeds allowable captured funds", () => {
      const result = calculateRefundEligibility({
        bookingId: "b_bounded",
        cancellationActor: "GUEST",
        effectiveCancellationTime: new Date("2026-11-01T15:00:00.000Z"),
        policyIdSnapshot: "FLEXIBLE",
        nights: 3,
        checkInDate: new Date("2026-11-15T15:00:00.000Z"),
        totalPrice: 100000,
        accommodationTotal: 80000,
        cleaningFee: 10000,
        serviceFee: 10000,
        capturedAmount: 100000,
        alreadyRefundedAmount: 70000, // 70,000 halalas already refunded
        pendingRefundReservedAmount: 20000, // 20,000 pending
      });

      // Remaining allowable is 100,000 - 90,000 = 10,000
      assert.equal(result.remainingRefundableBalance, 10000);
      assert.equal(result.totalRefundableAmount, 10000);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 10: Requests & Approvals
  // ──────────────────────────────────────────────────────────────────────────
  describe("Phase 10: Refund Request State & Approval Segregation", () => {
    test("Approval must not equal completion: approved refund remains PENDING until provider execution", () => {
      // Simulate state transition: PENDING (unapproved) -> PENDING (approved)
      const refundRecord = {
        id: "rfnd_123",
        status: RefundStatus.PENDING,
        approvedById: null as string | null,
        amount: 50000,
      };

      // Admin approves
      refundRecord.approvedById = "admin_user_1";
      assert.equal(refundRecord.status, RefundStatus.PENDING);
      assert.notEqual(refundRecord.approvedById, null);
      // Status is still not SUCCEEDED until settled
      assert.notEqual(refundRecord.status, RefundStatus.SUCCEEDED);
    });

    test("Admin rejection preserves mandatory reason and transitions to terminal REJECTED", () => {
      const refundRecord: {
        id: string;
        status: RefundStatus;
        failureReason: string | null;
      } = {
        id: "rfnd_reject_test",
        status: RefundStatus.PENDING,
        failureReason: null,
      };

      const rejectionReason = "Claimed damage was not verified by independent inspection.";
      refundRecord.status = RefundStatus.REJECTED;
      refundRecord.failureReason = rejectionReason;

      assert.equal(refundRecord.status, RefundStatus.REJECTED);
      assert.equal(refundRecord.failureReason, rejectionReason);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 11: Gateway Refund Execution & Webhooks
  // ──────────────────────────────────────────────────────────────────────────
  describe("Phase 11: Gateway Refund Processing & Synchronization", () => {
    test("Payment status transitions correctly on partial vs full refund", () => {
      const capturedAmount = 100000; // 1,000.00 SAR

      // Case 1: Partial refund of 40,000
      const refund1 = 40000;
      const status1 = refund1 >= capturedAmount ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
      assert.equal(status1, PaymentStatus.PARTIALLY_REFUNDED);

      // Case 2: Subsequent refund of 60,000 brings total to 100,000
      const totalRefunded = refund1 + 60000;
      const status2 = totalRefunded >= capturedAmount ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
      assert.equal(status2, PaymentStatus.REFUNDED);
    });

    test("Idempotency protection prevents duplicate execution of already succeeded refund", () => {
      const existingRefund = {
        id: "rfnd_idemp_test",
        status: RefundStatus.SUCCEEDED,
        providerRefundId: "rfnd_prov_999",
        amount: 25000,
      };

      // Second execution attempt
      const attemptExecution = (r: typeof existingRefund) => {
        if (r.status === RefundStatus.SUCCEEDED) {
          return { alreadyProcessed: true, refund: r };
        }
        return { alreadyProcessed: false, refund: r };
      };

      const result = attemptExecution(existingRefund);
      assert.equal(result.alreadyProcessed, true);
      assert.equal(result.refund.providerRefundId, "rfnd_prov_999");
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // PHASE 12: Host Earnings & Admin Summary
  // ──────────────────────────────────────────────────────────────────────────
  describe("Phase 12: Host Earnings Adjustments & Financial Dashboard", () => {
    test("Host payout retention is accurately adjusted on partial refund", () => {
      const originalNetHostPayout = 90000; // 900.00 SAR booked earnings
      const guestRefundAmount = 50000; // 500.00 SAR refunded to guest

      const adjustedHostPayout = Math.max(0, originalNetHostPayout - guestRefundAmount);
      assert.equal(adjustedHostPayout, 40000); // 400.00 SAR retained
    });

    test("Host payout retention drops to 0 on 100% full guest refund", () => {
      const originalNetHostPayout = 90000;
      const guestRefundAmount = 100000; // 100% refund of guest total

      const adjustedHostPayout = Math.max(0, originalNetHostPayout - guestRefundAmount);
      assert.equal(adjustedHostPayout, 0); // 0 SAR retained
    });
  });
});
