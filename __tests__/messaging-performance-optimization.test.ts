import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Messaging and notification performance safeguards", () => {
  it("reads message history newest-first with a stable cursor while retaining legacy offset callers", () => {
    const service = read("services/messaging.service.ts");
    const route = read("app/api/v1/messages/conversations/[id]/messages/route.ts");

    assert.match(service, /params: \{ cursor\?: string; skip\?: number; take\?: number; includeTotal\?: boolean \}/);
    assert.match(service, /orderBy: \[\{ createdAt: "desc" \}, \{ id: "desc" \}\]/);
    assert.match(service, /nextCursor: hasMore && oldest/);
    assert.match(service, /params\.includeTotal === false \? Promise\.resolve\(undefined\)/);
    assert.match(service, /if \(params\.skip !== undefined && !params\.cursor\)/);
    assert.match(route, /searchParams\.get\("cursor"\)/);
    assert.match(route, /includeTotal/);
  });

  it("limits list payloads and keeps system events out of unread message counts", () => {
    const service = read("services/messaging.service.ts");

    assert.match(service, /Math\.min\(50, Math\.max\(1, Math\.trunc\(params\.take \?\? 25\)\)\)/);
    assert.match(service, /single-conversation endpoint when its detail pane is opened/);
    assert.match(service, /senderId: \{ not: actor\.id \}/);
    assert.match(service, /uniqueUnlinkedConversationPairs/);
  });

  it("keeps both workspaces paged, cancellation-safe, and visibility-aware", () => {
    for (const workspace of [
      "components/messages/guest-messages-workspace.tsx",
      "components/host/messages/host-messages-workspace.tsx",
    ]) {
      const source = read(workspace);
      assert.match(source, /take: "40", includeTotal: "false"/);
      assert.match(source, /messageRequestIdRef/);
      assert.match(source, /fetchConversationDetail/);
      assert.match(source, /loadOlderMessages/);
      assert.match(source, /document\.visibilityState === "visible"/);
      assert.match(source, /take", "25"/);
    }
  });

  it("clears user-scoped notification count state across account transitions", () => {
    const store = read("lib/notifications/unread-count-store.ts");
    const header = read("components/dashboard/app-header.tsx");

    assert.match(store, /resetUnreadNotificationCount/);
    assert.match(store, /requestGeneration/);
    assert.match(header, /notificationAccountKey/);
    assert.match(header, /resetUnreadNotificationCount\(\)/);
  });
});
