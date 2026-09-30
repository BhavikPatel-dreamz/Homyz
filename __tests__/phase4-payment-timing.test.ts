import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  FULL_PAYMENT_TIMING,
  PARTIAL_PAYMENT_TIMING,
  PAY_OVER_TIME_PAYMENT_TIMING,
  getAvailablePaymentTimingOptions,
  getBookingApiPaymentPlan,
  getPaymentTimingSummary,
  isPaymentTiming,
} from "../lib/booking/payment-timing";
import { parseSafeCheckoutDraft } from "../lib/booking/checkout-wizard";
import { createBookingSchema } from "../lib/validation/booking";

const options = getAvailablePaymentTimingOptions();
assert.deepEqual(options.map((option) => option.type), ["FULL_NOW", "PARTIAL", "PAY_OVER_TIME"]);
assert.equal(FULL_PAYMENT_TIMING, "FULL_NOW");
assert.equal(PARTIAL_PAYMENT_TIMING, "PARTIAL");
assert.equal(PAY_OVER_TIME_PAYMENT_TIMING, "PAY_OVER_TIME");
assert.equal(isPaymentTiming("FULL_NOW"), true);
assert.equal(isPaymentTiming("PARTIAL"), true);
assert.equal(isPaymentTiming("PAY_OVER_TIME"), true);
assert.equal(getBookingApiPaymentPlan(FULL_PAYMENT_TIMING), "FULL");
assert.equal(getBookingApiPaymentPlan(PARTIAL_PAYMENT_TIMING), "SPLIT");
assert.equal(getBookingApiPaymentPlan(PAY_OVER_TIME_PAYMENT_TIMING), "PAY_OVER_TIME");
assert.match(getPaymentTimingSummary(FULL_PAYMENT_TIMING, "SAR 2,450.00"), /Pay SAR 2,450\.00 now.*payment pending/);

const draft = {
  version: 1 as const,
  intentSignature: "listing|dates|guests",
  bookingMode: "REQUEST_TO_BOOK" as const,
  activeStep: 2 as const,
  completedSteps: [1] as const,
  paymentTiming: "FULL_NOW" as const,
  paymentMethod: null,
  hostMessage: "Safe to persist",
  requestSubmissionId: "d775ae0f-051b-48d0-b2ae-12a68f62cde9",
};
assert.deepEqual(
  parseSafeCheckoutDraft(draft, draft.intentSignature, draft.bookingMode),
  { ...draft, completedSteps: [1] },
  "the supported timing restores with wizard progress",
);
assert.equal(
  parseSafeCheckoutDraft({ ...draft, paymentTiming: "part" }, draft.intentSignature, draft.bookingMode),
  null,
  "a legacy unsupported timing cannot be restored",
);

const bookingInput = {
  listingId: "listing-1",
  startDate: "2026-10-10",
  endDate: "2026-10-12",
  guests: 2,
};
assert.equal(createBookingSchema.safeParse({ ...bookingInput, paymentPlan: "FULL" }).success, true);
assert.equal(createBookingSchema.safeParse(bookingInput).success, true, "legacy callers remain full-payment compatible");
assert.equal(createBookingSchema.safeParse({ ...bookingInput, paymentPlan: "SPLIT" }).success, true);
assert.equal(createBookingSchema.safeParse({ ...bookingInput, paymentPlan: "PAY_OVER_TIME" }).success, true);
assert.equal(createBookingSchema.safeParse({ ...bookingInput, paymentPlan: "KLARNA" }).success, false);

const root = path.resolve(import.meta.dirname, "..");
const checkout = fs.readFileSync(path.join(root, "app/book/[id]/booking-checkout-client.tsx"), "utf8");
const service = fs.readFileSync(path.join(root, "services/booking.service.ts"), "utf8");
assert.match(checkout, /getAvailablePaymentTimingOptions\(\)/, "Step 1 uses the central option list");
assert.match(checkout, /handlePaymentTimingChange/, "selection changes use one handler");
assert.match(checkout, /checkoutTotalLabel/, "checkout consumes the authoritative quote total");
assert.match(checkout, /No payment is processed in test mode/, "checkout is explicitly unpaid in test mode");
assert.match(checkout, /Please choose when you want to pay\./, "invalid selection is blocked inline");
assert.match(checkout, /step1FinalizingRef\.current/, "Next is protected against rapid duplicate activation");
assert.match(checkout, /<fieldset[\s\S]*?<legend className="sr-only">Choose when to pay<\/legend>/, "the radio group has an accessible name");
assert.equal(options[1].title, "Pay part now, part later");
assert.equal(options[2].title, "Pay over time");
assert.doesNotMatch(checkout, /Klarna|Tamara|Tabby/, "unconfigured provider brands are not exposed");
assert.match(service, /paymentPlan: input\.paymentPlan \?\? "FULL"/, "the booking snapshot records the validated timing");

console.log("Phase 4 payment timing regression checks passed.");
