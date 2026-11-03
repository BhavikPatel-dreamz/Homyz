import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Guest Help & Support workspace", () => {
  test("uses persisted support metrics, filters, and URL-synchronised selection", () => {
    const center = source("components/profile/support-resolution-center.tsx");

    assert.match(center, /\/api\/v1\/support\/cases\?page=1&limit=1&status=WAITING_FOR_GUEST/);
    assert.match(center, /function guestTab/);
    assert.match(center, /query\.set\("caseId", id\)/);
    assert.match(center, /\/profile\/tab\/support\?\$\{query\.toString\(\)\}/);
    assert.match(center, /GuestCaseDetailPanel/);
    assert.match(center, /xl:grid-cols-\[minmax\(280px,40%\)_minmax\(0,1fr\)\]/);
  });

  test("keeps messages, evidence, and activity in the authorised case panel", () => {
    const center = source("components/profile/support-resolution-center.tsx");

    assert.match(center, /Conversation \(\{caseData\.messages\?\.length \|\| 0\}\)/);
    assert.match(center, /Evidence \(\{caseData\.evidence\?\.length \|\| 0\}\)/);
    assert.match(center, /\/evidence\/\$\{entry\.id\}\?download=true/);
    assert.match(center, /idempotencyKey: replyKey\.current/);
  });
});
