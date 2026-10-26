import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { Role } from "@/generated/prisma/enums";
import {
  resolveHostDashboardEntitlements,
  HOST_DASHBOARD_FEATURES,
  type HostDashboardFeature,
  type HostDashboardEntitlements,
} from "@/lib/entitlements/host-dashboard";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Scenario 1: Standard host has core features accessible while Plus features are protected", () => {
  const result = resolveHostDashboardEntitlements(null, Role.HOST);
  assert.equal(result.plan, "STANDARD");
  assert.equal(result.tier, "STANDARD");
  assert.equal(result.hasDashboardPlus, false);
  assert.equal(result.source, "STANDARD_DEFAULT");

  // Core Standard features are enabled
  assert.equal(result.features.DASHBOARD_OVERVIEW, true);
  assert.equal(result.features.BASIC_EARNINGS, true);
  assert.equal(result.features.RESERVATIONS_AND_CALENDAR, true);
  assert.equal(result.features.BASIC_INSIGHTS, true);
  assert.equal(result.features.REVIEWS_AND_RATINGS, true);
  assert.equal(result.features.BASIC_LISTING_PERFORMANCE, true);
  assert.equal(result.features.LISTING_HEALTH_AND_OPPORTUNITIES, true);

  // Plus features are locked
  assert.equal(result.features.ADVANCED_EARNINGS, false);
  assert.equal(result.features.REVPAN, false);
  assert.equal(result.features.BOOKING_BEHAVIOR, false);
  assert.equal(result.features.ADVANCED_PROPERTY_COMPARISON, false);
  assert.equal(result.features.OPERATIONS_AND_PROFITABILITY, false);
});

test("Scenario 2: Active paid Plus subscription unlocks Standard + implemented Plus features", () => {
  const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const personalInfo = {
    dashboardPlus: {
      status: "ACTIVE",
      expiresAt: future,
    },
  };

  const result = resolveHostDashboardEntitlements(personalInfo, Role.HOST);
  assert.equal(result.tier, "PLUS");
  assert.equal(result.hasDashboardPlus, true);
  assert.equal(result.source, "SUBSCRIPTION");
  assert.equal(result.accessStatus, "Plus — Paid");

  // All features enabled
  for (const feature of Object.keys(HOST_DASHBOARD_FEATURES) as HostDashboardFeature[]) {
    assert.equal(result.features[feature], true);
  }
});

test("Scenario 3: Active admin-granted Plus host has full Plus access without any paid subscription", () => {
  const adminGrant = {
    id: "grant-test-1",
    hostId: "host-1",
    featureKey: "DASHBOARD_PLUS",
    source: "ADMIN_COMPLIMENTARY",
    status: "ACTIVE",
    startsAt: new Date(Date.now() - 3600_000),
    expiresAt: null,
  };

  // No subscription in personalInfo
  const result = resolveHostDashboardEntitlements(null, Role.HOST, new Date(), { adminGrant });
  assert.equal(result.tier, "PLUS");
  assert.equal(result.hasDashboardPlus, true);
  assert.equal(result.source, "ADMIN");
  assert.equal(result.accessStatus, "Plus — Admin Granted");
  assert.equal(result.features.REVPAN, true);
  assert.equal(result.features.BOOKING_BEHAVIOR, true);
});

test("Scenario 4: Dual active (paid subscription + admin grant) stays active through either valid source", () => {
  const future = new Date(Date.now() + 30 * 86_400_000);
  const personalInfo = {
    dashboardPlus: {
      status: "ACTIVE",
      expiresAt: future.toISOString(),
    },
  };
  const adminGrant = {
    id: "grant-dual",
    hostId: "host-dual",
    featureKey: "DASHBOARD_PLUS",
    source: "ADMIN_COMPLIMENTARY",
    status: "ACTIVE",
    startsAt: new Date(Date.now() - 3600_000),
    expiresAt: null,
  };

  const result = resolveHostDashboardEntitlements(personalInfo, Role.HOST, new Date(), { adminGrant });
  assert.equal(result.hasDashboardPlus, true);
  assert.equal(result.tier, "PLUS");
});

