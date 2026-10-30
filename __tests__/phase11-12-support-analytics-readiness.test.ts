import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Phases 11 + 12 — support analytics and readiness safeguards", () => {
  test("analytics use persisted support-domain records with a bounded cohort", () => {
    const service = source("services/support-analytics.service.ts");
    assert.match(service, /MAX_ANALYTICS_CASES = 2_500/);
    assert.match(service, /prisma\.supportCase\.count/);
    assert.match(service, /resolutionOffers:/);
    assert.match(service, /evidence:/);
    assert.match(service, /refunds:/);
    assert.match(service, /notificationOutbox\.count/);
    assert.match(service, /truncated: isCapped/);
  });

  test("all filters are normalized in a shared backend where clause and UTC range", () => {
    const service = source("services/support-analytics.service.ts");
    assert.match(service, /buildSupportAnalyticsWhere/);
    assert.match(service, /dateField: "SupportCase\.createdAt"/);
    assert.match(service, /timezone: "UTC"/);
    assert.match(service, /assignedAdminId === "unassigned"/);
    assert.match(service, /escalationState === "ESCALATED"/);
  });

  test("SLA and agent measures do not treat absent timestamps as compliant", () => {
    const service = source("services/support-analytics.service.ts");
    assert.match(service, /item\.firstResponseDueAt && reply/);
    assert.match(service, /item\.resolvedAt && item\.slaDueAt/);
    assert.match(service, /current assignee/);
    assert.match(service, /not quality rankings/);
  });

  test("analytics and export enforce server-side RBAC, audit exports, and harden CSV cells", () => {
    const analyticsRoute = source("app/api/v1/admin/support/analytics/route.ts");
    const exportRoute = source("app/api/v1/admin/support/analytics/export/route.ts");
    const service = source("services/support-analytics.service.ts");
    assert.match(analyticsRoute, /PERMISSIONS\.DISPUTES_VIEW/);
    assert.match(exportRoute, /PERMISSIONS\.REPORTS_EXPORT/);
    assert.match(exportRoute, /SUPPORT_ANALYTICS_EXPORT/);
    assert.match(service, /\^\[=\+\\-@\\t\\r\]/);
    assert.match(service, /pageSize: MAX_PAGE_SIZE/);
  });

  test("the dashboard sends one normalized filter request and presents safe reporting data", () => {
    const dashboard = source("components/admin/support/support-analytics-dashboard.tsx");
    assert.match(dashboard, /AbortController/);
    assert.match(dashboard, /URLSearchParams/);
    assert.match(dashboard, /\/api\/v1\/admin\/support\/analytics/);
    assert.match(dashboard, /Communication content, private notes, and evidence links are not included/);
    assert.match(dashboard, /current assignee/);
  });

  test("existing support, evidence, outbox, and financial safety controls remain separated", () => {
    const support = source("services/support-case.service.ts");
    const evidence = source("services/support-case-evidence-security.service.ts");
    const resolution = source("services/resolution-offer.service.ts");
    assert.match(support, /version: \{ increment: 1 \}/);
    assert.match(support, /enqueueSupportNotification\(tx/);
    assert.match(evidence, /MAX_CLEANUP_BATCH = 50/);
    assert.match(resolution, /linkResolutionOfferRefund/);
    assert.doesNotMatch(source("services/support-analytics.service.ts"), /processRefund|createPayout|processPayout/);
  });
});
