import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { validateEvidenceFile } from "../services/moderation.service";

const root = path.resolve(__dirname, "..");

function source(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

test("Phase 4: Secure Evidence Upload, Management & Requests for Information", async (t) => {
  await t.test("evidence validator accepts valid JPEG, PNG, WebP, and PDF signatures", () => {
    // Valid JPEG: FF D8 FF E0
    const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    const jpegResult = validateEvidenceFile({ buffer: jpegBuffer, fileName: "receipt.jpg" });
    assert.equal(jpegResult.mimeType, "image/jpeg");
    assert.match(jpegResult.cleanFileName, /^receipt-/);
    assert.equal(jpegResult.extension, ".jpg");

    // Valid PNG: 89 50 4E 47 0D 0A 1A 0A
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
    const pngResult = validateEvidenceFile({ buffer: pngBuffer, fileName: "screenshot.png" });
    assert.equal(pngResult.mimeType, "image/png");
    assert.match(pngResult.cleanFileName, /^screenshot-/);

    // Valid WebP: RIFF ... WEBP
    const webpBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
    const webpResult = validateEvidenceFile({ buffer: webpBuffer, fileName: "photo.webp" });
    assert.equal(webpResult.mimeType, "image/webp");
    assert.match(webpResult.cleanFileName, /^photo-/);

    // Valid PDF: %PDF-
    const pdfBuffer = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
    const pdfResult = validateEvidenceFile({ buffer: pdfBuffer, fileName: "agreement.pdf" });
    assert.equal(pdfResult.mimeType, "application/pdf");
    assert.match(pdfResult.cleanFileName, /^agreement-/);
    assert.equal(pdfResult.isPdf, true);
  });

  await t.test("evidence validator rejects disallowed extensions, spoofed MIME types, and oversized files", () => {
    // Disallowed extension
    assert.throws(
      () => validateEvidenceFile({ buffer: Buffer.from("alert(1)"), fileName: "exploit.exe" }),
      /Evidence must be a JPG, PNG, WEBP image, or PDF document/,
    );
    assert.throws(
      () => validateEvidenceFile({ buffer: Buffer.from("<script>"), fileName: "index.html" }),
      /Evidence must be a JPG, PNG, WEBP image, or PDF document/,
    );

    // Mismatched signature (fake PNG containing plain text)
    assert.throws(
      () => validateEvidenceFile({ buffer: Buffer.from("This is plain text pretending to be PNG"), fileName: "fake.png" }),
      /Evidence file content does not match a supported format/,
    );

    // Mismatched signature (fake PDF)
    assert.throws(
      () => validateEvidenceFile({ buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), fileName: "fake.pdf" }),
      /File content does not match declared PDF format/,
    );

    // Empty file
    assert.throws(
      () => validateEvidenceFile({ buffer: Buffer.alloc(0), fileName: "empty.jpg" }),
      /Evidence file cannot be empty/,
    );

    // Oversized file (> 15MB)
    const bigBuffer = Buffer.alloc(16 * 1024 * 1024);
    assert.throws(
      () => validateEvidenceFile({ buffer: bigBuffer, fileName: "huge.jpg" }),
      /Evidence file must be 15MB or smaller/,
    );
  });

  await t.test("moderation service provides complete evidence and RFI management operations", () => {
    const service = source("services/moderation.service.ts");

    // Evidence methods
    assert.match(service, /export async function uploadModerationEvidence/);
    assert.match(service, /export async function getModerationEvidenceStream/);
    assert.match(service, /export async function listModerationEvidence/);
    assert.match(service, /savePrivateMedia\(\s*\{\s*kind:\s*"moderation-evidence"/);
    assert.match(service, /readPrivateMedia/);

    // Information Request methods
    assert.match(service, /export async function createInformationRequest/);
    assert.match(service, /export async function listInformationRequests/);
    assert.match(service, /export async function respondToInformationRequest/);
    assert.match(service, /export async function updateInformationRequestStatus/);
    assert.match(service, /action: "INFORMATION_REQUESTED"/);
    assert.match(service, /action: "INFORMATION_RESPONDED"/);
  });

  await t.test("API route handlers strictly protect evidence streaming and RFI lifecycle", () => {
    const evidenceListRoute = source("app/api/v1/moderation/cases/[id]/evidence/route.ts");
    const evidenceStreamRoute = source("app/api/v1/moderation/cases/[id]/evidence/[evidenceId]/route.ts");
    const rfiRoute = source("app/api/v1/moderation/cases/[id]/information-requests/route.ts");
    const rfiRespondRoute = source("app/api/v1/moderation/cases/[id]/information-requests/[requestId]/respond/route.ts");

    // Secure streaming headers
    assert.match(evidenceStreamRoute, /"Cache-Control": "private, no-cache, no-store, must-revalidate"/);
    assert.match(evidenceStreamRoute, /"X-Content-Type-Options": "nosniff"/);
    assert.match(evidenceStreamRoute, /getModerationEvidenceStream/);

    // Multipart validation
    assert.match(evidenceListRoute, /multipart\/form-data/);
    assert.match(evidenceListRoute, /uploadModerationEvidence/);

    // RFI handling
    assert.match(rfiRoute, /createInformationRequest/);
    assert.match(rfiRespondRoute, /respondToInformationRequest/);
  });

  await t.test("Admin Case Details UI provides full evidence preview, upload, and RFI controls", () => {
    const adminUi = source("app/(protected)/admin/moderation/cases/[id]/admin-moderation-case-details-client.tsx");

    assert.match(adminUi, /UploadEvidenceDialog/);
    assert.match(adminUi, /PreviewEvidenceDialog/);
    assert.match(adminUi, /CreateRfiDialog/);
    assert.match(adminUi, /Requests for Information \(RFI\)/);
    assert.match(adminUi, /Mark as Reviewed/);
    assert.match(adminUi, /Close Request/);
    assert.match(adminUi, /ModalOverlay/);
  });

  await t.test("Guest and Host MyReportsView integrates RFI response and evidence attachments", () => {
    const clientUi = source("components/profile/my-reports-view.tsx");

    assert.match(clientUi, /RespondRfiDialog/);
    assert.match(clientUi, /ClientUploadEvidenceDialog/);
    assert.match(clientUi, /ClientPreviewEvidenceDialog/);
    assert.match(clientUi, /Action Required: Information Requested/);
    assert.match(clientUi, /View Request/);
    assert.match(clientUi, /View Attached Evidence/);
    assert.match(clientUi, /ModalOverlay/);
  });
});
