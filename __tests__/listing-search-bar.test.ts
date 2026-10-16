import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Listing Search Bar & Placement Parity", () => {
  const headerPath = path.join(process.cwd(), "components/dashboard/app-header.tsx");
  const searchBarPath = path.join(process.cwd(), "components/listings/listing-search-bar.tsx");
  const resultsClientPath = path.join(process.cwd(), "app/listings/listings-results-client.tsx");

  it("ensures AppHeader is clean on /listings and only displays search bar when showSearchBar === true", () => {
    const source = fs.readFileSync(headerPath, "utf-8");
    assert.ok(
      source.includes("const isListingRoute = showSearchBar === true;"),
      "AppHeader must not automatically inject search bar inside the header for /listings"
    );
  });

  it("verifies ListingSearchBar contains full desktop 4-segment search bar with home page styling", () => {
    const source = fs.readFileSync(searchBarPath, "utf-8");

    // Must have 4 segments: Where, Check in, Check out, Who
    assert.ok(source.includes('desktopPanel === "where" ? "bg-[#fcdf9c]"'), "Where segment must highlight with #fcdf9c");
    assert.ok(source.includes('desktopPanel === "checkIn" ? "bg-[#fcdf9c]"'), "Check in segment must highlight with #fcdf9c");
    assert.ok(source.includes('desktopPanel === "checkOut" ? "bg-[#fcdf9c]"'), "Check out segment must highlight with #fcdf9c");
    assert.ok(source.includes('desktopPanel === "who" ? "bg-[#fcdf9c]"'), "Who segment must highlight with #fcdf9c");

    // Circular yellow button
    assert.ok(source.includes("bg-[#fcdf9c]"), "Must have yellow button");
    assert.ok(source.includes("h-[48px] w-[48px]"), "Must have 48px circle search button on desktop");

    // Autocomplete & date picker
    assert.ok(source.includes("fetchSuggestions"), "Must support suggestion autocomplete");
    assert.ok(source.includes("MobileDatePicker"), "Must support date picker");
    assert.ok(source.includes("guestOptions"), "Must support guest options");
  });

  it("verifies ListingSearchBar contains clean mobile pill and step drawer", () => {
    const source = fs.readFileSync(searchBarPath, "utf-8");

    // Mobile pill
    assert.ok(source.includes("h-[56px] w-full"), "Must have h-[56px] full width pill on mobile");
    assert.ok(source.includes("bg-[#f3f4f6]"), "Must have light gray background pill");
    assert.ok(source.includes("setIsMobileSearchOpen(true)"), "Must open mobile search drawer");

    // Modal overlay with steps
    assert.ok(source.includes("ModalOverlay"), "Must use ModalOverlay for scroll locking");
    assert.ok(source.includes('activeStep === "where"'), "Must have where step in mobile search");
    assert.ok(source.includes('activeStep === "when"'), "Must have when step in mobile search");
    assert.ok(source.includes('activeStep === "who"'), "Must have who step in mobile search");
  });

  it("verifies ListingsResultsClient renders ListingSearchBar below header and above ResultsSummaryBar", () => {
    const source = fs.readFileSync(resultsClientPath, "utf-8");

    const searchBarIndex = source.indexOf("<ListingSearchBar />");
    const summaryBarIndex = source.indexOf("<ResultsSummaryBar");

    assert.ok(searchBarIndex > 0, "ListingsResultsClient must include <ListingSearchBar />");
    assert.ok(summaryBarIndex > 0, "ListingsResultsClient must include <ResultsSummaryBar />");
    assert.ok(
      searchBarIndex < summaryBarIndex,
      "<ListingSearchBar /> must be rendered BEFORE (above) <ResultsSummaryBar />"
    );
  });
});

