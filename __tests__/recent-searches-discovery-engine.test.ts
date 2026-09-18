import assert from "node:assert/strict";
import {
  saveRecentSearchContext,
  parseServerRecentSearches,
  type StoredSearchContext,
  RECENT_SEARCHES_COOKIE,
} from "@/lib/storage/client-history";
import {
  getUserRecentSearches,
  saveUserRecentSearch,
} from "@/services/search-analytics.service";
import { homepageService } from "@/services/homepage.service";
import { getTranslatedSectionTitle } from "@/components/home/category-carousel";
import fs from "node:fs";
import path from "node:path";

async function runTestSuite() {
  console.log("\n==================================================================");
  console.log("   RECENT SEARCHES / BASED ON YOUR SEARCHES DISCOVERY SUITE      ");
  console.log("==================================================================\n");

  // Mock localStorage and document.cookie for Node.js environment
  const mockStorage: Record<string, string> = {};
  const mockCookies: Record<string, string> = {};

  (globalThis as any).window = {
    localStorage: {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      clear: () => {
        for (const k in mockStorage) delete mockStorage[k];
      },
    },
    dispatchEvent: () => true,
  };
  (globalThis as any).localStorage = (globalThis as any).window.localStorage;
  (globalThis as any).CustomEvent = class CustomEvent {
    type: string;
    constructor(type: string) {
      this.type = type;
    }
  };

  Object.defineProperty(globalThis, "document", {
    value: {
      get cookie() {
        return Object.entries(mockCookies)
          .map(([k, v]) => `${k}=${v}`)
          .join("; ");
      },
      set cookie(val: string) {
        const [pair] = val.split(";");
        const [k, v] = pair.split("=");
        if (k) {
          mockCookies[k.trim()] = v ? v.trim() : "";
        }
      },
    },
    writable: true,
    configurable: true,
  });

  // Global fetch mock to silence /api/v1/search/track background calls
  (globalThis as any).fetch = async () => ({ ok: true });

  // --------------------------------------------------------------------------
  // [1] Client-Side Recent Searches Deduplication and Max 3–4 Capping
  // --------------------------------------------------------------------------
  console.log("--- [1] Client Search History Deduplication & Capping (Max 4) ---");

  // Search 1: London
  saveRecentSearchContext({
    query: "London",
    displayName: "London, UK",
    city: "London",
    placeType: "city",
    latitude: 51.5074,
    longitude: -0.1278,
  });

  // Search 2: Dubai
  saveRecentSearchContext({
    query: "Dubai",
    displayName: "Dubai, United Arab Emirates",
    city: "Dubai",
    placeType: "city",
    latitude: 25.2048,
    longitude: 55.2708,
  });

  // Search 3: California
  saveRecentSearchContext({
    query: "California",
    displayName: "California, USA",
    city: "California",
    placeType: "area",
    latitude: 36.7783,
    longitude: -119.4179,
  });

  // Search 4: Paris
  saveRecentSearchContext({
    query: "Paris",
    displayName: "Paris, France",
    city: "Paris",
    placeType: "city",
    latitude: 48.8566,
    longitude: 2.3522,
  });

  // Read back from localStorage
  let storedJson = mockStorage["homyz_recent_search_contexts"];
  assert(storedJson, "Recent search contexts must be stored in localStorage");
  let list: StoredSearchContext[] = JSON.parse(storedJson);

  assert.equal(list.length, 4, "Must store exactly 4 unique locations");
  assert.equal(list[0].query, "Paris", "Index 0 must be most recent (Paris)");
  assert.equal(list[1].query, "California", "Index 1 must be California");
  assert.equal(list[2].query, "Dubai", "Index 2 must be Dubai");
  assert.equal(list[3].query, "London", "Index 3 must be London");
  console.log("  ✓ Stored 4 initial unique locations (Paris, California, Dubai, London)");

  // Re-search: Dubai (should move to top without duplicating)
  saveRecentSearchContext({
    query: "Dubai",
    displayName: "Dubai, United Arab Emirates",
    city: "Dubai",
    placeType: "city",
    latitude: 25.2048,
    longitude: 55.2708,
  });

  list = JSON.parse(mockStorage["homyz_recent_search_contexts"]);
  assert.equal(list.length, 4, "Must still have 4 items after re-searching existing location");
  assert.equal(list[0].query, "Dubai", "Dubai must now be at index 0");
  assert.equal(list[1].query, "Paris", "Paris should be shifted to index 1");
  assert.equal(list[2].query, "California", "California should be shifted to index 2");
  assert.equal(list[3].query, "London", "London should be at index 3");
  console.log("  ✓ Re-searching existing location (Dubai) moves to index 0 without duplicates");

  // Search 5: Tokyo (5th unique location -> oldest 'London' should drop off)
  saveRecentSearchContext({
    query: "Tokyo",
    displayName: "Tokyo, Japan",
    city: "Tokyo",
    placeType: "city",
    latitude: 35.6762,
    longitude: 139.6503,
  });

  list = JSON.parse(mockStorage["homyz_recent_search_contexts"]);
  assert.equal(list.length, 4, "Must be capped at max 4 items when 5th search occurs");
  assert.equal(list[0].query, "Tokyo", "Tokyo must be at index 0");
  assert.equal(list[1].query, "Dubai", "Dubai must be at index 1");
  assert.equal(list[2].query, "Paris", "Paris must be at index 2");
  assert.equal(list[3].query, "California", "California must be at index 3");
  assert(!list.some((s) => s.query.toLowerCase() === "london"), "Oldest search (London) must be dropped");
  console.log("  ✓ Adding 5th unique location (Tokyo) drops oldest (London) and keeps top 4");

  // --------------------------------------------------------------------------
  // [2] Cookie Synchronization & Server-Side Parser Audit
  // --------------------------------------------------------------------------
  console.log("\n--- [2] Cookie Synchronization & SSR Parsing Audit ---");
  const rawCookieVal = mockCookies[RECENT_SEARCHES_COOKIE];
  assert(rawCookieVal, "Cookie homyz_recent_searches must be populated");
  const parsedServerSearches = parseServerRecentSearches(rawCookieVal);
  assert.equal(parsedServerSearches.length, 4, "Server cookie parser must restore 4 items");
  assert.equal(parsedServerSearches[0].query, "Tokyo", "Server item 0 matches Tokyo");
  assert.equal(parsedServerSearches[1].query, "Dubai", "Server item 1 matches Dubai");
  assert.equal(parsedServerSearches[2].query, "Paris", "Server item 2 matches Paris");
  assert.equal(parsedServerSearches[3].query, "California", "Server item 3 matches California");
  console.log("  ✓ Server cookie parsing accurately reconstructs lightweight recent search context");

  // --------------------------------------------------------------------------
  // [3] Redis Authenticated User Search Persistence
  // --------------------------------------------------------------------------
  console.log("\n--- [3] Redis User Search Persistence Audit ---");
  const testUserId = "user-test-discovery-" + Date.now();
  await saveUserRecentSearch(testUserId, {
    query: "London",
    displayName: "London, UK",
    city: "London",
    placeType: "city",
  });
  await saveUserRecentSearch(testUserId, {
    query: "Dubai",
    displayName: "Dubai, UAE",
    city: "Dubai",
    placeType: "city",
  });
  await saveUserRecentSearch(testUserId, {
    query: "California",
    displayName: "California, USA",
    city: "California",
    placeType: "state",
  });
  await saveUserRecentSearch(testUserId, {
    query: "Paris",
    displayName: "Paris, France",
    city: "Paris",
    placeType: "city",
  });

  let userSearches = await getUserRecentSearches(testUserId);
  assert.equal(userSearches.length, 4, "Redis must store top 4 searches for user");
  assert.equal(userSearches[0].query, "Paris");
  assert.equal(userSearches[3].query, "London");

  // Re-search Dubai for logged-in user
  await saveUserRecentSearch(testUserId, {
    query: "Dubai",
    displayName: "Dubai, UAE",
    city: "Dubai",
    placeType: "city",
  });
  userSearches = await getUserRecentSearches(testUserId);
  assert.equal(userSearches.length, 4);
  assert.equal(userSearches[0].query, "Dubai", "Dubai promoted to index 0 in Redis");
  console.log("  ✓ Redis user recent search tracking deduplicates and maintains 30-day top 4");

  // --------------------------------------------------------------------------
  // [4] Dynamic Recent Search Property Rows Generation
  // --------------------------------------------------------------------------
  console.log("\n--- [4] Dynamic Recent Search Property Rows Generation ---");
  const sections = await homepageService.getRecentSearchSections({
    searches: [
      {
        query: "Surat",
        displayName: "Surat, Gujarat, India",
        city: "Surat",
        placeType: "city",
        latitude: 21.1702,
        longitude: 72.8311,
      },
      {
        query: "Burj Khalifa",
        displayName: "Burj Khalifa, Dubai, United Arab Emirates",
        city: "Dubai",
        placeType: "landmark",
        latitude: 25.1972,
        longitude: 55.2744,
      },
      {
        query: "Atlantis The Palm",
        displayName: "Atlantis The Palm, Dubai, United Arab Emirates",
        city: "Dubai",
        placeType: "landmark",
        latitude: 25.1304,
        longitude: 55.1171,
      },
      {
        query: "NonExistentPlaceXYZ999",
        displayName: "NonExistentPlaceXYZ999",
        city: "NonExistentPlaceXYZ999",
        placeType: "city",
        latitude: 0,
        longitude: 0,
      },
    ],
    limit: 4,
  });

  console.log(`  ✓ Generated ${sections.length} recent search sections`);
  assert(sections.length > 0, "Should generate sections for available locations");

  // Verify that NonExistentPlaceXYZ999 has NO section (empty rows omitted!)
  const emptyRow = sections.find((s) => s.id.includes("NonExistentPlaceXYZ999"));
  assert(!emptyRow, "Locations with 0 available properties must NOT generate empty rows");
  console.log("  ✓ Locations with 0 properties are omitted (no empty rows displayed)");

  // Check section titles
  for (const s of sections) {
    assert(
      s.title.startsWith("Stays in ") || s.title.startsWith("Stays near "),
      `Section title must be 'Stays in {loc}' or 'Stays near {loc}', got: '${s.title}'`
    );
    assert(s.properties.length > 0, `Section '${s.title}' must contain at least 1 property card`);
    assert(s.seeAllHref.startsWith("/listings"), `Section seeAllHref must route to /listings, got: '${s.seeAllHref}'`);

    // Verify card properties
    const card = s.properties[0];
    assert(card.id, "Card must have listing id");
    assert(card.title, "Card must have title");
    assert(card.pricePerNight > 0, "Card must have pricePerNight > 0");
    assert(card.currency, "Card must have currency");
    assert(card.city, "Card must have city");
    console.log(`    • ${s.title}: ${s.properties.length} properties | seeAll: ${s.seeAllHref}`);
  }

  // --------------------------------------------------------------------------
  // [5] Internationalization / Title Translations
  // --------------------------------------------------------------------------
  console.log("\n--- [5] Section Title Translation Audit ---");
  const enMessages = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "messages/en.json"), "utf-8")
  );
  assert(enMessages.home_section_stays_in, "en.json must contain home_section_stays_in");
  assert(enMessages.home_section_stays_near, "en.json must contain home_section_stays_near");

  const mockT = (key: string, params?: Record<string, string>) => {
    if (key === "home_section_stays_in") return `Stays in ${params?.location}`;
    if (key === "home_section_stays_near") return `Stays near ${params?.location}`;
    return key;
  };

  const titleIn = getTranslatedSectionTitle("Stays in Paris", mockT);
  assert.equal(titleIn, "Stays in Paris");
  const titleNear = getTranslatedSectionTitle("Stays near Burj Khalifa", mockT);
  assert.equal(titleNear, "Stays near Burj Khalifa");
  console.log("  ✓ getTranslatedSectionTitle handles 'Stays in {location}' and 'Stays near {location}'");

  // --------------------------------------------------------------------------
  // [6] Codebase Wiring & Component Audit
  // --------------------------------------------------------------------------
  console.log("\n--- [6] Component Wiring Audit ---");
  const homeViewSrc = fs.readFileSync(path.join(process.cwd(), "components/home/home-view.tsx"), "utf-8");
  assert(homeViewSrc.includes("recentSearchSections"), "home-view.tsx must reference recentSearchSections");
  assert(homeViewSrc.includes("saveRecentSearchContext"), "home-view.tsx must call saveRecentSearchContext on search");

  const listingsClientSrc = fs.readFileSync(path.join(process.cwd(), "app/listings/listings-results-client.tsx"), "utf-8");
  assert(listingsClientSrc.includes("saveRecentSearchContext"), "listings-results-client.tsx must call saveRecentSearchContext");

  const appPageSrc = fs.readFileSync(path.join(process.cwd(), "app/page.tsx"), "utf-8");
  assert(appPageSrc.includes("getUserRecentSearches"), "app/page.tsx must call getUserRecentSearches");
  assert(appPageSrc.includes("parseServerRecentSearches"), "app/page.tsx must call parseServerRecentSearches");
  assert(appPageSrc.includes("getRecentSearchSections"), "app/page.tsx must call getRecentSearchSections");
  console.log("  ✓ Full integration wiring confirmed across home-view, listings-results-client, and app/page.tsx");

  console.log("\n==================================================================");
  console.log("   ALL RECENT SEARCHES DISCOVERY SUITE TESTS PASSED!              ");
  console.log("==================================================================\n");
}

runTestSuite().catch((err) => {
  console.error("Test failure:", err);
  process.exit(1);
});
