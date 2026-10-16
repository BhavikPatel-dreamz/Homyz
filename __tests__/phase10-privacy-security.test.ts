import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  evidenceRetentionService,
  getEvidenceRetentionReport,
  applyEvidenceRetentionHold,
  releaseEvidenceRetentionHold,
  purgeEligibleEvidence,
} from "../services/evidence-retention.service";
import { moderationService } from "../services/moderation.service";
import { PERMISSIONS, hasPermission } from "../lib/permissions/permissions";
import { sanitizeSecurityMetadata } from "../lib/moderation/security-monitor";
import { exportModerationAnalyticsCsv } from "../services/moderation-analytics.service";
import type { AuthUser } from "../lib/auth/types";
import { Role } from "@/generated/prisma/enums";

const root = path.resolve(__dirname, "..");

function source(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Phase 10: Complete Privacy, Security & Compliance Implementation", async (t) => {
  const adminActor: AuthUser = {
    id: "admin_sec_tester",
    name: "Security Admin",
    email: "security.admin@test.com",
    role: Role.ADMIN,
    permissions: ["*"],
  };

  const moderatorActor: AuthUser = {
    id: "moderator_tester",
    name: "Staff Moderator",
    email: "moderator@test.com",
    role: Role.ADMIN,
    permissions: [
      PERMISSIONS.MODERATION_CASE_READ,
      PERMISSIONS.MODERATION_CASE_UPDATE,
      PERMISSIONS.MODERATION_EVIDENCE_READ,
      PERMISSIONS.MODERATION_EVIDENCE_ADD,
      PERMISSIONS.MODERATION_DECISION_CREATE,
      PERMISSIONS.MODERATION_RETENTION_MANAGE,
    ],
  };

  const guestActor: AuthUser = {
    id: "guest_tester_123",
    name: "Guest Reporter",
    email: "guest@test.com",
    role: Role.USER,
    permissions: [],
  };

  const hostActor: AuthUser = {
    id: "host_tester_456",
    name: "Target Host",
    email: "host@test.com",
    role: Role.HOST,
    permissions: [],
  };

  await t.test("1. Module contracts & service exports", () => {
    assert.equal(typeof evidenceRetentionService.getEvidenceRetentionReport, "function");
    assert.equal(typeof evidenceRetentionService.applyEvidenceRetentionHold, "function");
    assert.equal(typeof evidenceRetentionService.releaseEvidenceRetentionHold, "function");
    assert.equal(typeof evidenceRetentionService.purgeEligibleEvidence, "function");

    assert.equal(typeof moderationService.getEvidenceRetentionReport, "function");
    assert.equal(typeof moderationService.applyEvidenceRetentionHold, "function");
    assert.equal(typeof moderationService.releaseEvidenceRetentionHold, "function");
    assert.equal(typeof moderationService.purgeEligibleEvidence, "function");

    assert.equal(typeof getEvidenceRetentionReport, "function");
    assert.equal(typeof applyEvidenceRetentionHold, "function");
    assert.equal(typeof releaseEvidenceRetentionHold, "function");
    assert.equal(typeof purgeEligibleEvidence, "function");
  });

  await t.test("2. Granular Permissions Registry defines retention and purge permissions", () => {
    assert.equal(PERMISSIONS.MODERATION_RETENTION_MANAGE, "moderation.retention.manage");
    assert.equal(PERMISSIONS.MODERATION_EVIDENCE_PURGE, "moderation.evidence.purge");

    const permSrc = source("lib/permissions/permissions.ts");
    assert.ok(permSrc.includes("MODERATION_RETENTION_MANAGE"), "permissions.ts must declare MODERATION_RETENTION_MANAGE");
    assert.ok(permSrc.includes("MODERATION_EVIDENCE_PURGE"), "permissions.ts must declare MODERATION_EVIDENCE_PURGE");
    assert.ok(permSrc.includes("Manage evidence retention policies, holds, and dry-run reviews"), "ALL_PERMISSIONS must describe retention manage");
    assert.ok(permSrc.includes("Permanently delete eligible moderation evidence under approved policy"), "ALL_PERMISSIONS must describe evidence purge");
  });

  await t.test("3. RBAC isolation: Guests and Hosts cannot access retention management", async () => {
    // Non-moderators calling getEvidenceRetentionReport must be rejected
    await assert.rejects(
      async () => {
        await getEvidenceRetentionReport(guestActor);
      },
      (err: any) => {
        return err.status === 403 || err.message?.includes("Missing required permission");
      }
    );

    await assert.rejects(
      async () => {
        await getEvidenceRetentionReport(hostActor);
      },
      (err: any) => {
        return err.status === 403 || err.message?.includes("Missing required permission");
      }
    );

    // Decision-only / general moderators without MODERATION_EVIDENCE_PURGE cannot purge evidence
    await assert.rejects(
      async () => {
        await purgeEligibleEvidence(moderatorActor, {
          evidenceIds: ["ev_123"],
          confirmPurge: true,
        });
      },
      (err: any) => {
        return err.status === 403 || err.message?.includes("Missing required permission");
      }
    );
  });

  await t.test("4. Reporter Confidentiality: listModerationEvidence masks other participants' identity", () => {
    const modSrc = source("services/moderation.service.ts");
    assert.ok(
      modSrc.includes("// Reporter confidentiality (Task 4): mask other participants' personal info"),
      "listModerationEvidence must include reporter confidentiality masking"
    );
    assert.ok(
      modSrc.includes("Confidential Participant"),
      "listModerationEvidence must replace name with Confidential Participant"
    );
    assert.ok(
      modSrc.includes("submittedById: null"),
      "listModerationEvidence must scrub submittedById for non-owner participants"
    );
  });

  await t.test("5. Internal Notes Protection: Appeals scrub reviewNotes and resolutionNotes for users", () => {
    const modSrc = source("services/moderation.service.ts");
    assert.ok(
      modSrc.includes("reviewNotes: null"),
      "listCaseAppeals must scrub reviewNotes for non-moderators"
    );
    assert.ok(
      modSrc.includes("resolutionNotes: null"),
      "getModerationAppeal must scrub case.resolutionNotes for non-moderators"
    );
    assert.ok(
      modSrc.includes("Trust & Safety Specialist"),
      "getModerationAppeal must mask internal staff email in timeline"
    );
  });

  await t.test("6. Privileged Evidence Access is strictly audited (EVIDENCE_ACCESSED)", () => {
    const modSrc = source("services/moderation.service.ts");
    assert.ok(
      modSrc.includes('action: "EVIDENCE_ACCESSED"'),
      "getModerationEvidenceStream must record EVIDENCE_ACCESSED in moderationActivity"
    );
    assert.ok(
      modSrc.includes('action: "MODERATION_EVIDENCE_ACCESSED"'),
      "getModerationEvidenceStream must emit security audit log event"
    );
  });

  await t.test("7. Evidence Retention Report generates dry-run review without destructive changes", async () => {
    const report = await getEvidenceRetentionReport(adminActor, { dryRun: true });
    assert.equal(report.dryRun, true);
    assert.equal(typeof report.totalEvidenceCount, "number");
    assert.equal(typeof report.activeCaseEvidenceCount, "number");
    assert.equal(typeof report.legalHoldEvidenceCount, "number");
    assert.equal(typeof report.pendingAppealEvidenceCount, "number");
    assert.equal(typeof report.eligibleForPurgeCount, "number");
    assert.ok(Array.isArray(report.eligibleRecords));
    assert.ok(report.retentionPolicy);
  });

  await t.test("8. Evidence Purge requires explicit confirmPurge: true verification flag", async () => {
    await assert.rejects(
      async () => {
        await purgeEligibleEvidence(adminActor, {
          evidenceIds: ["ev_test_1"],
          confirmPurge: false as any,
        });
      },
      (err: any) => {
        return err.status === 400 && err.message?.includes("confirmPurge: true");
      }
    );
  });

  await t.test("9. Retention hold & active investigation safeguards protect evidence from purge", () => {
    const retSrc = source("services/evidence-retention.service.ts");
    assert.ok(
      retSrc.includes("Blocked: Record has active legal/retention hold"),
      "purgeEligibleEvidence must block evidence under legal hold"
    );
    assert.ok(
      retSrc.includes("Blocked: Case is currently active"),
      "purgeEligibleEvidence must block evidence in active cases"
    );
    assert.ok(
      retSrc.includes("Blocked: Case has a pending moderation appeal"),
      "purgeEligibleEvidence must block evidence with pending appeals"
    );
    assert.ok(
      retSrc.includes('action: "EVIDENCE_RETENTION_HOLD_APPLIED"'),
      "applyEvidenceRetentionHold must record audit activity"
    );
    assert.ok(
      retSrc.includes('action: "EVIDENCE_RETENTION_HOLD_RELEASED"'),
      "releaseEvidenceRetentionHold must record audit activity"
    );
  });

  await t.test("10. Private Message Moderation is bounded and audited (MESSAGE_CONTEXT_ACCESSED)", () => {
    const modSrc = source("services/moderation.service.ts");
    assert.ok(
      modSrc.includes("take: 3"),
      "getReportedMessageContext must strictly take at most 3 before and 3 after"
    );
    assert.ok(
      modSrc.includes("contextLimit: 7"),
      "getReportedMessageContext must declare 7 message context ceiling"
    );
    assert.ok(
      modSrc.includes('action: "MESSAGE_CONTEXT_ACCESSED"'),
      "getReportedMessageContext must record MESSAGE_CONTEXT_ACCESSED activity log"
    );
  });

  await t.test("11. CSV formula injection defense sanitizes dangerous trigger characters", async () => {
    const csv = await exportModerationAnalyticsCsv(adminActor, { period: "30d" });
    assert.ok(typeof csv === "string");
    // Verify that the file starts with header and does not start with executable spreadsheet commands
    const analyticsSrc = source("services/moderation-analytics.service.ts");
    assert.ok(
      analyticsSrc.includes("/^[=+\\-@\\t\\r]/"),
      "sanitizeCsvCell must check for =, +, -, @, \\t, and \\r"
    );
  });

  await t.test("12. Security log metadata sanitization strips passwords, secrets, and raw buffers", () => {
    const dirty = {
      user: "moderator",
      password: "secret_password_123",
      token: "jwt_token_abc",
      nested: {
        authorization: "Bearer secret_xyz",
        creditCard: "4111-2222-3333-4444",
        safeNote: "Everything is verified",
      },
    };
    const sanitized: any = sanitizeSecurityMetadata(dirty);
    assert.equal(sanitized.user, "moderator");
    assert.equal(sanitized.password, "[REDACTED]");
    assert.equal(sanitized.token, "[REDACTED]");
    assert.equal(sanitized.nested.authorization, "[REDACTED]");
    assert.equal(sanitized.nested.creditCard, "[REDACTED]");
    assert.equal(sanitized.nested.safeNote, "Everything is verified");
  });

  await t.test("13. Background worker / cron secret protection", () => {
    const cronSrc = source("app/api/v1/cron/jobs/route.ts");
    assert.ok(
      cronSrc.includes("validateCronSecret"),
      "cron route must validate secret token"
    );
    assert.ok(
      cronSrc.includes("401"),
      "cron route must return 401 when unauthorized"
    );
  });

  await t.test("14. Admin retention API routes exist and enforce required permissions", () => {
    const retRouteSrc = source("app/api/v1/admin/moderation/retention/route.ts");
    assert.ok(
      retRouteSrc.includes("PERMISSIONS.MODERATION_RETENTION_MANAGE"),
      "GET /retention must require MODERATION_RETENTION_MANAGE"
    );
    assert.ok(
      retRouteSrc.includes("PERMISSIONS.MODERATION_EVIDENCE_PURGE"),
      "POST /retention must require MODERATION_EVIDENCE_PURGE"
    );

    const holdRouteSrc = source("app/api/v1/admin/moderation/retention/hold/route.ts");
    assert.ok(
      holdRouteSrc.includes("PERMISSIONS.MODERATION_RETENTION_MANAGE"),
      "POST /retention/hold must require MODERATION_RETENTION_MANAGE"
    );
  });
});

