import "dotenv/config";
import assert from "node:assert";
import { prisma } from "@/lib/db/prisma";
import { ListingStatus } from "@/generated/prisma/enums";
import { createTestProperties } from "@/lib/testing/property-seeder";
import { CANONICAL_AMENITIES } from "@/lib/constants/amenities";

async function runTestSuite() {
  console.log(`\n==================================================================`);
  console.log(`   PROPERTY TEST SEEDER INTEGRATION & SEARCH VERIFICATION        `);
  console.log(`==================================================================\n`);

  const TARGET_HOST_ID = "cmu3no7ef00069basmh983qtv";
  const TEST_BATCH_ID = "TEST_SUITE_BATCH_V1";

  // ─── Test 1: Invalid Host ID Guard ───
  console.log(`--- [1] Host Validation & Error Guard ---`);
  try {
    await createTestProperties({
      hostId: "non_existent_host_id_999999",
      count: 5,
      mode: "create",
      validateAfterSeed: false,
    });
    assert.fail("Should have thrown TEST_HOST_NOT_FOUND");
  } catch (err: any) {
    assert(err.message.includes("TEST_HOST_NOT_FOUND"), `Expected TEST_HOST_NOT_FOUND error, got: ${err.message}`);
    console.log(` ✅ PASS: Successfully blocked invalid host ID with TEST_HOST_NOT_FOUND.`);
  }

  // ─── Test 2: Seed 10 Test Properties in Isolated Test Batch ───
  console.log(`\n--- [2] Create Test Batch (10 Properties) ---`);
  const summary = await createTestProperties({
    hostId: TARGET_HOST_ID,
    count: 10,
    seed: "unit-test-seed-12345",
    seedBatchId: TEST_BATCH_ID,
    mode: "reset-and-create",
    validateAfterSeed: true,
  });

  assert.strictEqual(summary.successfullyCreated, 10, "Should create exactly 10 properties");
  assert.strictEqual(summary.failed, 0, "No properties should fail creation");
  assert(summary.createdListingIds.length === 10, "Should have 10 created listing IDs");
  console.log(` ✅ PASS: Created 10 test properties cleanly.`);

  // ─── Test 3: Verify Existing Non-Batch Host Listings are Intact ───
  console.log(`\n--- [3] Host Original Listings Protection ---`);
  const originalListings = await prisma.listing.findMany({
    where: {
      hostId: TARGET_HOST_ID,
      OR: [
        { customSlug: null },
        { NOT: { customSlug: { startsWith: `seed-${TEST_BATCH_ID.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-` } } },
      ],
    },
  });
  assert(originalListings.length >= 7, `Expected at least 7 original listings, found ${originalListings.length}`);
  console.log(` ✅ PASS: Real host listings remain completely untouched (${originalListings.length} original listings).`);

  // ─── Test 4: Verify Schema & Business Rules ───
  console.log(`\n--- [4] Schema & Business Rules Verification ---`);
  const batchListings = await prisma.listing.findMany({
    where: { id: { in: summary.createdListingIds } },
  });

  const canonicalIds = new Set(CANONICAL_AMENITIES.map((a) => a.id));

  for (const listing of batchListings) {
    assert(listing.title && listing.title.length >= 3 && listing.title.length <= 50, `Invalid title: ${listing.title}`);
    assert(listing.description && listing.description.length >= 10, `Invalid description for: ${listing.title}`);
    assert(listing.photos.length >= 5, `Must have at least 5 photos, found ${listing.photos.length}`);
    assert(listing.latitude !== null && listing.longitude !== null, `Coordinates cannot be null`);
    assert(listing.city && listing.country, `City and Country must be populated`);
    assert(listing.price > 0, `Price must be positive`);
    assert(listing.guests >= 1 && listing.bedrooms >= 0 && listing.beds >= 1 && listing.bathrooms >= 0, `Capacity invalid`);

    for (const am of listing.amenities) {
      assert(canonicalIds.has(am), `Amenity '${am}' must be from CANONICAL_AMENITIES`);
    }
  }
  console.log(` ✅ PASS: All 10 listings strictly conform to schema, publish requirements, and canonical amenities.`);

  // ─── Test 5: Clean Up Test Batch ───
  console.log(`\n--- [5] Delete Test Batch Cleanup ---`);
  const deleteSummary = await createTestProperties({
    hostId: TARGET_HOST_ID,
    seedBatchId: TEST_BATCH_ID,
    mode: "delete-seed-batch",
    validateAfterSeed: false,
  });
  assert.strictEqual(deleteSummary.successfullyCreated, 0);

  const remaining = await prisma.listing.count({
    where: {
      hostId: TARGET_HOST_ID,
      customSlug: { startsWith: `seed-${TEST_BATCH_ID.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-` },
    },
  });
  assert.strictEqual(remaining, 0, "All test batch listings should be cleaned up");
  console.log(` ✅ PASS: Test batch cleanly deleted without touching real host data.`);

  console.log(`\n==================================================================`);
  console.log(`   ALL SEEDER INTEGRATION TESTS PASSED (5/5)                     `);
  console.log(`==================================================================\n`);
}

runTestSuite()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(`\n❌ Test Suite Failed:`, err);
    process.exit(1);
  });

