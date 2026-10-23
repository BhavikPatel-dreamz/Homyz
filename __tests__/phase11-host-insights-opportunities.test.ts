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
  assert.match(service, /dismissOpportunity\(/);
  assert.match(service, /Listing title/);
  assert.match(service, /Property description/);
  assert.match(service, /Address & location/);
  assert.match(service, /Photo gallery \(at least 5\)/);
  assert.match(service, /Cover photo set/);
  assert.match(service, /Nightly rate configured/);
  assert.match(service, /Arrival & check-in guide/);

  // Categories
  assert.match(service, /"PHOTOS"/);
  assert.match(service, /"AMENITIES"/);
  assert.match(service, /"FAMILY"/);
  assert.match(service, /"WORKSPACE"/);
  assert.match(service, /"SETTINGS"/);
  assert.match(service, /"PRICING"/);
  assert.match(service, /"CALENDAR"/);

  // Direct editor action routes
  assert.match(service, /\/host\/listings\/\$\{listing\.id\}\/photos/);
  assert.match(service, /\/host\/listings\/\$\{listing\.id\}\/amenities/);
  assert.match(service, /\/host\/listings\/\$\{listing\.id\}\/booking-settings/);
  assert.match(service, /\/host\/listings\/\$\{listing\.id\}\/pricing/);
  assert.match(service, /\/host\/calendar/);
});

test("Opportunities Tab UI renders Listing Health section, category filters, opportunity cards, and detail modal", () => {
  const tab = read("components/host/insights/insights-opportunities-tab.tsx");

  // Listing health and readiness
  assert.match(tab, /Listing Health & Completeness/);
  assert.match(tab, /Overall profile readiness/);
  assert.match(tab, /checks completed/);

  // Category navigation
  assert.match(tab, /Hosting opportunities/);
  assert.match(tab, /Actionable listing recommendations/);
  assert.match(tab, /"PHOTOS"/);
  assert.match(tab, /"AMENITIES"/);
  assert.match(tab, /"FAMILY"/);
  assert.match(tab, /"WORKSPACE"/);
  assert.match(tab, /"SETTINGS"/);
  assert.match(tab, /"PRICING"/);
  assert.match(tab, /"CALENDAR"/);

  // Action & Dismissal
  assert.match(tab, /opp\.actionLabel/);
  assert.match(tab, /handleDismiss/);
  assert.match(tab, /setActiveModalItem/);
});

test("Opportunities APIs enforce authentication and Role authorization", () => {
  const oppApi = read("app/api/v1/host/insights/opportunities/route.ts");
  assert.match(oppApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(oppApi, /hostOpportunitiesService\.getOpportunitiesOverview/);

  const dismissApi = read("app/api/v1/host/insights/opportunities/dismiss/route.ts");
  assert.match(dismissApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(dismissApi, /hostOpportunitiesService\.dismissOpportunity/);

  const listingOppApi = read("app/api/v1/host/insights/opportunities/[listingId]/route.ts");
  assert.match(listingOppApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(listingOppApi, /hostOpportunitiesService\.getOpportunitiesOverview/);
});

test("Opportunities reject cross-host filters and server-side mandatory dismissals", () => {
  const service = read("services/host-opportunities.service.ts");
  assert.match(service, /You do not have access to this listing/);
  assert.match(service, /This required opportunity cannot be dismissed/);
  assert.match(service, /opportunity\.dismissible/);
  assert.doesNotMatch(service, /most searched amenity|significantly more guest interest/);
});
