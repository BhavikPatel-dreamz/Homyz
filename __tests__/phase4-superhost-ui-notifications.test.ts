import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Phase 4: public badges render only from persisted Superhost status and remain separate from Guest Favorite", () => {
  const badge = read("components/badges/superhost-badge.tsx");
  const identity = read("components/users/public-host-identity-card.tsx");
  const listing = read("app/listings/[id]/public-listing-detail-client.tsx");
  const qualification = read("services/qualification.service.ts");

  assert.match(badge, /if \(active !== true\) return null/);
  assert.match(identity, /<SuperhostBadge active compact/);
  assert.match(listing, /<SuperhostBadge active=\{listing\.host\?\.isSuperhost\}/);
  assert.match(qualification, /return host\?\.isSuperhost === true/);
  assert.match(qualification, /return property\?\.isGuestFavorite === true/);
});

test("Phase 4: host progress displays all six engine criteria and distinguishes blocked results", () => {
  const dashboard = read("services/host-dashboard.service.ts");
  const insights = read("services/host-insights.service.ts");
  const tab = read("components/host/insights/insights-superhost-tab.tsx");

  assert.match(dashboard, /eligibilityStatus: superhostStatus\.qualification\.eligibilityStatus/);
  assert.match(insights, /superhostProg\.qualification\.criteria\.map/);
  assert.match(insights, /LISTING_OWNERSHIP/);
  assert.match(insights, /HOSTING_VOLUME/);
  assert.match(insights, /CANCELLATION_RATE/);
  assert.match(tab, /Six authoritative host-level criteria/);
  assert.match(tab, /criterion\.status === "BLOCKED"/);
  assert.match(tab, /Qualification cannot be determined yet/);
  assert.match(tab, /Progress is unavailable until this criterion is resolved/);
});

test("Phase 4: history exposes persisted assessment results and safe blocked explanations", () => {
  const history = read("app/(protected)/host/insights/superhost/history/page.tsx");

  assert.match(history, /evaluation\.failureReasons\.some/);
  assert.match(history, /Review required/);
  assert.match(history, /Renewed/);
  assert.match(history, /Status lost/);
  assert.match(history, /Official quarterly evaluations are retained/);
});

test("Phase 4: lifecycle notifications include first award, renewal, and loss without retry duplicates", () => {
  const service = read("services/superhost.service.ts");

  assert.match(service, /const renewed = result\.finalized/);
  assert.match(service, /Your Superhost status was renewed/);
  assert.match(service, /You are now a Superhost/);
  assert.match(service, /Your Superhost status changed/);
  assert.match(service, /if \(statusChanged \|\| renewed\)/);
  assert.match(service, /if \(existing\) return \{ history: existing, finalized: false \}/);
  assert.match(service, /Post-evaluation notification failed/);
});

test("Phase 4: admin detail and rerun controls remain permission-gated and use the Phase 3 API", () => {
  const route = read("app/api/v1/admin/superhost/evaluations/route.ts");
  const page = read("app/(protected)/admin/hosts/[id]/superhost/page.tsx");
  const manager = read("components/admin/superhost-assessment-manager.tsx");

  assert.match(route, /PERMISSIONS\.HOSTS_VIEW/);
  assert.match(route, /PERMISSIONS\.HOSTS_EDIT/);
  assert.match(route, /evaluateHostAtQuarterlyCheckpoint/);
  assert.match(page, /requirePagePermission\(PERMISSIONS\.HOSTS_VIEW\)/);
  assert.match(page, /canRerun=\{hasPermission\(admin, PERMISSIONS\.HOSTS_EDIT\)\}/);
  assert.match(manager, /Rerun assessment/);
  assert.match(manager, /qualification\.criteria/);
  assert.match(manager, /Assessment history/);
});
