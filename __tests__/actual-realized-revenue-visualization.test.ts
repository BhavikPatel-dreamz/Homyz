import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Actual realized revenue uses the responsive earnings chart with immutable completed-stay values", () => {
  const client = read("app/(protected)/host/earnings/analytics/host-earnings-analytics-client.tsx");
  const service = read("services/host-earnings-analytics.service.ts");

  assert.match(client, /EarningsInteractiveChart/);
  assert.match(client, /netEarnings: point\.netHostEarningsCents/);
  assert.match(client, /grossEarnings: point\.accommodationRevenueCents/);
  assert.match(client, /platformFee: point\.hostServiceFeesCents/);
  assert.match(client, /Loading realized revenue chart/);
  assert.match(client, /Revenue data couldn&apos;t be loaded/);
  assert.match(client, /No realized revenue for the selected period/);
  assert.match(service, /extractStoredHostPayout/);
  assert.match(service, /isStoredBookingPayoutEligible/);
  assert.match(service, /booking\.endDate > now/);
});

test("Actual realized revenue explains a legitimate net-to-accommodation difference", () => {
  const client = read("app/(protected)/host/earnings/analytics/host-earnings-analytics-client.tsx");
  const service = read("services/host-earnings-analytics.service.ts");

  assert.match(client, /Why net earnings can differ from accommodation revenue/);
  assert.match(client, /extraGuestFeesCents/);
  assert.match(client, /petFeesCents/);
  assert.match(client, /cleaningFeesCents/);
  assert.match(client, /taxesCollectedForHostCents/);
  assert.match(client, /hostServiceFeesCents/);
  assert.match(service, /target\.extraGuestFees \+= payout\.extraGuestFee/);
  assert.match(service, /target\.petFees \+= payout\.petFee/);
});
