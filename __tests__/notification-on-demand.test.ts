import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("On-demand notification loading", () => {
  it("keeps notification count requests off the initial header render", () => {
    const header = read("components/dashboard/app-header.tsx");

    assert.ok(header.includes("useUnreadNotificationCount"));
    assert.ok(header.includes("homyz:notifications-updated"));
    assert.ok(!header.includes('fetch("/api/v1/notifications?countOnly=true")'));
    assert.ok(!header.includes('window.addEventListener("focus"'));
  });

  it("deduplicates explicit count refreshes and uses the compact endpoint", () => {
    const store = read("lib/notifications/unread-count-store.ts");

    assert.ok(store.includes('fetch("/api/v1/notifications?countOnly=true"'));
    assert.ok(store.includes("if (inFlight) return inFlight"));
    assert.ok(store.includes("FRESH_FOR_MS"));
  });

  it("loads profile notifications only when the notifications tab is open", () => {
    const loader = read("lib/profile/profile-loader.ts");
    const view = read("components/profile/notifications-view.tsx");

    assert.ok(loader.includes("const needsNotifications = isNotifications;"));
    assert.ok(view.includes("publishUnreadNotificationCount"));
  });

  it("uses an indexed, user-scoped count query for count-only requests", () => {
    const route = read("app/api/v1/notifications/route.ts");
    const service = read("services/notification.service.ts");
    const schema = read("prisma/schema.prisma");

    assert.ok(route.includes('searchParams.get("countOnly") === "true"'));
    assert.ok(route.includes("notificationService.getUnreadCount(actor.id)"));
    assert.match(service, /prisma\.notification\.count\(\{\s*where: \{ userId, isRead: false \}/);
    assert.ok(schema.includes("@@index([userId, isRead, createdAt])"));
  });
});
