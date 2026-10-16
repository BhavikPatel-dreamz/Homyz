import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(__dirname, "..");

function source(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Phase 2: central moderation workflow consolidation", async (t) => {
  await t.test("direct admin review moderation uses the canonical case workflow", () => {
    const route = source("app/api/v1/admin/reviews/[id]/route.ts");
    const moderationService = source("services/moderation.service.ts");
    const reviewService = source("services/review.service.ts");

    assert.match(route, /moderationService\.moderateReviewFromAdmin/);
    assert.doesNotMatch(route, /reviewService\.adminModerateReview/);
    assert.match(moderationService, /export async function moderateReviewFromAdmin/);
    assert.match(moderationService, /pg_advisory_xact_lock/);
    assert.match(moderationService, /targetType: "REVIEW", targetId: input\.reviewId/);
    assert.match(moderationService, /source: "ADMIN_DIRECT_REVIEW"/);
    assert.doesNotMatch(
      moderationService.slice(moderationService.indexOf("export async function moderateReviewFromAdmin")),
      /moderationReport\.create/,
    );
    assert.match(reviewService, /caseId: string;/);
    assert.match(reviewService, /Review enforcement requires a moderation case/);
  });

  await t.test("central enforcement keeps decision, enforcement, activity, and audit events linked to a case", () => {
    const moderationService = source("services/moderation.service.ts");

    assert.match(moderationService, /MODERATION_DECISION_CREATE/);
    assert.match(moderationService, /MODERATION_ENFORCEMENT_EXECUTE/);
    assert.match(moderationService, /assertActionMatchesTarget/);
    assert.match(moderationService, /action: "DECISION_RECORDED"/);
    assert.match(moderationService, /action: "CONTENT_MODERATED"/);
    assert.match(moderationService, /action: "ENFORCEMENT_FAILED"/);
    assert.match(moderationService, /"MODERATION_ENFORCEMENT_EXECUTED"/);
    assert.match(moderationService, /action: "MODERATION_ENFORCEMENT_FAILED"/);
    assert.match(moderationService, /enforcementResult: "SUCCESS"/);
    assert.match(moderationService, /enforcementResult: "FAILURE"/);
  });

  await t.test("canonical case transitions and assignment remain server-side protected", () => {
    const moderationService = source("services/moderation.service.ts");
    const caseRoute = source("app/api/v1/admin/moderation/cases/[id]/route.ts");

    assert.match(moderationService, /assertValidModerationTransition/);
    assert.match(moderationService, /expectedUpdatedAt/);
    assert.match(moderationService, /assertEligibleModeratorAssignee/);
    assert.match(moderationService, /getEffectivePermissionsForUser/);
    assert.match(caseRoute, /requireApiPermission\(req, PERMISSIONS\.MODERATION_CASE_UPDATE\)/);
  });

  await t.test("specialized review queue remains a filtered view of canonical cases", () => {
    const reviewDisputesPage = source("app/(protected)/admin/moderation/review-disputes/page.tsx");
    const casesPage = source("app/(protected)/admin/moderation/cases/page.tsx");

    assert.match(reviewDisputesPage, /targetType: "REVIEW"/);
    assert.match(reviewDisputesPage, /AdminModerationCasesClient/);
    assert.match(casesPage, /AdminModerationCasesClient/);
  });
});
