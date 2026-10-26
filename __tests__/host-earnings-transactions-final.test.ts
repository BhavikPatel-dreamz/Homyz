import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("the standard host transactions index route is implemented", () => {
  const page = "app/(protected)/host/earnings/transactions/page.tsx";
  assert.ok(fs.existsSync(path.join(process.cwd(), page)));
  const source = read(page);
  assert.match(source, /requirePageRole\(\[Role\.HOST, Role\.ADMIN\]\)/);
  assert.match(source, /kind: "all"/);
  assert.match(source, /PAGE_SIZES = new Set\(\[10, 20, 25, 50\]\)/);
  assert.match(source, /HostTransactionsClient/);
});

test("the unified ledger keeps paid and payable snapshots distinct", () => {
  const service = read("services/payout.service.ts");
  assert.match(service, /HostEarningsTransactionKind = "all" \| "upcoming" \| "paid"/);
  assert.match(service, /"PAID", "SCHEDULED", "ELIGIBLE_SETTLEMENT", "PROCESSING"/);
  assert.match(service, /MIXED_FINANCIAL_DATE/);
  assert.match(service, /statusTotalsByCurrency/);
  assert.match(service, /calculation\.status === "PAID"/);
  assert.match(service, /assertHostPermission\(actorId, "earnings\.view"\)/);
});

test("the transactions API and CSV export support the filtered unified ledger", () => {
  const api = read("app/api/v1/host/earnings/transactions/route.ts");
  const exportRoute = read("app/api/v1/host/earnings/export/route.ts");
  assert.match(api, /kind !== "all" && kind !== "upcoming" && kind !== "paid"/);
  assert.match(api, /Unsupported transaction page size/);
  assert.match(exportRoute, /status === "all" \|\| status === "upcoming" \|\| status === "paid"/);
  assert.match(exportRoute, /"Financial Date"/);
  assert.match(exportRoute, /transaction\.status === "PAID"/);
});

test("the responsive transactions client exposes filters, status totals, and detail navigation", () => {
  const client = read("app/(protected)/host/earnings/host-transactions-client.tsx");
  const earnings = read("app/(protected)/host/earnings/host-earnings-client.tsx");
  assert.match(client, /View and manage your hosting financial transaction history\./);
  assert.match(client, /Transactions per page/);
  assert.match(client, /Completed payouts/);
  assert.match(client, /Pending payouts/);
  assert.match(client, /\/host\/earnings\/transactions\/\$\{item\.bookingId\}/);
  assert.match(earnings, /View all transactions/);
  assert.match(earnings, /host\/earnings\/transactions/);
});
