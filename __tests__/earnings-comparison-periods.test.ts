import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { resolveComparisonPeriod, resolveTimeframeBounds } from "@/lib/dashboard/reporting-filter";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Earnings comparison presets follow Period A and do not retain stale month state", () => {
  const ref = new Date(Date.UTC(2026, 9, 26, 12));
  const october = resolveTimeframeBounds({ timeframe: "monthly", month: 10, year: 2026 }, ref);
  assert.equal(resolveComparisonPeriod(october, "prior_period").endDateKey, "2026-09-26");
  assert.equal(resolveComparisonPeriod(october, "prior_year").endDateKey, "2025-10-26");

  const client = read("app/(protected)/host/earnings/host-earnings-client.tsx");
  assert.match(client, /comparePreset/);
  assert.match(client, /compareStartDate: null, compareEndDate: null/);

  const service = read("services/payout.service.ts");
  assert.match(service, /resolveComparisonPeriod\(timeframeBounds, presetComparison\)/);
  assert.match(service, /secondaryPlatformFee/);
});

test("Earnings comparison URLs validate exact calendar dates before reporting", () => {
  const route = read("app/api/v1/host/earnings/route.ts");
  assert.match(route, /The reporting period requires valid start and end dates/);
  assert.match(route, /The comparison period requires valid start and end dates/);
  assert.match(route, /date\.getUTCFullYear\(\) === year/);

  const modal = read("components/host/reporting/period-comparison-modal.tsx");
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /Future comparison periods are unavailable/);
});
