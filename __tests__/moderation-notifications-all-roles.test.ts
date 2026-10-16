import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(__dirname, "..");
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("moderation notification integrations", async (t) => {
  const moderationService = source("services/moderation.service.ts");
  const notificationService = source("services/notification.service.ts");

  await t.test("case assignment and staff follow-up notifications run after the case transaction", () => {
    const updateCase = moderationService.slice(
      moderationService.indexOf("export async function updateModerationCase"),
      moderationService.indexOf("export async function moderateReviewFromAdmin"),
    );
    assert.match(updateCase, /const updated = await prisma\.\$transaction/);
    assert.match(updateCase, /existing\.assignedModeratorId !== updated\.assignedModeratorId[\s\S]{0,700}notifyCaseAssignment/);
    assert.match(updateCase, /input\.status === "NEEDS_INFORMATION"[\s\S]{0,500}notifyRequiredInformation/);
  });

  await t.test("participant notifications use the authorized reports destination, never admin or dispute pages", () => {
    assert.match(moderationService, /function moderationParticipantLink\(caseId: string/);
    assert.match(moderationService, /return `\/profile\/reports\?\$\{search\.toString\(\)\}`/);
    assert.doesNotMatch(moderationService, /recipient\.participantRole === "HOST" \? `\/host\/resolution-center`/);
    assert.doesNotMatch(moderationService, /link: `\/profile\/tab\/reviews`/);
  });

  await t.test("evidence, responses, and appeals notify the right party without revealing evidence", () => {
    assert.match(moderationService, /entityType: "moderation-evidence-submitted"/);
    assert.match(moderationService, /entityType: "moderation-evidence-receipt"/);
    assert.match(moderationService, /entityType: `moderation-response-\$\{requestId\}`/);
    assert.match(moderationService, /entityType: `moderation-response-receipt-\$\{requestId\}`/);
    assert.match(moderationService, /entityType: "moderation-appeal-submitted"/);
    assert.doesNotMatch(moderationService, /storageReference: stored\.storagePath[\s\S]{0,120}notificationService\.create/);
  });

  await t.test("message outcomes notify only reporters other than the message author", () => {
    const messageEnforcement = moderationService.slice(
      moderationService.indexOf("export async function executeMessageEnforcement"),
    );
    assert.match(messageEnforcement, /filter\(\(reporterId: string\) => reporterId !== message\.senderId\)/);
    assert.match(messageEnforcement, /entityType: `moderation-message-outcome-\$\{input\.action\.toLowerCase\(\)\}`/);
  });

  await t.test("notification writes retain their existing per-recipient event idempotency", () => {
    assert.match(notificationService, /userId: data\.userId,[\s\S]{0,180}entityId: data\.entityId/);
    assert.match(notificationService, /entityType: data\.entityType/);
  });

  await t.test("the RFI UI displays the backend request text", () => {
    const reportsView = source("components/profile/my-reports-view.tsx");
    assert.match(reportsView, /\{activeRfi\.requestText\}/);
    assert.doesNotMatch(reportsView, /\{activeRfi\.questions\}/);
  });
});
