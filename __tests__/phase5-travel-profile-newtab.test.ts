import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/db/prisma";
import { travelSocialLikesService } from "../services/travel-social-likes.service";
import { travelStampService } from "../services/travel-stamp.service";
import { MAX_PHOTOS_PER_TRIP } from "../lib/validation/travel-trip";

function source(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

async function testNavigationAndNewTabRequirements() {
  console.log("▶ Testing Navigation & New Tab Requirements...");

  // 1. AppHeader Dropdown Menu includes "My Travel Profile" with target="_blank"
  const appHeaderContent = source("components/dashboard/app-header.tsx");
  assert.ok(
    appHeaderContent.includes("My Travel Profile"),
    "app-header.tsx must contain 'My Travel Profile' menu item",
  );
  assert.ok(
    appHeaderContent.includes('href="/travel-profile"'),
    "app-header.tsx must link to '/travel-profile'",
  );
  assert.ok(
    appHeaderContent.includes('target="_blank"') &&
      appHeaderContent.includes('rel="noopener noreferrer"'),
    "app-header.tsx link must use standard accessible target='_blank' rel='noopener noreferrer'",
  );

  // 2. Original /profile is not overwritten and includes access link
  const profileClientContent = source("app/(protected)/profile/profile-client.tsx");
  assert.ok(
    profileClientContent.includes('href="/travel-profile"'),
    "profile-client.tsx must provide entry point to '/travel-profile'",
  );
  assert.ok(
    profileClientContent.includes('target="_blank"'),
    "profile-client.tsx entry point must open in a new browser tab",
  );

  // 3. Dedicated /travel-profile route exists
  const travelProfilePage = source("app/(protected)/travel-profile/page.tsx");
  assert.ok(
    travelProfilePage.includes("GuestTravelProfileView"),
    "travel-profile/page.tsx must render GuestTravelProfileView",
  );
  assert.ok(
    travelProfilePage.includes("requirePageUser"),
    "travel-profile/page.tsx must enforce authenticated user requirement",
  );

  // 4. Public route /travelers/[handle] exists
  const publicTravelerPage = source("app/travelers/[handle]/page.tsx");
  assert.ok(
    publicTravelerPage.includes("isPublic"),
    "public traveler profile must enforce privacy check",
  );
  assert.ok(
    publicTravelerPage.includes("userBlock"),
    "public traveler profile must enforce mutual blocking policy",
  );

  console.log("✔ Navigation & New Tab requirements verified.");
}

async function testTravelStampsService() {
  console.log("▶ Testing Travel Stamps Service...");

  // Ensure catalog
  await travelStampService.ensureCatalog();

  const parisStamp = await prisma.travelStamp.findUnique({
    where: { slug: "paris" },
  });
  assert.ok(parisStamp, "Paris sketch stamp must exist in catalog");
  assert.equal(parisStamp.category, "DESTINATION");
  assert.ok(parisStamp.imageUrl.includes("paris-stamp.svg"));

  const coffeeStamp = await prisma.travelStamp.findUnique({
    where: { slug: "coffee" },
  });
  assert.ok(coffeeStamp, "Coffee sketch stamp must exist in catalog");
  assert.equal(coffeeStamp.category, "LIFESTYLE");
  assert.ok(coffeeStamp.imageUrl.includes("coffee-stamp.svg"));

  // Create temporary test user
  const testUser = await prisma.user.create({
    data: {
      email: `stamp_test_${Date.now()}@homyz-unit.com`,
      name: "Stamp Tester",
    },
  });

  const profile = await prisma.travelProfile.create({
    data: {
      userId: testUser.id,
      handle: `stamptester_${Date.now()}`,
      stampsVisible: true,
    },
  });

  try {
    // Initial fetch auto-awards default Paris & Coffee
    const userStampsResult = await travelStampService.getUserStamps(testUser.id);
    assert.ok(userStampsResult.stamps.length >= 2, "User should have at least 2 catalog stamps");
    assert.equal(userStampsResult.stampsVisible, true);

    const parisUserStamp = userStampsResult.stamps.find((s) => s.slug === "paris");
    assert.ok(parisUserStamp?.isEarned, "Paris stamp should be earned by default");

    // Toggle individual stamp display off
    const toggledOff = await travelStampService.toggleStampDisplay(testUser.id, parisStamp.id, false);
    assert.equal(toggledOff.isDisplayed, false);

    // Toggle individual stamp display on
    const toggledOn = await travelStampService.toggleStampDisplay(testUser.id, parisStamp.id, true);
    assert.equal(toggledOn.isDisplayed, true);

    // Profile-level stamps visibility switch
    const visibilityUpdated = await travelStampService.setProfileStampsVisibility(testUser.id, false);
    assert.equal(visibilityUpdated.stampsVisible, false);

    const checkProfile = await prisma.travelProfile.findUnique({
      where: { id: profile.id },
      select: { stampsVisible: true },
    });
    assert.equal(checkProfile?.stampsVisible, false);
  } finally {
    await prisma.userTravelStamp.deleteMany({ where: { userId: testUser.id } });
    await prisma.travelProfile.delete({ where: { id: profile.id } });
    await prisma.user.delete({ where: { id: testUser.id } });
  }

  console.log("✔ Travel Stamps Service verified.");
}

async function testSocialLikesService() {
  console.log("▶ Testing Social Likes Service (Profiles & Pictures)...");

  // Create two distinct users
  const userA = await prisma.user.create({
    data: {
      email: `like_actor_${Date.now()}@homyz-unit.com`,
      name: "Actor User",
    },
  });

  const userB = await prisma.user.create({
    data: {
      email: `like_target_${Date.now()}@homyz-unit.com`,
      name: "Target User",
    },
  });

  const profileB = await prisma.travelProfile.create({
    data: {
      userId: userB.id,
      handle: `traveler_b_${Date.now()}`,
    },
  });

  // Create a trip and a photo for user B
  const tripB = await prisma.travelTrip.create({
    data: {
      userId: userB.id,
      title: "Venice Vacation",
    },
  });

  const mediaB = await prisma.travelMediaAsset.create({
    data: {
      ownerId: userB.id,
      storageProvider: "LOCAL",
      storageKey: `travel_photo_${Date.now()}.webp`,
      originalFileName: "photo.webp",
      mimeType: "image/webp",
      fileSize: 1024,
      width: 800,
      height: 600,
      mediaType: "TRAVEL_PHOTO",
    },
  });

  const photoB = await prisma.travelPhoto.create({
    data: {
      userId: userB.id,
      tripId: tripB.id,
      mediaAssetId: mediaB.id,
      caption: "Gondola ride",
      location: "Venice",
    },
  });

  try {
    // 1. Self-like prevention
    await assert.rejects(
      () => travelSocialLikesService.toggleProfileLike(userB.id, profileB.id),
      (err: any) => err.message.includes("cannot like your own"),
      "Should prevent liking your own profile",
    );

    // 2. Profile like toggle (User A likes Profile B)
    const likeResult = await travelSocialLikesService.toggleProfileLike(userA.id, profileB.id);
    assert.equal(likeResult.liked, true, "Profile like should be set to true");
    assert.equal(likeResult.likeCount, 1, "Profile like count should be 1");

    // Check status
    const statusA = await travelSocialLikesService.getProfileLikeStatus(userA.id, profileB.id);
    assert.equal(statusA.liked, true);
    assert.equal(statusA.likeCount, 1);

    // Idempotent unlike
    const unlikeResult = await travelSocialLikesService.toggleProfileLike(userA.id, profileB.id);
    assert.equal(unlikeResult.liked, false, "Second toggle unlikes profile");
    assert.equal(unlikeResult.likeCount, 0, "Profile like count should decrease to 0");

    // Relike for list testing
    await travelSocialLikesService.toggleProfileLike(userA.id, profileB.id);

    // 3. Photo like toggle (User A likes Photo B)
    const photoLikeResult = await travelSocialLikesService.togglePhotoLike(userA.id, photoB.id);
    assert.equal(photoLikeResult.liked, true);
    assert.equal(photoLikeResult.likeCount, 1);

    const photoStatus = await travelSocialLikesService.getPhotoLikeStatus(userA.id, photoB.id);
    assert.equal(photoStatus.liked, true);

    // 4. Dual category retrieval
    const likedProfiles = await travelSocialLikesService.getUserLikedProfiles(userA.id);
    assert.equal(likedProfiles.items.length, 1);
    assert.equal(likedProfiles.items[0].profileId, profileB.id);

    const likedPhotos = await travelSocialLikesService.getUserLikedPhotos(userA.id);
    assert.equal(likedPhotos.items.length, 1);
    assert.equal(likedPhotos.items[0].photoId, photoB.id);

    // 5. Aggregate received likes counter for User B
    const totalReceivedB = await travelSocialLikesService.getTotalReceivedLikes(userB.id);
    assert.equal(totalReceivedB, 2, "User B received 1 profile like + 1 photo like = 2");

    // 6. Mutual blocking prevention
    await prisma.userBlock.create({
      data: {
        blockerId: userB.id,
        blockedId: userA.id,
      },
    });

    await assert.rejects(
      () => travelSocialLikesService.toggleProfileLike(userA.id, profileB.id),
      (err: any) => err.status === 403 || err.code === "FORBIDDEN",
      "Mutual block must forbid like interaction",
    );
  } finally {
    await prisma.userBlock.deleteMany({ where: { blockerId: userB.id } });
    await prisma.travelPhotoLike.deleteMany({ where: { photoId: photoB.id } });
    await prisma.travelProfileLike.deleteMany({ where: { profileId: profileB.id } });
    await prisma.travelPhoto.delete({ where: { id: photoB.id } });
    await prisma.travelTrip.delete({ where: { id: tripB.id } });
    await prisma.travelMediaAsset.delete({ where: { id: mediaB.id } }).catch(() => {});
    await prisma.travelProfile.delete({ where: { id: profileB.id } });
    await prisma.user.delete({ where: { id: userA.id } });
    await prisma.user.delete({ where: { id: userB.id } });
  }

  console.log("✔ Social Likes Service verified.");
}

async function testUploadModalAndCapacityConstraints() {
  console.log("▶ Testing Upload Modal & 5-Photo Limit...");

  assert.equal(MAX_PHOTOS_PER_TRIP, 5, "MAX_PHOTOS_PER_TRIP must be 5");

  const uploadModalCode = source("components/travel/travel-photo-upload-modal.tsx");
  assert.ok(
    uploadModalCode.includes("You can upload"),
    "Upload modal must include heading 'You can upload best 5 images of your trip'",
  );
  assert.ok(
    uploadModalCode.includes("Drop files here"),
    "Upload modal must include empty state dropzone matching Screenshot 3",
  );
  assert.ok(
    uploadModalCode.includes("overallProgress"),
    "Upload modal must compute real overall progress percentage",
  );
  assert.ok(
    uploadModalCode.includes("Cancel"),
    "Upload modal must support cancel action",
  );

  console.log("✔ Upload Modal & Capacity Constraints verified.");
}

async function runAll() {
  console.log("=================================================");
  console.log("PHASE 5 TRAVEL PROFILE SUITE: VERIFYING WORK");
  console.log("=================================================");
  await testNavigationAndNewTabRequirements();
  await testTravelStampsService();
  await testSocialLikesService();
  await testUploadModalAndCapacityConstraints();
  console.log("=================================================");
  console.log("ALL PHASE 5 TESTS PASSED SUCCESSFULLY! 🎉");
  console.log("=================================================");
}

runAll().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});

