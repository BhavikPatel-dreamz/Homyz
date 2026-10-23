import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ListingCoHostStatus, Role } from "@/generated/prisma/enums";
import { accessibleHostListingWhere } from "@/lib/permissions/host-listing-access";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

test("Plus report APIs enforce the matching server-side entitlement and do not cache account data", () => {
  const protectedRoutes = [
    ["app/api/v1/host/earnings/analytics/route.ts", "ADVANCED_EARNINGS"],
    ["app/api/v1/host/insights/booking-analytics/route.ts", "BOOKING_BEHAVIOR"],
    ["app/api/v1/host/operations/route.ts", "OPERATIONS_AND_PROFITABILITY"],
    ["app/api/v1/host/operations/cleaning/[id]/route.ts", "OPERATIONS_AND_PROFITABILITY"],
  ] as const;

  for (const [path, feature] of protectedRoutes) {
    const route = source(path);
    assert.match(route, new RegExp(`requireHostDashboardFeature\\(actor, "${feature}"\\)`));
  }

  for (const path of protectedRoutes.slice(0, 3).map(([path]) => path)) {
    assert.match(source(path), /Cache-Control.*private, no-store|private, no-store.*Cache-Control/);
  }
});

test("direct Plus pages and mixed listing comparisons cannot bypass the entitlement decision", () => {
  const pages = [
    ["app/(protected)/host/earnings/analytics/page.tsx", "ADVANCED_EARNINGS"],
    ["app/(protected)/host/earnings/analytics/revpan/page.tsx", "REVPAN"],
    ["app/(protected)/host/insights/stats/booking-analytics/page.tsx", "BOOKING_BEHAVIOR"],
    ["app/(protected)/host/insights/stats/booking-analytics/[metric]/page.tsx", "BOOKING_BEHAVIOR"],
    ["app/(protected)/host/operations/page.tsx", "OPERATIONS_AND_PROFITABILITY"],
  ] as const;

  for (const [path, feature] of pages) {
    assert.match(source(path), new RegExp(`getHostDashboardEntitlements\\(actor\\).*features\\.${feature}`));
  }

  const listingApi = source("app/api/v1/host/insights/listing-performance/route.ts");
  assert.match(listingApi, /getHostDashboardEntitlements\(actor\)/);
  assert.match(listingApi, /includeAdvancedComparisons: entitlements\.features\.ADVANCED_PROPERTY_COMPARISON/);
});

test("accepted co-hosts are included in reporting scope while unassigned users are excluded", () => {
  assert.deepEqual(
    accessibleHostListingWhere({ id: "co-host-id", role: Role.HOST }),
    {
      deletedAt: null,
      OR: [
        { hostId: "co-host-id" },
        { coHosts: { some: { userId: "co-host-id", status: ListingCoHostStatus.ACCEPTED } } },
      ],
    },
  );

  for (const path of [
    "services/host-earnings-analytics.service.ts",
    "services/host-booking-analytics.service.ts",
    "services/host-listing-performance.service.ts",
    "services/host-operational-records.service.ts",
  ]) {
    assert.match(source(path), /accessibleHostListingWhere\(actor/);
  }
});
