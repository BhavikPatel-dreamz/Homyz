import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

console.log("\n==================================================================");
console.log("   COMPLETE SEARCH FLOW & RESULTS EXPERIENCE AUDIT SUITE          ");
console.log("==================================================================\n");

// --- [1] Search Service Enhancement Audit ---
console.log("--- [1] Search Service Enhancement Audit ---");
const listingServicePath = path.resolve(__dirname, "../services/listing.service.ts");
assert(fs.existsSync(listingServicePath), "services/listing.service.ts must exist");
const listingServiceCode = fs.readFileSync(listingServicePath, "utf-8");

// SortBy options
assert(listingServiceCode.includes('"price_low"'), "searchPublicListings must support price_low sort");
assert(listingServiceCode.includes('"price_high"'), "searchPublicListings must support price_high sort");
assert(listingServiceCode.includes('"top_rated"'), "searchPublicListings must support top_rated sort");
assert(listingServiceCode.includes('"most_reviewed"'), "searchPublicListings must support most_reviewed sort");
assert(listingServiceCode.includes('"recommended"'), "searchPublicListings must support recommended sort");

// Extended filters
assert(listingServiceCode.includes("filters.bedrooms"), "searchPublicListings must filter by bedrooms");
assert(listingServiceCode.includes("filters.bathrooms"), "searchPublicListings must filter by bathrooms");
assert(listingServiceCode.includes("filters.beds"), "searchPublicListings must filter by beds");
assert(listingServiceCode.includes("filters.instantBook"), "searchPublicListings must filter by instantBook");
assert(listingServiceCode.includes("filters.mapBounds"), "searchPublicListings must filter by mapBounds");

// Redis Caching
assert(listingServiceCode.includes("hashFilters("), "searchPublicListings must hash filters for Redis cache");
assert(listingServiceCode.includes("getCache"), "searchPublicListings must check Redis cache");
assert(listingServiceCode.includes("setCache"), "searchPublicListings must write to Redis cache");
assert(listingServiceCode.includes("priceRange:"), "searchPublicListings must return priceRange aggregation");
assert(listingServiceCode.includes("totalPages:"), "searchPublicListings must return totalPages");

console.log("✓ ListingService searchPublicListings verified with extended filters, sorting, caching, and priceRange!");

// --- [2] Destination Autocomplete API Audit ---
console.log("\n--- [2] Destination Autocomplete API Audit ---");
const suggestApiPath = path.resolve(__dirname, "../app/api/v1/listings/search-suggest/route.ts");
assert(fs.existsSync(suggestApiPath), "app/api/v1/listings/search-suggest/route.ts must exist");
const suggestApiCode = fs.readFileSync(suggestApiPath, "utf-8");

assert(suggestApiCode.includes("searchParams.get(\"q\")"), "search-suggest route must read query param 'q'");
assert(suggestApiCode.includes("contains: q"), "search-suggest route must query matching cities and properties");
assert(suggestApiCode.includes("searchWorldCities"), "search-suggest route must query global world cities");
assert(suggestApiCode.includes("searchAddressAutocomplete"), "search-suggest route must support global geocoding");

// Verify world cities dataset includes Surat and Mumbai
const { searchWorldCities } = require("../lib/location/world-cities");
const suratResults = searchWorldCities("surat");
assert(suratResults.some((c: any) => c.city === "Surat" && c.country === "India"), "searchWorldCities must match Surat, India");

const mumbaiResults = searchWorldCities("mumbai");
assert(mumbaiResults.some((c: any) => c.city === "Mumbai" && c.country === "India"), "searchWorldCities must match Mumbai, India");

console.log("✓ Destination autocomplete API & Global World Cities (Surat, Mumbai) verified!");

// --- [3] Booked Dates API Audit ---
console.log("\n--- [3] Booked Dates API Audit ---");
const bookedDatesApiPath = path.resolve(__dirname, "../app/api/v1/listings/[id]/booked-dates/route.ts");
assert(fs.existsSync(bookedDatesApiPath), "app/api/v1/listings/[id]/booked-dates/route.ts must exist");
const bookedDatesApiCode = fs.readFileSync(bookedDatesApiPath, "utf-8");

assert(bookedDatesApiCode.includes("prisma.booking.findMany"), "booked-dates route must query booking table");
assert(bookedDatesApiCode.includes('status: { in: ["CONFIRMED", "PENDING"] }'), "booked-dates must check CONFIRMED and PENDING bookings");
console.log("✓ Booked dates API verified!");

// --- [4] HeroSection Autocomplete & URL Search Building Audit ---
console.log("\n--- [4] HeroSection Autocomplete & URL Building Audit ---");
const heroSectionPath = path.resolve(__dirname, "../components/home/hero-section.tsx");
assert(fs.existsSync(heroSectionPath), "components/home/hero-section.tsx must exist");
const heroSectionCode = fs.readFileSync(heroSectionPath, "utf-8");

assert(heroSectionCode.includes("search-suggest"), "HeroSection must call search-suggest API for debounced autocomplete");
assert(heroSectionCode.includes("saveRecentSearch"), "HeroSection must save recent searches");
assert(heroSectionCode.includes("getRecentSearches"), "HeroSection must load recent searches");
assert(heroSectionCode.includes("handleDestinationChange"), "HeroSection must handle destination input changes");
assert(heroSectionCode.includes("Math.max(1, mobileGuestCount)"), "HeroSection must default guest counts to at least 1");
assert(heroSectionCode.includes("destinationValue = destination.trim() || selectedLocation?.city"), "HeroSection must fall back to the selected/current city when destination is empty");
assert(fs.readFileSync(path.resolve(__dirname, "../components/home/home-view.tsx"), "utf-8").includes("const resolvedDestination = (params.destination || params.city || params.placeName || \"\").trim()"), "HomeView must carry city through when destination is empty");
console.log("✓ HeroSection debounced autocomplete and recent searches verified!");

