import test from "node:test";
import assert from "node:assert/strict";
import { Role } from "@/generated/prisma/enums";
import {
  assertHostDashboardFeatureAccess,
  resolveHostDashboardEntitlements,
} from "@/lib/entitlements/host-dashboard";

const now = new Date("2026-10-23T12:00:00.000Z");

test("Standard is the safe default when no subscription state is recorded", () => {
  const entitlements = resolveHostDashboardEntitlements(null, Role.HOST, now);
  assert.equal(entitlements.plan, "STANDARD");
  assert.equal(entitlements.hasDashboardPlus, false);
  assert.equal(entitlements.features.DASHBOARD_OVERVIEW, true);
  assert.equal(entitlements.features.BASIC_INSIGHTS, true);
  assert.equal(entitlements.features.BOOKING_BEHAVIOR, false);
  assert.equal(entitlements.features.ADVANCED_EARNINGS, false);
  assert.throws(
    () => assertHostDashboardFeatureAccess(entitlements, "ADVANCED_EARNINGS"),
    { message: "Advanced earnings analytics requires an active Dashboard Plus entitlement." },
  );
});

test("active and trial Dashboard Plus profiles unlock every configured Plus feature", () => {
  for (const status of ["ACTIVE", "TRIAL"] as const) {
    const entitlements = resolveHostDashboardEntitlements({
      dashboardPlus: { status, expiresAt: "2026-11-23T12:00:00.000Z" },
    }, Role.HOST, now);
    assert.equal(entitlements.plan, "DASHBOARD_PLUS");
    assert.equal(entitlements.hasDashboardPlus, true);
    assert.equal(Object.values(entitlements.features).every(Boolean), true);
  }
});

test("expired, cancelled, and suspended profiles cannot retain Plus access", () => {
  const expired = resolveHostDashboardEntitlements({
    dashboardPlus: { status: "ACTIVE", expiresAt: "2026-10-22T12:00:00.000Z" },
  }, Role.HOST, now);
  assert.equal(expired.status, "EXPIRED");
  assert.equal(expired.hasDashboardPlus, false);

  for (const status of ["CANCELLED", "SUSPENDED"] as const) {
    const entitlements = resolveHostDashboardEntitlements({
      dashboardPlus: { status, expiresAt: "2026-11-23T12:00:00.000Z" },
    }, Role.HOST, now);
    assert.equal(entitlements.hasDashboardPlus, false);
  }
});

test("administrators retain access for support and verification", () => {
  const entitlements = resolveHostDashboardEntitlements(null, Role.ADMIN, now);
  assert.equal(entitlements.status, "ADMIN_GRANTED");
  assert.equal(entitlements.hasDashboardPlus, true);
});

test("Dashboard Plus remains account-scoped for a co-host", () => {
  const listingOwner = resolveHostDashboardEntitlements({
    dashboardPlus: { status: "ACTIVE" },
  }, Role.HOST, now);
  const acceptedCoHost = resolveHostDashboardEntitlements(null, Role.HOST, now);

  assert.equal(listingOwner.features.BOOKING_BEHAVIOR, true);
  assert.equal(acceptedCoHost.features.BOOKING_BEHAVIOR, false);
});
