import assert from "node:assert/strict";
import {
  generateFlexibleCandidateStays,
  flexibleSearchWindow,
  formatFlexibleStaySummary,
} from "../lib/search/flexible-stays";
import { publicListingSearchFiltersSchema } from "../lib/validation/public-listing-search";

const weekends = generateFlexibleCandidateStays(["2099-11"], "weekend");
assert.ok(weekends.length >= 4, "a month supplies every Friday weekend opportunity");
assert.ok(weekends.every((stay) => stay.checkOut > stay.checkIn), "candidate stays have a valid range");
assert.equal(weekends[0].checkIn, "2099-11-06");

const window = flexibleSearchWindow(weekends);
assert.deepEqual(window, { start: "2099-11-06", end: "2099-11-29" });
assert.equal(
  formatFlexibleStaySummary("weekend", ["2099-11"], "en-US"),
  "Weekend in November",
  "flexible result copy names the requested duration and month without inventing dates",
);

assert.equal(
  publicListingSearchFiltersSchema.safeParse({
    dateMode: "flexible",
    flexibleDuration: "week",
    flexibleMonths: ["2099-11"],
    guests: 2,
  }).success,
  true,
  "a complete flexible search contract is valid",
);
assert.equal(
  publicListingSearchFiltersSchema.safeParse({ dateMode: "flexible", flexibleDuration: "week" }).success,
  false,
  "flexible searches cannot silently run without a month",
);
assert.equal(
  publicListingSearchFiltersSchema.safeParse({
    dateMode: "flexible",
    flexibleDuration: "week",
    flexibleMonths: ["2099-11"],
    checkIn: "2099-11-10",
    checkOut: "2099-11-17",
  }).success,
  false,
  "exact and flexible dates cannot be combined",
);

console.log("Flexible search contract regression checks passed.");
