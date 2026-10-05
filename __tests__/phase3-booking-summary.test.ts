import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  formatCheckoutDateRange,
  formatCheckoutGuests,
  getCheckoutPriceRows,
  type CheckoutSummaryQuote,
} from "../lib/booking/checkout-summary";

assert.equal(formatCheckoutDateRange("2026-09-30", "2026-10-04"), "Sep 30 – Oct 4, 2026");
assert.equal(formatCheckoutDateRange("2026-10-01", "2026-10-05"), "Oct 1 – Oct 5, 2026");
assert.equal(formatCheckoutDateRange("2026-12-30", "2027-01-02"), "Dec 30, 2026 – Jan 2, 2027");
assert.equal(formatCheckoutDateRange("", "2026-10-05"), "Select dates");

assert.equal(formatCheckoutGuests({ adults: 1, children: 0, infants: 0, pets: 0 }), "1 guest");
assert.equal(formatCheckoutGuests({ adults: 2, children: 1, infants: 1, pets: 2 }), "3 guests, 1 infant, 2 pets");

const quote: CheckoutSummaryQuote = {
  nights: 4,
  baseNightlyPrice: 12_000,
  nightlySubtotal: 48_000,
  discountAmount: 4_800,
  cleaningFee: 3_000,
  extraGuestFee: 1_000,
  petFee: 2_000,
  hostServiceFee: 6_480,
  taxes: [
    { taxName: "City tax", taxAmount: 1_200 },
    { taxName: "VAT", taxAmount: 2_000 },
  ],
  taxTotal: 3_200,
  guestTotal: 49_400,
  currency: "SAR",
  breakdown: [
    { date: "2026-10-01", price: 12_000 },
    { date: "2026-10-02", price: 12_000 },
    { date: "2026-10-03", price: 12_000 },
    { date: "2026-10-04", price: 12_000 },
  ],
};
const rows = getCheckoutPriceRows(quote);
assert.equal(rows[0].unitPrice, 12_000, "fixed rates expose the real per-night amount");
assert.equal(rows[0].units, 4);
assert.equal(rows.find((row) => row.id === "taxes")?.amount, quote.taxTotal);
assert.equal(
  rows.reduce((sum, row) => sum + (row.subtract ? -row.amount : row.amount), 0),
  quote.guestTotal,
  "summary line items reconcile to the authoritative total",
);

const itemized = getCheckoutPriceRows(quote, { itemizeTaxes: true });
assert.equal(itemized.some((row) => row.label === "City tax"), true);
assert.equal(itemized.some((row) => row.label === "VAT"), true);
const varyingRates = getCheckoutPriceRows({
  ...quote,
  breakdown: [
    { date: "2026-10-01", price: 10_000 },
    { date: "2026-10-02", price: 14_000 },
  ],
});
assert.equal(varyingRates[0].label, "Accommodation (4 nights, varying rates)");
assert.equal(varyingRates[0].unitPrice, undefined, "dynamic pricing is not misrepresented as base price × nights");

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const checkout = read("app/book/[id]/booking-checkout-client.tsx");
const summary = read("components/checkout/booking-summary.tsx");
const bookingService = read("services/booking.service.ts");

assert.equal((checkout.match(/<BookingSummary/g) || []).length, 1, "checkout renders one canonical summary");
assert.doesNotMatch(checkout, /"4\.96"|"xx"/, "checkout does not fabricate rating or review values");
assert.match(checkout, /title: listing\.title/, "summary uses the canonical property title");
assert.match(checkout, /isGuestFavorite: listing\.isGuestFavorite === true/, "badge uses the backend qualification flag");
assert.match(summary, /property\.isGuestFavorite &&/, "Guest Favorite is conditional");
assert.match(summary, /onError=\{\(\) => setFailed\(true\)\}/, "primary image has a broken-image fallback");
assert.match(summary, /sizes="\(min-width: 1280px\)/, "optimized image receives responsive sizes");
assert.match(checkout, /new AbortController\(\)/, "pricing refreshes cancel stale requests");
assert.match(checkout, /if \(!isCurrent\) return;/, "stale quote responses cannot overwrite current pricing");
assert.match(checkout, /setQuoteError\(null\);\s+setIsQuoteLoading\(true\);\s+setAdultsCount/, "guest changes trigger authoritative pricing while retaining the painted quote");
assert.match(summary, /onRetryPricing/, "failed pricing exposes retry behavior");
assert.match(summary, /aria-expanded=\{isBreakdownOpen\}/, "price breakdown exposes expansion state");
assert.match(summary, /lg:max-h-\[calc\(100vh-7rem\)\]/, "tall sticky summaries remain reachable");
assert.match(checkout, /className="order-2 lg:sticky lg:top-24"/, "summary follows the wizard on mobile and sticks on desktop");
assert.match(bookingService, /prevalidatedQuote \?\? await getBookingQuote\(/, "booking creation uses an authoritative quote and avoids request-to-book recalculation");

console.log("Phase 3 persistent booking summary regression checks passed.");
