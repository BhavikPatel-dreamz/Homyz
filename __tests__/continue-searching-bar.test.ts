import assert from "node:assert/strict";
import {
  formatSearchDateRange,
  getContinueSearchLocationPhrase,
  buildContinueSearchHref,
} from "../components/home/continue-searching-bar";

async function runContinueSearchingBarTests() {
  console.log("\n==================================================================");
  console.log("   TEST SUITE: Continue Searching Bar Specifications            ");
  console.log("==================================================================\n");

  // 1. Date Range Formatting
  console.log("--- [1] Date Range Formatting ---");

  // Same month (Sept 17 - Sept 30) matching client screenshot
  const sameMonth = formatSearchDateRange("2026-09-17", "2026-09-30");
  assert.equal(sameMonth, "17–30 Sept", "Same month range must format as '17–30 Sept'");
  console.log("  ✓ Same month range verified: '17–30 Sept'");

  // Cross-month in same year
  const crossMonth = formatSearchDateRange("2026-09-28", "2026-10-05");
  assert.equal(crossMonth, "28 Sept – 5 Oct", "Cross month range must format as '28 Sept – 5 Oct'");
  console.log("  ✓ Cross month range verified: '28 Sept – 5 Oct'");

  // Cross-year
  const crossYear = formatSearchDateRange("2026-12-28", "2027-01-05");
  assert.equal(crossYear, "28 Dec 2026 – 5 Jan 2027", "Cross year range must format with both years");
  console.log("  ✓ Cross year range verified: '28 Dec 2026 – 5 Jan 2027'");

  // Single date
  const singleDate = formatSearchDateRange("2026-09-17", null);
  assert.equal(singleDate, "from 17 Sept", "Single date must format as 'from 17 Sept'");
  console.log("  ✓ Single date verified: 'from 17 Sept'");

  // Null/empty dates
  assert.equal(formatSearchDateRange(null, null), null, "Null dates must return null");
  assert.equal(formatSearchDateRange("invalid", "invalid"), null, "Invalid dates must return null");
  console.log("  ✓ Null / invalid date handling verified");

  // 2. Preposition & Location Name Resolution
  console.log("\n--- [2] Preposition & Location Resolution ---");

  // Landmark: Burj Khalifa -> "near Burj Khalifa"
  const burj = getContinueSearchLocationPhrase({
    placeType: "landmark",
    displayName: "Burj Khalifa",
  });
  assert.equal(burj.preposition, "near");
  assert.equal(burj.locationName, "Burj Khalifa");
  console.log("  ✓ Landmark 'Burj Khalifa' resolves to 'near Burj Khalifa'");

  // Landmark by name without placeType:
  const burjByName = getContinueSearchLocationPhrase({
    displayName: "Burj Khalifa, Downtown Dubai",
  });
  assert.equal(burjByName.preposition, "near");
  console.log("  ✓ Landmark keyword detection resolves 'near' correctly");

  // City: Dubai -> "in Dubai"
  const dubai = getContinueSearchLocationPhrase({
    placeType: "city",
    displayName: "Dubai",
    city: "Dubai",
  });
  assert.equal(dubai.preposition, "in");
  assert.equal(dubai.locationName, "Dubai");
  console.log("  ✓ City 'Dubai' resolves to 'in Dubai'");

  // City: Surat -> "in Surat"
  const surat = getContinueSearchLocationPhrase({
    placeType: "city",
    displayName: "Surat",
    city: "Surat",
  });
  assert.equal(surat.preposition, "in");
  assert.equal(surat.locationName, "Surat");
  console.log("  ✓ City 'Surat' resolves to 'in Surat'");

  // Empty / placeholder queries
  const empty = getContinueSearchLocationPhrase({
    displayName: "Stays",
  });
  assert.equal(empty.locationName, "");
  assert.equal(empty.preposition, "");
  console.log("  ✓ Placeholder 'Stays' safely suppressed");

  // 3. Search Href Construction
  console.log("\n--- [3] Href Construction ---");

  const href = buildContinueSearchHref({
    query: "Burj Khalifa",
    displayName: "Burj Khalifa",
    placeId: "landmark:burj-khalifa",
    placeType: "landmark",
    latitude: 25.1972,
    longitude: 55.2744,
    city: "Dubai",
    country: "United Arab Emirates",
    checkIn: "2026-09-17",
    checkOut: "2026-09-30",
    guests: 2,
    adults: 2,
    children: 0,
    infants: 0,
    pets: 0,
  } as any);

  assert(href.startsWith("/listings?"), "Href must target /listings");
  assert(href.includes("destination=Burj+Khalifa"), "Must preserve destination");
  assert(href.includes("checkIn=2026-09-17"), "Must preserve checkIn");
  assert(href.includes("checkOut=2026-09-30"), "Must preserve checkOut");
  assert(href.includes("guests=2"), "Must preserve guests");
  assert(href.includes("lat=25.1972"), "Must preserve lat");
  assert(href.includes("lng=55.2744"), "Must preserve lng");
  console.log("  ✓ buildContinueSearchHref preserves all location, coordinates, dates & guests metadata");

  console.log("\n==================================================================");
  console.log("   ALL CONTINUE SEARCHING BAR TESTS PASSED!                      ");
  console.log("==================================================================\n");
}

runContinueSearchingBarTests().catch((err) => {
  console.error("Continue searching bar test suite failed:", err);
  process.exit(1);
});

