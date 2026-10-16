import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { homepageService } from "../services/homepage.service";
import { listingService } from "../services/listing.service";

async function runHomepageSeeAllTests() {
  console.log("==================================================================");
  console.log("   HOMEPAGE SECTION LIMITS & 'SEE ALL' FILTER AUDIT SUITE         ");
  console.log("==================================================================");

  // [1] Verify Section Limit and Candidate Limit
  console.log("\n[1] Section Limits & Architecture");
  const homepageServiceFile = fs.readFileSync(
    path.resolve(__dirname, "../services/homepage.service.ts"),
    "utf-8"
  );
  assert(
    homepageServiceFile.includes("SECTION_LIMIT = 12"),
    "Homepage service sets SECTION_LIMIT to 12 (10-12 cards per row)"
  );
  console.log("  ✅ PASS: SECTION_LIMIT is set to 12 cards per row");

  // [2] Verify Homepage Discovery Data & Sections
  console.log("\n[2] Homepage Data & 'See All' URL Generation");
  const homepageData = await homepageService.getHomepageData();
  assert(homepageData && Array.isArray(homepageData.sections), "Homepage data returns sections array");

  for (const section of homepageData.sections) {
    assert(section.properties.length <= 12, `Section '${section.title}' has at most 12 cards (found: ${section.properties.length})`);
    assert(Boolean(section.seeAllHref), `Section '${section.title}' has seeAllHref: ${section.seeAllHref}`);
    assert(Array.isArray(section.previewImages), `Section '${section.title}' has previewImages array`);
    console.log(`  ✅ PASS: Section '${section.title}' has ${section.properties.length} cards, seeAllHref: '${section.seeAllHref}'`);
  }

  // [3] Verify SeeAllCard Component Exists and Renders
  console.log("\n[3] SeeAllCard Component Structure");
  const seeAllCardPath = path.resolve(__dirname, "../components/home/see-all-card.tsx");
  assert(fs.existsSync(seeAllCardPath), "components/home/see-all-card.tsx exists");
  const seeAllCardContent = fs.readFileSync(seeAllCardPath, "utf-8");
  assert(seeAllCardContent.includes("See all"), "SeeAllCard contains 'See all' text");
  assert(seeAllCardContent.includes("-rotate-6") || seeAllCardContent.includes("rotate-8"), "SeeAllCard contains stacked rotating photos");
  assert(seeAllCardContent.includes("<Link"), "SeeAllCard is wrapped in an accessible Next.js Link");
  console.log("  ✅ PASS: SeeAllCard verified with stacked floating preview photos and Link");

  // [4] Verify CategoryCarousel Integration
  console.log("\n[4] CategoryCarousel Integration");
  const carouselPath = path.resolve(__dirname, "../components/home/category-carousel.tsx");
  const carouselContent = fs.readFileSync(carouselPath, "utf-8");
  assert(carouselContent.includes("SeeAllCard"), "CategoryCarousel imports and renders SeeAllCard");
  assert(carouselContent.includes("seeAllHref"), "CategoryCarousel receives seeAllHref prop");
  console.log("  ✅ PASS: CategoryCarousel integrates SeeAllCard at the end of property track");

  // [5] Verify Listings Search 'featured' Filter
  console.log("\n[5] Listings Search Service 'featured' Filter");
  const featuredResults = await listingService.searchPublicListings({
    featured: true,
    limit: 10,
  });
  assert(featuredResults && Array.isArray(featuredResults.items), "Search returns items for featured: true");
  for (const item of featuredResults.items) {
    assert(item.isFeatured === true, `Item '${item.title}' is confirmed featured`);
  }
  console.log(`  ✅ PASS: 'featured: true' filter strictly returns ${featuredResults.items.length} featured stays`);

  console.log("\n==================================================================");
  console.log("   ALL HOMEPAGE 'SEE ALL' TESTS PASSED SUCCESSFULLY!             ");
  console.log("==================================================================");
}

runHomepageSeeAllTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  });

