import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Phase 3 earnings overview keeps reporting scope in the URL and API contract", () => {
  const api = source("app/api/v1/host/earnings/route.ts");
  const page = source("app/(protected)/host/earnings/host-earnings-client.tsx");
  assert.match(api, /propertyId.*listingId/);
  assert.match(api, /searchParams\.get\("month"\)/);
  assert.match(api, /searchParams\.get\("year"\)/);
  assert.match(page, /router\.replace/);
  assert.match(page, /api\/v1\/host\/earnings\?/);
});

test("Phase 3 earnings uses completed-stay net payout and does not mix chart currencies", () => {
  const service = source("services/payout.service.ts");
  const page = source("app/(protected)/host/earnings/host-earnings-client.tsx");
  assert.match(service, /dataBasis: "COMPLETED_STAY_NET_HOST_PAYOUT"/);
  assert.match(service, /calc\.currency !== chartCurrency/);
  assert.match(page, /Amounts stay separated by settlement currency/);
  assert.match(service, /unavailableSnapshotCount/);
});

test("Phase 3 preserves payout method and bounded-preview behavior", () => {
  const service = source("services/payout.service.ts");
  const page = source("app/(protected)/host/earnings/host-earnings-client.tsx");
  assert.match(service, /upcomingPayouts\.slice\(0,\s*4\)/);
  assert.match(service, /includeAllPayouts/);
  assert.match(page, /Payout methods/);
  assert.match(page, /Add payout method/);
});
