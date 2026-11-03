import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const source = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("Host dispute attachment flow", () => {
  test("uses a shared picker that validates, deduplicates, limits, and removes selected files", () => {
    const picker = source("components/support/attachment-picker.tsx");
    assert.match(picker, /const MAX_FILES = 5/);
    assert.match(picker, /MAX_SIZE_BYTES = 15 \* 1024 \* 1024/);
    assert.match(picker, /known\.has\(key\)/);
    assert.match(picker, /merged\.length >= MAX_FILES/);
    assert.match(picker, /aria-label={`Remove \$\{file\.name\}`}/);
    assert.match(picker, /onDrop=\{onDrop\}/);
    assert.match(picker, /inputRef\.current\?\.click\(\)/);
    assert.match(picker, />\s*Choose files\s*</);
  });

  test("uses the same attachment control for replies, standalone evidence, and resolution proposals", () => {
    const client = source("components/host/host-dispute-details-client.tsx");
    const pickerUses = client.match(/<AttachmentPicker/g) || [];
    assert.equal(pickerUses.length, 3);
    assert.match(client, /files=\{proposalFiles\}/);
    assert.match(client, /files=\{replyFiles\}/);
  });

  test("uses the shared picker for direct-resolution and host support evidence", () => {
    const direct = source("components/resolution/direct-resolution-center.tsx");
    const support = source("components/host/support/host-support-center.tsx");
    const hostOperations = source(
      "components/host/support/host-case-detail-client.tsx",
    );
    assert.match(direct, /<AttachmentPicker/);
    assert.match(direct, /for \(const file of evidenceFiles\)/);
    assert.match(support, /<AttachmentPicker/);
    assert.match(support, /for \(const file of evidenceFiles\)/);
    assert.match(hostOperations, /<AttachmentPicker/);
    assert.match(hostOperations, /for \(const file of evidenceFiles\)/);
    assert.match(
      hostOperations,
      /\/api\/v1\/support\/cases\/\$\{active\.id\}\/evidence\/upload/,
    );
  });

  test("rejects duplicate uploads server-side and cleans up stored files if persistence fails", () => {
    const service = source("services/dispute.service.ts");
    assert.match(service, /crypto\s*\.\s*createHash\("sha256"\)/);
    assert.match(service, /The same evidence file was selected more than once/);
    assert.match(service, /async function deleteStoredDisputeEvidence/);
    assert.match(
      service,
      /await deleteStoredDisputeEvidence\(\s*evidence,?\s*\);/,
    );
    assert.match(
      service,
      /await deleteStoredDisputeEvidence\(\s*savedEvidence,?\s*\);/,
    );
    assert.match(
      service,
      /const evidence = await storeDisputeEvidence\(\s*incident\.id,\s*actor\.id,\s*evidenceFiles,?\s*\)/,
    );
  });

  test("lets hosts upload standalone multi-file evidence from the resolution-center evidence tab", () => {
    const client = source("components/host/host-dispute-details-client.tsx");
    const route = source("app/api/v1/host/disputes/[id]/evidence/route.ts");
    const service = source("services/dispute.service.ts");
    assert.match(client, /files=\{evidenceFiles\}/);
    assert.match(
      client,
      /evidenceFiles\.forEach\(\(file\) => body\.append\("evidence", file\)\)/,
    );
    assert.match(
      client,
      /\/api\/v1\/host\/disputes\/\$\{dispute\.id\}\/evidence/,
    );
    assert.match(route, /formData\.getAll\("evidence"\)/);
    assert.match(route, /uploadHostDisputeEvidence/);
    assert.match(service, /export async function uploadHostDisputeEvidence/);
    assert.match(service, /action: "DISPUTE_HOST_EVIDENCE_UPLOADED"/);
  });

  test("links a support-case attachment to its persisted message before rendering it in conversation", () => {
    const route = source(
      "app/api/v1/support/cases/[id]/evidence/upload/route.ts",
    );
    const service = source("services/support-case.service.ts");
    const client = source("components/profile/support-resolution-center.tsx");
    assert.match(route, /const messageId = formData\.get\("messageId"\)/);
    assert.match(service, /id: messageId, caseId, senderId: actor\.id/);
    assert.match(
      service,
      /metadata:\s*options\.messageId\s*\?\s*\{\s*messageId: options\.messageId,?\s*\}/,
    );
    assert.match(
      client,
      /formData\.set\(\s*"messageId",\s*savedMessage\.id,?\s*\)/,
    );
    assert.match(client, /entry\.metadata\?\.messageId\s*===\s*msg\.id/);
  });
});
