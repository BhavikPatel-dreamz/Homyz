import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { buildHostDashboardRecommendations } from "../lib/dashboard/host-recommendations";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

test("final dashboard: recommendations are deterministic, grounded, prioritized, and bounded", () => {
  const recommendations = buildHostDashboardRecommendations({
    hostCancellationRatePercentage: 2.5,
    responseRatePercentage: 75,
    overallRating: 4.6,
    totalReviewsCount: 10,
    futureAvailableNights: 6,
    futureWindowDays: 14,
    listings: [{ id: "listing-1", title: "Desert Villa", missingFields: ["check-in instructions"] }],
  });

  assert.equal(recommendations.length, 4, "the dashboard must not overload hosts with alerts");
  assert.deepEqual(recommendations.map((item) => item.priority), ["CRITICAL", "HIGH", "HIGH", "MEDIUM"]);
  assert.match(recommendations[0].description, /2.5%/);
  assert.match(recommendations[1].description, /75%/);
  assert.match(recommendations[3].description, /6 open bookable nights in the next 14 days/);
  assert.ok(recommendations.every((item) => !/revenue|competitor|demand spike|conversion increase/i.test(item.description)));
});

test("final dashboard: no-data recommendation inputs do not fabricate an alert", () => {
  const recommendations = buildHostDashboardRecommendations({
    hostCancellationRatePercentage: 0,
    responseRatePercentage: null,
    overallRating: null,
    totalReviewsCount: 0,
    futureAvailableNights: 0,
    futureWindowDays: 14,
    listings: [{ id: "complete", title: "Complete listing", missingFields: [] }],
  });

  assert.deepEqual(recommendations, []);
});

test("final dashboard: service reuses one inventory calculation and protects active inventory semantics", () => {
  const service = read("services/host-dashboard.service.ts");
  assert.match(service, /const inventoryListings = scopedListings\.filter\([\s\S]*listing\.published && listing\.status === "ACTIVE" && !listing\.isPaused/);
  assert.match(service, /const occupancyInventory = calculateDashboardInventory/);
  assert.match(service, /const futureInventory = calculateDashboardInventory/);
  assert.match(service, /bookingDateKey\(b\.startDate\) >= todayKey/);
  assert.match(service, /const sixMonthsAgo = new Date\(now\)/);
  assert.match(service, /recommendations = buildHostDashboardRecommendations/);
});

test("final dashboard: the rendered dashboard exposes the authorized property filter and data-backed insights", () => {
  const ui = read("components/host/dashboard/host-kpi-overview.tsx");
  assert.match(ui, /aria-label="Filter dashboard by property"/);
  assert.match(ui, /Actionable insights/);
  assert.match(ui, /No projected revenue or market data is inferred/);
  assert.match(ui, /AbortController/);
});
