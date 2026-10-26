import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Advanced earnings exposes only recorded payout items and marks booking-source limits", () => {
  const service = read("services/host-earnings-analytics.service.ts");
  const client = read("app/(protected)/host/earnings/analytics/host-earnings-analytics-client.tsx");
  const chart = read("components/host/reporting/earnings-interactive-chart.tsx");

  assert.match(service, /extractStoredGuestTotal/);
  assert.match(service, /hostServiceFeesCents/);
  assert.match(service, /point\.fees \+= payout\.hostServiceFee/);
  assert.match(service, /status: "UNATTRIBUTED"/);
  assert.match(service, /Booking source attribution is not recorded/);
  assert.match(client, /Eligible settlement items/);
  assert.match(client, /EarningsInteractiveChart/);
  assert.match(chart, /Service Fees/);
});

test("Advanced earnings property comparison is query-paginated and controllable", () => {
  const service = read("services/host-earnings-analytics.service.ts");
  const api = read("app/api/v1/host/earnings/analytics/route.ts");
  const client = read("app/(protected)/host/earnings/analytics/host-earnings-analytics-client.tsx");

  assert.match(service, /propertyPageSize/);
  assert.match(service, /filteredProperties/);
  assert.match(service, /pagedProperties/);
  assert.match(api, /Property pagination is invalid/);
  assert.match(client, /Search properties/);
  assert.match(client, /Rows per page/);
});
