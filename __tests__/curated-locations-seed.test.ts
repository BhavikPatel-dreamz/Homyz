import {
  CURATED_LOCATION_COUNTRIES,
  CURATED_LOCATION_COUNT,
  validateCuratedLocationSeed,
  SeedCountry,
  SeedLocation,
} from "@/data/locations.seed";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log("▶ Running Curated Locations Seed Unit Tests...\n");

  // Test 1: Country count
  assert(CURATED_LOCATION_COUNTRIES.length === 20, "Must have exactly 20 countries");
  console.log("  ✓ Exactly 20 countries defined");

  // Test 2: Total locations count
  assert(CURATED_LOCATION_COUNT === 100, "Must have exactly 100 locations in total");
  console.log("  ✓ Exactly 100 locations in total");

  // Test 3: Locations per country
  for (const country of CURATED_LOCATION_COUNTRIES) {
    assert(
      country.locations.length === 5,
      `Country ${country.name} (${country.code}) must have exactly 5 locations, found ${country.locations.length}`,
    );
  }
  console.log("  ✓ Every country has exactly 5 locations");

  // Test 4: Country codes uniqueness and format
  const countryCodes = new Set<string>();
  for (const country of CURATED_LOCATION_COUNTRIES) {
    assert(/^[A-Z]{2}$/.test(country.code), `Country code ${country.code} must be 2 uppercase letters`);
    assert(!countryCodes.has(country.code), `Duplicate country code ${country.code}`);
    countryCodes.add(country.code);
  }
  console.log("  ✓ All 20 country codes are unique 2-letter uppercase codes");

  // Test 5: Slugs uniqueness and format
  const slugs = new Set<string>();
  const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  for (const country of CURATED_LOCATION_COUNTRIES) {
    for (const loc of country.locations) {
      assert(slugRegex.test(loc.slug), `Slug '${loc.slug}' must be lowercase and hyphen-separated`);
      assert(!slugs.has(loc.slug), `Duplicate location slug '${loc.slug}'`);
      slugs.add(loc.slug);
    }
  }
  console.log("  ✓ All 100 location slugs are unique and properly formatted");

  // Test 6: Coordinates validity
  for (const country of CURATED_LOCATION_COUNTRIES) {
    for (const loc of country.locations) {
      assert(
        loc.latitude >= -90 && loc.latitude <= 90,
        `Latitude for ${loc.name} must be between -90 and 90, received ${loc.latitude}`,
      );
      assert(
        loc.longitude >= -180 && loc.longitude <= 180,
        `Longitude for ${loc.name} must be between -180 and 180, received ${loc.longitude}`,
      );
    }
  }
  console.log("  ✓ All coordinates are valid within range [-90, 90] and [-180, 180]");

  // Test 7: Currency and Timezone
  for (const country of CURATED_LOCATION_COUNTRIES) {
    assert(country.currencyCode.length === 3, `Currency code ${country.currencyCode} must be 3 letters`);
    for (const loc of country.locations) {
      assert(
        loc.currencyCode === country.currencyCode,
        `Location ${loc.name} currency (${loc.currencyCode}) must match country (${country.currencyCode})`,
      );
      assert(
        typeof loc.timezone === "string" && loc.timezone.includes("/"),
        `Location ${loc.name} timezone '${loc.timezone}' must be a valid IANA timezone`,
      );
    }
  }
  console.log("  ✓ All currencies and timezones are valid and match countries");

  // Test 8: validateCuratedLocationSeed function succeeds
  validateCuratedLocationSeed();
  console.log("  ✓ validateCuratedLocationSeed() executed without error");

  // Test 9: Display order sequence (1 to 5 per country)
  for (const country of CURATED_LOCATION_COUNTRIES) {
    const orders = country.locations.map((l) => l.displayOrder);
    assert(
      JSON.stringify(orders) === JSON.stringify([1, 2, 3, 4, 5]),
      `Display orders for ${country.name} must be [1, 2, 3, 4, 5], found ${JSON.stringify(orders)}`,
    );
  }
  console.log("  ✓ Display orders are sequential 1..5 for all countries");

  console.log("\n🎉 All 9 Curated Locations Seed Unit Tests passed successfully!\n");
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

