import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  validateSearchContext,
  parseServerLastSearch,
  saveLastSearch,
  getLastSearch,
  clearLastSearch,
  LAST_SEARCH_KEY,
  LAST_SEARCH_COOKIE,
  MAX_SEARCH_AGE_DAYS,
  type PersistedSearchContext,
} from "@/lib/storage/client-history";
import type { SearchContext } from "@/lib/location/search-context";

// Polyfill window & localStorage & document for Node environment test
const storageMock: Record<string, string> = {};
let cookieMock = "";

(global as any).window = {};
(global as any).localStorage = {
  getItem: (key: string) => storageMock[key] ?? null,
  setItem: (key: string, val: string) => {
    storageMock[key] = val;
  },
  removeItem: (key: string) => {
    delete storageMock[key];
  },
  clear: () => {
    for (const k of Object.keys(storageMock)) delete storageMock[k];
  },
};
(global as any).document = {
  get cookie() {
    return cookieMock;
  },
  set cookie(val: string) {
    // Basic cookie mock supporting key=val; path=/; max-age=...
    const [pair] = val.split(";");
    const [k, v] = pair.split("=");
    if (val.includes("max-age=0") || val.includes("expires=Thu, 01 Jan 1970")) {
      const parts = cookieMock.split("; ").filter((c) => !c.startsWith(`${k.trim()}=`));
      cookieMock = parts.join("; ");
    } else {
      const parts = cookieMock.split("; ").filter((c) => c && !c.startsWith(`${k.trim()}=`));
      parts.push(`${k.trim()}=${v}`);
      cookieMock = parts.join("; ");
    }
  },
};

