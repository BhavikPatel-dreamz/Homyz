import "dotenv/config";
import fs from "fs";
import path from "path";
import {
  parseNominatimAddress,
  reverseGeocodeLocation,
} from "../lib/location/geocoding";
import { formatAddressCountry } from "../lib/location/address-countries";

async function runCurrentLocationDetectionTests() {
  console.log("\n=======================================================");
  console.log("   CURRENT LOCATION DETECTION & AUTOFILL TEST SUITE    ");
  console.log("=======================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (!condition) {
      console.error(` ❌ FAIL: ${msg}`);
      failed++;
      throw new Error(`Assertion failed: ${msg}`);
    } else {
      console.log(` ✅ PASS: ${msg}`);
      passed++;
    }
  }

  // 1. StepLocationSearch Component Code Audit
  console.log("\n--- [1] StepLocationSearch Component Audit ---");
  const searchFile = path.join(process.cwd(), "components/host/onboarding/step-location-search.tsx");
  assert(fs.existsSync(searchFile), "components/host/onboarding/step-location-search.tsx exists");
  const searchContent = fs.readFileSync(searchFile, "utf-8");

  assert(
    searchContent.includes("handleUseCurrentLocation"),
    "StepLocationSearch implements handleUseCurrentLocation handler"
  );
  assert(
    searchContent.includes("navigator.geolocation.getCurrentPosition"),
    "StepLocationSearch calls navigator.geolocation.getCurrentPosition on user action"
  );
  assert(
    searchContent.includes("enableHighAccuracy: true"),
    "StepLocationSearch requests high accuracy geolocation"
  );
  assert(
    searchContent.includes("timeout: 15000"),
    "StepLocationSearch configures a safe 15s timeout for geolocation"
  );
  assert(
    searchContent.includes("isLocating"),
    "StepLocationSearch manages isLocating state to disable button and show spinner"
  );
  assert(
    searchContent.includes("geoSuccess"),
    "StepLocationSearch manages geoSuccess state for positive visual feedback"
  );
  assert(
    searchContent.includes("geoError"),
    "StepLocationSearch manages geoError state for user-friendly error banners"
  );
  assert(
    searchContent.includes("host_use_current_location"),
    "StepLocationSearch provides 'Use my current location' label"
  );
  assert(
    searchContent.includes("host_detecting_location"),
    "StepLocationSearch provides 'Detecting your location...' loading text"
  );
  assert(
    searchContent.includes("host_location_detected"),
    "StepLocationSearch provides 'Location detected' success confirmation"
  );
  assert(
    searchContent.includes("host_geo_permission_denied"),
    "StepLocationSearch handles permission denied error message"
  );
  assert(
    searchContent.includes("host_geo_unavailable"),
    "StepLocationSearch handles position unavailable error message"
  );
  assert(
    searchContent.includes("host_geo_timeout"),
    "StepLocationSearch handles geolocation timeout error message"
  );
  assert(
    searchContent.includes("host_geo_unsupported"),
    "StepLocationSearch handles unsupported browser error message"
  );
  assert(
    searchContent.includes('role="alert"'),
    "StepLocationSearch presents error alerts with role='alert'"
  );
  assert(
    searchContent.includes('role="combobox"'),
    "StepLocationSearch uses role='combobox' for input"
  );
  assert(
    searchContent.includes('role="listbox"'),
    "StepLocationSearch uses role='listbox' for suggestions"
  );
  assert(
    searchContent.includes('role="option"'),
    "StepLocationSearch uses role='option' for suggestion items"
  );
  assert(
    searchContent.includes("ArrowDown") && searchContent.includes("ArrowUp") && searchContent.includes("Enter"),
    "StepLocationSearch implements keyboard navigation (ArrowDown, ArrowUp, Enter, Escape)"
  );
  assert(
    searchContent.includes("reverseGeocodeLocation"),
    "StepLocationSearch imports and utilizes reverseGeocodeLocation"
  );

  // 2. StepAddressConfirm Component Code Audit
  console.log("\n--- [2] StepAddressConfirm Component Audit ---");
  const confirmFile = path.join(process.cwd(), "components/host/onboarding/step-address-confirm.tsx");
  assert(fs.existsSync(confirmFile), "components/host/onboarding/step-address-confirm.tsx exists");
  const confirmContent = fs.readFileSync(confirmFile, "utf-8");

  assert(
    confirmContent.includes("handleUseCurrentLocation"),
    "StepAddressConfirm provides 'Use my current location' action"
  );
  assert(
    confirmContent.includes("navigator.geolocation.getCurrentPosition"),
    "StepAddressConfirm integrates navigator.geolocation.getCurrentPosition"
  );
  assert(
    confirmContent.includes("reverseGeocodeLocation"),
    "StepAddressConfirm calls reverseGeocodeLocation to populate address fields"
  );
  assert(
    confirmContent.includes("setStreetAddress") &&
      confirmContent.includes("setDistrict") &&
      confirmContent.includes("setCity") &&
      confirmContent.includes("setPostalCode") &&
      confirmContent.includes("setCountry"),
    "StepAddressConfirm autofills structured address fields from detected coordinates"
  );

  // 3. GEMINI.md Font Weight Rule Audit
  console.log("\n--- [3] Typography Font Weight Audit (GEMINI.md Rule) ---");
  assert(
    !searchContent.includes("font-bold") &&
      !searchContent.includes("font-semibold") &&
      !searchContent.includes("<b>") &&
      !searchContent.includes("<strong>"),
    "StepLocationSearch contains ZERO font-bold, font-semibold, <b>, or <strong>"
  );
  assert(
    !confirmContent.includes("font-bold") &&
      !confirmContent.includes("font-semibold") &&
      !confirmContent.includes("<b>") &&
      !confirmContent.includes("<strong>"),
    "StepAddressConfirm contains ZERO font-bold, font-semibold, <b>, or <strong>"
  );

  // 4. Geocoding & Address Format Consistency
  console.log("\n--- [4] Geocoding & Address Country Formatting ---");
  const sampleRiyadh = {
    display_name: "Al Olaya St, Riyadh 12211, Saudi Arabia",
    lat: "24.7136",
    lon: "46.6753",
    address: {
      road: "Al Olaya St",
      house_number: "205",
      neighbourhood: "Al Olaya",
      city: "Riyadh",
      state: "Riyadh Province",
      postcode: "12211",
      country: "Saudi Arabia",
      country_code: "sa",
    },
  };
  const parsed = parseNominatimAddress(sampleRiyadh);
  assert(parsed.streetAddress === "205 Al Olaya St", "Parsed street includes house number and road");
  assert(parsed.district === "Al Olaya", "Parsed district matches neighborhood");
  assert(parsed.city === "Riyadh", "Parsed city matches");
  assert(parsed.postalCode === "12211", "Parsed postal code matches");
  assert(parsed.countryCode === "SA", "Parsed country code is normalized to uppercase");

  const formattedCountry = formatAddressCountry(parsed.country, parsed.countryCode);
  assert(formattedCountry.includes("Saudi Arabia"), "formatAddressCountry formats Saudi Arabia properly");

  console.log(`\n=======================================================`);
  console.log(`   ALL TESTS PASSED: ${passed} passed, ${failed} failed `);
  console.log(`=======================================================\n`);
}

runCurrentLocationDetectionTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

