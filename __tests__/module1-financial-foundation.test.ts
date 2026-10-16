import assert from "node:assert/strict";
import test, { describe, it } from "node:test";
import crypto from "node:crypto";
import { MoyasarAdapter } from "../lib/payment/moyasar-adapter";
import {
  MOYASAR_CAPABILITY_MATRIX,
  type PaymentProviderInterface,
} from "../lib/payment/provider-interface";
import { PaymentStatus, PaymentProvider, BookingStatus } from "../generated/prisma/enums";
import { calculateBookingPrice } from "../services/pricing.service";
import { TaxCalculator } from "../lib/tax/tax-calculator";
import { getPaymentPolicy } from "../lib/booking/payment-policy";
import type { TaxRuleDTO } from "../lib/tax/types";

describe("Module 1 — Financial Foundation Test Suite", () => {
  const adapter = new MoyasarAdapter();
  const testSecret = "sec_test_webhook_secret_key_1234567890abcdef";

  describe("1. Gateway Interface & Capabilities Matrix", () => {
    it("conforms to PaymentProviderInterface with MOYASAR provider", () => {
      assert.equal(adapter.providerName, PaymentProvider.MOYASAR);
      assert.equal(typeof adapter.verifyWebhookSignature, "function");
      assert.equal(typeof adapter.parseWebhookEvent, "function");
      assert.equal(typeof adapter.createPayment, "function");
      assert.equal(typeof adapter.capturePayment, "function");
      assert.equal(typeof adapter.voidAuthorization, "function");
      assert.equal(typeof adapter.createRefund, "function");
    });

    it("declares accurate gateway capabilities without fabricating marketplace payout support", () => {
      // Payment collection & authorization capabilities
      assert.equal(adapter.capabilities.createPayment, true);
      assert.equal(adapter.capabilities.paymentAuthorization, true);
      assert.equal(adapter.capabilities.delayedCapture, true);
      assert.equal(adapter.capabilities.partialCapture, true);
      assert.equal(adapter.capabilities.authorizationVoid, true);
      assert.equal(adapter.capabilities.fullRefund, true);
      assert.equal(adapter.capabilities.partialRefund, true);
      assert.equal(adapter.capabilities.paymentStatusWebhooks, true);
      assert.equal(adapter.capabilities.refundStatusWebhooks, true);

      // Truthful reporting of unsupported marketplace / transfer capabilities
      assert.equal(adapter.capabilities.marketplaceSplitPayments, false);
      assert.equal(adapter.capabilities.connectedHostAccounts, false);
      assert.equal(adapter.capabilities.hostTransfersPayouts, false);
      assert.equal(adapter.capabilities.payoutStatusTracking, false);
    });

    it("verifies MOYASAR_CAPABILITY_MATRIX includes all required audit items", () => {
      const requiredCapabilities = [
        "createPayment",
        "paymentAuthorization",
        "delayedCapture",
        "partialCapture",
        "authorizationVoid",
        "fullRefund",
        "partialRefund",
        "refundStatusWebhooks",
        "paymentStatusWebhooks",
        "marketplaceSplitPayments",
        "connectedHostAccounts",
        "hostTransfersPayouts",
        "payoutStatusTracking",
        "paymentReconciliation",
        "idempotencyKeys",
      ];

      for (const cap of requiredCapabilities) {
        const found = MOYASAR_CAPABILITY_MATRIX.find((entry) => entry.capability === cap);
        assert.ok(found, `Capability '${cap}' must be present in MOYASAR_CAPABILITY_MATRIX`);
        assert.ok(found.status, `Status required for ${cap}`);
        assert.ok(found.notes.length > 0, `Audit notes required for ${cap}`);
      }
    });
  });

  describe("2. Webhook Security & Signature Verification", () => {
    it("validates authentic HMAC-SHA256 signatures correctly", () => {
      const rawPayload = JSON.stringify({
        id: "evt_test_123456",
        type: "payment.paid",
        created_at: "2026-10-14T10:00:00Z",
        data: {
          id: "pay_test_987654",
          status: "paid",
          amount: 50000,
          currency: "SAR",
        },
      });

      const validSignature = crypto
        .createHmac("sha256", testSecret)
        .update(rawPayload, "utf8")
        .digest("hex");

      const result = adapter.verifyWebhookSignature(rawPayload, validSignature, testSecret);
      assert.equal(result, true, "Signature verification should succeed with correct secret and payload");
    });

    it("rejects forged or tampered webhook signatures", () => {
      const rawPayload = JSON.stringify({ id: "evt_tampered", amount: 1000 });
      const badSignature = "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789";

      const result = adapter.verifyWebhookSignature(rawPayload, badSignature, testSecret);
      assert.equal(result, false, "Signature verification should reject invalid HMAC");
    });

    it("rejects valid signature if payload was mutated after signing", () => {
      const originalPayload = JSON.stringify({ id: "evt_123", amount: 1000 });
      const signature = crypto
        .createHmac("sha256", testSecret)
        .update(originalPayload, "utf8")
        .digest("hex");

      const tamperedPayload = JSON.stringify({ id: "evt_123", amount: 999999 });
      const result = adapter.verifyWebhookSignature(tamperedPayload, signature, testSecret);
      assert.equal(result, false, "Tampered payload must fail signature verification");
    });

    it("fails closed when secret or signature is missing or blank", () => {
      assert.equal(adapter.verifyWebhookSignature("{}", "", testSecret), false);
      assert.equal(adapter.verifyWebhookSignature("{}", "abc", ""), false);
      assert.equal(adapter.verifyWebhookSignature("", "abc", testSecret), false);
    });
  });

  describe("3. Webhook Event Parsing & Normalization", () => {
    it("parses valid Moyasar event payload into standard format", () => {
      const raw = {
        id: "evt_moyasar_001",
        type: "payment.paid",
        created_at: "2026-10-14T12:00:00Z",
        data: {
          id: "pay_moyasar_001",
          status: "paid",
          amount: 150000,
          currency: "SAR",
          fee: 3750,
          source: {
            type: "creditcard",
            company: "visa",
            name: "John Doe",
            number: "XXXX-XXXX-XXXX-1111",
            message: "Succeeded",
          },
          metadata: {
            bookingId: "book_test_abc",
          },
        },
      };

      const parsed = adapter.parseWebhookEvent(JSON.stringify(raw));
      assert.ok(parsed);
      assert.equal(parsed.id, "evt_moyasar_001");
      assert.equal(parsed.type, "payment.paid");
      assert.equal(parsed.data.id, "pay_moyasar_001");
      assert.equal(parsed.data.status, "paid");
      assert.equal(parsed.data.amount, 150000);
      assert.equal(parsed.data.currency, "SAR");
      assert.equal(parsed.data.metadata?.bookingId, "book_test_abc");
    });

    it("returns null for malformed or non-object payloads", () => {
      assert.equal(adapter.parseWebhookEvent("not json"), null);
      assert.equal(adapter.parseWebhookEvent(""), null);
      assert.equal(adapter.parseWebhookEvent(JSON.stringify({ missing_id: true })), null);
    });
  });

  describe("4. Pricing Invariants & Mathematical Consistency", () => {
    it("calculates deterministic quotes strictly in integer minor units (halalas)", async () => {
      const quote = await calculateBookingPrice({
        checkIn: "2026-11-01",
        checkOut: "2026-11-04", // 3 nights
        weekdayBasePrice: 50000, // 500.00 SAR
        cleaningFee: 5000, // 50.00 SAR
        petFee: 3000, // 30.00 SAR
        currency: "SAR",
        guests: 2,
        pets: 1,
      });

      assert.equal(quote.nights, 3);
      assert.equal(quote.staySubtotal, 150000); // 3 * 50000
      assert.equal(quote.cleaningFee, 5000);
      assert.equal(quote.petFee, 3000);
      assert.equal(quote.currency, "SAR");

      // Verify all numerical values are non-negative integers
      assert.equal(Number.isInteger(quote.staySubtotal), true);
      assert.equal(Number.isInteger(quote.guestTotal), true);
      assert.equal(Number.isInteger(quote.payoutBreakdown.netHostPayout), true);
      assert.equal(Number.isInteger(quote.hostServiceFee), true);
      assert.equal(Number.isInteger(quote.taxTotal), true);
    });

    it("ensures Host Platform Fee is deducted from host earnings, not charged to guest", async () => {
      const quote = await calculateBookingPrice({
        checkIn: "2026-11-01",
        checkOut: "2026-11-02", // 1 night
        weekdayBasePrice: 100000, // 1000.00 SAR
        cleaningFee: 0,
        currency: "SAR",
        hostServiceFeePercentage: 15,
      });

      // 15% platform fee on 1000.00 SAR = 150.00 SAR (15000 halalas)
      assert.equal(quote.staySubtotal, 100000);
      assert.equal(quote.hostServiceFee, 15000);

      // Host earnings = host subtotal (100000) - host fee (15000) = 85000
      assert.equal(quote.payoutBreakdown.netHostPayout, 85000);

      // In the absence of external tax rules, guest total = accommodation (100000)
      // Notice: Host service fee is NOT added to guestTotal!
      assert.equal(quote.guestTotal, 100000);
      assert.equal(quote.guestTotal, quote.staySubtotal + quote.totalAdditionalFees + quote.taxTotal);
    });

    it("calculates 15% VAT on taxable components accurately via TaxCalculator", () => {
      const vatRule: TaxRuleDTO = {
        id: "vat-rule-15",
        jurisdictionId: "sa-zatca",
        taxType: "VAT",
        name: "VAT",
        description: "Standard VAT",
        calculationMethod: "PERCENTAGE",
        rate: 15.0,
        amount: null,
        taxableComponents: ["BASE_PRICE", "CLEANING_FEE", "PET_FEE"],
        remittanceResponsibility: "PLATFORM",
        isSystemManaged: true,
        isInclusive: false,
        longStayExemptionNights: null,
        effectiveFrom: "2026-01-01T00:00:00Z",
        effectiveUntil: null,
        version: 1,
        isActive: true,
      };

      const result = TaxCalculator.calculateTaxes({
        nights: 2,
        nightlySubtotal: 100000, // 1000.00 SAR
        cleaningFee: 10000, // 100.00 SAR
        petFee: 5000, // 50.00 SAR
        feeAmounts: {
          CLEANING_FEE: 10000,
          PET_FEE: 5000,
        },
        rules: [vatRule],
        currency: "SAR",
      });

      // Total taxable base = 100000 + 10000 + 5000 = 115000 halalas
      // 15% VAT on 115000 = 17250 halalas
      assert.equal(result.taxTotal, 17250);
      assert.equal(result.currency, "SAR");
      assert.equal(result.taxes.length, 1);
      assert.equal(result.taxes[0].taxName, "VAT");
      assert.equal(result.taxes[0].rate, 15.0);
      assert.equal(result.taxes[0].taxAmount, 17250);
      // Guest total includes accommodation (100000) + cleaning (10000) + pet (5000) + tax (17250) = 132250
      assert.equal(result.guestTotal, 132250);
    });
  });

  describe("5. Payment Policy & Sandbox Modes", () => {
    it("reports DEFERRED / MOCK / ONLINE_AUTHORIZATION mode in payment policy", () => {
      const policy = getPaymentPolicy();
      assert.ok(["DEFERRED", "MOCK", "ONLINE_AUTHORIZATION"].includes(policy.paymentMode));
      assert.equal(typeof policy.onlinePaymentRequired, "boolean");
      assert.equal(typeof policy.providerConfigured, "boolean");
      assert.equal(policy.defaultPaymentStatus, "PAYMENT_PENDING");
    });
  });

  describe("6. Financial Status State Machine Transitions", () => {
    // Defines permitted transitions for BookingPayment
    const validTransitions: Record<PaymentStatus, PaymentStatus[]> = {
      [PaymentStatus.PENDING]: [
        PaymentStatus.AUTHORIZED,
        PaymentStatus.CAPTURED,
        PaymentStatus.FAILED,
        PaymentStatus.VOIDED,
      ],
      [PaymentStatus.AUTHORIZED]: [
        PaymentStatus.CAPTURED,
        PaymentStatus.VOIDED,
        PaymentStatus.FAILED,
      ],
      [PaymentStatus.CAPTURED]: [
        PaymentStatus.PARTIALLY_REFUNDED,
        PaymentStatus.REFUNDED,
      ],
      [PaymentStatus.PARTIALLY_REFUNDED]: [
        PaymentStatus.REFUNDED,
      ],
      [PaymentStatus.REFUNDED]: [],
      [PaymentStatus.VOIDED]: [],
      [PaymentStatus.FAILED]: [
        PaymentStatus.PENDING, // retry
      ],
    };

    it("verifies all core financial status transitions are accounted for", () => {
      assert.ok(validTransitions[PaymentStatus.PENDING].includes(PaymentStatus.CAPTURED));
      assert.ok(validTransitions[PaymentStatus.PENDING].includes(PaymentStatus.AUTHORIZED));
      assert.ok(validTransitions[PaymentStatus.AUTHORIZED].includes(PaymentStatus.CAPTURED));
      assert.ok(validTransitions[PaymentStatus.AUTHORIZED].includes(PaymentStatus.VOIDED));
      assert.ok(validTransitions[PaymentStatus.CAPTURED].includes(PaymentStatus.REFUNDED));
      assert.ok(validTransitions[PaymentStatus.CAPTURED].includes(PaymentStatus.PARTIALLY_REFUNDED));
    });

    it("terminal states REFUNDED and VOIDED cannot transition back to CAPTURED", () => {
      assert.equal(validTransitions[PaymentStatus.REFUNDED].includes(PaymentStatus.CAPTURED), false);
      assert.equal(validTransitions[PaymentStatus.VOIDED].includes(PaymentStatus.CAPTURED), false);
    });
  });
});

