import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import "dotenv/config";
import { buildAdminBenefitCatalog, LOYALTY_CAPABILITY_BLOCKERS } from "@/lib/stayelite/admin-loyalty-catalog";

test("admin benefit catalog exposes only metadata and keeps commercial fulfillment policy-gated", () => {
  const benefits = buildAdminBenefitCatalog();
  assert.ok(benefits.some((benefit) => benefit.sourceKey === "AMBASSADOR" && benefit.name === "TIER_DISCOUNT_PERCENT"));
  assert.ok(benefits.some((benefit) => benefit.sourceKey === "ICON" && benefit.name === "EXTRA_NIGHT_14_PLUS"));
  assert.ok(benefits.every((benefit) => benefit.fulfillment === "POLICY_BLOCKED" || benefit.fulfillment === "PROFILE_ENTITLEMENT"));
  assert.match(LOYALTY_CAPABILITY_BLOCKERS.points, /ledger/i);
  assert.match(LOYALTY_CAPABILITY_BLOCKERS.rewards, /reward-catalog/i);
  assert.match(LOYALTY_CAPABILITY_BLOCKERS.campaigns, /campaign/i);
});

test("Phase 10 admin routes are permission-protected and cannot mutate tiers or financial state", () => {
  const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
  const overview = read("app/api/v1/admin/loyalty/overview/route.ts");
  const tiers = read("app/api/v1/admin/loyalty/tiers/route.ts");
  const benefits = read("app/api/v1/admin/loyalty/benefits/route.ts");
  const overviewService = read("services/admin-loyalty-overview.service.ts");
  const permissions = read("lib/permissions/permissions.ts");
  assert.match(overview, /requireApiPermission\(req, PERMISSIONS\.LOYALTY_OVERVIEW_VIEW\)/);
  assert.match(tiers, /requireApiPermission\(req, PERMISSIONS\.LOYALTY_TIERS_VIEW\)/);
  assert.match(benefits, /requireApiPermission\(req, PERMISSIONS\.LOYALTY_BENEFITS_VIEW\)/);
  assert.doesNotMatch(tiers, /export const (POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(benefits, /export const (POST|PUT|PATCH|DELETE)/);
  assert.match(overviewService, /available: false, reason: LOYALTY_CAPABILITY_BLOCKERS\.points/);
  assert.match(overviewService, /available: false, reason: LOYALTY_CAPABILITY_BLOCKERS\.rewards/);
  assert.match(permissions, /LOYALTY_OVERVIEW_VIEW/);
  assert.match(permissions, /LOYALTY_TIERS_MANAGE/);
  assert.match(permissions, /LOYALTY_REFERRALS_MANAGE/);
});

test("overview queries bounded aggregates and recent audit data rather than guest-history scans", () => {
  const service = fs.readFileSync(path.join(process.cwd(), "services/admin-loyalty-overview.service.ts"), "utf8");
  assert.match(service, /stayEliteMembership\.groupBy/);
  assert.match(service, /auditLog\.findMany/);
  assert.match(service, /take: 10/);
  assert.doesNotMatch(service, /booking\.findMany/);
  assert.doesNotMatch(service, /review\.findMany/);
});