test("Scenario 5: Expired subscription without admin grant falls back safely to Standard", () => {
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const personalInfo = {
    dashboardPlus: {
      status: "ACTIVE",
      expiresAt: past,
    },
  };

  const result = resolveHostDashboardEntitlements(personalInfo, Role.HOST);
  assert.equal(result.tier, "STANDARD");
  assert.equal(result.hasDashboardPlus, false);
  assert.equal(result.status, "EXPIRED");
  assert.equal(result.features.REVPAN, false);
  assert.equal(result.features.BASIC_EARNINGS, true);
});

test("Scenario 6: Expired subscription with active admin grant keeps Plus active", () => {
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const personalInfo = {
    dashboardPlus: {
      status: "EXPIRED",
      expiresAt: past,
    },
  };
  const adminGrant = {
    id: "grant-rescue",
    hostId: "host-rescue",
    featureKey: "DASHBOARD_PLUS",
    source: "ADMIN_COMPLIMENTARY",
    status: "ACTIVE",
    startsAt: new Date(Date.now() - 3600_000),
    expiresAt: null,
  };

  const result = resolveHostDashboardEntitlements(personalInfo, Role.HOST, new Date(), { adminGrant });
  assert.equal(result.tier, "PLUS");
  assert.equal(result.hasDashboardPlus, true);
  assert.equal(result.source, "ADMIN");
  assert.equal(result.features.REVPAN, true);
});

test("Scenario 7: Revoked admin grant with active paid subscription keeps Plus active", () => {
  const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const personalInfo = {
    dashboardPlus: {
      status: "ACTIVE",
      expiresAt: future,
    },
  };
  const revokedGrant = {
    id: "grant-revoked",
    hostId: "host-1",
    featureKey: "DASHBOARD_PLUS",
    source: "ADMIN_COMPLIMENTARY",
    status: "REVOKED",
    startsAt: new Date(Date.now() - 7200_000),
    expiresAt: null,
    revokedAt: new Date(Date.now() - 3600_000),
  };

  const result = resolveHostDashboardEntitlements(personalInfo, Role.HOST, new Date(), {
    adminGrant: null,
    latestGrant: revokedGrant,
  });
  assert.equal(result.tier, "PLUS");
  assert.equal(result.hasDashboardPlus, true);
  assert.equal(result.source, "SUBSCRIPTION");
});

test("Scenario 8: Revoked admin grant without subscription falls back to Standard", () => {
  const revokedGrant = {
    id: "grant-revoked",
    hostId: "host-1",
    featureKey: "DASHBOARD_PLUS",
    source: "ADMIN_COMPLIMENTARY",
    status: "REVOKED",
    startsAt: new Date(Date.now() - 7200_000),
    expiresAt: null,
    revokedAt: new Date(Date.now() - 3600_000),
  };

  const result = resolveHostDashboardEntitlements(null, Role.HOST, new Date(), {
    adminGrant: null,
    latestGrant: revokedGrant,
  });
  assert.equal(result.tier, "STANDARD");
  assert.equal(result.hasDashboardPlus, false);
  assert.equal(result.features.REVPAN, false);
  assert.equal(result.features.BASIC_EARNINGS, true);
});

test("Scenario 9: Suspended account enforces suspension restrictions across all features", () => {
  const future = new Date(Date.now() + 30 * 86_400_000).toISOString();
  const personalInfo = {
    dashboardPlus: {
      status: "ACTIVE",
      expiresAt: future,
    },
  };

  const result = resolveHostDashboardEntitlements(personalInfo, Role.HOST, new Date(), {
    userStatus: "SUSPENDED",
  });
  assert.equal(result.tier, "STANDARD");
  assert.equal(result.status, "SUSPENDED");
  assert.equal(result.hasDashboardPlus, false);
  assert.equal(result.isHostSuspended, true);
  assert.equal(result.features.REVPAN, false);
});

