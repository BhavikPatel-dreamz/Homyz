import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Phase 13 derives advanced earnings only from immutable eligible financial snapshots", () => {
  const service = read("services/host-earnings-analytics.service.ts");

  assert.match(service, /extractStoredHostPayout/);
  assert.match(service, /isStoredBookingPayoutEligible/);
  assert.match(service, /booking\.endDate > now/);
  assert.match(service, /eligibleAccommodationRevenueCents/);
  assert.match(service, /netHostEarningsCents/);
  assert.match(service, /normalizeCurrencyCode/);
});

test("Phase 13 RevPAN reuses the shared Host Dashboard inventory policy", () => {
  const service = read("services/host-earnings-analytics.service.ts");
  const dashboard = read("services/host-dashboard.service.ts");
  const client = read("app/(protected)/host/earnings/analytics/host-earnings-analytics-client.tsx");

  assert.match(service, /calculateDashboardInventory/);
  assert.match(client, /Eligible accommodation revenue ÷ bookable inventory nights/);
  assert.match(dashboard, /export function calculateDashboardInventory/);
});

test("Phase 13 keeps unsupported costs and profit explicitly unavailable", () => {
  const service = read("services/host-earnings-analytics.service.ts");
  const client = read("app\/(protected)\/host\/earnings\/analytics\/host-earnings-analytics-client.tsx");

  assert.match(service, /DATA_UNAVAILABLE/);
  assert.match(service, /Operating expenses are not recorded in Homyz yet/);
  assert.match(service, /Operating profit requires recorded operating expenses/);
  assert.match(client, /Not available yet/);
});

test("Phase 13 provides protected analytics, filter persistence, comparisons, and RevPAN drill-down", () => {
  const api = read("app/api/v1/host/earnings/analytics/route.ts");
  const page = read("app\/(protected)\/host\/earnings\/analytics\/page.tsx");
  const client = read("app\/(protected)\/host\/earnings\/analytics\/host-earnings-analytics-client.tsx");
  const revpan = read("app\/(protected)\/host\/earnings\/analytics\/revpan\/page.tsx");

  assert.match(api, /requireApiRole\(req, \[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(api, /comparisonStartDate/);
  assert.match(page, /requirePageRole\(\[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(client, /DatePeriodPicker/);
  assert.match(client, /PeriodComparisonModal/);
  assert.match(client, /router\.replace/);
  assert.match(client, /\/host\/earnings\/analytics\/revpan/);
  assert.match(revpan, /Revenue per available night/);
  assert.match(revpan, /Total bookable inventory nights/);
});
