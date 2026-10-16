import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { Role, ReviewDirection, ReviewStatus } from "../generated/prisma/enums";
import { hasPermission, PERMISSIONS } from "../lib/permissions/permissions";

const root = path.resolve(__dirname, "..");

function source(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Phase 1: moderation safety and data correctness", async (t) => {
  await t.test("decision-only moderators can record decisions but cannot enforce content changes", () => {
    const decisionOnlyModerator = {
      id: "moderator-decision-only",
      role: Role.ADMIN,
      email: "decision@example.test",
      permissions: [
        PERMISSIONS.MODERATION_CASE_READ,
        PERMISSIONS.MODERATION_CASE_UPDATE,
        PERMISSIONS.MODERATION_DECISION_CREATE,
      ],
    };
    const enforcingModerator = {
      ...decisionOnlyModerator,
      id: "moderator-enforcer",
      permissions: [...decisionOnlyModerator.permissions, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE],
    };

    assert.equal(hasPermission(decisionOnlyModerator, PERMISSIONS.MODERATION_DECISION_CREATE), true);
    assert.equal(hasPermission(decisionOnlyModerator, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE), false);
    assert.equal(hasPermission(enforcingModerator, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE), true);

    const moderationService = source("services/moderation.service.ts");
    assert.match(moderationService, /function hasContentEnforcementAction/);
    assert.match(moderationService, /hasContentEnforcementAction\(input\)[\s\S]{0,220}MODERATION_ENFORCEMENT_EXECUTE/);
    assert.match(moderationService, /hasDecisionMutation\(input\)[\s\S]{0,220}MODERATION_DECISION_CREATE/);
    assert.match(moderationService, /input\.mediaAction !== "NONE" && input\.mediaAction !== "DISMISS"/);

    const directReviewRoute = source("app/api/v1/admin/reviews/[id]/route.ts");
    assert.match(directReviewRoute, /requireApiPermission\(req, PERMISSIONS\.MODERATION_ENFORCEMENT_EXECUTE\)/);
  });

  await t.test("only guest-to-property published reviews affect property ratings and counts", () => {
    const reviews = [
      { direction: ReviewDirection.GUEST_TO_PROPERTY, status: ReviewStatus.PUBLISHED, rating: 5 },
      { direction: ReviewDirection.GUEST_TO_PROPERTY, status: ReviewStatus.PUBLISHED, rating: 4 },
      { direction: ReviewDirection.HOST_TO_GUEST, status: ReviewStatus.PUBLISHED, rating: 1 },
      { direction: ReviewDirection.GUEST_TO_PROPERTY, status: ReviewStatus.HIDDEN, rating: 1 },
    ];
    const propertyReviews = reviews.filter((review) =>
      review.direction === ReviewDirection.GUEST_TO_PROPERTY && review.status === ReviewStatus.PUBLISHED,
    );

    assert.equal(propertyReviews.length, 2);
    assert.equal(propertyReviews.reduce((sum, review) => sum + review.rating, 0) / propertyReviews.length, 4.5);

    const listingService = source("services/listing.service.ts");
    assert.match(listingService, /getPublishedReviewSummaries[\s\S]{0,600}direction: ReviewDirection\.GUEST_TO_PROPERTY/);
    assert.match(listingService, /listingId: listing\.id,[\s\S]{0,180}direction: ReviewDirection\.GUEST_TO_PROPERTY/);
    assert.match(listingService, /listing: \{ hostId: listing\.hostId \},[\s\S]{0,180}direction: ReviewDirection\.GUEST_TO_PROPERTY/);
    assert.match(source("services/user.service.ts"), /direction: ReviewDirection\.GUEST_TO_PROPERTY/);
    assert.match(source("services/host-dashboard.service.ts"), /direction: ReviewDirection\.GUEST_TO_PROPERTY/);
    assert.match(source("services/superhost.service.ts"), /direction: ReviewDirection\.GUEST_TO_PROPERTY/);
    assert.match(source("services/guest-favorite.service.ts"), /direction: "GUEST_TO_PROPERTY" as const/);
  });

  await t.test("removed photo fallback is restricted to the current reported-photo case", () => {
    const moderationService = source("services/moderation.service.ts");
    const targetSummary = moderationService.slice(moderationService.indexOf('if (targetType === "LISTING_PHOTO")'));

    assert.match(targetSummary, /where: \{ caseId, targetType: "LISTING_PHOTO", targetId \}/);
    assert.match(targetSummary, /where: \{[\s\S]{0,120}caseId,[\s\S]{0,180}action: \{ in: \["REPORT_ATTACHED", "CONTENT_MODERATED"\] \}/);
    assert.match(targetSummary, /if \(!listing && hasMatchingPhotoReport\)/);
  });
});