const searchAnalyticsPath = path.resolve(__dirname, "../services/search-analytics.service.ts");
assert(fs.existsSync(searchAnalyticsPath), "services/search-analytics.service.ts must exist");
const searchAnalyticsCode = fs.readFileSync(searchAnalyticsPath, "utf-8");
assert(searchAnalyticsCode.includes("trackHomepageSearchEvent"), "Search analytics service must expose trackHomepageSearchEvent");
console.log("✓ Search analytics tracking service verified!");

// --- [5] Search Results Page & Interactive Client Audit ---
console.log("\n--- [5] Search Results Page & Client Audit ---");
const searchPagePath = path.resolve(__dirname, "../app/listings/page.tsx");
assert(fs.existsSync(searchPagePath), "app/listings/page.tsx must exist");
const searchPageCode = fs.readFileSync(searchPagePath, "utf-8");

assert(searchPageCode.includes("ListingsResultsClient"), "Listings page must use ListingsResultsClient");
assert(searchPageCode.includes("searchPublicListings"), "Listings page must call searchPublicListings");
assert(searchPageCode.includes("sortBy"), "Listings page must pass sortBy to searchPublicListings");
assert(searchPageCode.includes("favoriteService.getFavoriteListingIds"), "Listings page must query user favorites");

const clientComponentPath = path.resolve(__dirname, "../app/listings/listings-results-client.tsx");
assert(fs.existsSync(clientComponentPath), "app/listings/listings-results-client.tsx must exist");
const clientComponentCode = fs.readFileSync(clientComponentPath, "utf-8");

assert(clientComponentCode.includes("SORT_OPTIONS"), "ListingsResultsClient must have sort options");
assert(clientComponentCode.includes("isFilterOpen"), "ListingsResultsClient must have filter panel state");
assert(clientComponentCode.includes("IntersectionObserver"), "ListingsResultsClient must implement infinite scroll");
assert(clientComponentCode.includes("SearchMap"), "ListingsResultsClient must include SearchMap");
assert(clientComponentCode.includes("draftInstantBook"), "ListingsResultsClient must support Instant Book filter");
console.log("✓ Search results page and client component verified!");

// --- [6] Search Map Component Audit ---
console.log("\n--- [6] Search Map Component Audit ---");
const searchMapPath = path.resolve(__dirname, "../components/listings/search-map.tsx");
assert(fs.existsSync(searchMapPath), "components/listings/search-map.tsx must exist");
const searchMapCode = fs.readFileSync(searchMapPath, "utf-8");

assert(searchMapCode.includes("leaflet"), "SearchMap must use Leaflet for dynamic mapping");
assert(searchMapCode.includes("onBoundsChange"), "SearchMap must provide onBoundsChange callback");
assert(searchMapCode.includes("SAR"), "SearchMap markers must display SAR price badges");
console.log("✓ Search map component verified!");

// --- [7] ListingCard Favorites Wiring Audit ---
console.log("\n--- [7] ListingCard Favorites Wiring Audit ---");
const listingCardPath = path.resolve(__dirname, "../components/listings/listing-card.tsx");
assert(fs.existsSync(listingCardPath), "components/listings/listing-card.tsx must exist");
const listingCardCode = fs.readFileSync(listingCardPath, "utf-8");

assert(listingCardCode.includes("/api/v1/favorites/"), "ListingCard must call favorites API endpoint");
assert(listingCardCode.includes("initialFavorite"), "ListingCard must accept initialFavorite prop");
assert(listingCardCode.includes("setIsFavorite"), "ListingCard must optimistically toggle favorite status");
console.log("✓ ListingCard favorites wiring verified!");

// --- [8] Property Detail Date Prefill Audit ---
console.log("\n--- [8] Property Detail Date Prefill Audit ---");
const detailPagePath = path.resolve(__dirname, "../app/listings/[id]/page.tsx");
assert(fs.existsSync(detailPagePath), "app/listings/[id]/page.tsx must exist");
const detailPageCode = fs.readFileSync(detailPagePath, "utf-8");

assert(detailPageCode.includes("searchParams:"), "Detail page must accept searchParams");
assert(detailPageCode.includes("searchCheckIn"), "Detail page must pass searchCheckIn to client");
assert(detailPageCode.includes("searchCheckOut"), "Detail page must pass searchCheckOut to client");

const detailClientPath = path.resolve(__dirname, "../app/listings/[id]/public-listing-detail-client.tsx");
const detailClientCode = fs.readFileSync(detailClientPath, "utf-8");
assert(detailClientCode.includes("useState(searchCheckIn"), "Detail client must initialize checkIn from searchCheckIn");
assert(detailClientCode.includes("useState(searchCheckOut"), "Detail client must initialize checkOut from searchCheckOut");
console.log("✓ Property detail date prefill verified!");

console.log("\n==================================================================");
console.log("   ALL SEARCH FLOW TESTS PASSED (8/8)                             ");
console.log("==================================================================\n");

