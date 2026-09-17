import assert from "node:assert/strict";
import {
  saveRecentSearchContext,
  getRecentSearchContexts,
  parseServerRecentSearches,
  clearRecentSearchContexts,
  RECENT_SEARCHES_KEY,
  RECENT_SEARCHES_COOKIE,
  type StoredSearchContext,
} from "../lib/storage/client-history";
import { homepageService } from "../services/homepage.service";

async function runRecentSearchesHomepageRowsSuite() {
  console.log("\n==================================================================");
  console.log("   TEST SUITE: Multiple Recent Searches Homepage Rows             ");
  console.log("==================================================================\n");

  // Mock browser window, localStorage and document.cookie
  const storageMock: Record<string, string> = {};
  let cookieMock = "";

  (global as any).window = {};
  (global as any).localStorage = {
    getItem: (key: string) => storageMock[key] ?? null,
    setItem: (key: string, val: string) => {
      storageMock[key] = String(val);
    },
    removeItem: (key: string) => {
      delete storageMock[key];
    },
    clear: () => {
      for (const k in storageMock) delete storageMock[k];
    },
  };

  (global as any).document = {
    get cookie() {
      return cookieMock;
    },
    set cookie(val: string) {
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

  // --- [1] Storage & Cookie Multi-Search Persistence ---
  console.log("--- [1] Multi-Search Sequence Persistence ---");

  clearRecentSearchContexts();
  assert.equal(getRecentSearchContexts().length, 0, "Initial recent searches must be empty");

  // Search 1: London
  saveRecentSearchContext({
    query: "London",
    displayName: "London, United Kingdom",
    placeType: "city",
    city: "London",
    country: "United Kingdom",
    latitude: 51.5074,
    longitude: -0.1278,
    guests: 1,
  });

  // Search 2: Dubai
  saveRecentSearchContext({
    query: "Dubai",
    displayName: "Dubai, United Arab Emirates",
    placeType: "city",
    city: "Dubai",
    country: "United Arab Emirates",
    latitude: 25.2048,
    longitude: 55.2708,
    guests: 2,
    checkIn: "2026-10-15",
    checkOut: "2026-10-22",
  });

  // Search 3: California
  saveRecentSearchContext({
    query: "California",
    displayName: "California, United States",
    placeType: "area",
    city: "California",
    country: "United States",
    latitude: 36.7783,
    longitude: -119.4179,
    guests: 3,
  });

  const stored = getRecentSearchContexts();
  assert.equal(stored.length, 3, "Must store all 3 distinct past searches");
  assert.equal(stored[0].city, "California", "Latest search (California) must be at index 0");
  assert.equal(stored[1].city, "Dubai", "Second search (Dubai) must be at index 1");
  assert.equal(stored[2].city, "London", "Third search (London) must be at index 2");
  console.log("  ✓ Multi-search history order verified: [California, Dubai, London]");

  // Verify cookie sync for SSR
  assert(cookieMock.includes(RECENT_SEARCHES_COOKIE), "Must sync to homyz_recent_searches cookie");
  const cookieVal = decodeURIComponent(cookieMock.split("=")[1].split(";")[0]);
  const parsedFromCookie = parseServerRecentSearches(cookieVal);
  assert.equal(parsedFromCookie.length, 3, "parseServerRecentSearches must parse 3 searches");
  assert.equal(parsedFromCookie[0].city, "California");
  assert.equal(parsedFromCookie[1].city, "Dubai");
  console.log("  ✓ parseServerRecentSearches successfully hydrated recent searches from cookie for SSR");

  // --- [2] Backend Discovery Engine Extra Rows ---
  console.log("\n--- [2] Backend Discovery Engine getRecentSearchSections ---");

  // Test 2.1: Deduplication against active search location
  const currentSearch = "California";
  const sections = await homepageService.getRecentSearchSections({
    searches: stored,
    currentLocationQuery: currentSearch,
    limit: 4,
  });

  // California should NOT be in the extra rows since it is the current active search!
  const sectionCities = sections.map((s) => s.title);
  assert(
    !sectionCities.some((t) => t.toLowerCase().includes("california")),
    "Current active search (California) must be excluded from extra past search rows",
  );
  console.log("  ✓ Current active search (California) excluded from extra past search rows");

  // Test 2.2: Titles & structure
  for (const s of sections) {
    assert(s.id.startsWith("recent-search-"), "Section id must have prefix 'recent-search-'");
    assert(s.title.startsWith("Homes in") || s.title.startsWith("Homes near"), "Section title must follow 'Homes in/near {location}'");
    assert(s.seeAllHref.startsWith("/listings?"), "seeAllHref must target /listings");
    assert(s.properties.length > 0, "Sections must not be empty");
    assert(Array.isArray(s.properties), "Must supply property cards in properties array");
  }
  console.log(`  ✓ Generated ${sections.length} extra past search carousel rows with verified titles and seeAllHref links`);

  // Test 2.3: Cap at max 3-4 extra rows
  const manySearches = [
    { query: "City1", city: "City1", placeType: "city" as const },
    { query: "City2", city: "City2", placeType: "city" as const },
    { query: "City3", city: "City3", placeType: "city" as const },
    { query: "City4", city: "City4", placeType: "city" as const },
    { query: "City5", city: "City5", placeType: "city" as const },
    { query: "City6", city: "City6", placeType: "city" as const },
  ];
  const cappedSections = await homepageService.getRecentSearchSections({
    searches: manySearches,
    limit: 4,
  });
  assert(cappedSections.length <= 4, "Must never return more than 4 extra rows");
  console.log("  ✓ Strict cap of max 3-4 extra rows enforced");

  // Clean up
  clearRecentSearchContexts();
  assert.equal(getRecentSearchContexts().length, 0, "clearRecentSearchContexts must clear history");
  console.log("  ✓ clearRecentSearchContexts cleanly purges search history");

  console.log("\n==================================================================");
  console.log("   ALL RECENT SEARCHES HOMEPAGE ROWS TESTS PASSED!                ");
  console.log("==================================================================\n");
}

runRecentSearchesHomepageRowsSuite().catch((err) => {
  console.error("Test suite failed:", err);
  process.exit(1);
});
