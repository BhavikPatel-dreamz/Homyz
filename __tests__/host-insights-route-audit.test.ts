import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
const exists = (file: string) => fs.existsSync(path.join(process.cwd(), file));

test("every clickable Stats metric is handled by the protected dynamic detail route", () => {
  const service = read("services/host-stats-insights.service.ts");
  const page = read("app/(protected)/host/insights/stats/[metric]/page.tsx");
  const api = read("app/api/v1/host/insights/stats/[metric]/route.ts");
  const metrics = ["earnings", "views", "bookings", "occupancy", "rates", "conversion", "response-rate", "cancellations", "stay-length"];

  assert.ok(exists("app/(protected)/host/insights/stats/[metric]/page.tsx"));
  for (const metric of metrics) assert.match(service, new RegExp(`"${metric}"`));
  assert.match(page, /error instanceof AppError && error\.status === 404/);
  assert.match(api, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
});

test("nested Insights destinations have protected detail pages and authorized APIs", () => {
  for (const page of [
    "app/(protected)/host/insights/reviews/[reviewId]/page.tsx",
    "app/(protected)/host/insights/stats/guests/page.tsx",
    "app/(protected)/host/insights/stats/guests/origins/page.tsx",
    "app/(protected)/host/insights/stats/guests/returning/page.tsx",
    "app/(protected)/host/insights/stats/guests/check-in/page.tsx",
    "app/(protected)/host/insights/superhost/history/page.tsx",
  ]) assert.ok(exists(page), `${page} exists`);

  const reviewApi = read("app/api/v1/host/insights/reviews/[reviewId]/route.ts");
  const historyApi = read("app/api/v1/host/insights/superhost/history/route.ts");
  assert.match(reviewApi, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(historyApi, /getSuperhostAssessmentHistory\(actor\.id\)/);
});

test("host navigation labels are translated in every supported locale", () => {
  for (const locale of ["en", "ar", "de", "es", "fr", "hi"]) {
    const messages = JSON.parse(read(`messages/${locale}.json`));
    assert.equal(typeof messages.host_nav_earnings, "string", `${locale} earnings label`);
    assert.equal(typeof messages.host_nav_insights, "string", `${locale} insights label`);
  }
  const header = read("components/dashboard/app-header.tsx");
  assert.doesNotMatch(header, /\(t as any\)\("host_nav_(earnings|insights)"/);
});
