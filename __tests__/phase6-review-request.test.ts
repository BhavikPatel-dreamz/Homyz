import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createReviewRequestData, PAYMENT_AUTHORIZATION_REQUIRED_MESSAGE } from "../lib/booking/review-request";
import { parseSafeCheckoutDraft } from "../lib/booking/checkout-wizard";
import { requestToBookSchema } from "../lib/validation/booking";
import type { CheckoutSummaryQuote } from "../lib/booking/checkout-summary";

const quote: CheckoutSummaryQuote = {
  nights: 2,
  baseNightlyPrice: 10_000,
  nightlySubtotal: 20_000,
  discountAmount: 2_000,
  cleaningFee: 1_500,
  extraGuestFee: 0,
  petFee: 500,
  hostServiceFee: 2_500,
  taxes: [{ taxName: "VAT", taxAmount: 3_000 }],
  taxTotal: 3_000,
  guestTotal: 25_500,
  currency: "SAR",
};

const review = createReviewRequestData({
  paymentTiming: "FULL_NOW",
  paymentMethodLabel: null,
  paymentAuthorizationValid: false,
  paymentRequiredNow: false,
  hostMessage: "  Hi, we're visiting Riyadh.  ",
  checkIn: "2026-10-10",
  checkOut: "2026-10-12",
  adults: 2,
  children: 1,
  infants: 0,
  pets: 1,
  quote,
});

assert.equal(review.payment.timing, "Pay now");
assert.equal(review.payment.method, "No payment required now");
assert.equal(review.message, "Hi, we're visiting Riyadh.");
assert.match(review.trip.checkIn, /Oct 10, 2026/);
assert.match(review.trip.checkOut, /Oct 12, 2026/);
assert.equal(review.trip.guests, "3 guests, 1 pet");
assert.equal(review.pricing.total, quote.guestTotal);
assert.equal(review.pricing.currency, "SAR");
assert.equal(review.canSubmitRequest, true);
assert.equal(review.blocker, null);
assert.match(PAYMENT_AUTHORIZATION_REQUIRED_MESSAGE, /Payment setup/);

const request = {
  listingId: "listing-1",
  startDate: "2026-10-10",
  endDate: "2026-10-12",
  guests: 3,
  adults: 2,
  children: 1,
  infants: 0,
  pets: 1,
  message: "Hi, we're visiting Riyadh.",
  paymentPlan: "FULL" as const,
  requestSubmissionId: "d775ae0f-051b-48d0-b2ae-12a68f62cde9",
  expectedGuestTotal: quote.guestTotal,
  expectedCurrency: "sar",
};
const parsed = requestToBookSchema.safeParse(request);
assert.equal(parsed.success, true);
if (parsed.success) assert.equal(parsed.data.expectedCurrency, "SAR");
assert.equal(requestToBookSchema.safeParse({ ...request, paymentStatus: "AUTHORIZED" }).success, false);
assert.equal(requestToBookSchema.safeParse({ ...request, paymentId: "fake" }).success, false);
assert.equal(requestToBookSchema.safeParse({ ...request, requestSubmissionId: "manual-success" }).success, false);

const restored = parseSafeCheckoutDraft({
  version: 1,
  intentSignature: "intent",
  bookingMode: "REQUEST_TO_BOOK",
  activeStep: 2,
  completedSteps: [1],
  paymentTiming: "FULL_NOW",
  paymentMethod: null,
  hostMessage: "Preserved message",
  requestSubmissionId: request.requestSubmissionId,
}, "intent", "REQUEST_TO_BOOK");
assert.equal(restored?.requestSubmissionId, request.requestSubmissionId, "the submission id survives refresh");
assert.equal(restored?.hostMessage, "Preserved message");

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const checkout = read("app/book/[id]/booking-checkout-client.tsx");
const component = read("components/checkout/review-request-step.tsx");
const requestService = read("services/request-to-book.service.ts");
const requestRoute = read("app/api/v1/bookings/request/route.ts");
const bookingService = read("services/booking.service.ts");
const schema = read("prisma/schema.prisma");

for (const label of ["Payment timing", "Payment method", "Message to host", "Check-in", "Check-out", "Guests", "Price details", "Total ("]) {
  assert.match(component, new RegExp(label.replace("(", "\\(")));
}
assert.match(component, /<ChangeButton label="payment timing"/);
assert.match(component, /<ChangeButton label="payment method"/);
assert.match(component, /<ChangeButton label="message to host"/);
assert.match(component, /<ChangeButton label="dates"/);
assert.match(component, /<ChangeButton label="guests"/);
assert.match(component, /disabled=\{!data\.canSubmitRequest \|\| isSubmitting\}/);
assert.match(component, /Confirming booking\.\.\./);
assert.match(component, /Sending request\.\.\./);
assert.match(component, /Confirm booking/);
assert.doesNotMatch(component, /dangerouslySetInnerHTML/);
assert.match(checkout, /createReviewRequestData\(/);
assert.match(checkout, /fetch\("\/api\/v1\/bookings\/request"/);
assert.match(checkout, /expectedGuestTotal: quote\.guestTotal/);
assert.match(checkout, /expectedCurrency: quote\.currency/);
assert.match(requestRoute, /requestToBookService\.createRequestToBook/);
assert.ok(requestService.indexOf("bookingService.getQuote") < requestService.indexOf("bookingService.create"));
assert.match(requestService, /quote\.guestTotal !== input\.expectedGuestTotal/);
assert.match(requestService, /DATES_NO_LONGER_AVAILABLE/);
assert.match(requestService, /BOOKING_MODE_CHANGED/);
assert.match(requestService, /DUPLICATE_REQUEST/);
assert.doesNotMatch(requestService, /booking\.create\(/, "the payment-gated service cannot create a booking");
assert.match(requestService, /return bookingService\.create\(actor/);
assert.doesNotMatch(requestService, /paymentId|cardNumber|cardCvc/, "host notification preparation contains no payment details");
assert.match(schema, /submissionId\s+String\?\s+@unique/);
assert.match(bookingService, /pg_advisory_xact_lock\(hashtext\(\$\{input\.requestSubmissionId\}\)\)/);

console.log("Phase 6 review and request-to-book preparation checks passed.");
