import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  bookingModePersistence,
  isBookingMode,
  resolveBookingMode,
} from "../lib/booking/booking-mode";

assert.equal(resolveBookingMode({ bookingApprovalMode: "INSTANT", instantBook: true }), "INSTANT_BOOK");
assert.equal(resolveBookingMode({ bookingApprovalMode: "MANUAL", instantBook: false }), "REQUEST_TO_BOOK");
assert.equal(resolveBookingMode({ bookingApprovalMode: "FIRST_THREE", instantBook: true }), "REQUEST_TO_BOOK");
assert.equal(resolveBookingMode({ bookingApprovalMode: "INSTANT", instantBook: false }), "REQUEST_TO_BOOK");
assert.deepEqual(bookingModePersistence("INSTANT_BOOK"), {
  bookingApprovalMode: "INSTANT",
  instantBook: true,
});
assert.deepEqual(bookingModePersistence("REQUEST_TO_BOOK"), {
  bookingApprovalMode: "MANUAL",
  instantBook: false,
});
assert.equal(isBookingMode("INSTANT_BOOK"), true);
assert.equal(isBookingMode("REQUEST_TO_BOOK"), true);
assert.equal(isBookingMode("INSTANT"), false);

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const checkout = read("app/book/[id]/booking-checkout-client.tsx");
const bookingService = read("services/booking.service.ts");
const publicMapper = read("services/mappers.ts");
const listingPage = read("app/listings/[id]/public-listing-detail-client.tsx");
const listingService = read("services/listing.service.ts");
const hostBookingSettings = read("app/(protected)/host/listings/[id]/components/PricingAndBookingViews.tsx");

assert.match(publicMapper, /bookingMode: resolveBookingMode\(l\)/, "public listing data exposes canonical bookingMode");
assert.match(bookingService, /const bookingMode = resolveBookingMode\(listing\)/, "server resolves mode from listing");
assert.doesNotMatch(bookingService, /input\.bookingMode/, "booking creation never trusts client bookingMode");
assert.doesNotMatch(checkout, /!isInstantBook && <>/, "Instant Book uses the shared four-step checkout");
assert.match(checkout, /setAuthoritativeBookingMode\(data\.data\.bookingMode\)/, "checkout refreshes stale mode from quote");
assert.match(checkout, /message: hostMessage\.trim\(\) \|\| undefined/, "Instant Book submits its optional host message");
assert.match(listingPage, /saveBookingQuote/, "CTA carries the authoritative detail quote into checkout without a duplicate request");
assert.match(bookingService, /prevalidatedQuote \?\? await getBookingQuote/, "the server remains authoritative at booking creation");
assert.match(listingPage, /Request to book/, "request listings use an explicit request CTA");
assert.match(listingService, /Object\.assign\(dataToUpdate, bookingModePersistence\(nextMode\)\)/, "listing updates synchronize legacy fields");
assert.doesNotMatch(hostBookingSettings, /bookingMethod: "first-three"/, "host settings expose only the two supported modes");

console.log("Phase 1 booking-mode and checkout-entry regression checks passed.");
