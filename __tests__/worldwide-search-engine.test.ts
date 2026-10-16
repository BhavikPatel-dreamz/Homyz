import assert from "node:assert";
import { searchPlacesAutocomplete, forwardGeocodeQuery, reverseGeocodeCoords } from "../lib/location/places-provider";
import { searchWorldLandmarks, findLandmarkByNameOrId } from "../lib/location/world-landmarks";
import { listingService } from "../services/listing.service";

console.log("==================================================================");
console.log("   WORLDWIDE GLOBAL SEARCH & LANDMARK ENGINE VERIFICATION SUITE   ");
console.log("==================================================================");

async function runAllTests() {
  let passed = 0;
  let failed = 0;

  function pass(testName: string, detail?: string) {
    passed++;
    console.log(`  ✅ PASS: ${testName}${detail ? ` -> ${detail}` : ""}`);
  }

  function fail(testName: string, err: any) {
    failed++;
    console.error(`  ❌ FAIL: ${testName}`, err);
  }

  // ── [1] Global Landmarks & POIs Resolution ──────────────────────────────────
  console.log("\n[1] Global Landmarks & POIs Resolution");

  try {
    const burj = findLandmarkByNameOrId("Burj Khalifa");
    assert(burj, "Burj Khalifa must exist in world landmarks registry");
    assert.strictEqual(burj?.city, "Dubai");
    assert(Math.abs(burj.latitude - 25.1972) < 0.01);
    assert(Math.abs(burj.longitude - 55.2744) < 0.01);
    pass("Burj Khalifa coordinates", `${burj.latitude}, ${burj.longitude} (${burj.city})`);
  } catch (err) { fail("Burj Khalifa coordinates", err); }

  try {
    const eiffel = findLandmarkByNameOrId("Eiffel Tower");
    assert(eiffel, "Eiffel Tower must exist in world landmarks registry");
    assert.strictEqual(eiffel?.city, "Paris");
    assert(Math.abs(eiffel.latitude - 48.8584) < 0.01);
    pass("Eiffel Tower coordinates", `${eiffel.latitude}, ${eiffel.longitude} (${eiffel.city})`);
  } catch (err) { fail("Eiffel Tower coordinates", err); }

  try {
    const timesSquare = findLandmarkByNameOrId("Times Square");
    assert(timesSquare, "Times Square must exist in registry");
    assert.strictEqual(timesSquare?.city, "New York");
    pass("Times Square coordinates", `${timesSquare.latitude}, ${timesSquare.longitude}`);
  } catch (err) { fail("Times Square coordinates", err); }

  try {
    const suratStation = findLandmarkByNameOrId("Surat Railway Station");
    assert(suratStation, "Surat Railway Station must exist in registry");
    assert.strictEqual(suratStation?.city, "Surat");
    pass("Surat Railway Station coordinates", `${suratStation.latitude}, ${suratStation.longitude}`);
  } catch (err) { fail("Surat Railway Station coordinates", err); }

  try {
    const dumas = findLandmarkByNameOrId("Dumas Beach");
    assert(dumas, "Dumas Beach must exist in registry");
    assert.strictEqual(dumas?.city, "Surat");
    pass("Dumas Beach coordinates", `${dumas.latitude}, ${dumas.longitude}`);
  } catch (err) { fail("Dumas Beach coordinates", err); }

  // ── [2] Typo Tolerance & Fuzzy Search ───────────────────────────────────────
  console.log("\n[2] Typo Tolerance & Fuzzy Search");

  const typos = [
    { query: "burj kalifa", expected: "Burj Khalifa" },
    { query: "surt station", expected: "Surat Railway Station" },
    { query: "dubia marina", expected: "Dubai Marina" },
    { query: "jumera beach", expected: "Jumeirah Beach" },
  ];

  for (const { query, expected } of typos) {
    try {
      const results = searchWorldLandmarks(query, 5);
      assert(results.length > 0, `Search for typo '${query}' must return results`);
      const matched = results.some(r => r.name.toLowerCase().includes(expected.toLowerCase()));
      assert(matched, `Results for typo '${query}' must include '${expected}'`);
      pass(`Typo tolerance '${query}'`, `Resolved to '${results[0].name}'`);
    } catch (err) { fail(`Typo tolerance '${query}'`, err); }
  }

  // ── [3] Multilingual / Arabic Queries ───────────────────────────────────────
  console.log("\n[3] Multilingual & Arabic Support");

  const multilingual = [
    { query: "برج خليفة", expected: "Burj Khalifa" },
    { query: "نخلة جميرا", expected: "Palm Jumeirah" },
    { query: "دبي مول", expected: "Dubai Mall" },
  ];

  for (const { query, expected } of multilingual) {
    try {
      const results = searchWorldLandmarks(query, 5);
      assert(results.length > 0, `Arabic query '${query}' must return results`);
      assert.strictEqual(results[0].name, expected);
      pass(`Arabic query '${query}'`, `Matched '${results[0].name}'`);
    } catch (err) { fail(`Arabic query '${query}'`, err); }
  }

  // ── [4] Forward & Reverse Geocoding ─────────────────────────────────────────
  console.log("\n[4] Forward & Reverse Geocoding");

  try {
    const burjGeo = await forwardGeocodeQuery("Burj Khalifa");
    assert(burjGeo, "Forward geocode of Burj Khalifa must succeed");
    assert(Math.abs(burjGeo.latitude - 25.1972) < 0.05);
    pass("Forward geocode 'Burj Khalifa'", `Lat: ${burjGeo.latitude}, Lng: ${burjGeo.longitude}`);
  } catch (err) { fail("Forward geocode 'Burj Khalifa'", err); }

  try {
    const rev = await reverseGeocodeCoords(25.1972, 55.2744);
    assert(rev, "Reverse geocoding Dubai coords must succeed");
    assert.strictEqual(rev.city, "Dubai");
    pass("Reverse geocode Dubai coordinates", `${rev.name}, ${rev.country}`);
  } catch (err) { fail("Reverse geocode Dubai coordinates", err); }

  // ── [5] Landmark Proximity & Distance Ranking ───────────────────────────────
  console.log("\n[5] Landmark Proximity & Distance Ranking");

  try {
    const res = await listingService.searchPublicListings({
      destination: "Burj Khalifa",
    });
    assert(res.total > 0, "Must find stays near Burj Khalifa in Dubai");
    assert.strictEqual(res.locationContextName, "Burj Khalifa");
    assert(res.items.length > 0);

    // Verify distance sorting: item 0 <= item 1 <= item 2
    for (let i = 0; i < res.items.length - 1; i++) {
      const d1 = res.items[i].distanceKm ?? 0;
      const d2 = res.items[i + 1].distanceKm ?? 0;
      assert(d1 <= d2 + 0.001, `Item ${i} distance (${d1}) must be <= item ${i+1} distance (${d2})`);
    }
    const closest = res.items[0];
    assert((closest.distanceKm ?? 10) < 1.0, `Closest stay must be within 1 km, got ${closest.distanceKm}`);
    pass("Burj Khalifa nearest property ranking", `Top stay '${closest.title}' is ${closest.distanceKm} km away`);
  } catch (err) { fail("Burj Khalifa nearest property ranking", err); }

  try {
    const res = await listingService.searchPublicListings({
      destination: "Surat Railway Station",
    });
    assert(res.total > 0, "Must find stays near Surat Railway Station");
    assert.strictEqual(res.locationContextName, "Surat Railway Station");
    const closest = res.items[0];
    assert((closest.distanceKm ?? 10) < 1.0, `Closest stay must be within 1 km, got ${closest.distanceKm}`);
    pass("Surat Railway Station nearest ranking", `Top stay '${closest.title}' is ${closest.distanceKm} km away`);
  } catch (err) { fail("Surat Railway Station nearest ranking", err); }

  try {
    const res = await listingService.searchPublicListings({
      destination: "Dumas Beach",
    });
    assert(res.total > 0, "Must find stays near Dumas Beach");
    assert.strictEqual(res.locationContextName, "Dumas Beach");
    const closest = res.items[0];
    assert((closest.distanceKm ?? 10) < 2.0, `Closest stay must be within 2 km, got ${closest.distanceKm}`);
    pass("Dumas Beach nearest ranking", `Top stay '${closest.title}' is ${closest.distanceKm} km away`);
  } catch (err) { fail("Dumas Beach nearest ranking", err); }

  // ── [6] Pets & Guests Policies ───────────────────────────────────────────────
  console.log("\n[6] Capacity & Policy Filters");

  try {
    const res = await listingService.searchPublicListings({
      city: "Surat",
      guests: 6,
    });
    assert(res.total > 0, "Must find stays in Surat for 6 guests");
    for (const item of res.items) {
      assert(item.guests >= 6, `Listing guests (${item.guests}) must be >= 6`);
    }
    pass("Guest capacity filtering (guests >= 6)", `All ${res.items.length} items satisfy capacity`);
  } catch (err) { fail("Guest capacity filtering", err); }

  try {
    const res = await listingService.searchPublicListings({
      city: "Surat",
      pets: 1,
    });
    for (const item of res.items) {
      assert(item.petsAllowed === true, "Must have petsAllowed true");
    }
    pass("Pet policy filtering (pets: 1)", `${res.items.length} pet-friendly stays found`);
  } catch (err) { fail("Pet policy filtering", err); }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n==================================================================");
  console.log(`   TOTAL TESTS: ${passed + failed} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Fatal test suite runner error:", err);
  process.exit(1);
});

