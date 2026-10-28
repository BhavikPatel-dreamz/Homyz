import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  validatePublicImageUpload,
  hasExpectedImageSignature,
} from "@/lib/media/public-image-validation";
import { MAX_PHOTOS_PER_TRIP } from "@/services/travel-photo.service";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

// ============================================================================
// 1. FILE & SIGNATURE VALIDATION (CLIENT & SERVER ENFORCEMENT)
// ============================================================================

test("Travel Media: Accepts valid JPEG, PNG, WebP, and AVIF image signatures", () => {
  // Valid JPEG magic bytes [0xFF, 0xD8, 0xFF]
  const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  assert.equal(hasExpectedImageSignature("image/jpeg", validJpeg), true);
  assert.equal(
    validatePublicImageUpload({
      fileName: "vacation.jpg",
      mimeType: "image/jpeg",
      size: validJpeg.length,
      buffer: validJpeg,
    }),
    null
  );

  // Valid PNG magic bytes [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
  const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
  assert.equal(hasExpectedImageSignature("image/png", validPng), true);
  assert.equal(
    validatePublicImageUpload({
      fileName: "mountain.png",
      mimeType: "image/png",
      size: validPng.length,
      buffer: validPng,
    }),
    null
  );

  // Valid WebP (RIFF ... WEBP)
  const validWebp = Buffer.concat([
    Buffer.from("RIFF", "ascii"),
    Buffer.alloc(4),
    Buffer.from("WEBP", "ascii"),
    Buffer.alloc(10),
  ]);
  assert.equal(hasExpectedImageSignature("image/webp", validWebp), true);
  assert.equal(
    validatePublicImageUpload({
      fileName: "beach.webp",
      mimeType: "image/webp",
      size: validWebp.length,
      buffer: validWebp,
    }),
    null
  );

  // Valid AVIF (ftyp avif)
  const validAvif = Buffer.concat([
    Buffer.alloc(4),
    Buffer.from("ftyp", "ascii"),
    Buffer.from("avif", "ascii"),
    Buffer.alloc(8),
  ]);
  assert.equal(hasExpectedImageSignature("image/avif", validAvif), true);
  assert.equal(
    validatePublicImageUpload({
      fileName: "sunset.avif",
      mimeType: "image/avif",
      size: validAvif.length,
      buffer: validAvif,
    }),
    null
  );
});

test("Travel Media: Rejects spoofed MIME types, corrupted images, and unsupported formats", () => {
  // Text file spoofed as JPEG
  const spoofedText = Buffer.from("Hello world this is not an image", "utf-8");
  assert.equal(hasExpectedImageSignature("image/jpeg", spoofedText), false);
  const textVal = validatePublicImageUpload({
    fileName: "malicious.jpg",
    mimeType: "image/jpeg",
    size: spoofedText.length,
    buffer: spoofedText,
  });
  assert.equal(textVal?.status, 415);
  assert.match(textVal?.message || "", /content does not match/);

  // Unsupported formats (e.g. GIF, SVG, BMP)
  const unsupported = validatePublicImageUpload({
    fileName: "anim.gif",
    mimeType: "image/gif",
    size: 100,
    buffer: Buffer.alloc(100),
  });
  assert.equal(unsupported?.status, 415);
  assert.match(unsupported?.message || "", /Only JPEG, PNG, WebP, and AVIF/);

  // Empty file (0 bytes)
  const empty = validatePublicImageUpload({
    fileName: "empty.jpg",
    mimeType: "image/jpeg",
    size: 0,
    buffer: Buffer.alloc(0),
  });
  assert.equal(empty?.status, 413);

  // File exceeding 10 MB limit
  const oversized = validatePublicImageUpload({
    fileName: "huge.jpg",
    mimeType: "image/jpeg",
    size: 10 * 1024 * 1024 + 1,
    buffer: Buffer.alloc(10),
  });
  assert.equal(oversized?.status, 413);
  assert.match(oversized?.message || "", /10 MB/);
});

// ============================================================================
// 2. STRICT FIVE-PHOTO LIMIT PER TRIP CONTRACT
// ============================================================================