async function runSearchPersistenceSuite() {
  console.log("\n==================================================================");
  console.log("   SEARCH-LOCATION PERSISTENCE FLOW AUDIT SUITE                   ");
  console.log("==================================================================\n");

  // Clean mock state
  (global as any).localStorage.clear();
  cookieMock = "";

  // --- [1] Normalized PersistedSearchContext Validation ---
  console.log("--- [1] Normalized SearchContext Validation ---");

  const validDubai: PersistedSearchContext = {
    query: "Dubai",
    displayName: "Dubai, United Arab Emirates",
    placeId: "place:dubai",
    placeType: "city",
    latitude: 25.2048,
    longitude: 55.2708,
    city: "Dubai",
    country: "United Arab Emirates",
    checkIn: "2026-10-15",
    checkOut: "2026-10-22",
    guests: 2,
    adults: 2,
    children: 0,
    infants: 0,
    pets: 0,
    searchedAt: new Date().toISOString(),
    filters: {
      minPrice: 500,
      maxPrice: 3000,
      propertyType: "Apartment",
    },
  };

  const validated = validateSearchContext(validDubai);
  assert(validated !== null, "Valid search context must pass validation");
  assert.equal(validated.query, "Dubai");
  assert.equal(validated.city, "Dubai");
  assert.equal(validated.guests, 2);
  assert.equal(validated.checkIn, "2026-10-15");
  assert.equal(validated.checkOut, "2026-10-22");
  assert.equal(validated.filters?.propertyType, "Apartment");
  console.log("  ✓ Valid search context normalized with all location, dates, guests & filter metadata");

  // Invalid / Corrupt validation checks
  assert.equal(validateSearchContext(null), null, "Null must return null");
  assert.equal(validateSearchContext("not an object"), null, "Primitive must return null");
  assert.equal(validateSearchContext({ query: "" }), null, "Empty query without coords must return null");

  // 30-Day Expiration Check
  const expiredDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  const expiredSearch = { ...validDubai, searchedAt: expiredDate };
  assert.equal(validateSearchContext(expiredSearch), null, "Searches older than 30 days must be expired");
  console.log("  ✓ 30-day expiration check verified (older searches safely rejected)");

  // --- [2] Centralized Storage Service (saveLastSearch, getLastSearch, clearLastSearch) ---
  console.log("\n--- [2] Centralized Persistence Service Audit ---");

  // 2.1 Save initial search: Dubai
  const saved = saveLastSearch(validDubai);
  assert(saved !== null, "saveLastSearch must succeed for valid context");
  assert(storageMock[LAST_SEARCH_KEY], "Must write to localStorage");
  assert(cookieMock.includes(LAST_SEARCH_COOKIE), "Must write to homyz_last_search cookie");

  const retrieved = getLastSearch();
  assert(retrieved !== null, "getLastSearch must retrieve active saved search");
  assert.equal(retrieved.displayName, "Dubai, United Arab Emirates");
  console.log("  ✓ saveLastSearch and getLastSearch verified across localStorage and cookie");

  // 2.2 Location Replacement: Dubai -> London
  const validLondon: PersistedSearchContext = {
    query: "London",
    displayName: "London, United Kingdom",
    placeId: "place:london",
    placeType: "city",
    latitude: 51.5074,
    longitude: -0.1278,
    city: "London",
    country: "United Kingdom",
    checkIn: "2026-11-01",
    checkOut: "2026-11-07",
    guests: 3,
    searchedAt: new Date().toISOString(),
  };

  saveLastSearch(validLondon);
  const activeSearch = getLastSearch();
  assert(activeSearch !== null, "Active search must exist");
  assert.equal(activeSearch.query, "London", "Active search must immediately replace Dubai with London");
  assert.notEqual(activeSearch.query, "Dubai", "Stale Dubai context must not remain");
  console.log("  ✓ New search immediately replaces prior search (Dubai -> London)");

  // 2.3 Date & Guest updates
  const updatedLondon = {
    ...activeSearch,
    checkIn: "2026-11-05",
    checkOut: "2026-11-12",
    guests: 4,
  };
  saveLastSearch(updatedLondon);
  const reloaded = getLastSearch();
  assert(reloaded !== null, "Reloaded search must exist");
  assert.equal(reloaded.checkIn, "2026-11-05", "Check-in date update must persist");
  assert.equal(reloaded.guests, 4, "Guest count update must persist");
  console.log("  ✓ Date and guest count adjustments update the stored search context");

  // 2.4 Clear search
  clearLastSearch();
  assert.equal(getLastSearch(), null, "clearLastSearch must purge active search");
  assert.equal(storageMock[LAST_SEARCH_KEY], undefined, "localStorage must be empty after clear");
  assert(!cookieMock.includes(LAST_SEARCH_COOKIE), "Cookie must be expired/removed after clear");
  console.log("  ✓ clearLastSearch cleanly purges both localStorage and cookie");

  // --- [3] Server-Side SSR Cookie Resolution Audit ---
  console.log("\n--- [3] Server-Side SSR Cookie Parser Audit ---");

  const serializedCookie = encodeURIComponent(JSON.stringify(validDubai));
  const serverResolved = parseServerLastSearch(serializedCookie);
  assert(serverResolved !== null, "parseServerLastSearch must parse valid URL-encoded cookie string");
  assert.equal(serverResolved.city, "Dubai");

  // Server error safety
  assert.equal(parseServerLastSearch("corrupt json{"), null, "Corrupt cookie must return null safely");
  assert.equal(parseServerLastSearch(""), null, "Empty cookie must return null safely");
  console.log("  ✓ parseServerLastSearch safely validates cookie payload for SSR in app/page.tsx");

  // --- [4] Codebase Integration Audit ---
  console.log("\n--- [4] Codebase Integration Audit ---");

  // 4.1 Server Page: app/page.tsx
  const pageCode = fs.readFileSync(path.resolve(__dirname, "../app/page.tsx"), "utf-8");
  assert(pageCode.includes("cookies"), "app/page.tsx must read cookies for SSR restoration");
  assert(pageCode.includes("parseServerLastSearch"), "app/page.tsx must use parseServerLastSearch");
  assert(pageCode.includes("clear"), "app/page.tsx must handle clear search param");
  assert(!pageCode.includes("redirect(\"/search"), "app/page.tsx must NOT redirect on manual homepage visits");
  assert(!pageCode.includes("redirect(\"/listings"), "app/page.tsx must NOT redirect on manual homepage visits");
  console.log("  ✓ app/page.tsx reads cookies for zero-flicker SSR without redirecting homepage visits");

  // 4.2 Home View: components/home/home-view.tsx
  const homeViewCode = fs.readFileSync(path.resolve(__dirname, "../components/home/home-view.tsx"), "utf-8");
  assert(homeViewCode.includes("saveLastSearch"), "home-view.tsx must call saveLastSearch on search submission");
  assert(homeViewCode.includes("router.push(`/listings"), "home-view.tsx must navigate to /listings search results page");
  assert(homeViewCode.includes("clearLastSearch"), "home-view.tsx must clear last search on reset");
  assert(!homeViewCode.includes("Continue searching in"), "Banner must not be rendered on homepage");
  console.log("  ✓ components/home/home-view.tsx navigates to /listings on search & renders clean discovery carousels without banner");

  // 4.3 Search Results Client: app/listings/listings-results-client.tsx
  const listingsCode = fs.readFileSync(path.resolve(__dirname, "../app/listings/listings-results-client.tsx"), "utf-8");
  assert(listingsCode.includes("saveLastSearch"), "listings-results-client.tsx must synchronize URL search state into saveLastSearch");
  console.log("  ✓ listings-results-client.tsx synchronizes URL state as source of truth into saveLastSearch");

  // 4.4 Next.js rewrite: next.config.ts
  const nextConfigCode = fs.readFileSync(path.resolve(__dirname, "../next.config.ts"), "utf-8");
  assert(nextConfigCode.includes("source: \"/search\""), "next.config.ts must rewrite /search to /listings");
  assert(nextConfigCode.includes("destination: \"/listings\""), "next.config.ts destination must be /listings");
  console.log("  ✓ next.config.ts includes rewrite for /search -> /listings");

  console.log("\n==================================================================");
  console.log("   ALL SEARCH-LOCATION PERSISTENCE TESTS PASSED!                  ");
  console.log("==================================================================\n");
}

runSearchPersistenceSuite().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});

