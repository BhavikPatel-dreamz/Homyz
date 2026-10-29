import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

const results = read("app/listings/listings-results-client.tsx");
const summary = read("components/listings/results-summary-bar.tsx");
const card = read("components/listings/listing-card.tsx");
const map = read("components/listings/search-map.tsx");

assert.ok(results.includes('dateMode={currentFilters.dateMode}'), "results forward flexible mode to cards and maps");
assert.ok(results.includes('flexibleDuration={currentFilters.flexibleDuration}'), "results forward flexible duration to cards and maps");
assert.ok(results.includes('flexibleMonths={currentFilters.flexibleMonths}'), "results preserve requested months for cards and detail links");
assert.ok(summary.includes("available for ${flexibleSummary.toLowerCase()}"), "result count describes flexible intent");
assert.ok(card.includes('isFlexibleSearch ? `From ${formatPrice'), "flexible cards use a starting nightly price");
assert.ok(card.includes('dateMode: "flexible"'), "listing detail links retain flexible date intent");
assert.ok(map.includes('isFlexibleSearch ? "From "'), "flexible map markers use a starting nightly price");
assert.ok(map.includes('params.set("stay", flexibleDuration)'), "map fallback links retain flexible duration");

console.log("Flexible result presentation regression checks passed.");
