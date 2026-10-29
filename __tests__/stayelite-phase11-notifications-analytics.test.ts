import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { buildLoyaltyNotification, LOYALTY_NOTIFICATION_CHANNELS } from "@/lib/stayelite/notification-catalog";
import { LOYALTY_METRIC_CATALOG } from "@/lib/stayelite/analytics-metrics";

test("loyalty notifications have deterministic source identity and only support configured in-app delivery", () => {
  const first = buildLoyaltyNotification({ event: "ACHIEVEMENT_EARNED", userId: "guest-1", sourceId: "award-1", sourceType: "ACHIEVEMENT_AWARD", label: "City Collector" });
  const replay = buildLoyaltyNotification({ event: "ACHIEVEMENT_EARNED", userId: "guest-1", sourceId: "award-1", sourceType: "ACHIEVEMENT_AWARD", label: "City Collector" });
  assert.equal(first.deduplicationKey, replay.deduplicationKey);
  assert.equal(first.link, "/travel-profile");
  assert.equal(LOYALTY_NOTIFICATION_CHANNELS.inApp, true);
  assert.equal(LOYALTY_NOTIFICATION_CHANNELS.email, false);
  assert.doesNotMatch(first.message, /booking|review|fraud/i);
});

test("activity and notification persistence are protected by database-level unique identities", () => {
  const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20261029090000_add_stayelite_notification_activity/migration.sql");
  const notificationService = read("services/notification.service.ts");
  const queue = read("services/job-queue.service.ts");
  assert.match(schema, /deduplicationKey String\?\s+@unique/);
  assert.match(schema, /model LoyaltyActivity/);
  assert.match(schema, /@@unique\(\[userId, eventKey\]\)/);
  assert.match(migration, /Notification_deduplicationKey_key/);
  assert.match(notificationService, /findUnique\(\{ where: \{ deduplicationKey/);
  assert.match(queue, /recordLoyaltyActivity/);
});

test("analytics catalog states exact source models and does not invent financial/campaign measurements", () => {
  assert.ok(LOYALTY_METRIC_CATALOG.every((metric) => metric.exact));
  assert.ok(LOYALTY_METRIC_CATALOG.some((metric) => metric.source.includes("StayEliteMembership")));
  const analytics = fs.readFileSync(path.join(process.cwd(), "services/admin-loyalty-analytics.service.ts"), "utf8");
  assert.match(analytics, /LOYALTY_CAPABILITY_BLOCKERS\.points/);
  assert.match(analytics, /LOYALTY_CAPABILITY_BLOCKERS\.rewards/);
  assert.match(analytics, /LOYALTY_CAPABILITY_BLOCKERS\.campaigns/);
  assert.doesNotMatch(analytics, /pointLedger|rewardRedemption|campaign\.findMany/);
});
