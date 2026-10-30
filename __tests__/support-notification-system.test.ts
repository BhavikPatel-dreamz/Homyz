import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Support notification system", () => {
  test("routes support messages only to explicitly authorized audiences", () => {
    const service = source("services/support-case.service.ts");

    assert.match(service, /if \(options\.targetAudience === "GUEST"\) return user\.role === Role\.USER/);
    assert.match(service, /if \(options\.targetAudience === "HOST"\) return user\.role === Role\.HOST/);
    assert.match(service, /if \(user\.role === Role\.ADMIN\) return false/);
    assert.match(service, /visibility === SupportCaseContentVisibility\.PARTICIPANTS/);
    assert.match(service, /visibility === SupportCaseContentVisibility\.ADMINS_ONLY \? "INTERNAL_NOTE_ADDED"/);
  });

  test("guest and host activity notify only an assigned agent or authorized support queue", () => {
    const service = source("services/support-case.service.ts");

    assert.match(service, /PERMISSIONS\.DISPUTES_MANAGE, PERMISSIONS\.DISPUTES_VIEW/);
    assert.match(service, /HOST_SUPPORT_CASE_CREATED/);
    assert.match(service, /GUEST_SUPPORT_CASE_CREATED/);
    assert.match(service, /HOST_REPLIED/);
    assert.match(service, /GUEST_REPLIED/);
    assert.match(service, /SUPPORT_CASE_ESCALATED_FOR_REVIEW/);
    assert.match(service, /getSupportQueueRecipients\(tx, updated\.escalationOwnerId, actor\.id\)/);
    assert.doesNotMatch(service, /role: Role\.ADMIN,\s*status: UserStatus\.ACTIVE,\s*\}\);/);
  });

  test("notification links use role-appropriate support locations", () => {
    const service = source("services/support-case.service.ts");
    const resolutions = source("services/resolution-offer.service.ts");

    assert.match(service, /\/host\/support\?caseId=/);
    assert.match(service, /\/profile\/tab\/support\?caseId=/);
    assert.match(service, /\/admin\/support\/\$\{encodeURIComponent\(caseId\)\}/);
    assert.match(resolutions, /\/host\/support\?view=direct&caseId=/);
    assert.match(resolutions, /await resolutionCaseLink\(tx, recipient, offer\.caseId\)/);
  });

  test("interactive support and resolution actions attempt delivery only after commit", () => {
    const support = source("services/support-case.service.ts");
    const resolutions = source("services/resolution-offer.service.ts");

    assert.match(support, /async function deliverCommittedSupportNotifications/);
    assert.match(support, /await deliverCommittedSupportNotifications\(\);\n  return message;/);
    assert.match(support, /await deliverCommittedSupportNotifications\(\);\n  return result\.updated;/);
    assert.match(resolutions, /async function deliverCommittedResolutionNotifications/);
    assert.match(resolutions, /await deliverCommittedResolutionNotifications\(\);\n  return created;/);
    assert.match(resolutions, /await deliverCommittedResolutionNotifications\(\);\n  return \{ supportCaseId: result\.supportCase\.id/);
  });

  test("outbox delivery retains separate in-app and email outcomes", () => {
    const service = source("services/notification-outbox.service.ts");

    assert.match(service, /NotificationDeliveryChannel\.IN_APP/);
    assert.match(service, /NotificationDeliveryChannel\.EMAIL/);
    assert.match(service, /NotificationDeliveryStatus\.SENT/);
    assert.match(service, /NotificationDeliveryStatus\.DELIVERED/);
    assert.match(service, /AMBIGUOUS_PROVIDER_OUTCOME/);
    assert.match(service, /supportEmail\(recipient\)/);
  });

  test("SLA alerts are bounded, deduplicated in the outbox, and run from the secured scheduler", () => {
    const service = source("services/support-case.service.ts");
    const cron = source("app/api/v1/cron/jobs/route.ts");

    assert.match(service, /async function queueSupportSlaNotifications/);
    assert.match(service, /Math\.min\(50, Math\.max\(1, Math\.trunc\(options\.limit \?\? 25\)\)\)/);
    assert.match(service, /support-case:sla:/);
    assert.match(service, /slaBreachedAt: now/);
    assert.match(cron, /supportCaseService\.queueSupportSlaNotifications\(\{ limit: 25 \}\)/);
    assert.match(cron, /notificationOutboxService\.processNotificationOutboxBatch\(\{ limit: 25 \}\)/);
  });

  test("notification UIs refresh only while the document is visible and expose delivery diagnostics", () => {
    const notifications = source("components/profile/notifications-view.tsx");
    const header = source("components/dashboard/app-header.tsx");
    const admin = source("components/admin/support/notification-outbox-monitor.tsx");

    assert.match(notifications, /window\.setInterval\(refresh, 30_000\)/);
    assert.match(notifications, /document\.visibilityState === "visible"/);
    assert.match(header, /window\.setInterval/);
    assert.match(admin, /Delivery status/);
    assert.match(admin, /lastAttemptedAt/);
    assert.match(admin, /pagination/);
  });
});
