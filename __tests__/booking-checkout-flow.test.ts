import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { createBookingSchema } from "../lib/validation/booking";
import { getAvailablePaymentTimingOptions, getBookingApiPaymentPlan } from "../lib/booking/payment-timing";

console.log("\n==================================================================");
console.log("   BOOKING CHECKOUT EXPERIENCE & ACCORDION FLOW AUDIT SUITE        ");
console.log("==================================================================\n");

// [1] Route Files Existence Audit
console.log("--- [1] Checkout Route Existence Audit ---");
const bookPagePath = path.resolve(__dirname, "../app/book/[id]/page.tsx");
assert(fs.existsSync(bookPagePath), "app/book/[id]/page.tsx must exist");
const bookPageCode = fs.readFileSync(bookPagePath, "utf-8");
assert(bookPageCode.includes("getPublicListingById"), "Book page must fetch listing by ID");
assert(bookPageCode.includes("BookingCheckoutClient"), "Book page must render BookingCheckoutClient");
console.log("✓ /book/[id] route verified!");

const bookRedirectPath = path.resolve(__dirname, "../app/listings/[id]/book/page.tsx");
assert(fs.existsSync(bookRedirectPath), "app/listings/[id]/book/page.tsx must exist");
const bookRedirectCode = fs.readFileSync(bookRedirectPath, "utf-8");
assert(bookRedirectCode.includes("redirect(`/book/"), "Listing book page must redirect to /book/[id]");
console.log("✓ /listings/[id]/book redirect route verified!");

// [2] Client Component & 4 Progressive Steps Audit
console.log("\n--- [2] 4-Step Accordion Flow Audit ---");
const clientPath = path.resolve(__dirname, "../app/book/[id]/booking-checkout-client.tsx");
assert(fs.existsSync(clientPath), "app/book/[id]/booking-checkout-client.tsx must exist");
const clientCode = fs.readFileSync(clientPath, "utf-8");

// Step 1: Choose when to pay
assert(clientCode.includes("Choose when to pay"), "Must include Step 1: Choose when to pay");
assert.equal(getAvailablePaymentTimingOptions().length, 3, "All supported payment intents must be exposed");
assert.equal(getBookingApiPaymentPlan(getAvailablePaymentTimingOptions()[0].type), "FULL");
assert(getAvailablePaymentTimingOptions().some((option) => option.title === "Pay part now, part later"), "Must restore the partial-payment intent UI");
assert(!clientCode.includes("Klarna"), "Must not expose an unconfigured installment provider");

// Step 2: Payment method
assert(clientCode.includes("Payment method"), "Must include Step 2: Payment method");
assert(clientCode.includes("Test payment mode"), "Must show test payment mode indicator");
assert(clientCode.includes("Card Number *"), "Must restore the in-memory mock card UI");
assert(clientCode.includes("Card Code (CVC) *"), "Must restore the in-memory mock CVC UI");
assert(clientCode.includes("Google Pay"), "Must restore Google Pay as an explicitly mock selection");
assert(clientCode.includes("Local gateways"), "Must restore the approved local-gateway row");
assert(clientCode.includes("clearRawCardFields()"), "Must erase raw card fields after producing a safe summary");

// Step 3: Write a message to the host
assert(clientCode.includes("Write a message to the host"), "Must include Step 3: Write a message to the host");
assert(clientCode.includes("Hosted by"), "Must display Host card in Step 3");
assert(clientCode.includes("Write a message"), "Must include message textarea label in Step 3");

// Step 4: Review your request
const wizardCode = fs.readFileSync(path.resolve(__dirname, "../lib/booking/checkout-wizard.ts"), "utf-8");
assert(wizardCode.includes('title: "Review your request"'), "Must include Step 4: Review your request");
const reviewStepCode = fs.readFileSync(path.resolve(__dirname, "../components/checkout/review-request-step.tsx"), "utf-8");
assert(reviewStepCode.includes("The host has 24 hours to respond"), "Must explain confirmation term");
assert(reviewStepCode.includes("Request to book"), "Must use the request-to-book CTA");
assert(clientCode.includes("getBookingApiPaymentPlan(selectedPaymentTiming)"), "Supported timing maps through the central API adapter");
console.log("✓ All 4 accordion steps verified!");

// [3] Sticky Right Column & Price Details Audit
console.log("\n--- [3] Sticky Summary Card & Live Price Audit ---");
const summaryCode = fs.readFileSync(path.resolve(__dirname, "../components/checkout/booking-summary.tsx"), "utf-8");
const summaryHelperCode = fs.readFileSync(path.resolve(__dirname, "../lib/booking/checkout-summary.ts"), "utf-8");
assert(summaryCode.includes("Free cancellation"), "Must display Free cancellation terms");
assert(summaryCode.includes("Dates"), "Must display Dates row with Change button");
assert(summaryCode.includes("Guests"), "Must display Guests row with Change button");
assert(summaryCode.includes("Price details"), "Must display Price details section");
assert(summaryHelperCode.includes("Taxes"), "Must display Taxes line");
assert(summaryHelperCode.includes("Extra guest fee"), "Must itemize the extra-guest fee included in the total");
assert(!summaryHelperCode.includes('label: "Service fee"'), "Host payout fees must not be charged to the guest");
assert(summaryHelperCode.includes("Pet fee"), "Must itemize a pet fee when one is included in the total");
assert(summaryCode.includes("Total"), "Must display Total amount row");
assert(summaryCode.includes("Price breakdown"), "Must include Price breakdown modal trigger");
assert(summaryCode.includes("ModalOverlay"), "Must use ModalOverlay for modals");
assert(
  clientCode.includes("formatMoney(quote.guestTotal, 2)"),
  "Checkout payment labels must display the authoritative quote total with two decimal places",
);
assert(
  clientCode.includes('quote\n    ? formatMoney(quote.guestTotal, 2)'),
  "Checkout must retain the last authoritative total while a refreshed quote is loading",
);
console.log("✓ Sticky property & price summary card verified!");

// [4] Listing Detail CTA Redirection Audit
console.log("\n--- [4] Listing Detail CTA Redirection Audit ---");
const listingDetailClientPath = path.resolve(__dirname, "../app/listings/[id]/public-listing-detail-client.tsx");
const listingDetailClientCode = fs.readFileSync(listingDetailClientPath, "utf-8");
assert(listingDetailClientCode.includes("/book/"), "Listing detail handleReserve must route to /book/");
console.log("✓ Reserve CTA redirection verified!");

// [5] Booking Schema Validation Audit
console.log("\n--- [5] Booking Schema Validation Audit ---");
const validBookingPayload = {
  listingId: "cmu5gnf3o0003avastygga3b9",
  startDate: new Date("2026-10-01"),
  endDate: new Date("2026-10-03"),
  guests: 2,
  pets: 0,
  nonRefundable: false,
  message: "Hi Joyce, looking forward to staying at your place!",
  paymentPlan: "FULL" as const,
};
const parsed = createBookingSchema.safeParse(validBookingPayload);
assert(parsed.success, "Booking schema must accept the supported booking request fields");
assert.equal(createBookingSchema.safeParse({ ...validBookingPayload, paymentMethod: "CARD" }).success, false);
console.log("✓ Booking validation rejects unsupported UI-only payment methods!");

console.log("\n==================================================================");
console.log("   ALL BOOKING CHECKOUT TESTS PASSED (5/5)                        ");
console.log("==================================================================\n");
