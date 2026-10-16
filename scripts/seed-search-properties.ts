import "dotenv/config";
import { createTestProperties, type CreateTestPropertiesOptions } from "@/lib/testing/property-seeder";

async function main() {
  // 1. Production Environment Guard
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_PRODUCTION_SEED !== "true") {
    console.error(`\n❌ CRITICAL ERROR: Property test seeder cannot be run in a production environment.`);
    console.error(`This tool is intended strictly for development, staging, and automated testing.\n`);
    process.exit(1);
  }

  // 2. Parse Command Line Arguments
  const args = process.argv.slice(2);
  let hostId = process.env.HOST_ID || "cmu3no7ef00069basmh983qtv";
  let count = 100;
  let seed = "homyz-search-testing-v1";
  let seedBatchId = "SEARCH_TEST_100_V1";
  let mode: CreateTestPropertiesOptions["mode"] = "create";
  let validateAfterSeed = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--hostId" || arg === "-h") {
      hostId = args[++i];
    } else if (arg.startsWith("--hostId=")) {
      hostId = arg.split("=")[1];
    } else if (arg === "--count" || arg === "-c") {
      count = parseInt(args[++i], 10) || 100;
    } else if (arg.startsWith("--count=")) {
      count = parseInt(arg.split("=")[1], 10) || 100;
    } else if (arg === "--seed" || arg === "-s") {
      seed = args[++i];
    } else if (arg.startsWith("--seed=")) {
      seed = arg.split("=")[1];
    } else if (arg === "--batch" || arg === "-b") {
      seedBatchId = args[++i];
    } else if (arg.startsWith("--batch=")) {
      seedBatchId = arg.split("=")[1];
    } else if (arg === "--reset") {
      mode = "reset-and-create";
    } else if (arg === "--delete") {
      mode = "delete-seed-batch";
    } else if (arg === "--no-validate") {
      validateAfterSeed = false;
    }
  }

  try {
    const summary = await createTestProperties({
      hostId,
      count,
      seed,
      seedBatchId,
      mode,
      validateAfterSeed,
    });

    // 3. Formatted Final Test Report
    console.log(`\n==================================================================`);
    console.log(`   FINAL PROPERTY TEST SEEDER REPORT                              `);
    console.log(`==================================================================`);
    console.log(` Host ID:                 ${summary.hostId}`);
    console.log(` Seed Batch ID:           ${summary.seedBatchId}`);
    console.log(` Requested Properties:    ${summary.requestedProperties}`);
    console.log(` Successfully Created:    ${summary.successfullyCreated}`);
    console.log(` Failed:                  ${summary.failed}`);
    console.log(` Published / Active:      ${summary.published}`);
    console.log(` Draft:                   ${summary.draft}`);
    console.log(` Pending Review:          ${summary.pending}`);
    console.log(` Stopped / Paused:        ${summary.stopped}`);
    console.log(` Countries Used (${summary.countriesUsed.length}):      ${summary.countriesUsed.join(", ")}`);
    console.log(` Cities Used (${summary.citiesUsed.length}):         ${summary.citiesUsed.join(", ")}`);
    console.log(` Neighborhoods Used (${summary.neighborhoodsUsed.length}):  ${summary.neighborhoodsUsed.join(", ")}`);
    console.log(` Property Types Used (${summary.propertyTypesUsed.length}): ${summary.propertyTypesUsed.join(", ")}`);
    console.log(` Min Price:               ${(summary.minPrice / 100).toFixed(2)} (${summary.minPrice} cents)`);
    console.log(` Max Price:               ${(summary.maxPrice / 100).toFixed(2)} (${summary.maxPrice} cents)`);

    if (summary.searchTestsPassed !== undefined) {
      console.log(` Search Tests Passed:     ${summary.searchTestsPassed}`);
      console.log(` Search Tests Failed:     ${summary.searchTestsFailed}`);
    }

    if (summary.createdListingIds.length > 0) {
      console.log(`\n Sample Created IDs (first 10 of ${summary.createdListingIds.length}):`);
      summary.createdListingIds.slice(0, 10).forEach((id, idx) => {
        console.log(`   ${idx + 1}. ${id}`);
      });
      if (summary.createdListingIds.length > 10) {
        console.log(`   ... and ${summary.createdListingIds.length - 10} more.`);
      }
    }
    console.log(`==================================================================\n`);

    process.exit(summary.failed > 0 ? 1 : 0);
  } catch (err: unknown) {
    console.error(`\n❌ Seeder execution failed:`, err);
    process.exit(1);
  }
}

main();