test("Scenario 10 & 11: Co-host data isolation and private owner financial isolation", () => {
  const payoutServiceSrc = read("services/payout.service.ts");

  // Verified that personal payout methods & adjustments are loaded strictly from the authenticated actor
  assert.match(payoutServiceSrc, /where:\s*accessibleHostListingWhere\(actor\)/);
  assert.match(payoutServiceSrc, /payoutMethods:\s*HostPayoutMethod\[\]\s*=\s*Array\.isArray\(info\.payoutMethods\)/);
  assert.match(payoutServiceSrc, /adjustments:\s*PayoutAdjustmentRecord\[\]\s*=\s*Array\.isArray\(\s*info\.payoutAdjustments/);

  // In host-facing earnings overview, host identity is strictly the querying actor
  assert.match(payoutServiceSrc, /const user = await prisma\.user\.findUnique\(\{\s*where:\s*\{\s*id:\s*hostId\s*\},/);
});

test("Scenario 12: Direct Plus APIs enforce server-side feature check requireHostDashboardFeature", () => {
  const bookingAnalyticsApi = read("app/api/v1/host/insights/booking-analytics/route.ts");
  const earningsAnalyticsApi = read("app/api/v1/host/earnings/analytics/route.ts");
  const operationsApi = read("app/api/v1/host/operations/route.ts");

  assert.match(bookingAnalyticsApi, /requireHostDashboardFeature\(actor,\s*"BOOKING_BEHAVIOR"\)/);
  assert.match(earningsAnalyticsApi, /requireHostDashboardFeature\(actor,\s*"ADVANCED_EARNINGS"\)/);
  assert.match(operationsApi, /requireHostDashboardFeature\(actor,\s*"OPERATIONS_AND_PROFITABILITY"\)/);
});

test("Scenario 13: Unimplemented Plus features are honestly represented and checkout has no fake buttons", () => {
  const statsTab = read("components/host/insights/insights-stats-tab.tsx");
  const earningsClient = read("app/(protected)/host/earnings/host-earnings-client.tsx");
  const dashboardKpi = read("components/host/dashboard/host-kpi-overview.tsx");

  // No fake buy / checkout buttons
  assert.doesNotMatch(statsTab, /stripe|paypal|buy now|purchase subscription/i);
  assert.doesNotMatch(earningsClient, /stripe|paypal|buy now|purchase subscription/i);
  assert.doesNotMatch(dashboardKpi, /stripe|paypal|buy now|purchase subscription/i);

  // Honest production messaging without exposing deployment configuration.
  assert.match(earningsClient, /Contact support or an administrator to activate access/);
  assert.doesNotMatch(earningsClient, /checkout is not configured/i);
  assert.match(dashboardKpi, /Plus available via admin grant or subscription/);
});

test("Unified Navigation and Dashboard Tier presentation", () => {
  const dashboardPage = read("app/(protected)/host/dashboard/page.tsx");
  const dashboardKpi = read("components/host/dashboard/host-kpi-overview.tsx");

  // Same route /host/dashboard used for both Standard and Plus
  assert.match(dashboardPage, /getHostDashboardData\(actor\)/);
  assert.match(dashboardKpi, /data\.entitlements\?\.hasDashboardPlus/);
  assert.match(dashboardKpi, /Dashboard Plus host tools/);
  assert.match(dashboardKpi, /Standard Hosting Tools Active/);

  // Plus quick-access links route to implemented modules
  assert.match(dashboardKpi, /buildPlusHref\("\/host\/insights\/stats\/booking-analytics"\)/);
  assert.match(dashboardKpi, /buildPlusHref\("\/host\/earnings\/analytics\/revpan"\)/);
  assert.match(dashboardKpi, /buildPlusHref\("\/host\/operations"\)/);
  assert.match(dashboardKpi, /buildPlusHref\("\/host\/insights\/listing-performance"\)/);
});

test("Cache invalidation on admin grant and revocation", () => {
  const entitlementService = read("services/host-entitlement.service.ts");
  const dashboardService = read("services/host-dashboard.service.ts");

  assert.match(dashboardService, /export function clearHostDashboardCache\(hostId\?: string\)/);
  assert.match(entitlementService, /clearHostDashboardCache\(input\.hostId\)/);
});
