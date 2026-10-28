import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Phase 5: host API is actor-scoped, admin API is permission-gated, and public surfaces expose only persisted badges", () => {
  const hostHistory = read("app/api/v1/host/insights/superhost/history/route.ts");
  const admin = read("app/api/v1/admin/superhost/evaluations/route.ts");
  const publicProfile = read("components/users/public-host-profile-view.tsx");
  const listing = read("app/listings/[id]/public-listing-detail-client.tsx");

  assert.match(hostHistory, /getSuperhostAssessmentHistory\(actor\.id\)/, "hosts cannot supply another host id");
  assert.match(admin, /requireApiPermission\(req, PERMISSIONS\.HOSTS_VIEW\)/);
  assert.match(admin, /requireApiPermission\(req, PERMISSIONS\.HOSTS_EDIT\)/);
  assert.match(publicProfile, /host\.isSuperhost/);
  assert.match(listing, /active=\{listing\.host\?\.isSuperhost\}/);
  assert.doesNotMatch(publicProfile, /qualification|failureReasons|accountGoodStanding/);
});

test("Phase 5: dashboard and host UI consume the authoritative engine result rather than recalculating eligibility", () => {
  const dashboard = read("services/host-dashboard.service.ts");
  const insights = read("services/host-insights.service.ts");
  const tab = read("components/host/insights/insights-superhost-tab.tsx");

  assert.match(dashboard, /getLiveSuperhostStatus\(actor\.id, now\)/);
  assert.match(dashboard, /criteria: superhostStatus\.qualification\.criteria/);
  assert.match(insights, /superhostProg\.qualification\.criteria\.map/);
  assert.match(tab, /criterion\.currentValue/);
  assert.match(tab, /criterion\.targetValue/);
  assert.match(tab, /criterion\.description/);
  assert.doesNotMatch(tab, /4\.8|90%|10 completed/, "UI does not reimplement Superhost thresholds");
});

test("Phase 5: automated assessment remains immutable, concurrent-safe, and post-commit-safe", () => {
  const service = read("services/superhost.service.ts");
  const schema = read("prisma/schema.prisma");
  const internal = read("app/api/internal/superhost/evaluations/route.ts");

  assert.match(schema, /@@unique\(\[hostId, evaluationDate\]\)/);
  assert.match(service, /code !== "P2002"/);
  assert.match(service, /Promise\.allSettled/);
  assert.match(service, /Post-evaluation notification failed/);
  assert.match(service, /eligibilityStatus: progress\.qualification\.eligibilityStatus/);
  assert.match(internal, /timingSafeEqual/);
  assert.match(internal, /SUPERHOST_EVALUATION_CRON_SECRET/);
});

test("Phase 5: blocked exceptions cannot become false awards and Guest Favorite stays independent", () => {
  const rules = read("lib/superhost/rules.ts");
  const lifecycle = read("lib/superhost/lifecycle.ts");
  const favorite = read("services/guest-favorite.service.ts");

  assert.match(rules, /cancellationExceptionVerificationState === "UNVERIFIED"/);
  assert.match(rules, /eligibilityStatus: hasBlockedCriterion \? "CANNOT_DETERMINE"/);
  assert.match(lifecycle, /input\.eligibilityStatus === "CANNOT_DETERMINE"/);
  assert.doesNotMatch(favorite, /evaluateSuperhostRequirements/);
});
