import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { isSupportedGuestSupportRequest } from "@/lib/support-case/taxonomy";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Phase 4 — guest support and resolution center", () => {
  test("guest taxonomy is server-owned and rejects unsupported category/type combinations", () => {
    assert.equal(isSupportedGuestSupportRequest("BOOKING", "CHECK_IN"), true);
    assert.equal(isSupportedGuestSupportRequest("BOOKING", "RECEIPT"), false);
    assert.equal(isSupportedGuestSupportRequest("NOT_A_CATEGORY", "OTHER"), false);
  });

  test("case creation validates the server taxonomy and preserves request idempotency", () => {
    const service = source("services/support-case.service.ts");
    assert.match(service, /isSupportedGuestSupportRequest\(category, issueType\)/);
    assert.match(service, /findUnique\(\{\s*where: \{ idempotencyKey: input\.idempotencyKey \},?\s*\}\)/);
  });

  test("guest case details omit storage keys and filter restricted content", () => {
    const service = source("services/support-case.service.ts");
    const details = service.slice(service.indexOf("async function getSupportCaseDetails"), service.indexOf("async function updateSupportCaseStatus"));
    assert.doesNotMatch(details, /storageKey: true/);
    assert.match(details, /visibility: SupportCaseContentVisibility\.PARTICIPANTS/);
    assert.match(details, /assignedAdmin: access\.admin/);
    assert.match(details, /refunds: access\.admin/);
  });

  test("guest evidence uses private binary storage and an authorized download route", () => {
    const service = source("services/support-case.service.ts");
    const uploadRoute = source("app/api/v1/support/cases/[id]/evidence/upload/route.ts");
    const downloadRoute = source("app/api/v1/support/cases/[id]/evidence/[evidenceId]/route.ts");
    assert.match(service, /kind: "support-case-evidence"/);
    assert.match(service, /validateEvidenceFile/);
    assert.match(service, /readPrivateMedia\(\s*"support-case-evidence"/);
    assert.match(uploadRoute, /requireApiAuth/);
    assert.match(downloadRoute, /Cache-Control": "private, no-store"/);
    assert.match(downloadRoute, /X-Content-Type-Options": "nosniff"/);
  });

  test("guests cannot register metadata-only evidence or modify closed cases", () => {
    const evidenceRoute = source("app/api/v1/support/cases/[id]/evidence/route.ts");
    const service = source("services/support-case.service.ts");
    assert.match(evidenceRoute, /requireApiPermission\(req, PERMISSIONS\.DISPUTES_MANAGE\)/);
    assert.match(service, /PARTICIPANT_MUTABLE_STATUSES/);
    assert.match(service, /Replies and evidence can no longer be added/);
  });

  test("profile support tab now uses the persisted Resolution Center instead of simulated replies", () => {
    const compatibilityView = source("components/profile/support-chat-view.tsx");
    const resolutionCenter = source("components/profile/support-resolution-center.tsx");
    assert.match(compatibilityView, /SupportResolutionCenter/);
    assert.doesNotMatch(compatibilityView, /Automated agent reply simulation/);
    assert.match(resolutionCenter, /\/api\/v1\/support\/cases/);
    assert.match(resolutionCenter, /idempotencyKey/);
    assert.match(resolutionCenter, /evidence\/upload/);
  });
});
