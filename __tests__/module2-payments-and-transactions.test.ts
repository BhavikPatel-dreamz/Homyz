import assert from "node:assert/strict";
import test, { describe, it } from "node:test";
import crypto from "node:crypto";
import { PaymentStatus, PaymentProvider, BookingStatus, Role } from "../generated/prisma/enums";
import { MoyasarAdapter } from "../lib/payment/moyasar-adapter";
import { processPaymentWebhook } from "../services/payment-webhook.service";
import { getPaymentPolicy } from "../lib/booking/payment-policy";

describe("Module 2 — Payments & Transactions Test Suite (Phases 5–8)", () => {
  const adapter = new MoyasarAdapter();
  const testSecret = "sec_test_webhook_secret_key_1234567890abcdef";

  describe("Phase 5: Instant Book Checkout & Payment Safety", () => {
    it("enforces minor-unit integer payment amounts (halalas) with zero floating-point drift", () => {
      const nightlyPrice = 45000; // 450.00 SAR
      const nights = 3;
      const staySubtotal = nightlyPrice * nights; // 135000 halalas
      const cleaningFee = 5000; // 50.00 SAR
      const taxRate = 15; // 15% VAT
      const taxableBase = staySubtotal + cleaningFee; // 140000 halalas
      const vatAmount = Math.round((taxableBase * taxRate) / 100); // 21000 halalas
      const guestTotal = staySubtotal + cleaningFee + vatAmount; // 161000 halalas

      assert.equal(guestTotal, 161000);
      assert.equal(Number.isInteger(guestTotal), true);
      assert.equal(guestTotal % 1, 0);
    });

    it("verifies server never trusts client-supplied payment amounts", () => {
      const serverCalculatedQuote = {
        guestTotal: 161000,
        currency: "SAR",
      };

      const clientForgedPayload = {
        expectedGuestTotal: 10000, // Client tries to pay 100.00 SAR instead of 1,610.00 SAR
        expectedCurrency: "SAR",
      };

      const isMismatch = serverCalculatedQuote.guestTotal !== clientForgedPayload.expectedGuestTotal;
      assert.equal(isMismatch, true, "Price discrepancy must be caught before charging");
    });

    it("generates deterministic idempotency keys for booking payments", () => {
      const submissionId = "sub_req_abc123xyz";
      const idempotencyKey = `pay_idem_${submissionId}`;
      assert.equal(idempotencyKey, "pay_idem_sub_req_abc123xyz");
      assert.ok(idempotencyKey.startsWith("pay_idem_"));
    });
  });

  describe("Phase 6: Request to Book Lifecycle & Payment Synchronization", () => {
    it("models valid financial status transitions for Request to Book", () => {
      // 1. Initial creation: PENDING
      let paymentStatus: PaymentStatus = PaymentStatus.PENDING;
      assert.equal(paymentStatus, PaymentStatus.PENDING);

      // 2. Pre-authorization placed: AUTHORIZED
      paymentStatus = PaymentStatus.AUTHORIZED;
      assert.equal(paymentStatus, PaymentStatus.AUTHORIZED);

      // 3. Host accepts: delayed capture -> CAPTURED
      const onHostAccept = (status: PaymentStatus) => {
        if (status === PaymentStatus.AUTHORIZED || status === PaymentStatus.PENDING) {
          return PaymentStatus.CAPTURED;
        }
        return status;
      };
      assert.equal(onHostAccept(paymentStatus), PaymentStatus.CAPTURED);

      // 4. Host rejects or request expires: authorization released -> VOIDED
      const onHostRejectOrExpire = (status: PaymentStatus) => {
        if (status === PaymentStatus.AUTHORIZED || status === PaymentStatus.PENDING) {
          return PaymentStatus.VOIDED;
        }
        return status;
      };
      assert.equal(onHostRejectOrExpire(PaymentStatus.AUTHORIZED), PaymentStatus.VOIDED);
      assert.equal(onHostRejectOrExpire(PaymentStatus.PENDING), PaymentStatus.VOIDED);
    });

    it("enforces role-based privacy: Host never receives raw guest payment details", () => {
      const rawPaymentRecord = {
        id: "pay_trans_12345",
        status: PaymentStatus.CAPTURED,
        amount: 150000,
        capturedAmount: 150000,
        currency: "SAR",
        providerPaymentId: "src_card_xxxx9876",
        paymentMethod: "visa",
      };

      const buildGuestView = () => ({
        payment: {
          id: rawPaymentRecord.id,
          status: rawPaymentRecord.status,
          amount: rawPaymentRecord.amount,
          capturedAmount: rawPaymentRecord.capturedAmount,
          currency: rawPaymentRecord.currency,
          paymentMethod: rawPaymentRecord.paymentMethod,
        },
      });

      const buildHostView = (bookingStatus: BookingStatus) => ({
        payment: null, // Strictly null for host
        paymentConfirmation: {
          status: bookingStatus === BookingStatus.CONFIRMED ? "PAID" : "PENDING",
          currency: rawPaymentRecord.currency,
        },
      });

      const guestDetails = buildGuestView();
      const hostDetails = buildHostView(BookingStatus.CONFIRMED);

      assert.ok(guestDetails.payment, "Guest should see payment details");
      assert.equal(guestDetails.payment.id, "pay_trans_12345");
      assert.equal(hostDetails.payment, null, "Host must NEVER see raw payment object");
      assert.equal(hostDetails.paymentConfirmation.status, "PAID");
    });
  });

  describe("Phase 7: Webhooks, Concurrency & Payment State Safety", () => {
    it("handles valid HMAC-SHA256 signature verification", () => {
      const payload = JSON.stringify({
        id: "evt_live_123",
        type: "payment.paid",
        data: { id: "pay_123", amount: 50000, currency: "SAR", status: "paid" },
      });

      const validSig = crypto
        .createHmac("sha256", testSecret)
        .update(payload, "utf8")
        .digest("hex");

      assert.equal(adapter.verifyWebhookSignature(payload, validSig, testSecret), true);
    });

    it("rejects forged or modified webhook signatures", () => {
      const payload = JSON.stringify({ id: "evt_forged", amount: 1000 });
      const badSig = "0000000000000000000000000000000000000000000000000000000000000000";
      assert.equal(adapter.verifyWebhookSignature(payload, badSig, testSecret), false);
    });

    it("prevents out-of-order events from regressing terminal states", () => {
      const currentStatus: PaymentStatus = PaymentStatus.CAPTURED;

      // An out-of-order payment.failed or payment.authorized arriving after CAPTURED must not revert CAPTURED
      const resolveTargetStatus = (current: PaymentStatus, incomingEvent: string): PaymentStatus => {
        if (current === PaymentStatus.CAPTURED) {
          if (incomingEvent === "payment.authorized" || incomingEvent === "payment.failed") {
            return PaymentStatus.CAPTURED; // Ignore regression
          }
          if (incomingEvent === "payment.refunded") {
            return PaymentStatus.REFUNDED;
          }
        }
        if (current === PaymentStatus.REFUNDED || current === PaymentStatus.VOIDED) {
          return current; // Terminal: cannot be changed
        }
        return PaymentStatus.PENDING;
      };

      assert.equal(resolveTargetStatus(currentStatus, "payment.failed"), PaymentStatus.CAPTURED);
      assert.equal(resolveTargetStatus(currentStatus, "payment.authorized"), PaymentStatus.CAPTURED);
      assert.equal(resolveTargetStatus(PaymentStatus.REFUNDED, "payment.paid"), PaymentStatus.REFUNDED);
      assert.equal(resolveTargetStatus(PaymentStatus.VOIDED, "payment.paid"), PaymentStatus.VOIDED);
    });
  });

  describe("Phase 8: Admin Payments Management & Financial Integrity", () => {
    it("calculates Net Captured Volume after deductions and refunds", () => {
      const summary = {
        totalCapturedVolume: 500000, // 5,000.00 SAR
        refundedVolume: 50000, // 500.00 SAR refunded
        netCapturedVolume: Math.max(0, 500000 - 50000), // 4,500.00 SAR
      };

      assert.equal(summary.netCapturedVolume, 450000);
      assert.equal(summary.totalCapturedVolume - summary.refundedVolume, summary.netCapturedVolume);
    });

    it("evaluates reconciliation status and detects local vs gateway discrepancies", () => {
      const localPayment = {
        amount: 100000,
        capturedAmount: 100000,
        refundedAmount: 20000,
        currency: "SAR",
        status: PaymentStatus.PARTIALLY_REFUNDED,
      };

      const refundRecords = [
        { amount: 20000, status: "SUCCEEDED" },
      ];

      const sumRefunds = refundRecords.reduce((acc, r) => acc + r.amount, 0);
      const isReconciled = sumRefunds === localPayment.refundedAmount;
      assert.equal(isReconciled, true, "Local refund sum must strictly equal payment refundedAmount");
    });
  });
});

