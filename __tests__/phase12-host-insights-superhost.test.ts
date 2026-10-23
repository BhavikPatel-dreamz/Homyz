import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Phase 12 preserves finalized quarterly assessments and exposes host-scoped history", () => {
  const service = read("services/superhost.service.ts");
  const api = read("app/api/v1/host/insights/superhost/history/route.ts");
  const page = read("app/(protected)/host/insights/superhost/history/page.tsx");

  assert.match(service, /superhostEvaluation\.findUnique/);
  assert.match(service, /if \(existing\) return \{ history: existing, finalized: false \}/);
  assert.match(service, /superhostEvaluation\.create/);
  assert.match(service, /where: \{ hostId \}/);
  assert.match(api, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(api, /getSuperhostAssessmentHistory\(actor\.id\)/);
  assert.match(page, /Official quarterly evaluations are retained/);
});

test("Phase 12 distinguishes official status and does not promise unimplemented benefits", () => {
  const insights = read("services/host-insights.service.ts");
  const tab = read("components/host/insights/insights-superhost-tab.tsx");

  assert.match(insights, /officialStatus: dashboardData\.superhostEvaluation\.officialStatus/);
  assert.match(insights, /Superhost Badge/);
  assert.doesNotMatch(insights, /Priority Host Support|Featured Search Placement|Community Recognition/);
  assert.match(tab, /Eligible at next assessment/);
  assert.match(tab, /Assessment history/);
});
