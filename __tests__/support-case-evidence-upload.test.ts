import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("Support Case Evidence Upload and Storage", () => {
  test("lib/storage/media.ts maps support-case-evidence to dispute-evidence wire partition", () => {
    const media = source("lib/storage/media.ts");
    assert.match(media, /if\s*\(kind === "support-case-evidence"\)\s*\{\s*return "dispute-evidence";/);
    assert.match(media, /const wireKind = storageWireKind\(options\.kind\);/);
    assert.match(media, /const wireKind = storageWireKind\(kind\);/);
  });

  test("supportCaseService records clean scan status and participant-visible event upon valid upload", () => {
    const service = source("services/support-case.service.ts");
    assert.match(service, /scanStatus:\s*SupportCaseEvidenceScanStatus\.CLEAN/);
    assert.match(service, /eventType:\s*"EVIDENCE_UPLOADED"/);
    assert.match(service, /visibility:\s*SupportCaseContentVisibility\.PARTICIPANTS/);
  });

  test("getSupportCaseEvidenceForParticipant allows participants to download verified clean evidence", () => {
    const service = source("services/support-case.service.ts");
    assert.match(service, /if\s*\(\s*!access\.admin\s*&&\s*evidence\.scanStatus !== SupportCaseEvidenceScanStatus\.CLEAN\s*\)/);
    assert.match(service, /buffer = await readPrivateMedia\(\s*"support-case-evidence",\s*evidence\.storageKey,?\s*\);/);
  });

  test("media-server/storage.mjs retains support-case-evidence in MEDIA_KINDS for forward compatibility", () => {
    const storageMjs = source("media-server/storage.mjs");
    assert.match(storageMjs, /"support-case-evidence"/);
  });
});
