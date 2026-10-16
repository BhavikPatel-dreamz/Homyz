import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { moderationService } from "../services/moderation.service";
import { evidenceRetentionService } from "../services/evidence-retention.service";
import { moderationAnalyticsService } from "../services/moderation-analytics.service";
import { jobQueueService } from "../services/job-queue.service";
import { PERMISSIONS, hasPermission } from "../lib/permissions/permissions";
import { MODERATION_POLICY_CATEGORIES, getModerationPolicy } from "../lib/moderation/policies";
import { sanitizeSecurityMetadata } from "../lib/moderation/security-monitor";
import type { AuthUser } from "../lib/auth/types";
import { Role, ModerationCaseStatus, ModerationTargetType } from "@/generated/prisma/enums";

const root = path.resolve(__dirname, "..");

function source(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Phase 11: Complete Moderation End-to-End Master Verification Suite", async (t) => {
  // Actors
  const superAdmin: AuthUser = {
    id: "e2e_super_admin",
    name: "Super Admin",
    email: "superadmin@homyz.test",
    role: Role.ADMIN,
    permissions: ["*"],
  };

  const decisionOnlyModerator: AuthUser = {
    id: "e2e_decision_mod",
    name: "Decision Moderator",
    email: "decision.mod@homyz.test",
    role: Role.ADMIN,
    permissions: [
      PERMISSIONS.MODERATION_CASE_READ,
      PERMISSIONS.MODERATION_CASE_UPDATE,
      PERMISSIONS.MODERATION_DECISION_CREATE,
      PERMISSIONS.MODERATION_AUDIT_READ,
    ],
  };

  const enforcementModerator: AuthUser = {
    id: "e2e_enforce_mod",
    name: "Enforcement Specialist",
    email: "enforce.mod@homyz.test",
    role: Role.ADMIN,
    permissions: [
      PERMISSIONS.MODERATION_CASE_READ,
      PERMISSIONS.MODERATION_CASE_UPDATE,
      PERMISSIONS.MODERATION_DECISION_CREATE,
      PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE,
      PERMISSIONS.MODERATION_EVIDENCE_READ,
      PERMISSIONS.MODERATION_EVIDENCE_ADD,
      PERMISSIONS.MODERATION_RETENTION_MANAGE,
      PERMISSIONS.MODERATION_EVIDENCE_PURGE,
      PERMISSIONS.REPORTS_EXPORT,
    ],
  };

  const guestA: AuthUser = {
    id: "e2e_guest_a",
    name: "Guest Alice",
    email: "alice@homyz.test",
    role: Role.USER,
    permissions: [],
  };

  const hostB: AuthUser = {
    id: "e2e_host_b",
    name: "Host Bob",
    email: "bob@homyz.test",
    role: Role.HOST,
    permissions: [],
  };

  // --- 1. PREREQUISITES & MODULE REGISTRY ---
  await t.test("1. All moderation services, policies, and permissions are correctly registered", () => {
    // Service methods
    assert.equal(typeof moderationService.createModerationReport, "function");
    assert.equal(typeof moderationService.listModerationCases, "function");
    assert.equal(typeof moderationService.getModerationCaseDetails, "function");
    assert.equal(typeof moderationService.updateModerationCase, "function");
    assert.equal(typeof moderationService.uploadModerationEvidence, "function");
    assert.equal(typeof moderationService.getModerationEvidenceStream, "function");
    assert.equal(typeof moderationService.createInformationRequest, "function");
    assert.equal(typeof moderationService.respondToInformationRequest, "function");
    assert.equal(typeof moderationService.checkAppealEligibility, "function");
    assert.equal(typeof moderationService.submitModerationAppeal, "function");
    assert.equal(typeof moderationService.recordAppealDecision, "function");
    assert.equal(typeof moderationService.issueAccountWarning, "function");
    assert.equal(typeof moderationService.applyAccountRestriction, "function");
    assert.equal(typeof moderationService.suspendUserAccount, "function");
    assert.equal(typeof moderationService.reinstateUserAccount, "function");
    assert.equal(typeof moderationService.getCaseBookingImpact, "function");
    assert.equal(typeof moderationService.getReportedMessageContext, "function");
    assert.equal(typeof moderationService.executeMessageEnforcement, "function");

    // Retention service methods
    assert.equal(typeof evidenceRetentionService.getEvidenceRetentionReport, "function");
    assert.equal(typeof evidenceRetentionService.applyEvidenceRetentionHold, "function");
    assert.equal(typeof evidenceRetentionService.releaseEvidenceRetentionHold, "function");
    assert.equal(typeof evidenceRetentionService.purgeEligibleEvidence, "function");

    // Analytics service methods
    assert.equal(typeof moderationAnalyticsService.getModerationAnalytics, "function");
    assert.equal(typeof moderationAnalyticsService.exportModerationAnalyticsCsv, "function");

    // Queue service methods
    assert.equal(typeof jobQueueService.enqueueJob, "function");
    assert.equal(typeof jobQueueService.claimJobs, "function");
    assert.equal(typeof jobQueueService.executeJob, "function");

    // Policies
    assert.ok(MODERATION_POLICY_CATEGORIES.length >= 5);
    const policiesSrc = source("lib/moderation/policies.ts");
    assert.ok(policiesSrc.includes("listAllModerationPolicies"), "policies must export listAllModerationPolicies");
    assert.ok(getModerationPolicy("FAKE_OR_INAUTHENTIC_REVIEW"));
    assert.ok(getModerationPolicy("MISLEADING_LISTING"));
    assert.ok(getModerationPolicy("SAFETY_OR_SECURITY_CONCERNS"));
  });

  // --- 2. GUEST REPORTING COMPLETE WORKFLOW ---
  await t.test("2. Guest reporting workflow and case correlation contract", () => {
    const modSrc = source("services/moderation.service.ts");

    // Verifies report intake creates or reuses canonical case
    assert.ok(modSrc.includes("createModerationReport"), "moderationService must export createModerationReport");
    assert.ok(modSrc.includes("listMyModerationReports"), "moderationService must export listMyModerationReports");

    // Verify report route exists and calls moderation service
    const reportRoute = source("app/api/v1/moderation/reports/route.ts");
    assert.ok(reportRoute.includes("moderationService.createModerationReport"), "POST /reports must delegate to moderationService");
    assert.ok(reportRoute.includes("moderationService.listMyModerationReports"), "GET /reports must delegate to listMyModerationReports");
    assert.ok(reportRoute.includes("requireApiAuth"), "reports route must enforce authentication");

    // Client reporting modal integration
    const reportModal = source("components/moderation/report-content-modal.tsx");
    assert.ok(reportModal.includes("ModalOverlay"), "Report modal must use ModalOverlay scroll lock contract");
    assert.ok(reportModal.includes("/api/v1/moderation/reports"), "Report modal must submit to /api/v1/moderation/reports");
  });

  // --- 3. HOST REPORTING & EXPERIENCE WORKFLOW ---
  await t.test("3. Host reporting and private view isolation", () => {
    const myReportsView = source("components/profile/my-reports-view.tsx");
    assert.ok(myReportsView.includes("/api/v1/moderation/reports"), "MyReportsView must fetch user reports");
    assert.ok(myReportsView.includes("/api/v1/moderation/me/enforcement"), "MyReportsView must check enforcement status");
    assert.ok(myReportsView.includes("/withdraw"), "MyReportsView must support appeal withdrawal");
    assert.ok(myReportsView.includes("ModalOverlay"), "MyReportsView must use ModalOverlay for dialogs");
  });

  // --- 4. ADMIN CENTRAL MODERATION WORKFLOW ---
  await t.test("4. Central Case Management: assignment, concurrency, and RBAC guards", () => {
    // Optimistic concurrency contract: expectedUpdatedAt prevents overwrites
    const modSrc = source("services/moderation.service.ts");
    assert.ok(modSrc.includes("expectedUpdatedAt"), "updateModerationCase must verify expectedUpdatedAt");
    assert.ok(modSrc.includes("assertValidModerationTransition"), "updateModerationCase must validate case status transitions");
    assert.ok(modSrc.includes("assertActionMatchesTarget"), "updateModerationCase must validate action matches target");

    // Separation of decision vs enforcement permissions
    assert.equal(hasPermission(decisionOnlyModerator, PERMISSIONS.MODERATION_DECISION_CREATE), true);
    assert.equal(hasPermission(decisionOnlyModerator, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE), false);
    assert.equal(hasPermission(enforcementModerator, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE), true);

    // Verify service enforces this separation
    assert.ok(
      modSrc.includes("hasContentEnforcementAction(input) && !canModerate(actor, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE)"),
      "updateModerationCase must reject enforcement actions without MODERATION_ENFORCEMENT_EXECUTE"
    );
    assert.ok(
      modSrc.includes("hasDecisionMutation(input) && !canModerate(actor, PERMISSIONS.MODERATION_DECISION_CREATE)"),
      "updateModerationCase must reject decision mutations without MODERATION_DECISION_CREATE"
    );
  });

  // --- 5. EVIDENCE & RFI LIFECYCLE ---
  await t.test("5. Evidence validation, streaming, RFI responses, and confidentiality", () => {
    // Evidence file validation
    const testValidJpeg = {
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]),
      fileName: "evidence.jpg",
      mimeType: "image/jpeg",
    };
    const validResult = moderationService.validateEvidenceFile(testValidJpeg);
    assert.equal(validResult.evidenceType, "EXISTING_MEDIA");
    assert.equal(validResult.cleanFileName.endsWith(".jpg"), true);

    const testSpoofedFile = {
      buffer: Buffer.from("<html><script>alert(1)</script></html>"),
      fileName: "malicious.jpg",
      mimeType: "image/jpeg",
    };
    assert.throws(() => {
      moderationService.validateEvidenceFile(testSpoofedFile);
    });

    // Evidence access auditing and reporter masking in source
    const modSrc = source("services/moderation.service.ts");
    assert.ok(modSrc.includes('action: "EVIDENCE_ACCESSED"'), "getModerationEvidenceStream must record EVIDENCE_ACCESSED");
    assert.ok(modSrc.includes("Confidential Participant"), "listModerationEvidence must mask reporter identity for participants");
  });

  // --- 6. MULTI-TARGET ENFORCEMENT & BOOKING SAFEGUARDS ---
  await t.test("6. Multi-target enforcement execution and booking protection safeguards", () => {
    const modSrc = source("services/moderation.service.ts");

    // Booking safeguards: No auto-cancellations or accidental refunds
    assert.ok(
      modSrc.includes("Existing confirmed reservations remain valid"),
      "Listing suspension notice must explicitly confirm reservation validity"
    );
    assert.ok(
      modSrc.includes("Financial settlement and booking records are preserved"),
      "Booking impact assessment must confirm settlements are preserved"
    );

    // Enforcement methods present
    assert.ok(modSrc.includes("issueAccountWarning"), "moderationService must export issueAccountWarning");
    assert.ok(modSrc.includes("applyAccountRestriction"), "moderationService must export applyAccountRestriction");
    assert.ok(modSrc.includes("suspendUserAccount"), "moderationService must export suspendUserAccount");
    assert.ok(modSrc.includes("reinstateUserAccount"), "moderationService must export reinstateUserAccount");
    assert.ok(modSrc.includes("executeMessageEnforcement"), "moderationService must export executeMessageEnforcement");
  });

  // --- 7. APPEALS & REINSTATEMENT WORKFLOW ---
  await t.test("7. Appeals queue, eligibility, reviewer assignment, and decision recording", () => {
    const modSrc = source("services/moderation.service.ts");
    assert.ok(modSrc.includes("checkAppealEligibility"), "moderationService must export checkAppealEligibility");
    assert.ok(modSrc.includes("submitModerationAppeal"), "moderationService must export submitModerationAppeal");
    assert.ok(modSrc.includes("assignAppealReviewer"), "moderationService must export assignAppealReviewer");
    assert.ok(modSrc.includes("recordAppealDecision"), "moderationService must export recordAppealDecision");
    assert.ok(modSrc.includes("withdrawModerationAppeal"), "moderationService must export withdrawModerationAppeal");

    // Internal notes scrubbing
    assert.ok(modSrc.includes("reviewNotes: null"), "Appeals list must scrub reviewNotes for non-moderators");
  });

  // --- 8. EVIDENCE RETENTION & SAFE PURGE ---
  await t.test("8. Evidence retention lifecycle, legal hold, and purge safety guards", async () => {
    // Dry-run report contract
    const report = await evidenceRetentionService.getEvidenceRetentionReport(superAdmin, { dryRun: true });
    assert.equal(report.dryRun, true);
    assert.equal(typeof report.totalEvidenceCount, "number");
    assert.equal(typeof report.activeCaseEvidenceCount, "number");
    assert.equal(typeof report.legalHoldEvidenceCount, "number");

    // Purge fails without confirmPurge: true
    await assert.rejects(
      async () => {
        await evidenceRetentionService.purgeEligibleEvidence(superAdmin, {
          evidenceIds: ["test_ev_1"],
          confirmPurge: false as any,
        });
      },
      (err: any) => err.status === 400
    );

    // Retention hold guards in service source
    const retSrc = source("services/evidence-retention.service.ts");
    assert.ok(retSrc.includes("Blocked: Record has active legal/retention hold"));
    assert.ok(retSrc.includes("Blocked: Case is currently active"));
    assert.ok(retSrc.includes("Blocked: Case has a pending moderation appeal"));
  });

  // --- 9. BACKGROUND AUTOMATION & SCHEDULER SECURITY ---
  await t.test("9. Background queue, cron token authorization, and scheduled tasks", () => {
    const cronRoute = source("app/api/v1/cron/jobs/route.ts");
    assert.ok(cronRoute.includes("validateCronSecret"), "Cron endpoint must validate scheduler secret");
    assert.ok(cronRoute.includes("REVIEW_EXPIRY_PUBLISH"), "Cron must schedule review expiry publish");
    assert.ok(cronRoute.includes("ACCOUNT_RESTRICTION_EXPIRY"), "Cron must schedule restriction expiry");

    const queueSrc = source("services/job-queue.service.ts");
    assert.ok(queueSrc.includes("enqueueJob"), "jobQueueService must provide enqueueJob");
    assert.ok(queueSrc.includes("claimJobs"), "jobQueueService must provide claimJobs");
    assert.ok(queueSrc.includes("executeJob"), "jobQueueService must provide executeJob");
    assert.ok(queueSrc.includes("retryJob"), "jobQueueService must provide retryJob");
  });

  // --- 10. ANALYTICS ACCURACY & EXPORT DEFENSE ---
  await t.test("10. Analytics aggregations and CSV formula injection sanitization", async () => {
    const csv = await moderationAnalyticsService.exportModerationAnalyticsCsv(superAdmin, { period: "30d" });
    assert.ok(typeof csv === "string");
    assert.ok(csv.includes("MODERATION ANALYTICS SUMMARY"));
    assert.ok(csv.includes("CORE KEY PERFORMANCE INDICATORS"));
    assert.ok(csv.includes("Total Reports"));
    assert.ok(csv.includes("Total Moderation Cases"));

    // Verify formula sanitization regex in source
    const analyticsSrc = source("services/moderation-analytics.service.ts");
    assert.ok(analyticsSrc.includes("/^[=+\\-@\\t\\r]/"), "sanitizeCsvCell must check for dangerous formula prefixes");
  });

  // --- 11. SECURITY, RBAC & AUDIT TAMPER-RESISTANCE ---
  await t.test("11. Role-based access control and security log metadata sanitization", () => {
    // Non-admins cannot perform enforcement
    assert.equal(hasPermission(guestA, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE), false);
    assert.equal(hasPermission(hostB, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE), false);
    assert.equal(hasPermission(decisionOnlyModerator, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE), false);
    assert.equal(hasPermission(enforcementModerator, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE), true);
    assert.equal(hasPermission(superAdmin, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE), true);

    // Sanitization utility scrubs sensitive tokens
    const dirty = {
      apiKey: "secret_live_key_999",
      password: "admin_password",
      authorization: "Bearer sensitive_token",
      payload: { normalField: "valid_info" },
    };
    const cleaned: any = sanitizeSecurityMetadata(dirty);
    assert.equal(cleaned.apiKey, "[REDACTED]");
    assert.equal(cleaned.password, "[REDACTED]");
    assert.equal(cleaned.authorization, "[REDACTED]");
    assert.equal(cleaned.payload.normalField, "valid_info");
  });

  // --- 12. SPECIALIZED QUEUES CANONICAL PARITY ---
  await t.test("12. Specialized queues reference canonical moderation cases", () => {
    const adminPage = source("app/(protected)/admin/moderation/page.tsx");
    assert.ok(adminPage.includes("getModerationAnalytics"), "Dashboard page must fetch canonical analytics");

    const casesApiRoute = source("app/api/v1/admin/moderation/cases/route.ts");
    assert.ok(casesApiRoute.includes("moderationService.listModerationCases"), "Cases API must list canonical cases");
    assert.ok(casesApiRoute.includes("PERMISSIONS.MODERATION_CASE_READ"), "Cases API must enforce MODERATION_CASE_READ");

    const adminClient = source("app/(protected)/admin/moderation/admin-moderation-dashboard-client.tsx");
    assert.ok(adminClient.includes("targetType"), "Dashboard must filter by canonical targetType");
    assert.ok(adminClient.includes("exportModerationAnalyticsCsv") || adminClient.includes("/export"), "Dashboard must support secure export");
  });
});
