import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Phases 9 + 10 — operational reliability and evidence security", () => {
  test("migration is additive and introduces durable outbox, delivery, and quarantine state", () => {
    const migration = source("prisma/migrations/20261029150000_add_support_notification_outbox_evidence_security/migration.sql");
    assert.doesNotMatch(migration, /DROP\s+(TABLE|COLUMN|TYPE)/i);
    assert.match(migration, /CREATE TABLE "NotificationOutbox"/);
    assert.match(migration, /CREATE TABLE "NotificationDelivery"/);
    assert.match(migration, /CREATE TABLE "NotificationDeliveryAttempt"/);
    assert.match(migration, /SupportCaseEvidenceScanStatus/);
  });

  test("outbox worker has bounded claims, lease recovery, idempotent delivery, and dead letters", () => {
    const worker = source("services/notification-outbox.service.ts");
    assert.match(worker, /DEFAULT_MAX_ATTEMPTS = 5/);
    assert.match(worker, /LEASE_MS = 90_000/);
    assert.match(worker, /MAX_BATCH_SIZE = 50/);
    assert.match(worker, /recoverStaleLeases/);
    assert.match(worker, /updateMany\(\{[\s\S]*processingLeaseId/);
    assert.match(worker, /outboxEventId_recipientUserId_channel/);
    assert.match(worker, /NotificationOutboxStatus\.DEAD_LETTER/);
    assert.match(worker, /AMBIGUOUS_PROVIDER_OUTCOME/);
  });

  test("in-app delivery uses durable deduplication while email remains disabled unless the real provider is configured", () => {
    const worker = source("services/notification-outbox.service.ts");
    const email = source("lib/services/email.ts");
    assert.match(worker, /deduplicationKey: `outbox:\$\{event\.id\}:in-app:\$\{recipient\.userId\}`/);
    assert.match(worker, /if \(!isEmailDeliveryConfigured\(\)\) return/);
    assert.match(email, /isEmailDeliveryConfigured/);
    assert.match(email, /sendOperationalNotificationEmail/);
  });

  test("support and resolution mutations enqueue their notifications inside their originating transactions", () => {
    const support = source("services/support-case.service.ts");
    const resolution = source("services/resolution-offer.service.ts");
    assert.match(support, /enqueueSupportNotification\(tx, \{/);
    assert.match(support, /SUPPORT_CASE_CREATED/);
    assert.match(support, /MESSAGE_ADDED_\$\{created\.id\}/);
    assert.match(resolution, /RESOLUTION_REQUESTED/);
    assert.match(resolution, /RESOLUTION_OFFER_EXPIRED/);
    assert.doesNotMatch(resolution, /void notifyResolutionUser/);
  });

  test("quarantined or scan-failed evidence cannot be downloaded and private storage remains enforced", () => {
    const support = source("services/support-case.service.ts");
    const storage = source("lib/storage/media.ts");
    assert.match(support, /scanStatus: SupportCaseEvidenceScanStatus\.QUARANTINED/);
    assert.match(support, /evidence\.scanStatus !== SupportCaseEvidenceScanStatus\.CLEAN/);
    assert.match(support, /savePrivateMedia\(/);
    assert.match(storage, /cacheControl: "private, max-age=0, no-store"/);
    assert.match(storage, /resolveStoredKey/);
  });

  test("legal holds are append-only and retention cleanup is bounded, manually confirmed, and hold-aware", () => {
    const service = source("services/support-case-evidence-security.service.ts");
    assert.match(service, /supportCaseEvidenceHold\.create/);
    assert.match(service, /legalHold: true/);
    assert.match(service, /MAX_CLEANUP_BATCH = 50/);
    assert.match(service, /if \(!input\.confirm\)/);
    assert.match(service, /if \(record\.legalHold\)/);
    assert.match(service, /dryRun = input\.dryRun !== false/);
  });

  test("operational endpoints use explicit permissions and bounded processing", () => {
    const processRoute = source("app/api/v1/admin/support/notification-outbox/process/route.ts");
    const retryRoute = source("app/api/v1/admin/support/notification-outbox/[id]/retry/route.ts");
    const holdRoute = source("app/api/v1/support/cases/[id]/evidence/[evidenceId]/legal-hold/route.ts");
    assert.match(processRoute, /PERMISSIONS\.NOTIFICATIONS_MANAGE/);
    assert.match(processRoute, /max\(50\)/);
    assert.match(retryRoute, /PERMISSIONS\.NOTIFICATIONS_RETRY/);
    assert.match(holdRoute, /PERMISSIONS\.DISPUTES_RESOLVE/);
  });
});
