import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Phase 5 provides a URL-backed owned transaction-detail API and page", () => {
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/api/v1/host/earnings/transactions/[transactionId]/route.ts")));
  assert.ok(fs.existsSync(path.join(process.cwd(), "app/(protected)/host/earnings/transactions/[transactionId]/page.tsx")));
  const service = read("services/payout.service.ts");
  assert.match(service, /listing: accessibleHostListingWhere\(actor\)/);
  assert.match(service, /assertHostPermission\(actorId, "earnings\.view"\)/);
  assert.match(service, /getHostEarningsTransactionDetails/);
  assert.match(service, /payoutMethodMasked/);
});

test("Phase 5 displays stored financial events without inferring paid payouts", () => {
  const service = read("services/payout.service.ts");
  const page = read("app/(protected)/host/earnings/transactions/[transactionId]/page.tsx");
  assert.match(service, /calculation\.executionDetails\?\.executedAt/);
  assert.match(service, /Payment captured/);
  assert.match(service, /Refund /);
  assert.match(page, /Earnings breakdown/);
  assert.match(page, /Payout history/);
  assert.match(page, /View reservation/);
});

test("Phase 5 preserves list filters while navigating to details", () => {
  const client = read("app/(protected)/host/earnings/host-transactions-client.tsx");
  const page = read("app/(protected)/host/earnings/transactions/[transactionId]/page.tsx");
  assert.match(client, /returnTo=/);
  assert.match(client, /encodeURIComponent/);
  assert.match(page, /startsWith\("\/host\/earnings"\)/);
});
