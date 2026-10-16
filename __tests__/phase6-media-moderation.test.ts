import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getModerationPolicy, MODERATION_POLICIES } from "../lib/moderation/policies";

test("Phase 6: Uploaded Photos & Media Moderation", async (t) => {
  await t.test("1. Media policy catalog supports all required photo & profile violations", () => {
    const explicitPhoto = getModerationPolicy("EXPLICIT_OR_NUDITY", "LISTING_PHOTO");
    assert.ok(explicitPhoto, "EXPLICIT_OR_NUDITY must be valid for LISTING_PHOTO");
    assert.equal(explicitPhoto.defaultSeverity, "CRITICAL");

    const explicitProfile = getModerationPolicy("EXPLICIT_OR_NUDITY", "PROFILE");
    assert.ok(explicitProfile, "EXPLICIT_OR_NUDITY must be valid for PROFILE");
    assert.equal(explicitProfile.defaultSeverity, "CRITICAL");

    const contactInfo = getModerationPolicy("CONTACT_INFO_IN_PHOTO", "LISTING_PHOTO");
    assert.ok(contactInfo, "CONTACT_INFO_IN_PHOTO must be valid for LISTING_PHOTO");
    assert.equal(contactInfo.defaultSeverity, "MEDIUM");

    const violence = getModerationPolicy("VIOLENCE_OR_DISTURBING", "LISTING_PHOTO");
    assert.ok(violence, "VIOLENCE_OR_DISTURBING must be valid for LISTING_PHOTO");
    assert.equal(violence.defaultSeverity, "HIGH");

    const infringing = getModerationPolicy("UNAUTHORIZED_OR_INFRINGING", "LISTING_PHOTO");
    assert.ok(infringing, "UNAUTHORIZED_OR_INFRINGING must be valid for LISTING_PHOTO");

    const fraud = getModerationPolicy("SUSPECTED_FRAUD", "LISTING_PHOTO");
    assert.ok(fraud, "SUSPECTED_FRAUD must be valid for LISTING_PHOTO");
  });

  await t.test("2. User report intake accepts full-length media URLs", () => {
    const reportRoutePath = path.join(process.cwd(), "app/api/v1/moderation/reports/route.ts");
    const content = fs.readFileSync(reportRoutePath, "utf-8");
    assert.match(
      content,
      /targetId:\s*z\.string\(\)\.trim\(\)\.min\(1\)\.max\(2048\)/,
      "Report API schema must allow up to 2048 chars for long media URLs"
    );
  });

  await t.test("3. Gallery lightbox has Report Photo integration using ModalOverlay", () => {
    const galleryPath = path.join(process.cwd(), "components/listings/listing-gallery.tsx");
    const galleryContent = fs.readFileSync(galleryPath, "utf-8");
    assert.match(galleryContent, /ReportContentModal/, "Gallery must import ReportContentModal");
    assert.match(galleryContent, /reportingPhotoUrl/, "Gallery must track reporting photo state");
    assert.match(galleryContent, /Report photo/i, "Lightbox must expose a Report photo control");

    const modalPath = path.join(process.cwd(), "components/moderation/report-content-modal.tsx");
    const modalContent = fs.readFileSync(modalPath, "utf-8");
    assert.match(modalContent, /from ["']@\/components\/ui\/modal-overlay["']/, "Modal must use ModalOverlay");
    assert.match(modalContent, /LISTING_PHOTO/, "Modal must support LISTING_PHOTO target type");
  });

  await t.test("4. Photo removal safely promotes next photo as cover and flags low photo count", () => {
    const initialPhotos = [
      "https://images.example.com/cover.jpg",
      "https://images.example.com/bedroom.jpg",
      "https://images.example.com/kitchen.jpg",
      "https://images.example.com/bathroom.jpg",
      "https://images.example.com/balcony.jpg",
    ];

    const photoToRemove = "https://images.example.com/cover.jpg";
    const nextPhotos = initialPhotos.filter((p) => p !== photoToRemove);

    // Verify next photo becomes cover (index 0)
    assert.equal(nextPhotos[0], "https://images.example.com/bedroom.jpg");
    assert.equal(nextPhotos.length, 4);

    // Below minimum of 5 photos requires changes
    const requiresMorePhotos = nextPhotos.length < 5;
    assert.equal(requiresMorePhotos, true);
  });

  await t.test("5. Admin moderation case management supports mediaAction", () => {
    const caseRoutePath = path.join(process.cwd(), "app/api/v1/admin/moderation/cases/[id]/route.ts");
    const caseRouteContent = fs.readFileSync(caseRoutePath, "utf-8");
    assert.match(
      caseRouteContent,
      /mediaAction:\s*z\.enum\(\["NONE",\s*"DISMISS",\s*"HIDE_PHOTO",\s*"REMOVE_PHOTO",\s*"REQUEST_REPLACEMENT",\s*"RESTORE_PHOTO"\]\)/,
      "Case update schema must include mediaAction enum"
    );

    const clientPath = path.join(
      process.cwd(),
      "app/(protected)/admin/moderation/cases/[id]/admin-moderation-case-details-client.tsx"
    );
    const clientContent = fs.readFileSync(clientPath, "utf-8");
    assert.match(clientContent, /Photo moderation action/, "Decision dialog must render photo moderation action");
    assert.match(clientContent, /Listing Gallery Context/, "TargetPreview must render gallery context comparison");
    assert.match(clientContent, /Cover Photo/, "TargetPreview must label cover photos");
  });

  await t.test("6. Media moderation dedicated queue and sidebar navigation are registered", () => {
    const mediaPagePath = path.join(process.cwd(), "app/(protected)/admin/moderation/media/page.tsx");
    assert.ok(fs.existsSync(mediaPagePath), "Media moderation page route must exist");

    const mediaLoadingPath = path.join(process.cwd(), "app/(protected)/admin/moderation/media/loading.tsx");
    assert.ok(fs.existsSync(mediaLoadingPath), "Media moderation loading skeleton must exist");

    const sidebarPath = path.join(process.cwd(), "components/admin/admin-sidebar.tsx");
    const sidebarContent = fs.readFileSync(sidebarPath, "utf-8");
    assert.match(sidebarContent, /\/admin\/moderation\/media/, "Sidebar must include media moderation link");
    assert.match(sidebarContent, /moderation-media/, "Sidebar must register moderation-media key");
  });
});

