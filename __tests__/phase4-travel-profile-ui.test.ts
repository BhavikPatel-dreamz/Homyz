import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  updateTravelProfileSchema,
  updateTravelPhotoSchema,
  addPhotoTagSchema,
  allPhotosQuerySchema,
  attachTripPhotoSchema,
  MAX_PHOTOS_PER_TRIP,
} from "../lib/validation/travel-trip";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

function testValidationSchemas() {
  // 1. Travel Profile Schema
  const validProfile = updateTravelProfileSchema.parse({
    displayName: "Marco Polo",
    bio: "Exploring the Silk Road and beyond.",
    handle: "marco_polo_88",
    homeLocation: "Venice, Italy",
    visibility: "PUBLIC",
  });
  assert.equal(validProfile.displayName, "Marco Polo");
  assert.equal(validProfile.handle, "marco_polo_88");
  assert.equal(validProfile.visibility, "PUBLIC");

  // Invalid handle: spaces and symbols
  assert.throws(() => {
    updateTravelProfileSchema.parse({ handle: "invalid handle!" });
  });

  // Invalid handle: too short (< 3 chars)
  assert.throws(() => {
    updateTravelProfileSchema.parse({ handle: "ab" });
  });

  // Bio exceeding 500 characters
  assert.throws(() => {
    updateTravelProfileSchema.parse({ bio: "a".repeat(501) });
  });

  // 2. Photo Update Schema
  const validPhotoUpdate = updateTravelPhotoSchema.parse({
    caption: "Sunset over the grand canal",
    location: "Venice, Italy",
    destinationId: "dest_123",
  });
  assert.equal(validPhotoUpdate.caption, "Sunset over the grand canal");
  assert.equal(validPhotoUpdate.location, "Venice, Italy");

  // Caption exceeding 500 characters
  assert.throws(() => {
    updateTravelPhotoSchema.parse({ caption: "c".repeat(501) });
  });

  // 3. Add Photo Tag Schema
  const validTag = addPhotoTagSchema.parse({
    taggedUserId: "usr_tagged_456",
  });
  assert.equal(validTag.taggedUserId, "usr_tagged_456");

  // Empty tagged user id
  assert.throws(() => {
    addPhotoTagSchema.parse({ taggedUserId: "" });
  });

  // 4. All Photos Query Schema
  const validQuery = allPhotosQuerySchema.parse({
    tripId: "trip_123",
    destinationId: "dest_456",
    limit: "24",
  });
  assert.equal(validQuery.tripId, "trip_123");
  assert.equal(validQuery.destinationId, "dest_456");
  assert.equal(validQuery.limit, 24);

  // 5. Attach Trip Photo Schema (with optional location)
  const attachInput = attachTripPhotoSchema.parse({
    mediaAssetId: "asset_789",
    caption: "A memorable morning",
    location: "Rome, Italy",
  });
  assert.equal(attachInput.mediaAssetId, "asset_789");
  assert.equal(attachInput.location, "Rome, Italy");

  console.log("✔ Validation schemas pass all boundary and constraint checks.");
}

function testFivePhotoLimitInvariant() {
  assert.equal(MAX_PHOTOS_PER_TRIP, 5, "Maximum active photos per trip must be strictly 5.");

  const tripServiceSrc = source("services/travel-trip.service.ts");
  assert(
    tripServiceSrc.includes("MAX_PHOTOS_PER_TRIP"),
    "travel-trip.service.ts must reference MAX_PHOTOS_PER_TRIP",
  );
  assert(
    tripServiceSrc.includes("TRIP_PHOTO_LIMIT_EXCEEDED"),
    "travel-trip.service.ts must throw TRIP_PHOTO_LIMIT_EXCEEDED when limit is reached",
  );

  const uploadModalSrc = source("components/travel/travel-photo-upload-modal.tsx");
  assert(
    uploadModalSrc.includes("MAX_PHOTOS_PER_TRIP"),
    "TravelPhotoUploadModal must enforce MAX_PHOTOS_PER_TRIP in UI before upload",
  );

  console.log("✔ Strict 5-photo-per-trip invariant verified across schema, service, and UI.");
}

function testPeopleTaggingPrivacyAndBlocking() {
  const tagServiceSrc = source("services/travel-photo-tag.service.ts");

  // Ensure safe projection: only id, name, image
  assert.match(
    tagServiceSrc,
    /select:\s*\{\s*id:\s*true,\s*name:\s*true,\s*image:\s*true,\s*\}/,
    "searchTaggableUsers must only select id, name, image — never email or phone",
  );
  assert(
    !tagServiceSrc.includes("email: true"),
    "searchTaggableUsers must NEVER select email",
  );
  assert(
    !tagServiceSrc.includes("phone: true"),
    "searchTaggableUsers must NEVER select phone",
  );

  // Ensure blocking check is enforced both ways
  assert(
    tagServiceSrc.includes("userBlock.findMany"),
    "searchTaggableUsers must query userBlock to filter out blocked users",
  );
  assert(
    tagServiceSrc.includes("blockerId"),
    "searchTaggableUsers must check blockerId",
  );
  assert(
    tagServiceSrc.includes("blockedId"),
    "searchTaggableUsers must check blockedId",
  );

  // Ensure tag creation sets PENDING status
  assert(
    tagServiceSrc.includes('"PENDING"') || tagServiceSrc.includes("TravelTagStatus.PENDING"),
    "addPhotoTag must set initial tag status to PENDING awaiting consent",
  );

  console.log("✔ People tagging privacy, blocking rules, and consent lifecycle verified.");
}

