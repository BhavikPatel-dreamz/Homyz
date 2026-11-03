import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import {
  buildPhotoTourViewModel,
  partitionPhotosIntoBlocks,
} from "../lib/listing/photo-tour-view-model";

const filesToCheck = [
  "components/listings/listing-gallery.tsx",
  "components/listings/photo-tour/hero-cover-gallery.tsx",
  "components/listings/photo-tour/photo-tour-view.tsx",
  "components/listings/photo-tour/photo-tour-modal.tsx",
  "components/listings/photo-tour/fullscreen-photo-viewer.tsx",
  "app/listings/[id]/photos/listing-photos-client.tsx",
  "app/listings/[id]/photos/page.tsx",
];

describe("StayElite Guest Listing Photo Tour Redesign Suite", () => {
  it("enforces GEMINI.md typography rule: strictly 0 instances of font-bold, font-semibold, <b>, <strong>", () => {
    for (const relPath of filesToCheck) {
      const fullPath = path.join(process.cwd(), relPath);
      assert.ok(fs.existsSync(fullPath), `File must exist: ${relPath}`);
      const content = fs.readFileSync(fullPath, "utf8");

      assert.doesNotMatch(
        content,
        /font-bold/,
        `Violation in ${relPath}: font-bold is strictly prohibited per GEMINI.md`,
      );
      assert.doesNotMatch(
        content,
        /font-semibold/,
        `Violation in ${relPath}: font-semibold is strictly prohibited per GEMINI.md`,
      );
      assert.doesNotMatch(
        content,
        /<b(\s|>)/,
        `Violation in ${relPath}: <b> tag is prohibited per GEMINI.md`,
      );
      assert.doesNotMatch(
        content,
        /<strong(\s|>)/,
        `Violation in ${relPath}: <strong> tag is prohibited per GEMINI.md`,
      );
    }
  });

  it("Phase 1 & 7 — Real data integration with room grouping and unassigned fallback", () => {
    const p1 = "https://example.com/workspace.jpg";
    const p2 = "https://example.com/living.jpg";
    const p3 = "https://example.com/bedroom.jpg";
    const p4 = "https://example.com/unassigned.jpg";

    const vm = buildPhotoTourViewModel({
      photos: [p1, p2, p3, p4],
      photoRoomAssignments: [
        { url: p1, roomType: "WORKSPACE" },
        { url: p2, roomType: "LIVING_ROOM" },
        { url: p3, roomType: "BEDROOM", roomLabel: "Primary Suite" },
      ],
      amenities: ["wifi", "air_conditioning", "refrigerator", "tv"],
    });

    assert.equal(vm.totalPhotos, 4);
    assert.equal(vm.sections.length, 4);
    assert.equal(vm.sections[0].title, "Workspace");
    assert.equal(vm.sections[1].title, "Living Room");
    assert.equal(vm.sections[2].title, "Primary Suite");
    assert.equal(vm.sections[3].title, "Additional photos");

    // Details check
    assert.match(vm.sections[0].details || "", /Wifi/i);
    assert.match(vm.sections[1].details || "", /Air Conditioning/i);
  });

  it("Header & Sticky Photo Navigation layout: dynamically docks navigation below AppHeader without overlapping", () => {
    const tourViewSrc = fs.readFileSync(
      path.join(process.cwd(), "components/listings/photo-tour/photo-tour-view.tsx"),
      "utf8",
    );

    // 1. Measures header height dynamically
    assert.match(tourViewSrc, /useAppHeaderHeight/);
    assert.match(tourViewSrc, /--app-header-height/);

    // 2. Positions sticky navigation directly below the header
    assert.match(tourViewSrc, /top:\s*`\$\{headerHeight\}px`/);
    assert.match(tourViewSrc, /sticky\s+z-30/);

    // 2b. Border width matches header size via Container, not complete screen
    assert.match(tourViewSrc, /<Container>/);
    assert.match(tourViewSrc, /border-b border-\[#727272\]\/20/);

    // 3. Section headings account for both header and navigation heights with scrollMarginTop
    assert.match(tourViewSrc, /scrollMarginTop:\s*`\$\{headerHeight\s*\+\s*navHeight\s*\+\s*20\}px`/);

    // 4. Smooth scrolling without overlap or scroll jumping
    assert.match(tourViewSrc, /isClickScrolling/);
    assert.match(tourViewSrc, /scrollToSection/);
  });

  it("Phase 3 — Adaptive layout partition handles 1, 2, 3, 4, 5+ photos without empty spaces", () => {
    const dummy = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `p-${i}`,
        url: `https://example.com/p-${i}.jpg`,
        globalIndex: i,
        roomIndex: i,
        roomId: "room",
        roomName: "Room",
      }));

    for (let count = 1; count <= 20; count++) {
      const photos = dummy(count);
      const blocks = partitionPhotosIntoBlocks(photos);
      assert.ok(blocks.length > 0, `Count ${count} must produce blocks`);

      let totalPhotosInBlocks = 0;
      for (const b of blocks) {
        if (b.type === "single") totalPhotosInBlocks += 1;
        else if (b.type === "two-column") totalPhotosInBlocks += 2;
        else if (b.type === "feature-right-stacked" || b.type === "feature-left-stacked") totalPhotosInBlocks += 3;
        else if (b.type === "two-by-two") totalPhotosInBlocks += 4;
      }
      assert.equal(totalPhotosInBlocks, count, `Block photo count mismatch for total = ${count}`);
    }
  });

  it("Phase 4 — Fullscreen Individual Photo Viewer provides keyboard, swipe, counter, and report modal", () => {
    const viewerSrc = fs.readFileSync(
      path.join(process.cwd(), "components/listings/photo-tour/fullscreen-photo-viewer.tsx"),
      "utf8",
    );

    assert.match(viewerSrc, /objectFit:\s*"contain"/);
    assert.match(viewerSrc, /ReportContentModal/);
    assert.match(viewerSrc, /ArrowLeft/);
    assert.match(viewerSrc, /ArrowRight/);
    assert.match(viewerSrc, /Escape/);
    assert.match(viewerSrc, /onTouchStart/);
    assert.match(viewerSrc, /onTouchEnd/);
    assert.match(viewerSrc, /thumbnailStripRef/);
  });

  it("Phase 5 — Hero cover gallery provides 5-image desktop grid, 'Show all photos' action, and mobile carousel", () => {
    const heroSrc = fs.readFileSync(
      path.join(process.cwd(), "components/listings/photo-tour/hero-cover-gallery.tsx"),
      "utf8",
    );

    assert.match(heroSrc, /Show all/);
    assert.match(heroSrc, /col-span-2/);
    assert.match(heroSrc, /grid-cols-4/);
    assert.match(heroSrc, /onTouchStart/);
    assert.match(heroSrc, /onTouchEnd/);
  });

  it("Phase 9 — Dedicated /listings/[id]/photos route provides AppHeader, server metadata, and ListingPhotosClient", () => {
    const routeSrc = fs.readFileSync(
      path.join(process.cwd(), "app/listings/[id]/photos/page.tsx"),
      "utf8",
    );

    assert.match(routeSrc, /AppHeader/);
    assert.match(routeSrc, /generateMetadata/);
    assert.match(routeSrc, /ListingPhotosClient/);
    assert.match(routeSrc, /resolveListing/);
  });
});
