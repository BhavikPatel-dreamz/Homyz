import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  MODERATION_POLICY_VERSION,
  MODERATION_POLICY_CATEGORIES,
  MODERATION_POLICIES,
  getModerationPolicy,
  isPolicyAppealable,
  getAppealDeadlineDays,
  listAllModerationPolicies,
} from "../lib/moderation/policies";

const root = path.resolve(__dirname, "..");

function source(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Phase 5: Complete Appeals & Moderation Policy Management", async (t) => {
  await t.test("versioned policy catalogue defines categories, appealability, deadlines, and enforcements", () => {
    assert.equal(MODERATION_POLICY_VERSION, "moderation-policy-v1");
    assert.ok(MODERATION_POLICY_CATEGORIES.length >= 5);

    const categories = MODERATION_POLICY_CATEGORIES.map((c) => c.id);
    assert.ok(categories.includes("SAFETY"));
    assert.ok(categories.includes("CONTENT_QUALITY"));
    assert.ok(categories.includes("FRAUD_AND_LEGAL"));
    assert.ok(categories.includes("AUTHENTICITY"));
    assert.ok(categories.includes("COMMUNITY_STANDARDS"));

    // Every policy has valid properties
    for (const policy of MODERATION_POLICIES) {
      assert.ok(policy.code, "Policy must have code");
      assert.ok(policy.name, `Policy ${policy.code} must have name`);
      assert.ok(policy.category, `Policy ${policy.code} must have category`);
      assert.ok(categories.includes(policy.category), `Policy ${policy.code} has invalid category`);
      assert.ok(policy.targetTypes.length > 0, `Policy ${policy.code} must have targetTypes`);
      assert.ok(policy.defaultSeverity, `Policy ${policy.code} must have defaultSeverity`);
      assert.ok(policy.description, `Policy ${policy.code} must have description`);
      assert.equal(typeof policy.appealable, "boolean", `Policy ${policy.code} must specify appealable`);
      assert.ok(policy.appealDeadlineDays && policy.appealDeadlineDays > 0, `Policy ${policy.code} must have positive deadline days`);
      assert.ok(Array.isArray(policy.allowedEnforcements), `Policy ${policy.code} must have allowedEnforcements array`);
    }

    // Helper functions
    assert.equal(isPolicyAppealable("FAKE_OR_INAUTHENTIC_REVIEW"), true);
    assert.equal(isPolicyAppealable("NON_EXISTENT_CODE"), true); // Default fallback

    assert.equal(getAppealDeadlineDays("FAKE_OR_INAUTHENTIC_REVIEW"), 14);
    assert.equal(getAppealDeadlineDays(), 14);

    const safetyPolicies = listAllModerationPolicies({ category: "SAFETY" });
    assert.ok(safetyPolicies.length > 0);
    assert.ok(safetyPolicies.every((p) => p.category === "SAFETY"));

    const reviewPolicies = listAllModerationPolicies({ targetType: "REVIEW" });
    assert.ok(reviewPolicies.length > 0);
    assert.ok(reviewPolicies.every((p) => p.targetTypes.includes("REVIEW")));

    const getRes = getModerationPolicy("FAKE_OR_INAUTHENTIC_REVIEW", "REVIEW");
    assert.ok(getRes);
    assert.equal(getRes.code, "FAKE_OR_INAUTHENTIC_REVIEW");
    assert.equal(getModerationPolicy("FAKE_OR_INAUTHENTIC_REVIEW", "LISTING"), null);
  });

  await t.test("appeals service enforces strict eligibility, deadlines, and single active appeal limits", () => {
    const serviceSrc = source("services/moderation.service.ts");

    // checkAppealEligibility checks
    assert.ok(serviceSrc.includes("export async function checkAppealEligibility"), "Must export checkAppealEligibility");
    assert.ok(serviceSrc.includes("hadDecision ="), "Must verify case has resolved or recorded decision");
    assert.ok(serviceSrc.includes("isPolicyAppealable"), "Must check policy appealability");
    assert.ok(serviceSrc.includes("getAppealDeadlineDays"), "Must calculate deadline window");
    assert.ok(serviceSrc.includes("An appeal is already active"), "Must prevent duplicate active appeals");
    assert.ok(serviceSrc.includes("maximum limit of 2 appeals"), "Must prevent excessive appeals");
    assert.ok(serviceSrc.includes("Only the affected content owner or case participant"), "Must enforce ownership / participant access");
  });

  await t.test("appeal submission and reviewer assignment follow auditable activity lifecycle", () => {
    const serviceSrc = source("services/moderation.service.ts");

    assert.ok(serviceSrc.includes("export async function submitModerationAppeal"), "Must export submitModerationAppeal");
    assert.ok(serviceSrc.includes('action: "APPEAL_SUBMITTED"'), "Must record APPEAL_SUBMITTED activity");
    assert.ok(serviceSrc.includes('app_${nanoid(12)}'), "Must generate standard appeal ID");

    assert.ok(serviceSrc.includes("export async function assignAppealReviewer"), "Must export assignAppealReviewer");
    assert.ok(serviceSrc.includes('action: "APPEAL_ASSIGNED"'), "Must record APPEAL_ASSIGNED activity");
    assert.ok(serviceSrc.includes('status = "UNDER_REVIEW"'), "Must transition status to UNDER_REVIEW upon assignment");
    assert.ok(serviceSrc.includes("assertEligibleModeratorAssignee"), "Must verify assigned reviewer has admin moderation permissions");
  });

  await t.test("appeal decisions support reversal, case reopening, notifications, and fault tolerance", () => {
    const serviceSrc = source("services/moderation.service.ts");

    assert.ok(serviceSrc.includes("export async function recordAppealDecision"), "Must export recordAppealDecision");
    assert.ok(serviceSrc.includes('action: "APPEAL_DECISION_RECORDED"'), "Must record APPEAL_DECISION_RECORDED activity");
    assert.ok(serviceSrc.includes('action: "CONTENT_REINSTATED"'), "Must record CONTENT_REINSTATED on approval");
    assert.ok(serviceSrc.includes('action: "MODERATION_ENFORCEMENT_FAILED"'), "Must record MODERATION_ENFORCEMENT_FAILED on reinstatement error");
    assert.ok(serviceSrc.includes('status: "REOPENED"'), "Must reopen case when requested on approved appeal");
    assert.ok(serviceSrc.includes('resourceType: "MODERATION_APPEAL"'), "Must record audit log for appeal decision");
    assert.ok(serviceSrc.includes("notificationService.create"), "Must notify appellant of appeal decision");

    // Review, listing, and photo restoration calls
    assert.ok(serviceSrc.includes('action: "RESTORE"'), "Must support RESTORE action for review and listing");
    assert.ok(serviceSrc.includes('action: "RESTORE_PHOTO"'), "Must support RESTORE_PHOTO for listing photo");
  });

  await t.test("appeal withdrawal and central queue queries enforce permissions and filtering", () => {
    const serviceSrc = source("services/moderation.service.ts");

    assert.ok(serviceSrc.includes("export async function withdrawModerationAppeal"), "Must export withdrawModerationAppeal");
    assert.ok(serviceSrc.includes('action: "APPEAL_WITHDRAWN"'), "Must record APPEAL_WITHDRAWN activity");

    assert.ok(serviceSrc.includes("export async function listModerationAppeals"), "Must export listModerationAppeals");
    assert.ok(serviceSrc.includes("PERMISSIONS.MODERATION_CASE_READ"), "Must assert moderator permission for queue");
  });

  await t.test("API routes provide secure endpoints for appeals, eligibility, and policy catalog", () => {
    // Check files exist
    assert.ok(fs.existsSync(path.join(root, "app/api/v1/moderation/policies/route.ts")), "Policies route exists");
    assert.ok(fs.existsSync(path.join(root, "app/api/v1/moderation/appeals/route.ts")), "Central appeals route exists");
    assert.ok(fs.existsSync(path.join(root, "app/api/v1/moderation/cases/[id]/appeals/route.ts")), "Case appeals route exists");
    assert.ok(fs.existsSync(path.join(root, "app/api/v1/moderation/cases/[id]/appeals/eligibility/route.ts")), "Eligibility route exists");
    assert.ok(fs.existsSync(path.join(root, "app/api/v1/moderation/cases/[id]/appeals/[appealId]/route.ts")), "Appeal details & assign route exists");
    assert.ok(fs.existsSync(path.join(root, "app/api/v1/moderation/cases/[id]/appeals/[appealId]/decision/route.ts")), "Decision route exists");
    assert.ok(fs.existsSync(path.join(root, "app/api/v1/moderation/cases/[id]/appeals/[appealId]/withdraw/route.ts")), "Withdraw route exists");

    const decisionRoute = source("app/api/v1/moderation/cases/[id]/appeals/[appealId]/decision/route.ts");
    assert.ok(decisionRoute.includes("appealDecisionSchema"), "Must validate decision input with zod schema");
    assert.ok(decisionRoute.includes("requireApiAuth"), "Must require authenticated user");
  });

  await t.test("UI components integrate appeals across Admin, Host, and Client with ModalOverlay scroll lock", () => {
    // Admin Appeals Queue
    assert.ok(fs.existsSync(path.join(root, "app/(protected)/admin/moderation/appeals/page.tsx")), "Admin appeals page exists");
    assert.ok(fs.existsSync(path.join(root, "app/(protected)/admin/moderation/appeals/admin-appeals-client.tsx")), "Admin appeals client exists");

    const appealsClient = source("app/(protected)/admin/moderation/appeals/admin-appeals-client.tsx");
    assert.ok(appealsClient.includes('from "@/components/ui/modal-overlay"'), "Must use ModalOverlay for dialogs");
    assert.ok(appealsClient.includes("handleAssignReviewer"), "Must allow assigning reviewers");
    assert.ok(appealsClient.includes("handleSubmitDecision"), "Must allow recording decisions");

    // Case Details integration
    const caseDetailsClient = source("app/(protected)/admin/moderation/cases/[id]/admin-moderation-case-details-client.tsx");
    assert.ok(caseDetailsClient.includes("Moderation Appeals"), "Must have Appeals section on case details");
    assert.ok(caseDetailsClient.includes("AdminAppealDecisionDialog"), "Must have decision dialog on case details");

    // User reports view integration
    const myReports = source("components/profile/my-reports-view.tsx");
    assert.ok(myReports.includes("SubmitAppealModal"), "Must have SubmitAppealModal");
    assert.ok(myReports.includes("handleWithdrawAppeal"), "Must allow withdrawing pending appeal");
    assert.ok(myReports.includes('from "@/components/ui/modal-overlay"'), "Must use ModalOverlay in reports view");
  });
});