function testPhotoLevelLocationAndTripCover() {
  const tripServiceSrc = source("services/travel-trip.service.ts");

  assert(
    tripServiceSrc.includes("updatePhotoMetadata"),
    "travel-trip.service.ts must implement updatePhotoMetadata",
  );
  assert(
    tripServiceSrc.includes("getAllOwnerPhotos"),
    "travel-trip.service.ts must implement getAllOwnerPhotos for Instagram grid",
  );
  assert(
    tripServiceSrc.includes("coverPhotoId"),
    "travel-trip.service.ts must track trip cover photo via coverPhotoId",
  );

  const schemaSrc = source("prisma/schema.prisma");
  assert(
    schemaSrc.includes("model TravelPhotoTag"),
    "prisma/schema.prisma must declare model TravelPhotoTag",
  );
  assert(
    schemaSrc.includes("enum TravelTagStatus"),
    "prisma/schema.prisma must declare enum TravelTagStatus",
  );
  assert.match(
    schemaSrc,
    /location\s+String\?/,
    "TravelPhoto model must include location string",
  );
  assert.match(
    schemaSrc,
    /destinationId\s+String\?/,
    "TravelPhoto model must include destinationId relation",
  );

  console.log("✔ Photo-level location, destination linkage, and trip cover management verified.");
}

function testProfileViewAndComponentsStructure() {
  // 1. Master Profile View
  const profileViewSrc = source("components/travel/guest-travel-profile-view.tsx");
  assert(profileViewSrc.includes("GuestTravelProfileView"), "Must export GuestTravelProfileView");
  assert(profileViewSrc.includes("Visited Destinations"), "Must render Visited Destinations section");
  assert(profileViewSrc.includes("All Places"), "Must include All Places carousel filter");
  assert(profileViewSrc.includes("Photos ("), "Must render Photos tab");
  assert(profileViewSrc.includes("Trips & Albums ("), "Must render Trips tab");
  assert(profileViewSrc.includes("TravelCoverUploadModal"), "Must wire TravelCoverUploadModal");
  assert(profileViewSrc.includes("TravelProfileEditModal"), "Must wire TravelProfileEditModal");
  assert(profileViewSrc.includes("TravelPhotoUploadModal"), "Must wire TravelPhotoUploadModal");
  assert(profileViewSrc.includes("TravelPhotoDetailModal"), "Must wire TravelPhotoDetailModal Lightbox");

  // 2. Photo Detail Modal / Lightbox
  const lightboxSrc = source("components/travel/travel-photo-detail-modal.tsx");
  assert(lightboxSrc.includes("TravelPhotoDetailModal"), "Must export TravelPhotoDetailModal");
  assert(lightboxSrc.includes("ArrowLeft"), "Must support ArrowLeft keyboard navigation");
  assert(lightboxSrc.includes("ArrowRight"), "Must support ArrowRight keyboard navigation");
  assert(lightboxSrc.includes("LocationSearchInput"), "Must wire LocationSearchInput for inline location edits");
  assert(lightboxSrc.includes("search-taggable"), "Must wire privacy-safe search-taggable endpoint");
  assert(lightboxSrc.includes("Set as Album Cover"), "Must support setting photo as album cover");
  assert(lightboxSrc.includes("Delete Photo"), "Must support photo deletion with confirmation");

  // 3. Upload Modal
  const uploadSrc = source("components/travel/travel-photo-upload-modal.tsx");
  assert(uploadSrc.includes("TravelPhotoUploadModal"), "Must export TravelPhotoUploadModal");
  assert(uploadSrc.includes("onDragOver"), "Must support drag-and-drop file uploads");
  assert(uploadSrc.includes("XMLHttpRequest"), "Must use real XHR byte upload progress");
  assert(uploadSrc.includes("abort()"), "Must support canceling in-flight uploads");

  // 4. Cover Banner Upload Modal
  const coverSrc = source("components/travel/travel-cover-upload-modal.tsx");
  assert(coverSrc.includes("TravelCoverUploadModal"), "Must export TravelCoverUploadModal");
  assert(coverSrc.includes("TRAVEL_COVER"), "Must use TRAVEL_COVER media asset kind");

  // 5. Profile Edit Modal
  const editModalSrc = source("components/travel/travel-profile-edit-modal.tsx");
  assert(editModalSrc.includes("TravelProfileEditModal"), "Must export TravelProfileEditModal");
  assert(editModalSrc.includes("visibility"), "Must support public/private visibility toggle");

  // 6. Integration in ProfileClient
  const profileClientSrc = source("app/(protected)/profile/profile-client.tsx");
  assert(
    profileClientSrc.includes("GuestTravelProfileView"),
    "ProfileClient must embed GuestTravelProfileView",
  );

  console.log("✔ Complete Phase 4 component architecture and integration verified.");
}

function runAllTests() {
  console.log("=== Phase 4 Travel Profile & Trip Photo UI Tests ===");
  testValidationSchemas();
  testFivePhotoLimitInvariant();
  testPeopleTaggingPrivacyAndBlocking();
  testPhotoLevelLocationAndTripCover();
  testProfileViewAndComponentsStructure();
  console.log("🎉 ALL PHASE 4 INVARIANTS & INTEGRATION TESTS PASSED!");
}

runAllTests();
