import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { homepageService } from "@/services/homepage.service";

async function runHomepageDiscoveryPaginationTests() {
  console.log("\n==================================================================");
  console.log("   HOMEPAGE DISCOVERY, LAZY LOADING & PAGINATION AUDIT           ");
  console.log("==================================================================\n");

  // [1] Verify deferOffscreenProperties in getHomepageData
  console.log("--- [1] Initial Page Load: Defer Offscreen Property Datasets ---");
  const deferredData = await homepageService.getHomepageData({
    deferOffscreenProperties: true,
    initialLoadedSectionsCount: 2,
  });

  assert(deferredData && Array.isArray(deferredData.sections), "Homepage returns sections array");
  assert(deferredData.sections.length >= 2, "Homepage contains at least 2 sections");

  // Section 0 and 1 must have properties populated for instant initial viewport SSR
  assert(
    deferredData.sections[0].properties.length > 0,
    `Section 0 (${deferredData.sections[0].title}) must have initial properties populated for SSR`,
  );
  assert(
    deferredData.sections[1].properties.length > 0,
    `Section 1 (${deferredData.sections[1].title}) must have initial properties populated for SSR`,
  );

  // Section >= 2 must have empty properties (deferred) while retaining metadata
  for (let i = 2; i < deferredData.sections.length; i++) {
    const s = deferredData.sections[i];
    assert.equal(
      s.properties.length,
      0,
      `Offscreen section ${i} (${s.title}) must have 0 properties in initial SSR payload`,
    );
    assert(s.totalCount > 0, `Offscreen section ${i} (${s.title}) must retain totalCount metadata`);
    assert(s.id, `Offscreen section ${i} must retain id`);
    assert(s.title, `Offscreen section ${i} must retain title`);
    assert(s.seeAllHref, `Offscreen section ${i} must retain seeAllHref`);
  }
  console.log("  ✓ Section metadata separated from card data on initial load!");
  console.log("  ✓ First 2 visible sections populated for instant viewport paint; offscreen sections deferred!");

  // [2] Test getSectionProperties and horizontal cursor/page pagination
  console.log("\n--- [2] Section Discovery API & Horizontal Carousel Pagination ---");
  const testSectionId = deferredData.sections[0].id;
  const page1 = await homepageService.getSectionProperties({
    sectionId: testSectionId,
    page: 1,
    limit: 6,
  });

  assert.equal(page1.sectionId, testSectionId, "Page 1 matches sectionId");
  assert.equal(page1.page, 1, "Page 1 returns page: 1");
  assert(page1.properties.length <= 6, "Page 1 respects limit of 6");
  console.log(`  • Page 1 returned ${page1.properties.length} cards (total: ${page1.totalCount}, hasMore: ${page1.hasMore})`);

  if (page1.hasMore) {
    const page2 = await homepageService.getSectionProperties({
      sectionId: testSectionId,
      page: 2,
      limit: 6,
    });

    assert.equal(page2.page, 2, "Page 2 returns page: 2");
    console.log(`  • Page 2 returned ${page2.properties.length} cards (hasMore: ${page2.hasMore})`);

    // Verify card deduplication: Page 1 and Page 2 must not have overlapping IDs
    const page1Ids = new Set(page1.properties.map((p) => p.id));
    for (const card of page2.properties) {
      assert(
        !page1Ids.has(card.id),
        `Page 2 contains overlapping card ID ${card.id} found in Page 1`,
      );
    }
    console.log("  ✓ Progressive pagination verified with zero card overlap across pages!");
  } else {
    console.log("  ✓ Page 1 contains all available items; hasMore correctly false");
  }

  // [3] Progressive offscreen section fetching
  console.log("\n--- [3] Progressive Fetching of Offscreen Section ---");
  const offscreenSectionId = deferredData.sections[2].id;
  const offscreenResult = await homepageService.getSectionProperties({
    sectionId: offscreenSectionId,
    page: 1,
    limit: 8,
  });

  assert.equal(offscreenResult.sectionId, offscreenSectionId, "Offscreen section resolved");
  assert(offscreenResult.properties.length > 0, "Offscreen section returns property cards on demand");
  assert(offscreenResult.properties[0].pricing, "Cards contain authoritative pricing view model");
  assert(offscreenResult.properties[0].currency, "Cards contain resolved currency");
  console.log(`  ✓ Offscreen section '${offscreenResult.title}' loaded ${offscreenResult.properties.length} cards on demand!`);

  // [4] Code architecture verification
  console.log("\n--- [4] Component & API Route Wiring Verification ---");
  const sectionsRoutePath = path.resolve(__dirname, "../app/api/v1/homepage/sections/[id]/route.ts");
  assert(fs.existsSync(sectionsRoutePath), "app/api/v1/homepage/sections/[id]/route.ts must exist");
  const sectionsRouteContent = fs.readFileSync(sectionsRoutePath, "utf-8");
  assert(sectionsRouteContent.includes("getSectionProperties"), "API route must call getSectionProperties");

  const lazySectionPath = path.resolve(__dirname, "../components/home/lazy-section.tsx");
  assert(fs.existsSync(lazySectionPath), "components/home/lazy-section.tsx must exist");
  const lazySectionContent = fs.readFileSync(lazySectionPath, "utf-8");
  assert(lazySectionContent.includes("IntersectionObserver"), "LazySection must use IntersectionObserver");
  assert(lazySectionContent.includes("sectionDataCache"), "LazySection must use module-level cache");
  assert(lazySectionContent.includes("handleLoadMore"), "LazySection must provide handleLoadMore");
  assert(lazySectionContent.includes("MAX_CONCURRENT_FETCHES"), "LazySection must throttle concurrent fetches");

  const carouselPath = path.resolve(__dirname, "../components/home/category-carousel.tsx");
  const carouselContent = fs.readFileSync(carouselPath, "utf-8");
  assert(carouselContent.includes("onLoadMore"), "CategoryCarousel must support onLoadMore prop");
  assert(carouselContent.includes("isLoadingMore"), "CategoryCarousel must support isLoadingMore prop");

  console.log("  ✓ API endpoints, lazy loader, cache, and carousel wiring verified!");

  console.log("\n==================================================================");
  console.log("   ALL HOMEPAGE DISCOVERY & PAGINATION AUDITS PASSED! (4/4)      ");
  console.log("==================================================================\n");
}

runHomepageDiscoveryPaginationTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

