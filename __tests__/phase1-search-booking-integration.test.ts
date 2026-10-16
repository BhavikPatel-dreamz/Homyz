import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  publicListingSearchFiltersSchema,
  validatePublicListingSearchFilters,
} from "../lib/validation/public-listing-search";
import { buildTravelQueryParams, parseSearchQueryParams } from "../lib/storage/client-history";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const futureStay = {
  checkIn: "2099-06-10",
  checkOut: "2099-06-14",
  guests: 3,
  adults: 2,
  children: 1,
  infants: 1,
  pets: 1,
};

const valid = validatePublicListingSearchFilters({
  ...futureStay,
  city: "Paris",
  country: "France",
  lat: 48.8566,
  lng: 2.3522,
  radiusKm: 12,
  page: 2,
  limit: 20,
});
assert.equal(valid.country, "France", "country-only narrowing survives shared validation");
assert.equal(valid.checkIn, "2099-06-10", "search dates are canonicalized as date-only strings");
assert.equal(valid.checkOut, "2099-06-14");

for (const [label, query] of Object.entries({
  "incomplete dates": { checkIn: "2099-06-10" },
  "invalid calendar date": { ...futureStay, checkIn: "2099-02-30" },
  "reversed dates": { ...futureStay, checkIn: "2099-06-14", checkOut: "2099-06-10" },
  "past check-in": { ...futureStay, checkIn: "2000-01-01", checkOut: "2000-01-03" },
  "unpaired coordinates": { ...futureStay, lat: 25 },
  "out-of-range latitude": { ...futureStay, lat: 91, lng: 25 },
  "invalid page": { ...futureStay, page: Number.NaN },
  "oversized limit": { ...futureStay, limit: 101 },
  "negative guests": { ...futureStay, guests: -1 },
  "reversed prices": { ...futureStay, minPrice: 500, maxPrice: 499 },
  "inverted map bounds": {
    ...futureStay,
    mapBounds: { neLat: 10, neLng: 10, swLat: 11, swLng: 9 },
  },
})) {
  assert.equal(
    publicListingSearchFiltersSchema.safeParse(query).success,
    false,
    `${label} must be rejected instead of silently broadening the search`,
  );
}

const detailParams = buildTravelQueryParams({
  ...futureStay,
  city: "Paris",
  country: "France",
  latitude: 48.8566,
  longitude: 2.3522,
  radiusKm: 12,
  placeId: "place-paris",
  placeType: "city",
});
assert.equal(detailParams.get("country"), "France");
assert.equal(detailParams.get("infants"), "1");
assert.equal(detailParams.get("pets"), "1");
assert.equal(detailParams.get("lat"), "48.8566");
assert.equal(detailParams.get("lng"), "2.3522");

const refreshedContext = parseSearchQueryParams(detailParams);
assert.equal(refreshedContext.country, "France", "refresh parsing retains country context");
assert.equal(refreshedContext.city, "Paris", "refresh parsing retains city context");
assert.equal(refreshedContext.latitude, 48.8566, "refresh parsing retains coordinates");
assert.equal(refreshedContext.infants, 1, "refresh parsing retains infant count");

const apiRoute = read("app/api/v1/listings/route.ts");
const listingsPage = read("app/listings/page.tsx");
const listingService = read("services/listing.service.ts");
const homeView = read("components/home/home-view.tsx");
const resultsClient = read("app/listings/listings-results-client.tsx");

assert.match(apiRoute, /validatePublicListingSearchFilters/, "API search uses shared validation");
assert.match(apiRoute, /country/, "API search reads country context");
assert.match(apiRoute, /All four map bounds must be provided together/, "partial map bounds return a validation error");
assert.match(listingsPage, /publicListingSearchFiltersSchema\.safeParse/, "SSR search validates URL input");
assert.match(listingsPage, /errorMessage/, "SSR validation feedback reaches the result UI");
assert.match(listingService, /validatePublicListingSearchFilters\(filters\)/, "service remains a defensive validation boundary");
assert.match(listingService, /filters\.country/, "country reaches the Prisma search predicate");
assert.match(homeView, /sp\.set\("country", params\.country\.trim\(\)\)/, "homepage search serializes country");
assert.match(resultsClient, /activeErrorMessage/, "client displays API validation feedback");

console.log("Phase 1 search and booking integration regression checks passed.");
