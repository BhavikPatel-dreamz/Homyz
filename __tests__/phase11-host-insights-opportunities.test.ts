import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Phase 11 opportunities routes, components, and APIs exist", () => {
  // Opportunities Tab component
  assert.ok(fs.existsSync(path.join(process.cwd(), "components/host/insights/insights-opportunities-tab.tsx")));

  // Dedicated opportunities service
  assert.ok(fs.existsSync(path.join(process.cwd(), "services/host-opportunities.service.ts")));

  // APIs
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/host/insights/opportunities/route.ts")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/host/insights/opportunities/dismiss/route.ts")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/host/insights/opportunities/[listingId]/route.ts")));
});

test("Host Opportunities Service evaluates deterministic, non-AI listing health and recommendations", () => {
  const service = read("services/host-opportunities.service.ts");

  // Health and completeness checks
  assert.match(service, /getOpportunitiesOverview\(/);
  assert.match(service, /updateLifecycle\(/);
  assert.match(service, /listing\.description\.missing/);
  assert.match(service, /listing\.location\.incomplete/);
  assert.match(service, /listing\.photos\.insufficient/);
  assert.match(service, /listing\.pricing\.missing/);
  assert.match(service, /listing\.checkin\.instructions_missing/);

  // Categories
  assert.match(service, /"LISTING_QUALITY"/);
  assert.match(service, /"PRICING_AVAILABILITY"/);
  assert.match(service, /"REVIEWS_GUEST_EXPERIENCE"/);

  // Direct editor action routes
  assert.match(service, /\/host\/listings\/\$\{listing\.id\}\/photos/);
  assert.match(service, /\/host\/listings\/\$\{listing\.id\}\/amenities/);
  assert.match(service, /\/host\/listings\/\$\{listing\.id\}\/check-in-out/);
  assert.match(service, /\/host\/listings\/\$\{listing\.id\}\/pricing/);
});

test("Opportunities Tab UI renders filters, actionable opportunity cards, and lifecycle controls", () => {
  const tab = read("components/host/insights/insights-opportunities-tab.tsx");

  // Category navigation
  assert.match(tab, /Opportunity category/);
  assert.match(tab, /actionable items/);
  assert.match(tab, /"PRICING_AVAILABILITY"/);
  assert.match(tab, /"LISTING_QUALITY"/);
  assert.match(tab, /"REVIEWS_GUEST_EXPERIENCE"/);

  // Action & Dismissal
  assert.match(tab, /item\.actionLabel/);
  assert.match(tab, /updateLifecycle/);
  assert.match(tab, /Snooze 7 days/);
});

test("Opportunities APIs enforce authentication and Role authorization", () => {
  const oppApi = read("app/api/v1/host/insights/opportunities/route.ts");
  assert.match(oppApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(oppApi, /hostOpportunitiesService\.getOpportunitiesOverview/);

  const dismissApi = read("app/api/v1/host/insights/opportunities/dismiss/route.ts");
  assert.match(dismissApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(dismissApi, /hostOpportunitiesService\.updateLifecycle/);

  const listingOppApi = read("app/api/v1/host/insights/opportunities/[listingId]/route.ts");
  assert.match(listingOppApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(listingOppApi, /hostOpportunitiesService\.getOpportunitiesOverview/);
});

test("Opportunities reject cross-host filters and server-side mandatory dismissals", () => {
  const service = read("services/host-opportunities.service.ts");
  assert.match(service, /You do not have access to this listing/);
  assert.match(service, /This required opportunity cannot be changed/);
  assert.match(service, /opportunity\.dismissible/);
  assert.doesNotMatch(service, /most searched amenity|significantly more guest interest/);
});
