import "dotenv/config";
import fs from "fs";
import path from "path";
import {
  parseNominatimAddress,
  searchAddressAutocomplete,
  reverseGeocodeLocation,
  POPULAR_GLOBAL_DESTINATIONS,
} from "../lib/location/geocoding";

async function runHostLocationFlowTests() {
  console.log("\n=======================================================");
  console.log("   HOST LISTING EDITOR: LOCATION FLOW & SYNC AUDIT     ");
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

  // 1. Geocoding utilities
  console.log("\n--- [1] Geocoding & Address Parsing Utilities ---");
  const sampleNominatim = {
    display_name: "King Fahd Road, Al Olaya, Riyadh, Riyadh Region, 12211, Saudi Arabia",
    lat: "24.7136",
    lon: "46.6753",
    address: {
      road: "King Fahd Road",
      house_number: "100",
      neighbourhood: "Al Olaya",
      city: "Riyadh",
      state: "Riyadh Region",
      postcode: "12211",
      country: "Saudi Arabia",
      country_code: "sa",
    },
  };

  const parsed = parseNominatimAddress(sampleNominatim);
  assert(parsed.streetAddress === "100 King Fahd Road", "Parses house_number and road correctly");
  assert(parsed.district === "Al Olaya", "Parses neighborhood as district");
  assert(parsed.city === "Riyadh", "Parses city correctly");
  assert(parsed.state === "Riyadh Region", "Parses state correctly");
  assert(parsed.postalCode === "12211", "Parses postalCode correctly");
  assert(parsed.country === "Saudi Arabia", "Parses country correctly");
  assert(parsed.countryCode === "SA", "Parses uppercase country code");
  assert(parsed.latitude === 24.7136, "Parses latitude as number");
  assert(parsed.longitude === 46.6753, "Parses longitude as number");

  // Test searchAddressAutocomplete with fallback matching
  const autocompleteResults = await searchAddressAutocomplete("Riyadh");
  assert(autocompleteResults.length > 0, "Returns autocomplete suggestions for query");
  assert(autocompleteResults[0].city === "Riyadh", "First suggestion matches Riyadh city");

  // Test reverseGeocodeLocation handles null coordinates safely
  const nullReverse = await reverseGeocodeLocation(NaN, NaN);
  assert(nullReverse === null, "Gracefully returns null for invalid coordinates");

  // 2. AddressAutocomplete Component
  console.log("\n--- [2] AddressAutocomplete Component ---");
  const autocompleteFile = path.join(process.cwd(), "components/ui/address-autocomplete.tsx");
  assert(fs.existsSync(autocompleteFile), "components/ui/address-autocomplete.tsx exists");
  const autocompleteContent = fs.readFileSync(autocompleteFile, "utf-8");

  assert(
    autocompleteContent.includes("searchAddressAutocomplete"),
    "AddressAutocomplete imports and uses searchAddressAutocomplete"
  );
  assert(
    autocompleteContent.includes('role="combobox"'),
    "AddressAutocomplete implements accessible combobox role"
  );
  assert(
    autocompleteContent.includes("onSelect"),
    "AddressAutocomplete provides onSelect callback for structured address"
  );
  assert(
    autocompleteContent.includes("handleClear"),
    "AddressAutocomplete includes clear button functionality"
  );

  // 3. RealMap Component Bidirectional Sync
  console.log("\n--- [3] RealMap Component Bidirectional Sync ---");
  const realMapFile = path.join(process.cwd(), "components/ui/real-map.tsx");
  assert(fs.existsSync(realMapFile), "components/ui/real-map.tsx exists");
  const realMapContent = fs.readFileSync(realMapFile, "utf-8");

  assert(
    realMapContent.includes("reverseGeocodeLocation"),
    "RealMap imports and uses centralized reverseGeocodeLocation"
  );
  assert(
    realMapContent.includes("initialLat !== coords.lat || initialLng !== coords.lng"),
    "RealMap synchronizes internal coords when parent lat/lng props change"
  );
  assert(
    realMapContent.includes("isInternalUpdateRef"),
    "RealMap prevents feedback loops using internal update flag"
  );
  assert(
    realMapContent.includes("state?: string"),
    "LocationDetails includes state field"
  );

  // 4. HostAndLocationViews Component
  console.log("\n--- [4] HostAndLocationViews LocationView Component ---");
  const viewsFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/HostAndLocationViews.tsx");
  assert(fs.existsSync(viewsFile), "HostAndLocationViews.tsx exists");
  const viewsContent = fs.readFileSync(viewsFile, "utf-8");

  assert(
    viewsContent.includes("<AddressAutocomplete"),
    "LocationView integrates AddressAutocomplete component"
  );
  assert(
    viewsContent.includes("handleAutocompleteSelect"),
    "LocationView handles autocomplete selection and updates all fields"
  );
  assert(
    viewsContent.includes("<RealMap") &&
    viewsContent.includes("lat={latitude ?? undefined}") &&
    viewsContent.includes("lng={longitude ?? undefined}") &&
    viewsContent.includes("onLocationChange={handleMapLocationChange}"),
    "LocationView wires RealMap with lat, lng, and onLocationChange handler"
  );
  assert(
    viewsContent.includes("editApartment"),
    "LocationView supports editApartment field"
  );
  assert(
    viewsContent.includes("editDistrict"),
    "LocationView supports editDistrict field"
  );
  assert(
    viewsContent.includes("editPostalCode"),
    "LocationView supports editPostalCode field"
  );
  assert(
    viewsContent.includes("showExactLocation"),
    "LocationView supports showExactLocation privacy toggle"
  );

  // 5. HostListingEditorClient Parent State & Saving
  console.log("\n--- [5] HostListingEditorClient State & Payload ---");
  const editorFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/host-listing-editor-client.tsx");
  assert(fs.existsSync(editorFile), "host-listing-editor-client.tsx exists");
  const editorContent = fs.readFileSync(editorFile, "utf-8");

  assert(
    editorContent.includes("const [editApartment, setEditApartment] = useState"),
    "host-listing-editor-client manages editApartment state"
  );
  assert(
    editorContent.includes("apartment: editApartment || null"),
    "host-listing-editor-client includes apartment in location save payload"
  );
  assert(
    editorContent.includes("shortAddress: [editAddress, editCity].filter(Boolean).join(\", \") || null"),
    "host-listing-editor-client includes canonical shortAddress in save payload"
  );
  assert(
    editorContent.includes("locationSearch: [editAddress, editDistrict, editCity, editCountry].filter(Boolean).join(\", \") || null"),
    "host-listing-editor-client includes canonical locationSearch in save payload"
  );
  assert(
    editorContent.includes("editApartment={editApartment}") &&
    editorContent.includes("setEditApartment={setEditApartment}"),
    "host-listing-editor-client passes editApartment and setter to HostAndLocationViews"
  );

  // 6. EditorSidebar Mini-map
  console.log("\n--- [6] EditorSidebar Location Pin ---");
  const sidebarFile = path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/EditorSidebar.tsx");
  assert(fs.existsSync(sidebarFile), "EditorSidebar.tsx exists");
  const sidebarContent = fs.readFileSync(sidebarFile, "utf-8");

  assert(
    sidebarContent.includes("lat={latitude ?? undefined}") &&
    sidebarContent.includes("lng={longitude ?? undefined}"),
    "EditorSidebar mini RealMap receives lat and lng coordinates"
  );

  // 7. Saudi Arabia re-approval protection in listing.service.ts
  console.log("\n--- [7] Saudi Arabia Re-approval Protection ---");
  const serviceFile = path.join(process.cwd(), "services/listing.service.ts");
  assert(fs.existsSync(serviceFile), "listing.service.ts exists");
  const serviceContent = fs.readFileSync(serviceFile, "utf-8");

  assert(
    serviceContent.includes("!isSaudiArabia(dataToUpdate.country ?? existing.country)"),
    "services/listing.service.ts exempts Saudi listings from admin re-approval on edit"
  );

  console.log(`\n=======================================================`);
  console.log(`   ALL TESTS PASSED: ${passed} passed, ${failed} failed `);
  console.log(`=======================================================\n`);
}

runHostLocationFlowTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

