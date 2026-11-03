import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { SupportCaseStatus } from "@/generated/prisma/enums";
import { canTransitionSupportCase } from "@/lib/support-case/lifecycle";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Phase 3 — support-case backend foundation", () => {
  test("lifecycle permits only explicit support-case transitions", () => {
    assert.equal(canTransitionSupportCase(SupportCaseStatus.OPEN, SupportCaseStatus.IN_REVIEW), true);
    assert.equal(canTransitionSupportCase(SupportCaseStatus.IN_REVIEW, SupportCaseStatus.RESOLVED), true);
    assert.equal(canTransitionSupportCase(SupportCaseStatus.RESOLVED, SupportCaseStatus.CLOSED), true);
    assert.equal(canTransitionSupportCase(SupportCaseStatus.CLOSED, SupportCaseStatus.REOPENED), true);
    assert.equal(canTransitionSupportCase(SupportCaseStatus.OPEN, SupportCaseStatus.CLOSED), false);
    assert.equal(canTransitionSupportCase(SupportCaseStatus.RESOLVED, SupportCaseStatus.OPEN), false);
    assert.equal(canTransitionSupportCase(SupportCaseStatus.CLOSED, SupportCaseStatus.RESOLVED), false);
  });

  test("schema defines relational cases, participants, content, events, and financial/dispute links", () => {
    const schema = source("prisma/schema.prisma");
    for (const model of [
      "model SupportCase {",
      "model SupportCaseParticipant {",
      "model SupportCaseMessage {",
      "model SupportCaseEvidence {",
      "model SupportCaseEvent {",
      "model SupportCaseAssignmentHistory {",
    ]) {
      assert.ok(schema.includes(model), model);
    }
    assert.match(schema, /legacyQualityIncidentId String\?\s+@unique/);
    assert.match(schema, /supportCaseId\s+String\?/);
    assert.match(schema, /version\s+Int\s+@default\(1\)/);
  });

  test("state changes use versioned conditional updates and append activity", () => {
    const service = source("services/support-case.service.ts");

    assert.match(service, /where: \{ id: caseId, version: input\.expectedVersion \}/);
    assert.match(service, /version: \{ increment: 1 \}/);
    assert.match(service, /await tx\.supportCaseEvent\.create/);
    assert.match(service, /Cannot transition support case from/);
    assert.match(service, /Only an administrator can change support-case status/);
  });

  test("participant and internal-content boundaries are enforced in service and routes", () => {
    const service = source("services/support-case.service.ts");
    const detailsRoute = source("app/api/v1/support/cases/[id]/route.ts");
    const statusRoute = source("app/api/v1/support/cases/[id]/status/route.ts");
    const participantRoute = source("app/api/v1/support/cases/[id]/participants/route.ts");

    assert.match(service, /!participant \|\| !participant\.canView \|\| \(requirePost && !participant\.canPost\)/);
    assert.match(service, /visibility === SupportCaseContentVisibility\.ADMINS_ONLY && !access\.admin/);
    assert.match(detailsRoute, /requireApiPermission\(req, PERMISSIONS\.DISPUTES_VIEW\)/);
    assert.match(statusRoute, /PERMISSIONS\.DISPUTES_RESOLVE/);
    assert.match(statusRoute, /PERMISSIONS\.DISPUTES_MANAGE/);
    assert.match(participantRoute, /PERMISSIONS\.DISPUTES_MANAGE/);
    assert.match(service, /assertMutationAccessInTransaction/);
  });

  test("refund-only case creation resolves ownership before linking the refund", () => {
    const service = source("services/support-case.service.ts");
    const createCase = service.slice(service.indexOf("async function createSupportCase"), service.indexOf("async function listSupportCases"));

    assert.ok(createCase.indexOf("if (!isAdmin(actor))") > createCase.indexOf("if (input.refundId)"));
    assert.match(createCase, /The refund does not belong to the support case booking/);
  });

  test("migration is additive and protects event history", () => {
    const migration = source("prisma/migrations/20261029130000_add_support_case_foundation/migration.sql");

    assert.doesNotMatch(migration, /\bDROP\b/i);
    assert.match(migration, /ALTER TABLE "BookingRefund" ADD COLUMN "supportCaseId" TEXT/);
    assert.match(migration, /"SupportCase_legacyQualityIncidentId_fkey"/);
    assert.match(migration, /SupportCaseEvent is append-only/);
    assert.match(migration, /CREATE TRIGGER "SupportCaseEvent_no_update"/);
  });

  test("legacy-dispute backfill is explicitly invoked, dry-run by default, and idempotent", () => {
    const service = source("services/support-case.service.ts");
    const script = source("scripts/backfill-support-cases.ts");

    assert.match(service, /where: \{ supportCase: null \}/);
    assert.match(service, /pg_advisory_xact_lock/);
    assert.match(service, /LEGACY_DISPUTE_LINKED/);
    assert.match(script, /dryRun: !apply/);
    assert.match(script, /--apply/);
  });
});
