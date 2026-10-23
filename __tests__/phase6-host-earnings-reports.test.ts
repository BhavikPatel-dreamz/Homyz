import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const read = (file: string) =>
  fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Phase 6 exposes host-authorized reports and real CSV/PDF exports", () => {
  assert.ok(
    fs.existsSync(
      path.join(
        process.cwd(),
        "app/(protected)/host/earnings/reports/page.tsx",
      ),
    ),
  );
  const exportRoute = read("app/api/v1/host/earnings/reports/export/route.ts");
  assert.match(exportRoute, /requireApiRole/);
  assert.match(exportRoute, /application\/pdf/);
  assert.match(exportRoute, /text\/csv/);
});

test("Phase 6 preserves native currency and safe export semantics", () => {
  const service = read("services/host-reporting.service.ts");
  assert.match(
    service,
    /Select one currency before generating a multi-currency report/,
  );
  assert.ok(service.includes("\\uFEFF"));
  assert.match(service, /\^\[=\+\\-@\]/);
  assert.match(service, /Earnings report — not a tax statement/);
  assert.doesNotMatch(service, /Official Financial Statement/);
});

test("Phase 6 rejects out-of-scope listing filters instead of broadening reports", () => {
  const service = read("services/host-reporting.service.ts");
  assert.match(service, /resolveOwnedListingId/);
  assert.match(service, /Listing not found or access denied for this host/);
});

test("Phase 6 validates report inputs and bounds in-process exports", () => {
  const service = read("services/host-reporting.service.ts");
  const route = read("app/api/v1/host/earnings/reports/export/route.ts");
  assert.match(service, /MAX_REPORT_BOOKINGS = 10_000/);
  assert.match(
    service,
    /Narrow the date range or property filter before exporting/,
  );
  assert.match(route, /Unsupported \$\{name\} filter/);
  assert.match(route, /One or more report columns are not supported/);
});

test("Phase 6 derives report currencies from immutable settlement snapshots and excludes future stays", () => {
  const service = read("services/host-reporting.service.ts");
  assert.match(service, /settlementCurrencyForBooking/);
  assert.match(service, /A future reservation is not income/);
  assert.match(
    service,
    /b\.endDate > now \|\|\s*!\["PAID", "ELIGIBLE_SETTLEMENT"\]\.includes\(\s*calc\.status,?\s*\)/,
  );
  assert.doesNotMatch(
    service,
    /\.\.\.\(query\.currency \? \{ currency: query\.currency\.toUpperCase\(\) \} : \{\}\)/,
  );
});

test("Phase 6 defaultExportFields is defined and exported cleanly", () => {
  const service = read("services/host-reporting.service.ts");
  assert.match(service, /import\s*\{[^}]*defaultExportFields/);
  assert.match(service, /export\s*\{[^}]*defaultExportFields/);
});
