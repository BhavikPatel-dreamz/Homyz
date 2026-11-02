import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPhotoTourViewModel,
  partitionPhotosIntoBlocks,
} from "../lib/listing/photo-tour-view-model";

const p1 = "https://images.unsplash.com/photo-1";
const p2 = "https://images.unsplash.com/photo-2";
const p3 = "https://images.unsplash.com/photo-3";
const p4 = "https://images.unsplash.com/photo-4";
const p5 = "https://images.unsplash.com/photo-5";
const p6 = "https://images.unsplash.com/photo-6";
const p7 = "https://images.unsplash.com/photo-7";

describe("Photo Tour View Model & Adaptive Masonry Partitioning", () => {
  it("handles empty photos list safely", () => {
    const vm = buildPhotoTourViewModel({ photos: [] });
    assert.equal(vm.totalPhotos, 0);
    assert.equal(vm.sections.length, 0);
    assert.equal(vm.allPhotos.length, 0);
  });

  it("handles unassigned photos by rendering a single 'All photos' section", () => {
    const vm = buildPhotoTourViewModel({
      photos: [p1, p2, p3],
      listingTitle: "Luxury Marina Penthouse",
    });

    assert.equal(vm.totalPhotos, 3);
    assert.equal(vm.sections.length, 1);
    assert.equal(vm.sections[0].id, "all_photos");
    assert.equal(vm.sections[0].title, "All photos");
    assert.equal(vm.sections[0].photos.length, 3);
    assert.equal(vm.sections[0].coverPhoto.url, p1);
    assert.equal(vm.sections[0].blocks.length, 1);
    assert.equal(vm.sections[0].blocks[0].type, "feature-right-stacked");
  });

  it("correctly groups photos by room assignments and appends unassigned photos", () => {
    const vm = buildPhotoTourViewModel({
      photos: [p1, p2, p3, p4, p5],
      photoRoomAssignments: [
        { url: p1, roomType: "LIVING_ROOM" },
        { url: p2, roomType: "LIVING_ROOM" },
        { url: p3, roomType: "BEDROOM", roomLabel: "Master Bedroom" },
        { url: p4, roomType: "BEDROOM", roomLabel: "Master Bedroom" },
        // p5 is unassigned
      ],
      amenities: ["air_conditioning", "tv", "wifi"],
    });

    assert.equal(vm.totalPhotos, 5);
    assert.equal(vm.sections.length, 3);

    // Section 1: Living room
    assert.equal(vm.sections[0].title, "Living Room");
    assert.equal(vm.sections[0].photos.length, 2);
    assert.equal(vm.sections[0].coverPhoto.url, p1);
    assert.match(vm.sections[0].details || "", /Air Conditioning/i);

    // Section 2: Master Bedroom
    assert.equal(vm.sections[1].title, "Master Bedroom");
    assert.equal(vm.sections[1].photos.length, 2);
    assert.equal(vm.sections[1].coverPhoto.url, p3);

    // Section 3: Additional unassigned
    assert.equal(vm.sections[2].title, "Additional photos");
    assert.equal(vm.sections[2].photos.length, 1);
    assert.equal(vm.sections[2].coverPhoto.url, p5);

    // Verify global indices
    assert.equal(vm.allPhotos[0].url, p1);
    assert.equal(vm.allPhotos[0].globalIndex, 0);
    assert.equal(vm.allPhotos[4].url, p5);
    assert.equal(vm.allPhotos[4].globalIndex, 4);
  });

  it("partitions arbitrary photo counts into balanced masonry blocks without orphans", () => {
    // 1 photo
    const b1 = partitionPhotosIntoBlocks([{ url: p1, globalIndex: 0, roomIndex: 0, roomId: "r", roomName: "R", id: "1" }]);
    assert.equal(b1.length, 1);
    assert.equal(b1[0].type, "single");

    // 2 photos
    const b2 = partitionPhotosIntoBlocks([
      { url: p1, globalIndex: 0, roomIndex: 0, roomId: "r", roomName: "R", id: "1" },
      { url: p2, globalIndex: 1, roomIndex: 1, roomId: "r", roomName: "R", id: "2" },
    ]);
    assert.equal(b2.length, 1);
    assert.equal(b2[0].type, "two-column");

    // 4 photos
    const b4 = partitionPhotosIntoBlocks([
      { url: p1, globalIndex: 0, roomIndex: 0, roomId: "r", roomName: "R", id: "1" },
      { url: p2, globalIndex: 1, roomIndex: 1, roomId: "r", roomName: "R", id: "2" },
      { url: p3, globalIndex: 2, roomIndex: 2, roomId: "r", roomName: "R", id: "3" },
      { url: p4, globalIndex: 3, roomIndex: 3, roomId: "r", roomName: "R", id: "4" },
    ]);
    assert.equal(b4.length, 1);
    assert.equal(b4[0].type, "two-by-two");

    // 5 photos -> 3 + 2
    const b5 = partitionPhotosIntoBlocks([
      { url: p1, globalIndex: 0, roomIndex: 0, roomId: "r", roomName: "R", id: "1" },
      { url: p2, globalIndex: 1, roomIndex: 1, roomId: "r", roomName: "R", id: "2" },
      { url: p3, globalIndex: 2, roomIndex: 2, roomId: "r", roomName: "R", id: "3" },
      { url: p4, globalIndex: 3, roomIndex: 3, roomId: "r", roomName: "R", id: "4" },
      { url: p5, globalIndex: 4, roomIndex: 4, roomId: "r", roomName: "R", id: "5" },
    ]);
    assert.equal(b5.length, 2);
    assert.equal(b5[0].type, "feature-right-stacked");
    assert.equal(b5[1].type, "two-column");

    // 7 photos -> 3 + 4
    const b7 = partitionPhotosIntoBlocks([
      { url: p1, globalIndex: 0, roomIndex: 0, roomId: "r", roomName: "R", id: "1" },
      { url: p2, globalIndex: 1, roomIndex: 1, roomId: "r", roomName: "R", id: "2" },
      { url: p3, globalIndex: 2, roomIndex: 2, roomId: "r", roomName: "R", id: "3" },
      { url: p4, globalIndex: 3, roomIndex: 3, roomId: "r", roomName: "R", id: "4" },
      { url: p5, globalIndex: 4, roomIndex: 4, roomId: "r", roomName: "R", id: "5" },
      { url: p6, globalIndex: 5, roomIndex: 5, roomId: "r", roomName: "R", id: "6" },
      { url: p7, globalIndex: 6, roomIndex: 6, roomId: "r", roomName: "R", id: "7" },
    ]);
    assert.equal(b7.length, 2);
    assert.equal(b7[0].type, "feature-right-stacked");
    assert.equal(b7[1].type, "two-by-two");
  });
});

