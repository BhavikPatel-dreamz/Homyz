import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getCheckoutSteps, parseSafeCheckoutDraft } from "../lib/booking/checkout-wizard";
import { buildBookingCheckoutUrl, parseSearchQueryParams } from "../lib/storage/client-history";
import { createBookingSchema } from "../lib/validation/booking";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const checkout = read("app/book/[id]/booking-checkout-client.tsx");
const review = read("components/checkout/review-request-step.tsx");
const confirmation = read("components/checkout/booking-confirmation.tsx");
const bookingService = read("services/booking.service.ts");
const dashboard = read("components/dashboard/reservation-dashboard.tsx");

assert.equal(getCheckoutSteps("INSTANT_BOOK").length, 4, "Instant Book exposes all four checkout steps");
assert.doesNotMatch(checkout, /!isInstantBook && <>/, "message and review are not hidden for Instant Book");
assert.doesNotMatch(checkout, /handleInstantBookSubmit/, "Step 2 cannot bypass message and review");
assert.match(checkout, /isInstantBook && !hostMessage\.trim\(\)/, "Instant Book message is optional");
assert.match(checkout, /message: hostMessage\.trim\(\) \|\| undefined/, "Instant Book submits the shared message value");
assert.match(checkout, /Review and confirm/);
assert.match(review, /Your booking will be confirmed immediately after you continue/);
assert.match(review, /Confirm booking/);
assert.match(review, /Confirming booking\.\.\./);
assert.match(review, /Request to book/);
assert.match(review, /Sending request\.\.\./);

assert.match(bookingService, /const bookingMode = resolveBookingMode\(listing\)/, "stored listing mode is authoritative");
assert.doesNotMatch(bookingService, /input\.bookingMode/, "client bookingMode is never trusted");
assert.match(bookingService, /automaticallyApprove \? BookingStatus\.CONFIRMED : BookingStatus\.PENDING/);
assert.match(bookingService, /paymentStatus: "PAYMENT_PENDING"/);
assert.match(bookingService, /getOrCreateBookingConversation\([\s\S]*?messageContent: input\.message/);

assert.match(confirmation, /Booking confirmed/);
assert.match(confirmation, /Booking ID:/);
assert.match(confirmation, /Message sent to host/);
assert.match(confirmation, /Pending \/ Deferred/);
assert.match(confirmation, /View booking details/);
assert.match(confirmation, /View all bookings/);
assert.doesNotMatch(checkout, /setTimeout\([\s\S]{0,120}profile\/tab\/upcoming/, "success does not auto-redirect");

assert.match(dashboard, /status !== "CONFIRMED" && status !== "CURRENT_STAY"/, "Upcoming includes confirmed Instant Book reservations");
assert.match(dashboard, /filters\.status === "PENDING" && status !== "PENDING"/, "Pending filter excludes confirmed Instant Book reservations");

const instantInput = createBookingSchema.safeParse({
  listingId: "listing-1",
  startDate: "2026-10-12",
  endDate: "2026-10-14",
  guests: 1,
  message: "Hi, I'm visiting Jeddah for two days.",
  paymentPlan: "FULL",
  expectedGuestTotal: 100_000,
  expectedCurrency: "sar",
});
assert.equal(instantInput.success, true, "Instant Book accepts an optional bounded message and quote snapshot");

const draft = parseSafeCheckoutDraft({
  version: 1,
  intentSignature: "instant-intent",
  bookingMode: "INSTANT_BOOK",
  activeStep: 4,
  completedSteps: [1, 2, 3],
  paymentTiming: "FULL_NOW",
  paymentMethod: null,
  hostMessage: "Hi, I'm visiting Jeddah for two days.",
  requestSubmissionId: "d775ae0f-051b-48d0-b2ae-12a68f62cde9",
}, "instant-intent", "INSTANT_BOOK");
assert.equal(draft?.activeStep, 4, "Instant Book review state survives refresh");
assert.equal(draft?.hostMessage, "Hi, I'm visiting Jeddah for two days.");

const canonicalUrl = buildBookingCheckoutUrl("seed-search-test-100-v1-073", {
  checkIn: "2026-10-12",
  checkOut: "2026-10-14",
  guests: 1,
  adults: 1,
}, { bookingMode: "INSTANT_BOOK" });
assert.equal(
  canonicalUrl,
  "/book/seed-search-test-100-v1-073?checkIn=2026-10-12&checkOut=2026-10-14&guests=1&adults=1&bookingMode=INSTANT_BOOK",
);
assert.doesNotMatch(canonicalUrl, /checkin=|checkout=/);
const legacyParsed = parseSearchQueryParams(new URLSearchParams("checkin=2026-10-12&checkout=2026-10-14&guests=1"));
assert.equal(legacyParsed.checkIn, "2026-10-12", "legacy URLs remain readable");
assert.equal(legacyParsed.checkOut, "2026-10-14", "legacy URLs remain readable");

console.log("Instant Book complete flow regression checks passed.");