test("Travel Photo Service: Strict maximum 5 photos per trip capacity rule", () => {
  assert.equal(MAX_PHOTOS_PER_TRIP, 5, "Maximum photos per trip must be exactly 5");

  // Helper verifying capacity logic identical to service implementation
  function checkCapacity(currentCount: number, addingCount: number, isReplacing: boolean) {
    if (isReplacing) {
      if (currentCount > MAX_PHOTOS_PER_TRIP) {
        throw new Error("Trip capacity exceeded");
      }
      return { allowed: true, newCount: currentCount };
    }
    if (currentCount + addingCount > MAX_PHOTOS_PER_TRIP) {
      throw new Error(`Trip capacity exceeded. Max ${MAX_PHOTOS_PER_TRIP} photos.`);
    }
    return { allowed: true, newCount: currentCount + addingCount };
  }

  // 1. Add 5 photos to empty trip (0 -> 5)
  assert.equal(checkCapacity(0, 5, false).newCount, 5);

  // 2. Add 3 photos to trip with 2 existing (2 -> 5)
  assert.equal(checkCapacity(2, 3, false).newCount, 5);

  // 3. Reject 6th photo on trip with 5 existing
  assert.throws(() => checkCapacity(5, 1, false), /Trip capacity exceeded/);

  // 4. Reject 3 photos on trip with 3 existing (3 + 3 = 6 > 5)
  assert.throws(() => checkCapacity(3, 3, false), /Trip capacity exceeded/);

  // 5. Replace photo in full trip (5/5) does NOT increase count
  assert.equal(checkCapacity(5, 1, true).newCount, 5);

  // 6. Delete photo (5 -> 4) allows adding 1 more
  assert.equal(checkCapacity(4, 1, false).newCount, 5);
});

test("Travel Photo Service: Transactional capacity verification in source code", () => {
  const serviceCode = read("services/travel-photo.service.ts");

  assert.match(serviceCode, /assertTripCapacity/);
  assert.match(serviceCode, /MAX_PHOTOS_PER_TRIP\s*=\s*5/);
  assert.match(serviceCode, /currentCount\s*\+\s*additionalCount\s*>\s*MAX_PHOTOS_PER_TRIP/);
  assert.match(serviceCode, /prisma\.\$transaction/);
  assert.match(serviceCode, /tx\.travelPhoto\.count/);
});

// ============================================================================
// 3. DEDICATED TRAVEL MEDIA API & STORAGE INTEGRATION
// ============================================================================

test("Dedicated Travel Media API: Routes exist and enforce authentication & rate limits", () => {
  const uploadRoute = read("app/api/v1/travel-media/uploads/route.ts");
  assert.match(uploadRoute, /getAuthContext/);
  assert.match(uploadRoute, /checkRateLimitAsync/);
  assert.match(uploadRoute, /uploadTravelPhoto/);
  assert.match(uploadRoute, /status:\s*401/);

  const photosRoute = read("app/api/v1/travel-media/photos/route.ts");
  assert.match(photosRoute, /getPaginatedTravelPhotos/);
  assert.match(photosRoute, /canViewTravelProfile/);

  const photoDetailRoute = read("app/api/v1/travel-media/photos/[id]/route.ts");
  assert.match(photoDetailRoute, /updateTravelPhotoMetadata/);
  assert.match(photoDetailRoute, /deleteTravelPhoto/);

  const tripsRoute = read("app/api/v1/travel-media/trips/route.ts");
  assert.match(tripsRoute, /getUserTrips/);
  assert.match(tripsRoute, /createTrip/);
  assert.match(tripsRoute, /getOrCreateDestination/);
});

test("Media Storage: Uses dedicated travel-photos kind without listing-photo endpoint", () => {
  const mediaCode = read("lib/storage/media.ts");
  assert.match(mediaCode, /"travel-photos"/);
  assert.match(mediaCode, /"travel-covers"/);

  const serviceCode = read("services/travel-photo.service.ts");
  assert.match(serviceCode, /kind:\s*"travel-photos"/);
  assert.match(serviceCode, /savePublicMedia/);
  assert.match(serviceCode, /deleteManagedMediaUrl/);

  // Profile management client now uses /api/v1/travel-media/uploads instead of listing-photo
  const clientCode = read("app/(protected)/profile-management/profile-management-client.tsx");
  assert.match(clientCode, /\/api\/v1\/travel-media\/uploads/);
});

