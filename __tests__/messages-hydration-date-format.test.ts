import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  formatConversationListDate,
  formatMessageDate,
  formatMessageTime,
  isSameUtcDate,
} from "../lib/messages/message-date";

const root = path.resolve(import.meta.dirname, "..");

describe("Message date formatting hydration safety", () => {
  it("formats message times and list dates deterministically", () => {
    assert.equal(formatMessageTime("2026-10-01T10:53:49.000Z"), "10:53");
    assert.equal(formatMessageDate("2026-11-02T07:06:00.000Z"), "Nov 2");
    assert.equal(formatMessageDate("2026-11-02T07:06:00.000Z", true), "Nov 2, 2026");
    assert.equal(isSameUtcDate("2026-11-02T23:59:00.000Z", "2026-11-02T00:00:00.000Z"), true);
    assert.equal(isSameUtcDate("2026-11-01T23:59:00.000Z", "2026-11-02T00:00:00.000Z"), false);
    assert.equal(
      formatConversationListDate(
        "2026-10-01T10:53:49.000Z",
        "2026-10-01T23:59:59.000Z",
      ),
      "10:53",
    );
    assert.equal(
      formatConversationListDate(
        "2026-09-30T23:59:59.000Z",
        "2026-10-01T00:00:00.000Z",
      ),
      "Sep 30",
    );
  });

  it("does not use runtime locale or current-time formatting in either workspace", () => {
    for (const workspace of [
      "components/host/messages/host-messages-workspace.tsx",
      "components/messages/guest-messages-workspace.tsx",
    ]) {
      const source = fs.readFileSync(path.join(root, workspace), "utf8");
      assert.doesNotMatch(source, /toLocale(?:Time|Date)String/);
      assert.match(source, /formatConversationListDate\(conv\.lastMessageAt, initialRenderedAt\)/);
    }

    const hostWorkspace = fs.readFileSync(
      path.join(root, "components/host/messages/host-messages-workspace.tsx"),
      "utf8",
    );
    assert.match(hostWorkspace, /formatMessageDate\(firstMsg\.createdAt\)/);
    assert.match(hostWorkspace, /isSameUtcDate\(firstMsg\.createdAt, initialRenderedAt\)/);
  });
});
