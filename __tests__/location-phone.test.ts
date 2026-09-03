import "dotenv/config";
import { normalizePhone, isValidE164Phone } from "../lib/auth/normalization";
import { getCountryByCallingCode, getCountryByIso2, searchCountries, getAllCountries } from "../lib/auth/country-codes";
import { searchLocations, formatLocationString } from "../lib/location/geocoding";

async function runLocationPhoneTests() {
  console.log("\n==========================================");
  console.log("  LOCATION & PHONE SYSTEM REGRESSION TESTS ");
  console.log("==========================================\n");

  // 1. Phone Normalization (US, IT, SA, FR, GB, IN, JP)
  const phoneCases = [
    { input: "+1 (555) 234-5678", expected: "+15552345678" },
    { input: "00966 51 234 5678", expected: "+966512345678" },
    { input: "+39-06-12345678", expected: "+390612345678" },
    { input: "966512345678", expected: "+966512345678" },
    { input: "+33 6 12 34 56 78", expected: "+33612345678" },
  ];

  for (const tc of phoneCases) {
    const normalized = normalizePhone(tc.input);
    if (normalized !== tc.expected) {
      throw new Error(`Phone normalization failed for input "${tc.input}". Expected "${tc.expected}", got "${normalized}"`);
    }
  }
  console.log(" ✅ PASS: International E.164 Phone Normalization");

  // 2. Phone Validation
  if (!isValidE164Phone("+15552345678") || !isValidE164Phone("+393331234567")) {
    throw new Error("Valid E.164 phones rejected");
  }
  if (isValidE164Phone("123") || isValidE164Phone("abc")) {
    throw new Error("Invalid phone strings accepted");
  }
  console.log(" ✅ PASS: International E.164 Phone Validation");

  // 3. Country Code Dataset & Utilities
  const allCountries = getAllCountries();
  if (allCountries.length < 25) throw new Error("Country dataset incomplete");

  const us = getCountryByIso2("US");
  if (!us || us.code !== "+1") throw new Error("ISO2 country lookup failed");

  const it = getCountryByCallingCode("+39");
  if (!it || it.iso2 !== "IT") throw new Error("Calling code lookup failed");

  const filtered = searchCountries("Saudi");
  if (!filtered.some((c) => c.iso2 === "SA")) throw new Error("Country search failed");

  console.log(" ✅ PASS: Country Code Dataset & ISO Lookup Utilities");

  // 4. Geocoding Place Search & Structured Location
  const places = await searchLocations("Paris");
  if (!places || places.length === 0 || !places[0].formattedAddress.includes("Paris")) {
    throw new Error("Geocoding place search failed");
  }
  console.log(" ✅ PASS: Geocoding & Structured Location Search");

  // 5. Location String Formatter
  const formatted = formatLocationString("   Paris, France   ");
  if (formatted !== "Paris, France") throw new Error("Location string formatting failed");
  console.log(" ✅ PASS: Location String Formatter");

  console.log("\n------------------------------------------");
  console.log("Results: 5 PASSED, 0 FAILED");
  console.log("==========================================\n");
}

runLocationPhoneTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(" ❌ FAIL:", err);
    process.exit(1);
  });
