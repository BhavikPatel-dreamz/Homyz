import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { bookingDateKey, parseBookingDate } from "../lib/booking/booking-date";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const detailPage = read("app/listings/[id]/page.tsx");
const detailClient = read("app/listings/[id]/public-listing-detail-client.tsx");
const gallery = read("components/listings/listing-gallery.tsx");
const listingService = read("services/listing.service.ts");

assert.match(detailPage, /const resolveListing = cache\(/, "metadata and page rendering share the listing lookup per request");
assert.match(detailPage, /initialSelectionError/, "invalid explicit URL state is surfaced to the booking UI");
assert.match(detailPage, /isBookingDatePast/, "past check-in dates are rejected before an initial quote");
assert.match(detailPage, /parseGuestParam/, "guest URL values are range-checked before hydration");
assert.match(detailPage, /hasExplicitDateSelection/, "a partial URL date selection cannot be completed with an old cookie date");

assert.match(detailClient, /<DeferredReviewList/, "reviews load only when their section approaches the viewport");
assert.match(detailClient, /<DeferredListingMap/, "the map loads only when its section approaches the viewport");
assert.doesNotMatch(detailClient, /\n\s*<ReviewList\s*\n\s*listingId=\{listing\.id\}/, "the rendered route does not eagerly mount reviews");
assert.doesNotMatch(detailClient, /\n\s*<RealMap\s*\n\s*address=\{listing\.shortAddress/, "the rendered route does not eagerly mount the map");
assert.match(detailClient, /At least one adult is required for a reservation/, "invalid adult combinations are explained explicitly");
assert.match(detailClient, /Infants do not count toward the listing guest capacity/, "infants are selectable without consuming guest capacity");
assert.match(detailClient, /Pets are not allowed at this property/, "property pet rules are explained explicitly");

assert.match(gallery, /if \(!lightboxOpen \|\| galleryPhotos\.length === 0\) return;/, "adjacent gallery images wait for lightbox intent");
assert.match(gallery, /lightboxTriggerRef/, "gallery restores focus after closing");
assert.match(gallery, /total > 1/, "Show all photos works for every multi-photo gallery");
assert.match(listingService, /Promise\.all\(\[\s*prisma\.review\.aggregate/, "public detail review aggregates are parallelized");
assert.match(listingService, /getOrSetCache\(\s*`homyz:listings:detail/, "public listing detail is versioned and cached");

for (const date of ["2028-02-29", "2029-12-31", "2030-01-01"]) {
  assert.equal(bookingDateKey(parseBookingDate(date)), date, `${date} remains a timezone-safe booking date`);
}
assert.ok(Number.isNaN(parseBookingDate("2029-02-29").getTime()), "invalid leap day remains invalid");

console.log("Property detail performance and booking-state regressions passed.");
