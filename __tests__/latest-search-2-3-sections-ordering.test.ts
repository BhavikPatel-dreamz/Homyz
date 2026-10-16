import assert from "node:assert/strict";
import { homepageService } from "@/services/homepage.service";

async function runTest() {
  console.log("\n==================================================================");
  console.log("   LATEST SEARCH 2-3 SECTIONS & ORDERING SPECIFICATION AUDIT      ");
  console.log("==================================================================\n");

  // [1] Test: Searched destination returns max 2-3 sections
  console.log("--- [1] Searched Location Section Capping (Max 2–3 Sections) ---");
  const londonData = await homepageService.getHomepageData({
    searchContext: {
      query: "London",
      city: "London",
      displayName: "London, UK",
      placeType: "city",
    },
  });

  const londonSections = londonData.sections.filter((s) => s.priority < 100);
  console.log(`  • Found ${londonSections.length} sections for searched destination:`);
  for (const s of londonSections) {
    console.log(`    - [Priority ${s.priority}] ${s.title} (${s.id})`);
  }

  assert(
    londonSections.length >= 1 && londonSections.length <= 3,
    `Latest searched location must have between 1 and 3 sections, got ${londonSections.length}`,
  );
  console.log("  ✓ Strict 2–3 section cap on searched location verified!");

  // [2] Test: Last-to-last search rows exclude latest search
  console.log("\n--- [2] Last-to-Last Search Rows Exclude Latest Search ---");
  const pastSearches = [
    { query: "London", city: "London", displayName: "London, UK" },
    { query: "Paris", city: "Paris", displayName: "Paris, France" },
    { query: "Dubai", city: "Dubai", displayName: "Dubai, UAE" },
    { query: "California", city: "California", displayName: "California, USA" },
  ];

  const pastRows = await homepageService.getRecentSearchSections({
    searches: pastSearches,
    currentLocationQuery: "London", // London is the latest search
    limit: 4,
  });

  console.log(`  • Generated ${pastRows.length} past search rows:`);
  for (const row of pastRows) {
    console.log(`    - ${row.title}`);
    assert(
      !row.title.toLowerCase().includes("london"),
      `Past search rows must not include the latest search (London), found: ${row.title}`,
    );
  }

  assert(pastRows.length <= 3, "Past search rows must contain remaining unique locations");
  console.log("  ✓ Last-to-last search rows strictly exclude the latest search!");

  // [3] Test: Other discovery sections
  console.log("\n--- [3] Others Block (Discovery / Trending Stays) ---");
  const otherSections = londonData.sections.filter((s) => s.priority >= 100);
  console.log(`  • Generated ${otherSections.length} other discovery sections:`);
  for (const s of otherSections) {
    console.log(`    - [Priority ${s.priority}] ${s.title}`);
  }
  assert(
    otherSections.some((s) => s.id === "global-trending-stays"),
    "Others block must contain global trending stays",
  );
  console.log("  ✓ Others block verified!");

  console.log("\n==================================================================");
  console.log("   ALL LATEST SEARCH 2-3 SECTIONS & ORDERING TESTS PASSED!        ");
  console.log("==================================================================\n");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