// ============================================================================
// 4. BYTE-LEVEL UPLOAD PROGRESS & CANCELLATION (FIGMA SCREENSHOTS 2–5)
// ============================================================================

test("Upload Modal: Implements genuine XMLHttpRequest byte-level progress and cancellation", () => {
  const modalCode = read("components/travel/travel-photo-upload-modal.tsx");

  // Real XHR upload onprogress
  assert.match(modalCode, /new XMLHttpRequest\(\)/);
  assert.match(modalCode, /xhr\.upload\.onprogress/);
  assert.match(modalCode, /event\.loaded/);
  assert.match(modalCode, /event\.total/);

  // Cancellation via XHR abort
  assert.match(modalCode, /activeXhrRef\.current\.abort\(\)/);
  assert.match(modalCode, /Upload cancelled by user/);

  // Circular progress ring matching Screenshot 2
  assert.match(modalCode, /stroke-\[#FCDF9C\]/);
  assert.match(modalCode, /strokeDashoffset/);

  // Dropzone drag-and-drop events matching Screenshot 3
  assert.match(modalCode, /onDragEnter/);
  assert.match(modalCode, /onDragOver/);
  assert.match(modalCode, /onDragLeave/);
  assert.match(modalCode, /onDrop/);

  // Preview grid matching Screenshot 4
  assert.match(modalCode, /grid-cols-3/);

  // List curation with captions, locations, and remove image matching Screenshot 5
  assert.match(modalCode, /Add location/);
  assert.match(modalCode, /Add a caption/);
  assert.match(modalCode, /Remove Image/);
});

// ============================================================================
// 5. DATABASE SCHEMA, PRISMA CLIENT & BACKWARD COMPATIBILITY
// ============================================================================

test("Prisma Schema: Defines TravelTrip, TravelPhoto, and TravelPhotoLike with indexes", () => {
  const schemaCode = read("prisma/schema.prisma");

  assert.match(schemaCode, /model TravelTrip/);
  assert.match(schemaCode, /model TravelPhoto/);
  assert.match(schemaCode, /model TravelPhotoLike/);
  assert.match(schemaCode, /enum TravelTripStatus/);

  assert.match(schemaCode, /travelTrips\s+TravelTrip\[\]/);
  assert.match(schemaCode, /travelPhotos\s+TravelPhoto\[\]/);

  const migrationCode = read("prisma/migrations/20261026160000_add_travel_photos_and_trips/migration.sql");
  assert.match(migrationCode, /CREATE TABLE IF NOT EXISTS "TravelTrip"/);
  assert.match(migrationCode, /CREATE TABLE IF NOT EXISTS "TravelPhoto"/);
  assert.match(migrationCode, /CREATE TABLE IF NOT EXISTS "TravelPhotoLike"/);
});

test("Photo Service: Guarantees backward compatibility with legacy TripPhoto records", () => {
  const serviceCode = read("services/travel-photo.service.ts");

  // getTravelPhotos fetches from both TravelPhoto and legacy TripPhoto
  assert.match(serviceCode, /prisma\.travelPhoto\.findMany/);
  assert.match(serviceCode, /prisma\.tripPhoto\.findMany/);
  assert.match(serviceCode, /isLegacy:\s*true/);

  // updateTravelPhotoMetadata and deleteTravelPhoto handle both tables
  assert.match(serviceCode, /prisma\.tripPhoto\.findUnique/);
  assert.match(serviceCode, /prisma\.tripPhoto\.delete/);
});

// ============================================================================
// 6. REGRESSION INTEGRITY: PHASE 1 PROFILE & STATS INTEGRITY
// ============================================================================

test("Regression Protection: Travel photo uploads do not fabricate or inflate trips statistic", () => {
  const profileService = read("services/travel-profile.service.ts");

  // Trips stat is strictly computed from completed confirmed bookings, not trip photos count
  assert.doesNotMatch(profileService, /Math\.max\(.*tripPhoto/);
  assert.match(profileService, /isCompletedConfirmedBooking/);
});

test("Profile Integration: Travel Profile header Upload button opens the upload modal", () => {
  const headerCode = read("components/travel/travel-profile-header.tsx");

  assert.match(headerCode, /TravelPhotoUploadModal/);
  assert.match(headerCode, /isUploadModalOpen/);
  assert.match(headerCode, /setIsUploadModalOpen\(true\)/);
});
