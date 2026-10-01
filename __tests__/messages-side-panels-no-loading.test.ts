import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Messages side panels render without loading flashes", () => {
  it("hydrates host and guest workspaces with server-provided conversations", () => {
    for (const page of [
      "app/(protected)/host/messages/page.tsx",
      "app/(protected)/messages/page.tsx",
    ]) {
      const source = read(page);
      assert.match(source, /listConversationsForUser/);
      assert.match(source, /initialConversations=\{initialData\.conversations\}/);
    }
  });

  it("keeps both side panels populated while conversation data refreshes", () => {
    for (const workspace of [
      "components/host/messages/host-messages-workspace.tsx",
      "components/messages/guest-messages-workspace.tsx",
    ]) {
      const source = read(workspace);
      assert.match(source, /useState<ConversationDTO\[]>\(initialConversations\)/);
      assert.match(source, /conversationCacheRef/);
      assert.match(source, /conversationRequestIdRef/);
      assert.doesNotMatch(source, /loadingConversations/);
      assert.doesNotMatch(source, /animate-pulse[^\n]*conversation/i);
    }
  });

  it("does not refetch the side panels merely because the selected thread changes", () => {
    for (const workspace of [
      "components/host/messages/host-messages-workspace.tsx",
      "components/messages/guest-messages-workspace.tsx",
    ]) {
      const source = read(workspace);
      assert.match(source, /\}, \[filter, search\]\);/);
      assert.doesNotMatch(source, /\}, \[filter, search, selectedId\]\);/);
    }
  });
});
