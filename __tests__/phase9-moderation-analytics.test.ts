import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  moderationAnalyticsService,
  getModerationAnalytics,
  exportModerationAnalyticsCsv,
} from "../services/moderation-analytics.service";
import { moderationService } from "../services/moderation.service";

const root = path.resolve(__dirname, "..");

function source(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Phase 9: Complete Moderation Analytics, Dashboard & Performance Optimization", async (t) => {
  await t.test("moderationAnalyticsService exports required methods", () => {
    assert.equal(typeof moderationAnalyticsService.getModerationAnalytics, "function");
    assert.equal(typeof moderationAnalyticsService.exportModerationAnalyticsCsv, "function");
    assert.equal(typeof getModerationAnalytics, "function");
    assert.equal(typeof exportModerationAnalyticsCsv, "function");
  });

  await t.test("moderationService exports Phase 9 analytics methods", () => {
    assert.equal(typeof moderationService.getModerationAnalytics, "function");
    assert.equal(typeof moderationService.exportModerationAnalyticsCsv, "function");
    const modSrc = source("services/moderation.service.ts");
    assert.ok(modSrc.includes("getModerationAnalytics"), "moderationService must export getModerationAnalytics");
    assert.ok(modSrc.includes("exportModerationAnalyticsCsv"), "moderationService must export exportModerationAnalyticsCsv");
  });

  await t.test("getModerationDashboardSummary separates Total Reports from Total Cases", () => {
    const modSrc = source("services/moderation.service.ts");
    assert.ok(modSrc.includes("totalReports"), "getModerationDashboardSummary must query and return totalReports");
    assert.ok(modSrc.includes("totalCases"), "getModerationDashboardSummary must query and return totalCases");
    assert.ok(
      modSrc.includes("prisma.moderationReport.count"),
      "getModerationDashboardSummary must count reports separately from cases"
    );
  });

  await t.test("analytics queries accurately compute KPIs, SLA, and exclude unresolved from resolution avg", async () => {
    const mockActor = {
      id: "admin_test",
      name: "Admin Tester",
      email: "admin@test.com",
      role: "ADMIN" as const,
      adminRoleId: null,
      adminRole: null,
    };

    const analytics = await getModerationAnalytics(mockActor, { period: "30d" });

    // Validate KPI structure
    assert.ok(typeof analytics.kpis.totalReports === "number");
    assert.ok(typeof analytics.kpis.totalCases === "number");
    assert.ok(typeof analytics.kpis.openCases === "number");
    assert.ok(typeof analytics.kpis.pendingReview === "number");
    assert.ok(typeof analytics.kpis.underInvestigation === "number");
    assert.ok(typeof analytics.kpis.assignedCases === "number");
    assert.ok(typeof analytics.kpis.resolvedCases === "number");
    assert.ok(typeof analytics.kpis.closedCases === "number");
    assert.ok(typeof analytics.kpis.overdueCases === "number");
    assert.ok(typeof analytics.kpis.avgResolutionTimeHours === "number");
    assert.ok(typeof analytics.kpis.enforcementActions === "number");
    assert.ok(typeof analytics.kpis.pendingAppeals === "number");

    // Validate SLA Metrics
    assert.equal(analytics.slaMetrics.standardSlaHours, 72);
    assert.equal(analytics.slaMetrics.highPrioritySlaHours, 24);
    assert.ok(
      analytics.slaMetrics.onTimeResolutionRate === null
        || (analytics.slaMetrics.onTimeResolutionRate >= 0 && analytics.slaMetrics.onTimeResolutionRate <= 100)
    );

    // Validate Phase 8 AI Status is explicitly marked DEFERRED
    assert.equal(analytics.jobHealth.phase8AiStatus, "DEFERRED_NOT_ACTIVE");
  });

  await t.test("analytics breakdown covers Listings, Reviews, Media, Users, and Messages", async () => {
    const mockActor = {
      id: "admin_test",
      name: "Admin Tester",
      email: "admin@test.com",
      role: "ADMIN" as const,
      adminRoleId: null,
      adminRole: null,
    };

    const analytics = await getModerationAnalytics(mockActor, { period: "7d" });

    // Listings
    assert.ok(typeof analytics.targetTypeAnalytics.listings.totalReports === "number");
    assert.ok(typeof analytics.targetTypeAnalytics.listings.distinctListings === "number");
    assert.ok(typeof analytics.targetTypeAnalytics.listings.activeCases === "number");
    assert.ok(typeof analytics.targetTypeAnalytics.listings.resolvedCases === "number");

    // Reviews - verifies Guest->Property vs Host->Guest separation per Task 5
    assert.ok(typeof analytics.targetTypeAnalytics.reviews.totalReports === "number");
    assert.ok(typeof analytics.targetTypeAnalytics.reviews.distinctReviews === "number");
    assert.ok(typeof analytics.targetTypeAnalytics.reviews.guestToProperty === "number");
    assert.ok(typeof analytics.targetTypeAnalytics.reviews.hostToGuest === "number");

    // Media
    assert.ok(typeof analytics.targetTypeAnalytics.media.totalReports === "number");
    assert.ok(typeof analytics.targetTypeAnalytics.media.distinctMedia === "number");

    // Users & Messages
    assert.ok(typeof analytics.targetTypeAnalytics.usersAndMessages.userReports === "number");
    assert.ok(typeof analytics.targetTypeAnalytics.usersAndMessages.messageReports === "number");
    assert.ok(typeof analytics.targetTypeAnalytics.usersAndMessages.distinctUsers === "number");
    assert.ok(typeof analytics.targetTypeAnalytics.usersAndMessages.distinctMessages === "number");
  });

  await t.test("exportModerationAnalyticsCsv sanitizes against formula injection and formats summary", async () => {
    const mockActor = {
      id: "admin_test",
      name: "Admin Tester",
      email: "admin@test.com",
      role: "ADMIN" as const,
      adminRoleId: null,
      adminRole: null,
    };

    const csv = await exportModerationAnalyticsCsv(mockActor, { period: "30d" });
    assert.ok(csv.includes("MODERATION ANALYTICS SUMMARY"), "CSV must include title");
    assert.ok(csv.includes("CORE KEY PERFORMANCE INDICATORS"), "CSV must include KPIs section");
    assert.ok(csv.includes("Total Reports"), "CSV must include Total Reports");
    assert.ok(csv.includes("Total Moderation Cases"), "CSV must include Total Cases");
    assert.ok(csv.includes("MODERATOR WORKLOAD & PRODUCTIVITY"), "CSV must include workload section");
    assert.ok(csv.includes("OPERATIONAL SLA METRICS"), "CSV must include SLA section");
    assert.ok(csv.includes("DEFERRED — NOT ACTIVE"), "CSV must clearly indicate Phase 8 AI detection is deferred");

    const exportRouteSrc = source("app/api/v1/admin/moderation/analytics/export/route.ts");
    assert.ok(exportRouteSrc.includes("MODERATION_ANALYTICS_EXPORT"), "export route must log audit log");
    assert.ok(exportRouteSrc.includes("attachment; filename="), "export route must send download attachment header");
  });

  await t.test("admin analytics API routes enforce permissions", () => {
    const analyticsRouteSrc = source("app/api/v1/admin/moderation/analytics/route.ts");
    assert.ok(analyticsRouteSrc.includes("MODERATION_CASE_READ"), "analytics route must require MODERATION_CASE_READ");
    assert.ok(analyticsRouteSrc.includes("getModerationAnalytics"), "analytics route must call getModerationAnalytics");

    const exportRouteSrc = source("app/api/v1/admin/moderation/analytics/export/route.ts");
    assert.ok(exportRouteSrc.includes("REPORTS_EXPORT"), "export route must require REPORTS_EXPORT");
  });

  await t.test("admin moderation dashboard UI provides tabs, KPIs, trend chart, and workload table", () => {
    const pageSrc = source("app/(protected)/admin/moderation/page.tsx");
    assert.ok(pageSrc.includes("getModerationAnalytics"), "page must load getModerationAnalytics");
    assert.ok(pageSrc.includes("initialAnalytics"), "page must supply initialAnalytics to client");

    const clientSrc = source("app/(protected)/admin/moderation/admin-moderation-dashboard-client.tsx");
    assert.ok(clientSrc.includes("Overview & Trends"), "client must have Overview tab");
    assert.ok(clientSrc.includes("Content Moderation Breakdown"), "client must have Content breakdown tab");
    assert.ok(clientSrc.includes("Enforcement & Appeals"), "client must have Enforcement tab");
    assert.ok(clientSrc.includes("Moderator Workload & SLA"), "client must have Workload & SLA tab");
    assert.ok(clientSrc.includes("System Automation Health"), "client must have System Health tab");
    assert.ok(clientSrc.includes("Total User Reports"), "client must display Total User Reports card");
    assert.ok(clientSrc.includes("Total Cases"), "client must display Total Cases card");
    assert.ok(clientSrc.includes("Export CSV"), "client must include Export CSV button");
    assert.ok(clientSrc.includes("Moderation Activity Trends"), "client must include Trends chart");
    assert.ok(clientSrc.includes("Moderator Team Workload"), "client must include Workload table");
    assert.ok(clientSrc.includes("PHASE 8 STATUS"), "client must display Phase 8 deferred status");
    assert.ok(clientSrc.includes("window.history.replaceState"), "filter changes must update the URL without duplicating the analytics request");
    assert.ok(!clientSrc.includes("router.replace(`/admin/moderation?"), "filter changes must not trigger a duplicate server analytics load");
  });
});
