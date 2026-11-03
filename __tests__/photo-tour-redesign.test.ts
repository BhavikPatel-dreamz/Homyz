import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import {
  normalizePhotoRoomAssignments,
  PHOTO_TOUR_CATEGORIES,
  getPhotoTourCategoryById,
  resolvePhotoRoomType,
} from "../lib/listing/photo-room-assignments";
import { updateListingSchema } from "../lib/validation/listing";

const photoOne = "/uploads/listing-photos/photo_1.jpg";
const photoTwo = "/uploads/listing-photos/photo_2.jpg";
const photoThree = "/uploads/listing-photos/photo_3.jpg";
const photoFour = "/uploads/listing-photos/photo_4.jpg";

describe("Complete Redesign — Homyz Photo Tour & Photo Management", () => {
  it("enforces GEMINI.md typography rule: strictly 0 instances of font-bold and font-semibold", () => {
    const photoTourSrc = fs.readFileSync(
      path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/PhotoTourManager.tsx"),
      "utf8",
    );
    const roomIllustrationsSrc = fs.readFileSync(
      path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/RoomIllustrations.tsx"),
      "utf8",
    );

    assert.doesNotMatch(photoTourSrc, /font-bold/);
    assert.doesNotMatch(photoTourSrc, /font-semibold/);
    assert.doesNotMatch(roomIllustrationsSrc, /font-bold/);
    assert.doesNotMatch(roomIllustrationsSrc, /font-semibold/);
  });

  it("contains all documented room categories and unassigned section", () => {
    const photoTourSrc = fs.readFileSync(
      path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/PhotoTourManager.tsx"),
      "utf8",
    );

    for (const label of [
      "Living Room",
      "Bedroom",
      "Bathroom",
      "Kitchen",
      "Dining Area",
      "Workspace",
      "Exterior",
      "Patio or Balcony",
      "Pool or Hot Tub",
      "Unassigned Photos",
    ]) {
      assert.match(photoTourSrc, new RegExp(label));
    }
  });

  it("Phase 1 — supports room cards, cover thumbnails, and photo counts", () => {
    const photoTourSrc = fs.readFileSync(
      path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/PhotoTourManager.tsx"),
      "utf8",
    );

    assert.match(photoTourSrc, /All photos/);
    assert.match(photoTourSrc, /Add room or space/);
    assert.match(photoTourSrc, /View your tasks/);
    assert.match(photoTourSrc, /grid-cols-1 sm:grid-cols-2 lg:grid-cols-3/);
  });

  it("Phase 2 — provides centered Add Room modal with category search and selection", () => {
    const photoTourSrc = fs.readFileSync(
      path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/PhotoTourManager.tsx"),
      "utf8",
    );

    assert.match(photoTourSrc, /Choose a room or space/);
    assert.match(photoTourSrc, /Search room types/);
    assert.match(photoTourSrc, /handleCreateRoom/);
  });

  it("Phase 3 — provides room detail view with left vertical sidebar, empty state, and safe room deletion", () => {
    const photoTourSrc = fs.readFileSync(
      path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/PhotoTourManager.tsx"),
      "utf8",
    );

    assert.match(photoTourSrc, /Back to Photo tour/);
    assert.match(photoTourSrc, /No photos in this room yet/);
    assert.match(photoTourSrc, /border-dashed/);
    assert.match(photoTourSrc, /Sleeping arrangements/);
    assert.match(photoTourSrc, /Amenities/);
    assert.match(photoTourSrc, /Accessibility features/);
    assert.match(photoTourSrc, /Delete room or space/);
    assert.match(photoTourSrc, /Photos currently in this room will not be deleted; they will be moved to Additional photos/);
  });

  it("Phase 4 & 5 — provides All Photos gallery and multi-select Manage Photos mode", () => {
    const photoTourSrc = fs.readFileSync(
      path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/PhotoTourManager.tsx"),
      "utf8",
    );

    assert.match(photoTourSrc, /Manage photos/);
    assert.match(photoTourSrc, /Cover photo/);
    assert.match(photoTourSrc, /selected/);
    assert.match(photoTourSrc, /Deselect/);
    assert.match(photoTourSrc, /handleDeleteSelectedPhotos/);
  });

  it("Phase 6 — Move Photos modal supports moving to existing rooms and creating new rooms", () => {
    const photoTourSrc = fs.readFileSync(
      path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/PhotoTourManager.tsx"),
      "utf8",
    );

    assert.match(photoTourSrc, /Move photos/);
    assert.match(photoTourSrc, /Existing rooms or spaces/);
    assert.match(photoTourSrc, /Or add a new room or space/);
    assert.match(photoTourSrc, /handleExecuteMove/);
  });

  it("Phase 7 — Photo editor includes large preview, description character counter, save, and make cover", () => {
    const photoTourSrc = fs.readFileSync(
      path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/PhotoTourManager.tsx"),
      "utf8",
    );

    assert.match(photoTourSrc, /Add a description for this room or space/);
    assert.match(photoTourSrc, /characters available/);
    assert.match(photoTourSrc, /maxLength=\{250\}/);
    assert.match(photoTourSrc, /handleSaveDescription/);
    assert.match(photoTourSrc, /handleMakeCoverPhoto/);
  });

  it("Phase 8 — Add photos workflow provides Upload from device and Choose from Additional photos", () => {
    const photoTourSrc = fs.readFileSync(
      path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/PhotoTourManager.tsx"),
      "utf8",
    );

    assert.match(photoTourSrc, /Upload from your device/);
    assert.match(photoTourSrc, /Choose from Additional photos/);
    assert.match(photoTourSrc, /handleMoveFromAdditionalToActive/);
  });

  it("Phase 9 — EditorSidebar displays photo tour summary with room counts and collage", () => {
    const sidebarSrc = fs.readFileSync(
      path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/EditorSidebar.tsx"),
      "utf8",
    );

    assert.match(sidebarSrc, /Photo tour/);
    assert.match(sidebarSrc, /bedroom.*bed.*bath/);
    assert.match(sidebarSrc, /You have tasks/);
  });

  it("Phase 11 — Backend validation and data synchronization accepts photo assignments with descriptions and room types", () => {
    const parsed = updateListingSchema.parse({
      photos: [photoOne, photoTwo, photoThree],
      photoRoomAssignments: [
        {
          url: photoOne,
          roomType: "BEDROOM",
          roomInstanceId: "room_bed_1",
          roomLabel: "Bedroom 1",
          description: "Cozy master bedroom with king bed",
        },
        {
          url: photoTwo,
          roomType: "DINING_AREA",
          roomInstanceId: "room_dining_1",
          roomLabel: "Dining area",
          description: "Dining area for 6 guests",
        },
      ],
      rooms: [
        { id: "room_bed_1", name: "Bedroom 1", type: "BEDROOM", beds: [{ type: "KING", count: 1 }] },
        { id: "room_dining_1", name: "Dining area", type: "DINING_AREA", beds: [] },
      ],
    });

    assert.equal(parsed.photos?.length, 3);
    assert.equal(parsed.photoRoomAssignments?.length, 2);
    assert.equal((parsed.photoRoomAssignments?.[0] as any).description, "Cozy master bedroom with king bed");
    assert.equal(parsed.rooms?.length, 2);
  });

  it("Modal stacking fix — uses discriminated union state to guarantee only one active modal at a time", () => {
    const photoTourSrc = fs.readFileSync(
      path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/PhotoTourManager.tsx"),
      "utf8",
    );

    assert.match(photoTourSrc, /export type ActiveModalState\s*=/);
    assert.match(photoTourSrc, /type:\s*"photo-detail"/);
    assert.match(photoTourSrc, /type:\s*"move-photos"/);
    assert.match(photoTourSrc, /type:\s*"add-room"/);

    assert.match(photoTourSrc, /handleOpenMoveFromDetail/);
    assert.match(photoTourSrc, /returnToPhotoIndex:\s*curIdx/);

    assert.match(photoTourSrc, /activeModal\.returnToPhotoIndex/);
    assert.match(photoTourSrc, /title="Back to photo details"/);
  });

  it("Global header overlay coverage fix — portals modals to document.body with z-9999 covering the navbar", () => {
    const photoTourSrc = fs.readFileSync(
      path.join(process.cwd(), "app/(protected)/host/listings/[id]/components/PhotoTourManager.tsx"),
      "utf8",
    );
    const modalOverlaySrc = fs.readFileSync(
      path.join(process.cwd(), "components/ui/modal-overlay.tsx"),
      "utf8",
    );

    assert.match(modalOverlaySrc, /createPortal\(node,\s*document\.body\)/);
    assert.match(modalOverlaySrc, /lockBodyScroll\(\)/);

    assert.match(photoTourSrc, /<ModalOverlay/);
    assert.match(photoTourSrc, /z-9999/);
    assert.match(photoTourSrc, /activeModal\.type !== "none"/);
  });
});
