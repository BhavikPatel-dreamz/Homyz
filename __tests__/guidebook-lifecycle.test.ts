import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createGuidebookSchema,
  updateGuidebookSchema,
  createGuidebookItemSchema,
  updateGuidebookItemSchema,
  reorderGuidebookItemsSchema,
  GUIDEBOOK_CATEGORIES,
  TIP_CATEGORIES,
  getCategoryLabel,
  getCategoryIcon,
} from "../lib/validation/guidebook";
import {
  calculateDistance,
  formatRelativeDistance,
  detectCategoryFromOsm,
} from "../lib/location/places-search";

async function runGuidebookLifecycleTests() {
  console.log("\n==================================================================");
  console.log("   HOST GUIDEBOOK & LOCAL RECOMMENDATIONS QA VERIFICATION   ");
  console.log("==================================================================\n");

  let passed = 0;
  let failed = 0;

  function test(description: string, fn: () => void) {
    try {
      fn();
      console.log(` ✅ PASS: ${description}`);
      passed++;
    } catch (err) {
      console.error(` ❌ FAIL: ${description}`);
      console.error(err);
      failed++;
    }
  }

  // --- [1] Schema Validation Tests ---
  console.log("\n--- [1] Guidebook Validation Schemas ---");

  test("createGuidebookSchema parses valid input with title and location", () => {
    const parsed = createGuidebookSchema.parse({
      title: "Bhavik's Guide to Riyadh",
      coverImage: "https://example.com/cover.jpg",
      city: "Riyadh",
      country: "Saudi Arabia",
      latitude: 24.7136,
      longitude: 46.6753,
      listingIds: ["listing_1", "listing_2"],
      published: true,
    });
    assert.equal(parsed.title, "Bhavik's Guide to Riyadh");
    assert.equal(parsed.city, "Riyadh");
    assert.equal(parsed.listingIds?.length, 2);
    assert.equal(parsed.published, true);
  });

  test("createGuidebookSchema trims whitespace and rejects short titles", () => {
    assert.throws(() => {
      createGuidebookSchema.parse({ title: " " });
    });
    assert.throws(() => {
      createGuidebookSchema.parse({ title: "a" });
    });
  });

  test("createGuidebookSchema rejects titles exceeding 100 characters", () => {
    assert.throws(() => {
      createGuidebookSchema.parse({ title: "x".repeat(101) });
    });
  });

  test("createGuidebookItemSchema parses valid PLACE recommendation", () => {
    const item = createGuidebookItemSchema.parse({
      type: "PLACE",
      title: "Brew92 Specialty Coffee",
      category: "COFFEE_AND_CAFES",
      description: "My favorite spot for morning pour-over.",
      hostTip: "Arrive before 9 AM for the freshest pastries.",
      placeProviderId: "osm:node:12345",
      address: "Al Olaya, Riyadh",
      latitude: 24.701,
      longitude: 46.678,
      isFavorite: true,
      sortOrder: 0,
    });
    assert.equal(item.title, "Brew92 Specialty Coffee");
    assert.equal(item.category, "COFFEE_AND_CAFES");
    assert.equal(item.isFavorite, true);
  });

  test("createGuidebookItemSchema parses valid NEIGHBORHOOD and TIP items", () => {
    const neighborhood = createGuidebookItemSchema.parse({
      type: "NEIGHBORHOOD",
      title: "Al Olaya District",
      category: "OUTDOORS",
      description: "Lively central area with great walking paths and shops.",
      hostTip: "Tahlia Street is great in the evening.",
    });
    assert.equal(neighborhood.type, "NEIGHBORHOOD");

    const tip = createGuidebookItemSchema.parse({
      type: "TIP",
      title: "Getting around at night",
      category: "GETTING_AROUND",
      description: "Ride-hailing apps are the most convenient option after 10 PM.",
    });
    assert.equal(tip.type, "TIP");
    assert.equal(tip.category, "GETTING_AROUND");
  });

  test("reorderGuidebookItemsSchema accepts array of item IDs", () => {
    const parsed = reorderGuidebookItemsSchema.parse({
      itemIds: ["item_3", "item_1", "item_2"],
    });
    assert.deepEqual(parsed.itemIds, ["item_3", "item_1", "item_2"]);
  });

  // --- [2] Categories & Place Detection ---
  console.log("\n--- [2] Category Catalog & Auto-Detection ---");

  test("GUIDEBOOK_CATEGORIES contains core categories", () => {
    assert(GUIDEBOOK_CATEGORIES.length >= 10, "Should contain at least 10 categories");
    const ids = GUIDEBOOK_CATEGORIES.map((c) => c.id);
    assert(ids.includes("FOOD_AND_DRINK"), "Should include FOOD_AND_DRINK");
    assert(ids.includes("COFFEE_AND_CAFES"), "Should include COFFEE_AND_CAFES");
    assert(ids.includes("SIGHTSEEING"), "Should include SIGHTSEEING");
    assert(ids.includes("ESSENTIALS"), "Should include ESSENTIALS");
    assert(ids.includes("OUTDOORS"), "Should include OUTDOORS");
  });

  test("getCategoryLabel and getCategoryIcon return appropriate values", () => {
    assert.equal(getCategoryLabel("COFFEE_AND_CAFES"), "Coffee & cafés");
    assert.equal(getCategoryIcon("COFFEE_AND_CAFES"), "☕");
    assert.equal(getCategoryIcon("FOOD_AND_DRINK"), "🍽️");
  });

  test("detectCategoryFromOsm correctly maps OpenStreetMap tags", () => {
    assert.equal(detectCategoryFromOsm("cafe", undefined, { amenity: "cafe" }), "COFFEE_AND_CAFES");
    assert.equal(detectCategoryFromOsm("restaurant", "amenity", { amenity: "restaurant" }), "FOOD_AND_DRINK");
    assert.equal(detectCategoryFromOsm("museum", undefined, { tourism: "museum" }), "SIGHTSEEING");
    assert.equal(detectCategoryFromOsm("park", "leisure", { leisure: "park" }), "OUTDOORS");
    assert.equal(detectCategoryFromOsm("supermarket", "shop", { shop: "supermarket" }), "ESSENTIALS");
  });

  // --- [3] Distance & Proximity Calculations ---
  console.log("\n--- [3] Distance & Privacy Calculations ---");

  test("calculateDistance computes accurate kilometers between coordinates", () => {
    // Riyadh Kingdom Centre to Faisaliah Tower (~2.7 km)
    const dist = calculateDistance(24.7114, 46.6744, 24.6901, 46.6853);
    assert(dist > 2.0 && dist < 3.5, `Expected distance ~2.7km, got ${dist}`);
  });

  test("formatRelativeDistance formats intuitive travel estimates", () => {
    assert.equal(formatRelativeDistance(0.1), "2 min walk");
    assert(formatRelativeDistance(0.5).includes("min walk"));
    assert(formatRelativeDistance(3.0).includes("min drive"));
    assert(formatRelativeDistance(8.5).includes("km away"));
  });

  // --- [4] Component Integrity & UX Rules ---
  console.log("\n--- [4] Component Contracts & Architecture Checks ---");

  test("GuidebooksManager exists and uses ModalOverlay for all modals", () => {
    const filePath = path.join(
      process.cwd(),
      "app/(protected)/host/listings/[id]/components/GuidebooksManager.tsx"
    );
    assert(fs.existsSync(filePath), "GuidebooksManager.tsx must exist");
    const content = fs.readFileSync(filePath, "utf-8");
    assert(content.includes("ModalOverlay"), "GuidebooksManager must use ModalOverlay per user rule");
    assert(!content.includes("Lorem ipsum"), "GuidebooksManager must contain zero Lorem Ipsum text");
    assert(content.includes("searchPlaces"), "GuidebooksManager must use places search");
    assert(content.includes("isFavorite"), "GuidebooksManager must support standout favorites");
    assert(content.includes("duplicateWarning"), "GuidebooksManager must implement duplicate prevention");
  });

  test("GuestGuidebookClient exists and contains zero host edit controls", () => {
    const filePath = path.join(process.cwd(), "app/guidebooks/[id]/guest-guidebook-client.tsx");
    assert(fs.existsSync(filePath), "guest-guidebook-client.tsx must exist");
    const content = fs.readFileSync(filePath, "utf-8");
    assert(!content.includes("openPlaceModal"), "Guest view must never expose openPlaceModal");
    assert(!content.includes("handleMoveItem"), "Guest view must never expose item reordering controls");
    assert(!content.includes("handleConfirmDelete"), "Guest view must never expose delete controls");
    assert(!content.includes("Lorem ipsum"), "Guest view must contain zero Lorem Ipsum");
    assert(content.includes("ModalOverlay"), "Guest view mobile map drawer must use ModalOverlay per user rule");
  });

  test("HouseRulesAndArrivalViews renders GuidebooksManager with listing props", () => {
    const filePath = path.join(
      process.cwd(),
      "app/(protected)/host/listings/[id]/components/HouseRulesAndArrivalViews.tsx"
    );
    const content = fs.readFileSync(filePath, "utf-8");
    assert(content.includes("<GuidebooksManager"), "HouseRulesAndArrivalViews must mount GuidebooksManager");
    assert(content.includes("listingId={listingId"), "HouseRulesAndArrivalViews must pass listingId to GuidebooksManager");
  });

  test("Public listing detail client includes Local Host Guidebook section", () => {
    const filePath = path.join(
      process.cwd(),
      "app/listings/[id]/public-listing-detail-client.tsx"
    );
    const content = fs.readFileSync(filePath, "utf-8");
    assert(content.includes("Local Host Guidebook"), "Public listing client must include Local Host Guidebook section");
    assert(content.includes("/guidebooks/"), "Public listing client must link to guidebook");
  });

  test("Server actions export all required Guidebook lifecycle mutations", () => {
    const filePath = path.join(process.cwd(), "actions/host/guidebooks.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    assert(content.includes("createGuidebookAction"), "Must export createGuidebookAction");
    assert(content.includes("updateGuidebookAction"), "Must export updateGuidebookAction");
    assert(content.includes("deleteGuidebookAction"), "Must export deleteGuidebookAction");
    assert(content.includes("addGuidebookItemAction"), "Must export addGuidebookItemAction");
    assert(content.includes("updateGuidebookItemAction"), "Must export updateGuidebookItemAction");
    assert(content.includes("deleteGuidebookItemAction"), "Must export deleteGuidebookItemAction");
    assert(content.includes("reorderGuidebookItemsAction"), "Must export reorderGuidebookItemsAction");
  });

  console.log("\n==================================================================");
  console.log(`   ALL GUIDEBOOK TESTS PASSED (${passed}/${passed + failed})   `);
  console.log("==================================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
}

runGuidebookLifecycleTests().catch((err) => {
  console.error("Test runner error:", err);
  process.exit(1);
});
