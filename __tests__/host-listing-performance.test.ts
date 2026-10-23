import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("listing performance uses real Homyz search, persisted scoped observations, and shared nightly pricing", () => {
  const service = read("services/host-listing-performance.service.ts");
  assert.match(service, /listingService\.searchPublicListings/);
  assert.match(service, /listingSearchRankingObservation\.create/);
  assert.match(service, /resultPosition: position >= 0 \? position \+ 1 : null/);
  assert.match(service, /Not found within the first/);
  assert.match(service, /resolveNightlyPrice/);
  assert.match(service, /Same property type/);
  assert.match(service, /Same listing currency/);
  assert.match(service, /MIN_COMPARABLES = 3/);
});

test("listing performance has protected API and Stats detail navigation", () => {
  const api = read("app/api/v1/host/insights/listing-performance/route.ts");
  const stats = read("components/host/insights/insights-stats-tab.tsx");
  const page = read("app/(protected)/host/insights/listing-performance/page.tsx");
  assert.match(api, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(api, /hostListingPerformanceService\.getListingPerformance/);
  assert.match(stats, /View Listing Performance/);
  assert.match(page, /requirePageRole\(\[Role\.HOST, Role\.ADMIN\]\)/);
});

test("comparison quick fixes are deterministic and only added for a selected listing", () => {
  const service = read("services/host-listing-performance.service.ts");
  const opportunities = read("services/host-opportunities.service.ts");
  assert.match(service, /Improve your Value Rating/);
  assert.match(service, /Review pricing against similar listings/);
  assert.match(service, /Only add it after confirming that guests can truthfully use it/);
  assert.match(opportunities, /if \(options\.listingId\)/);
  assert.match(opportunities, /hostListingPerformanceService\.getListingPerformance/);
});
