import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Phase 4 exposes dedicated Upcoming and Paid transaction routes", () => {
  assert.ok(
    fs.existsSync(
      path.join(
        process.cwd(),
        "app/(protected)/host/earnings/upcoming/page.tsx",
      ),
    ),
  );
  assert.ok(
    fs.existsSync(
      path.join(process.cwd(), "app/(protected)/host/earnings/paid/page.tsx"),
    ),
  );
  const overview = read(
    "app/(protected)/host/earnings/host-earnings-client.tsx",
  );
  assert.match(overview, /host\/earnings\/upcoming/);
  assert.match(overview, /host\/earnings\/paid/);
});

test("Phase 4 transaction queries keep paid status authoritative and paginate filtered rows", () => {
  const service = read("services/payout.service.ts");
  assert.match(
    service,
    /priceBreakdown:\s*\{\s*path: \["payoutExecution", "status"\],\s*equals: "PAID"/,
  );
  assert.match(service, /calculation\.status === "PAID"/);
  assert.match(service, /rows\.slice\(\(page - 1\) \* limit, page \* limit\)/);
  assert.match(service, /totalsByCurrency/);
});

test("Phase 4 uses server-side search/filter parameters and filtered export", () => {
  const api = read("app/api/v1/host/earnings/transactions/route.ts");
  const client = read(
    "app/(protected)/host/earnings/host-transactions-client.tsx",
  );
  const exportRoute = read("app/api/v1/host/earnings/export/route.ts");
  assert.match(api, /searchParams\.get\("search"\)/);
  assert.match(api, /searchParams\.get\("datePreset"\)/);
  assert.match(client, /setTimeout/);
  assert.match(client, /Export filtered CSV/);
  assert.match(exportRoute, /includeAll: true/);
});

test("Phase 4 filters settlement currency after reading immutable payout snapshots", () => {
  const service = read("services/payout.service.ts");
  const route = read("app/api/v1/host/earnings/transactions/route.ts");
  assert.match(service, /normalizeSettlementCurrency/);
  assert.match(service, /calculation\.currency === settlementCurrency/);
  assert.doesNotMatch(service, /input\.currency\?\.trim\(\) \? \{ currency:/);
  assert.match(
    service,
    /A custom transaction range requires both a start and end date/,
  );
  assert.match(route, /Payout status is not valid for this transaction view/);
});
