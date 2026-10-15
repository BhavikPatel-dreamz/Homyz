import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(__dirname, "..");
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("moderation dashboard initial-load safeguards", async (t) => {
  const analyticsService = source("services/moderation-analytics.service.ts");
  const page = source("app/(protected)/admin/moderation/page.tsx");
  const client = source("app/(protected)/admin/moderation/admin-moderation-dashboard-client.tsx");

  await t.test("initial server render uses the canonical analytics request only", () => {
    assert.ok(page.includes("getModerationAnalytics(actor"));
    assert.ok(!page.includes("getModerationDashboardSummary"));
  });

  await t.test("database failures do not become a fake all-zero analytics payload", () => {
    assert.ok(analyticsService.includes("assertAnalyticsDatabaseAvailable"));
    assert.ok(analyticsService.includes("AppError.serviceUnavailable"));
    assert.ok(!analyticsService.includes("DB probe timeout"));
    assert.ok(!analyticsService.includes("Promise.race([probePromise"));
  });

  await t.test("custom date-only ranges include their full UTC end date", () => {
    assert.ok(analyticsService.includes('parseAnalyticsDate(query.endDate, "end")'));
    assert.ok(analyticsService.includes("startDate must be before or equal to endDate"));
  });

  await t.test("filter refreshes cancel stale work and expose a retryable error", () => {
    assert.ok(client.includes("new AbortController()"));
    assert.ok(client.includes("requestSequence"));
    assert.ok(client.includes('cache: "no-store"'));
    assert.ok(client.includes('role="alert"'));
    assert.ok(client.includes("Retry"));
    assert.ok(client.includes('window.addEventListener("popstate"'));
  });

  await t.test("the no-denominator SLA is represented as N/A", () => {
    assert.ok(analyticsService.includes(": null;"));
    assert.ok(client.includes('? "N/A"'));
  });
});
