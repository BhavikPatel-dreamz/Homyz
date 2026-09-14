import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { normalizePhotoRoomAssignments } from "../lib/listing/photo-room-assignments";
import { updateListingSchema } from "../lib/validation/listing";

const photoOne = "/uploads/listing-photos/photo_one.jpg";
const photoTwo = "/uploads/listing-photos/photo_two.jpg";

describe("Listing Photo Tour room assignments", () => {
  it("accepts room metadata while preserving the existing photo URL array", () => {
    const parsed = updateListingSchema.parse({
      photos: [photoOne, photoTwo],
      photoRoomAssignments: [
        { url: photoOne, roomType: "LIVING_ROOM" },
        { url: photoTwo, roomType: "BEDROOM" },
      ],
    });

    assert.deepEqual(parsed.photos, [photoOne, photoTwo]);
    assert.deepEqual(parsed.photoRoomAssignments, [
      { url: photoOne, roomType: "LIVING_ROOM" },
      { url: photoTwo, roomType: "BEDROOM" },
    ]);
  });

  it("treats legacy URL-only photos as unassigned and removes stale metadata", () => {
    assert.deepEqual(normalizePhotoRoomAssignments(undefined, [photoOne]), []);
    assert.deepEqual(
      normalizePhotoRoomAssignments([
        { url: photoOne, roomType: "KITCHEN" },
        { url: photoTwo, roomType: "BEDROOM" },
        { url: photoOne, roomType: "BATHROOM" },
        { url: "/uploads/listing-photos/invalid.jpg", roomType: null },
      ], [photoOne]),
      [{ url: photoOne, roomType: "KITCHEN" }],
    );
  });

  it("renders only the documented room categories and an unassigned section in the editor", () => {
    const photoTour = fs.readFileSync(
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
      assert.match(photoTour, new RegExp(label));
    }
  });
});
