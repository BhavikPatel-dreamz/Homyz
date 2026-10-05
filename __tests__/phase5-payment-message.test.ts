import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getAvailablePaymentMethods,
  PAYMENT_PROVIDER_UNAVAILABLE_MESSAGE,
} from "../lib/booking/payment-method";
import {
  formatHostMessagePreview,
  HOST_MESSAGE_MAX_LENGTH,
  validateHostMessage,
} from "../lib/booking/host-message";
import { parseSafeCheckoutDraft } from "../lib/booking/checkout-wizard";
import { createBookingSchema } from "../lib/validation/booking";

assert.deepEqual(getAvailablePaymentMethods(), [], "no unconfigured payment method is advertised");
assert.match(PAYMENT_PROVIDER_UNAVAILABLE_MESSAGE, /secure payment provider/i);

assert.deepEqual(validateHostMessage("   "), {
  valid: false,
  error: "Please write a message to the host.",
});
assert.deepEqual(validateHostMessage("  Hello host  "), { valid: true, value: "Hello host" });
assert.equal(validateHostMessage("x".repeat(HOST_MESSAGE_MAX_LENGTH + 1)).valid, false);
assert.equal(formatHostMessagePreview("A concise message", 30), "A concise message");
assert.equal(formatHostMessagePreview("This message needs shortening", 15), "This message n…");

const input = {
  listingId: "listing-1",
  startDate: "2026-10-10",
  endDate: "2026-10-12",
  guests: 2,
  paymentPlan: "FULL" as const,
  message: "Hello host",
};
assert.equal(createBookingSchema.safeParse(input).success, true);
assert.equal(createBookingSchema.safeParse({ ...input, message: "   " }).success, false);
assert.equal(createBookingSchema.safeParse({ ...input, message: "x".repeat(HOST_MESSAGE_MAX_LENGTH + 1) }).success, false);
assert.equal(createBookingSchema.safeParse({ ...input, paymentMethod: "CARD" }).success, false);

const legacyDraft = {
  version: 1 as const,
  intentSignature: "listing|dates|guests",
  bookingMode: "REQUEST_TO_BOOK" as const,
  activeStep: 4 as const,
  completedSteps: [1, 2, 3] as const,
  paymentTiming: "FULL_NOW" as const,
  paymentMethod: "card",
  hostMessage: "My safe message",
};
const restoredLegacyDraft = parseSafeCheckoutDraft(legacyDraft, legacyDraft.intentSignature, legacyDraft.bookingMode);
assert(restoredLegacyDraft, "legacy safe draft can be restored");
assert.equal(restoredLegacyDraft.activeStep, 4);
assert.deepEqual(restoredLegacyDraft.completedSteps, [1, 2, 3]);
assert.equal(restoredLegacyDraft.paymentMethod, null);
assert.equal(restoredLegacyDraft.hostMessage, legacyDraft.hostMessage);
assert.match(restoredLegacyDraft.requestSubmissionId, /^[0-9a-f-]{36}$/i);

const root = path.resolve(import.meta.dirname, "..");
const checkout = fs.readFileSync(path.join(root, "app/book/[id]/booking-checkout-client.tsx"), "utf8");
const bookingService = fs.readFileSync(path.join(root, "services/booking.service.ts"), "utf8");
const messagingService = fs.readFileSync(path.join(root, "services/messaging.service.ts"), "utf8");
const bookingRoute = fs.readFileSync(path.join(root, "app/api/v1/bookings/route.ts"), "utf8");

assert.match(checkout, /Test payment mode/);
assert.match(checkout, /Credit \/ debit card/i);
assert.match(checkout, /Card Number \*|Card Code \(CVC\)/);
assert.match(checkout, /Google Pay/);
assert.match(checkout, /Local gateways/);
assert.doesNotMatch(checkout, /STC Pay|Tamara/, "unapproved local provider labels remain hidden");
assert.match(checkout, /clearRawCardFields\(\)/, "raw mock card fields are erased on step completion");
assert.doesNotMatch(checkout, /rawCardNumber.*sessionStorage|rawCardCvc.*sessionStorage/, "raw payment credentials are absent from checkout state");
assert.match(checkout, /maxLength=\{HOST_MESSAGE_MAX_LENGTH\}/);
assert.match(checkout, /validateHostMessage\(hostMessage\)/);
assert.match(checkout, /formatHostMessagePreview\(hostMessage\)/);
assert.doesNotMatch(checkout, /!isInstantBook && <>/, "host message is shared by both booking modes");
assert.match(checkout, /isInstantBook && !hostMessage\.trim\(\)/, "Instant Book message is optional");
assert.doesNotMatch(checkout, /dangerouslySetInnerHTML/, "host message renders as escaped React text");
assert.match(bookingService, /bookingMode === "REQUEST_TO_BOOK"[\s\S]*?validateHostMessage\(input\.message \|\| ""\)/);
assert.match(bookingService, /db: tx/, "booking and host conversation are persisted atomically");
assert.match(messagingService, /const db = params\.db \?\? prisma/);
assert.match(bookingRoute, /getAvailablePaymentMethods\(\)\.length === 0/,
  "the public booking API fails closed until payment authorization exists");

console.log("Phase 5 payment and host-message regression checks passed.");
