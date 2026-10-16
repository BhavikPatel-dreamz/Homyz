import assert from "node:assert";
import {
  searchWorldCities,
  getPlacesInCity,
  getPopularGlobalDestinations,
} from "../lib/location/world-cities";

console.log("==================================================================");
console.log("   AIRBNB-STYLE PLACES & DESTINATIONS AUDIT SUITE                 ");
console.log("==================================================================");

// --- [1] Mumbai Places Test ---
console.log("\n--- [1] Mumbai Airbnb Places Audit ---");
const mumbaiBundle = getPlacesInCity("mumbai");
assert(mumbaiBundle.primary, "Must resolve Mumbai as primary city");
assert.strictEqual(mumbaiBundle.primary.name, "Mumbai");
assert.strictEqual(mumbaiBundle.primary.country, "India");
assert.strictEqual(mumbaiBundle.primary.region, "Maharashtra");
assert(mumbaiBundle.places.length >= 6, "Must provide rich places in Mumbai");

const mumbaiPlaceNames = mumbaiBundle.places.map((p) => p.name.toLowerCase());
console.log("Places found in Mumbai:", mumbaiPlaceNames.slice(0, 8));
assert(
  mumbaiPlaceNames.some((name) => ["bandra", "juhu", "andheri", "powai", "colaba", "worli"].includes(name)),
  "Mumbai must include iconic neighborhoods like Bandra, Juhu, Andheri, Powai, etc.",
);
console.log("✓ Mumbai places list successfully verified!");

// --- [2] Surat Places Test ---
console.log("\n--- [2] Surat Airbnb Places Audit ---");
const suratBundle = getPlacesInCity("surat");
assert(suratBundle.primary, "Must resolve Surat as primary city");
assert.strictEqual(suratBundle.primary.name, "Surat");
assert.strictEqual(suratBundle.primary.country, "India");
assert.strictEqual(suratBundle.primary.region, "Gujarat");
assert(suratBundle.places.length >= 5, "Must provide rich places in Surat");

const suratPlaceNames = suratBundle.places.map((p) => p.name.toLowerCase());
console.log("Places found in Surat:", suratPlaceNames.slice(0, 8));
assert(
  suratPlaceNames.some((name) => ["adajan", "vesu", "piplod", "varachha", "dumas road", "pal", "katargam"].includes(name)),
  "Surat must include iconic neighborhoods like Adajan, Vesu, Piplod, Varachha, etc.",
);
console.log("✓ Surat places list successfully verified!");

// --- [3] London Places Test ---
console.log("\n--- [3] London Airbnb Places Audit ---");
const londonBundle = getPlacesInCity("london");
assert(londonBundle.primary, "Must resolve London as primary city");
assert.strictEqual(londonBundle.primary.name, "London");
assert.strictEqual(londonBundle.primary.country, "United Kingdom");
assert(londonBundle.places.length >= 5, "Must provide rich places in London");

const londonPlaceNames = londonBundle.places.map((p) => p.name.toLowerCase());
console.log("Places found in London:", londonPlaceNames.slice(0, 8));
assert(
  londonPlaceNames.some((name) => ["westminster", "soho", "camden town", "chelsea", "kensington"].includes(name)),
  "London must include iconic neighborhoods like Westminster, Soho, Camden Town, Chelsea, etc.",
);
console.log("✓ London places list successfully verified!");

// --- [4] Paris Places Test ---
console.log("\n--- [4] Paris Airbnb Places Audit ---");
const parisBundle = getPlacesInCity("paris");
assert(parisBundle.primary, "Must resolve Paris as primary city");
assert.strictEqual(parisBundle.primary.name, "Paris");
assert.strictEqual(parisBundle.primary.country, "France");
assert(parisBundle.places.length >= 4, "Must provide places in Paris");

const parisPlaceNames = parisBundle.places.map((p) => p.name.toLowerCase());
console.log("Places found in Paris:", parisPlaceNames.slice(0, 6));
console.log("✓ Paris places list successfully verified!");

// --- [5] Direct Localities Autocomplete Test ---
console.log("\n--- [5] Direct Localities Search Audit ---");
const adajanResults = searchWorldCities("adajan");
assert(adajanResults.length > 0, "Searching 'adajan' must return matches");
assert(adajanResults[0].city.toLowerCase().includes("adajan"), "First result must match Adajan");
assert(adajanResults[0].city.toLowerCase().includes("surat"), "Adajan must reference parent city Surat");

const bandraResults = searchWorldCities("bandra");
assert(bandraResults.length > 0, "Searching 'bandra' must return matches");
assert(bandraResults[0].city.toLowerCase().includes("bandra"), "First result must match Bandra");
assert(bandraResults[0].city.toLowerCase().includes("mumbai"), "Bandra must reference parent city Mumbai");

console.log("✓ Direct locality searches (Adajan -> Surat, Bandra -> Mumbai) successfully verified!");

// --- [6] Popular Global Destinations Test ---
console.log("\n--- [6] Popular Global Destinations Audit ---");
const popular = getPopularGlobalDestinations();
assert(popular.length >= 6, "Must provide popular global destinations");
assert(popular.some((p) => p.city === "Surat"), "Must include Surat in popular list");
assert(popular.some((p) => p.city === "Mumbai"), "Must include Mumbai in popular list");
console.log("✓ Popular global destinations successfully verified!");

console.log("\n==================================================================");
console.log("   ALL AIRBNB PLACES SEARCH AUDITS PASSED (6/6)                   ");
console.log("==================================================================");

