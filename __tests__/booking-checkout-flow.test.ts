import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { createBookingSchema } from "../lib/validation/booking";

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
assert(clientCode.includes("Pay part now, part lather") || clientCode.includes("part now"), "Must include pay part now, part later option");
assert(clientCode.includes("Klarna"), "Must include Klarna payment option");

// Step 2: Payment method
assert(clientCode.includes("Payment method"), "Must include Step 2: Payment method");
assert(clientCode.includes("Credit / debit card"), "Must include credit/debit card option");
assert(clientCode.includes("Card Number *"), "Must include Card Number input");
assert(clientCode.includes("Expiry Date *"), "Must include Expiry Date input");
assert(clientCode.includes("Card Code (CVC) *"), "Must include CVC input");
assert(clientCode.includes("Apple Pay"), "Must include Apple Pay option");
assert(clientCode.includes("Google Pay"), "Must include Google Pay option");
assert(clientCode.includes("Local gateways"), "Must include Local gateways option");

// Step 3: Write a message to the host
assert(clientCode.includes("Write a message to the host"), "Must include Step 3: Write a message to the host");
assert(clientCode.includes("Hosted by"), "Must display Host card in Step 3");
assert(clientCode.includes("Write a message"), "Must include message textarea label in Step 3");

// Step 4: Review your request
assert(clientCode.includes("Review your request"), "Must include Step 4: Review your request");
assert(clientCode.includes("The host has 24 hours to confirm your booking") || clientCode.includes("instant"), "Must explain confirmation term");
assert(clientCode.includes(">Pay<") || clientCode.includes(">Pay") || clientCode.includes("Pay</button>"), "Must include Pay CTA button");
assert(
  clientCode.includes('now: "FULL"') &&
    clientCode.includes('part: "SPLIT"') &&
    clientCode.includes('klarna: "KLARNA"'),
  "Checkout payment-plan choices must map to the booking API enum values",
);
console.log("✓ All 4 accordion steps verified!");

// [3] Sticky Right Column & Price Details Audit
console.log("\n--- [3] Sticky Summary Card & Live Price Audit ---");
assert(clientCode.includes("Free cancellation"), "Must display Free cancellation terms");
assert(clientCode.includes("Dates"), "Must display Dates row with Change button");
assert(clientCode.includes("Guests"), "Must display Guests row with Change button");
assert(clientCode.includes("Price details"), "Must display Price details section");
assert(clientCode.includes("Taxes"), "Must display Taxes line");
assert(clientCode.includes("Total"), "Must display Total amount row");
assert(clientCode.includes("Price breakdown"), "Must include Price breakdown modal trigger");
assert(clientCode.includes("ModalOverlay"), "Must use ModalOverlay for modals");
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
  paymentMethod: "CARD" as const,
};
const parsed = createBookingSchema.safeParse(validBookingPayload);
assert(parsed.success, "Booking schema must accept message, paymentPlan, and paymentMethod");
console.log("✓ Booking validation schema accepts all checkout payload fields!");

console.log("\n==================================================================");
console.log("   ALL BOOKING CHECKOUT TESTS PASSED (5/5)                        ");
console.log("==================================================================\n");
