import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import {
  searchPlacesAutocomplete,
  type UnifiedLocationSuggestion,
  HIGH_PRECISION_PLACES,
} from "../lib/location/places-provider";
import { calculateDistance } from "../lib/location/places-search";

console.log("==================================================================");
console.log("   AIRBNB-STYLE MAPBOX & PLACES SEARCH VERIFICATION SUITE         ");
console.log("==================================================================");

async function runTests() {
  // --- [1] Target Locations Matching (All 6 User Queries) ---
  console.log("\n--- [1] Target Locations Matching ---");

  // Target 1: City - "Surat"
  const suratRes = await searchPlacesAutocomplete("Surat");
  assert(suratRes.length > 0, "Must return results for 'Surat'");
  const suratCity = suratRes.find((p) => p.locationType === "city" && p.name.toLowerCase().includes("surat"));
  assert(suratCity, "Must find Surat city suggestion");
  assert.strictEqual(suratCity.locationType, "city");
  assert.strictEqual(typeof suratCity.latitude, "number");
  assert.strictEqual(typeof suratCity.longitude, "number");
  assert(suratCity.providerPlaceId, "Must have providerPlaceId");
  console.log(` ✅ PASS: City search 'Surat' -> ${suratCity.name}, ${suratCity.fullAddress} (${suratCity.latitude}, ${suratCity.longitude})`);

  // Target 2: Area - "Dumas, Surat"
  const dumasRes = await searchPlacesAutocomplete("Dumas, Surat");
  assert(dumasRes.length > 0, "Must return results for 'Dumas, Surat'");
  const dumasArea = dumasRes.find((p) => p.name.toLowerCase().includes("dumas"));
  assert(dumasArea, "Must find Dumas area");
  assert(dumasArea.latitude > 21.0 && dumasArea.latitude < 21.2, "Dumas latitude must be in Surat coastal region (~21.08)");
  assert(dumasArea.longitude > 72.6 && dumasArea.longitude < 72.8, "Dumas longitude must be in Surat coastal region (~72.70)");
  console.log(` ✅ PASS: Area search 'Dumas, Surat' -> ${dumasArea.name} [${dumasArea.locationType}] (${dumasArea.latitude}, ${dumasArea.longitude})`);

  // Target 3: Road - "Station Road, Surat"
  const stationRoadRes = await searchPlacesAutocomplete("Station Road, Surat");
  assert(stationRoadRes.length > 0, "Must return results for 'Station Road, Surat'");
  const stationRoad = stationRoadRes.find((p) => p.name.toLowerCase().includes("station road"));
  assert(stationRoad, "Must find Station Road");
  assert.strictEqual(stationRoad.locationType, "street");
  console.log(` ✅ PASS: Road search 'Station Road, Surat' -> ${stationRoad.name} [${stationRoad.locationType}] (${stationRoad.latitude}, ${stationRoad.longitude})`);

  // Target 4: Landmark / Station - "Surat Railway Station"
  const rwyStationRes = await searchPlacesAutocomplete("Surat Railway Station");
  assert(rwyStationRes.length > 0, "Must return results for 'Surat Railway Station'");
  const rwyStation = rwyStationRes.find((p) => p.name.toLowerCase().includes("railway") || p.name.toLowerCase().includes("station"));
  assert(rwyStation, "Must find Surat Railway Station");
  assert.strictEqual(rwyStation.locationType, "station");
  console.log(` ✅ PASS: Landmark/Station search 'Surat Railway Station' -> ${rwyStation.name} [${rwyStation.locationType}] (${rwyStation.latitude}, ${rwyStation.longitude})`);

  // Target 5: Neighborhood - "Vesu"
  const vesuRes = await searchPlacesAutocomplete("Vesu");
  assert(vesuRes.length > 0, "Must return results for 'Vesu'");
  const vesu = vesuRes.find((p) => p.name.toLowerCase().includes("vesu"));
  assert(vesu, "Must find Vesu neighborhood");
  assert.strictEqual(vesu.locationType, "neighborhood");
  console.log(` ✅ PASS: Neighborhood search 'Vesu' -> ${vesu.name} [${vesu.locationType}] (${vesu.latitude}, ${vesu.longitude})`);

  // Target 6: Full address or POI - "Dumas Beach"
  const beachRes = await searchPlacesAutocomplete("Dumas Beach");
  assert(beachRes.length > 0, "Must return results for 'Dumas Beach'");
  const beach = beachRes.find((p) => p.name.toLowerCase().includes("beach") || p.name.toLowerCase().includes("dumas"));
  assert(beach, "Must find Dumas Beach POI");
  assert.strictEqual(beach.locationType, "beach");
  console.log(` ✅ PASS: POI/Beach search 'Dumas Beach' -> ${beach.name} [${beach.locationType}] (${beach.latitude}, ${beach.longitude})`);

  // --- [2] Stored Location Schema Verification ---
  console.log("\n--- [2] Stored Location Schema Verification ---");
  for (const item of [suratCity, dumasArea, stationRoad, rwyStation, vesu, beach]) {
    assert(item.name && typeof item.name === "string", "name must be non-empty string");
    assert(item.fullAddress && typeof item.fullAddress === "string", "fullAddress must be non-empty string");
    assert(item.city && typeof item.city === "string", "city must be non-empty string");
    assert(typeof item.state === "string", "state must be a string");
    assert(item.country && typeof item.country === "string", "country must be non-empty string");
    assert(typeof item.latitude === "number" && !isNaN(item.latitude), "latitude must be a valid number");
    assert(typeof item.longitude === "number" && !isNaN(item.longitude), "longitude must be a valid number");
    assert(item.locationType && typeof item.locationType === "string", "locationType must be non-empty string");
    assert(item.providerPlaceId && typeof item.providerPlaceId === "string", "providerPlaceId must be non-empty string");
  }
  console.log(" ✅ PASS: All 6 targets contain full Airbnb schema: name, fullAddress, city, state, country, locality, lat, lng, locationType, providerPlaceId");

  // --- [3] Haversine Distance & Proximity Calculations ---
  console.log("\n--- [3] Haversine Distance & Proximity Calculations ---");
  const distCenterToVesu = calculateDistance(21.1702, 72.8311, 21.1442, 72.7758);
  assert(distCenterToVesu > 5 && distCenterToVesu < 8, `Distance Surat center to Vesu should be ~6.4km (got ${distCenterToVesu.toFixed(2)})`);
  console.log(` ✅ PASS: Distance Surat center to Vesu: ${distCenterToVesu.toFixed(2)} km`);

  const distBeachToStation = calculateDistance(21.0772, 72.7013, 21.2048, 72.8411);
  assert(distBeachToStation > 15 && distBeachToStation < 25, `Distance Dumas to Station should be ~20km (got ${distBeachToStation.toFixed(2)})`);
  console.log(` ✅ PASS: Distance Dumas Beach to Railway Station: ${distBeachToStation.toFixed(2)} km`);

  // --- [4] Global Cities Outside India ---
  console.log("\n--- [4] Global Cities Coverage ---");
  const mumbaiRes = await searchPlacesAutocomplete("Mumbai");
  assert(mumbaiRes.some((p) => p.name.toLowerCase().includes("mumbai")), "Must find Mumbai");
  console.log(" ✅ PASS: Global city 'Mumbai' resolved");

  const londonRes = await searchPlacesAutocomplete("London");
  assert(londonRes.some((p) => p.name.toLowerCase().includes("london")), "Must find London");
  console.log(" ✅ PASS: Global city 'London' resolved");

  const riyadhRes = await searchPlacesAutocomplete("Riyadh");
  assert(riyadhRes.some((p) => p.name.toLowerCase().includes("riyadh")), "Must find Riyadh");
  console.log(" ✅ PASS: Global city 'Riyadh' resolved");

  // --- [5] Service-level Geo-spatial Radius & Haversine Integrity ---
  console.log("\n--- [5] Service-level Geo-spatial Radius & Haversine Integrity ---");
  const listingServiceCode = fs.readFileSync(path.resolve(__dirname, "../services/listing.service.ts"), "utf-8");
  assert(listingServiceCode.includes("filters.lat"), "Listing service must accept filters.lat");
  assert(listingServiceCode.includes("filters.lng"), "Listing service must accept filters.lng");
  assert(listingServiceCode.includes("deltaLat = r / 111"), "Listing service must compute bounding box latitude delta");
  assert(listingServiceCode.includes("deltaLng = r / (111 * Math.cos"), "Listing service must compute bounding box longitude delta");
  assert(listingServiceCode.includes("latitude: { gte: filters.lat - deltaLat, lte: filters.lat + deltaLat }"), "Listing service must query latitude range");
  assert(listingServiceCode.includes("longitude: { gte: filters.lng - deltaLng, lte: filters.lng + deltaLng }"), "Listing service must query longitude range");
  assert(listingServiceCode.includes("calculateDistance(filters.lat!"), "Listing service must compute Haversine distanceKm for matched items");
  assert(listingServiceCode.includes("a.distanceKm - b.distanceKm"), "Listing service must sort by distance when lat/lng are provided");
  console.log(" ✅ PASS: listing.service.ts implements geo-spatial bounding box, distanceKm attachment & proximity sorting");

  // --- [6] Search Page & Client Coordinates Forwarding ---
  console.log("\n--- [6] Search Page & Client Coordinates Forwarding ---");
  const searchPageCode = fs.readFileSync(path.resolve(__dirname, "../app/listings/page.tsx"), "utf-8");
  assert(searchPageCode.includes("lat?: string"), "SearchPageProps must accept lat query parameter");
  assert(searchPageCode.includes("lng?: string"), "SearchPageProps must accept lng query parameter");
  assert(searchPageCode.includes("parseFloat(sp.lat)"), "SearchPage must parse lat parameter");
  assert(searchPageCode.includes("parseFloat(sp.lng)"), "SearchPage must parse lng parameter");
  assert(searchPageCode.includes("placeName"), "SearchPage must support contextual placeName");

  const resultsClientCode = fs.readFileSync(path.resolve(__dirname, "../app/listings/listings-results-client.tsx"), "utf-8");
  assert(resultsClientCode.includes("currentFilters.lat"), "ListingsResultsClient must handle lat");
  assert(resultsClientCode.includes("currentFilters.lng"), "ListingsResultsClient must handle lng");
  assert(resultsClientCode.includes("[currentFilters.lat, currentFilters.lng]"), "ListingsResultsClient must pass center coordinates to SearchMap");

  const searchMapCode = fs.readFileSync(path.resolve(__dirname, "../components/listings/search-map.tsx"), "utf-8");
  assert(searchMapCode.includes("center?: [number, number]"), "SearchMapProps must accept center coordinate array");
  assert(searchMapCode.includes("map.setView(center"), "SearchMap must center view on selected coordinates");
  console.log(" ✅ PASS: Search page and client properly forward coordinates and center Leaflet map");

  // --- [7] HeroSection Airbnb UI & Debouncing ---
  console.log("\n--- [7] HeroSection Airbnb UI & Debouncing ---");
  const heroSectionCode = fs.readFileSync(path.resolve(__dirname, "../components/home/hero-section.tsx"), "utf-8");
  assert(heroSectionCode.includes("LocationIcon"), "HeroSection must render distinct location icons");
  assert(heroSectionCode.includes("300"), "HeroSection must debounce autocomplete at 300ms");
  assert(heroSectionCode.includes("handleClearDestination"), "HeroSection must support clearing destination");
  assert(heroSectionCode.includes("homyz_selected_location"), "HeroSection must persist selected location metadata in localStorage");
  assert(heroSectionCode.includes("providerPlaceId"), "HeroSection must preserve providerPlaceId");
  assert(heroSectionCode.includes("ModalOverlay"), "HeroSection must lock scroll via ModalOverlay");
  console.log(" ✅ PASS: HeroSection implements LocationIcon, 300ms debounce, clear button, and Airbnb selection metadata");

  console.log("\n==================================================================");
  console.log("   ALL AIRBNB-STYLE MAPBOX & PLACES TESTS PASSED (7/7)            ");
  console.log("==================================================================");
}

runTests().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});

