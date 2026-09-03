import "dotenv/config";
import { userService } from "../services/user.service";
import { prisma } from "../lib/db/prisma";

async function runGuestProfileTests() {
  console.log("\n==========================================");
  console.log("   GUEST PROFILE SYSTEM AUTOMATED TESTS   ");
  console.log("==========================================\n");

  let testUserId = "";

  try {
    // 1. Create a dummy test guest user
    const user = await prisma.user.create({
      data: {
        email: `profile.test.${Date.now()}@homyz.app`,
        name: "Test Guest User",
        publicProfile: {
          whereILive: "Bucharest, Romania",
          bio: "Automated profile test guest bio.",
          stampsVisible: true,
        },
      },
    });
    testUserId = user.id;

    // Test 1: Fetch Profile & Verify Public Info
    const profile = await userService.getById(testUserId);
    if (profile.id !== testUserId || profile.name !== "Test Guest User") {
      throw new Error("Profile retrieval failed");
    }
    console.log(" ✅ PASS: Public Profile Retrieval & Field Mapping");

    // Test 2: User Stats Initial State
    const initialStats = await userService.getUserStats(testUserId);
    if (typeof initialStats.trips !== "number" || typeof initialStats.likes !== "number") {
      throw new Error("Stats calculation failed");
    }
    console.log(" ✅ PASS: Dynamic Profile Statistics Calculation");

    // Test 3: Create Multi Trip Photos
    const photos = await userService.createTripPhotos(testUserId, [
      { url: "https://example.com/photo1.jpg", location: "Paris, France", caption: "Sunset at Eiffel", tags: ["alex", "paris"] },
      { url: "https://example.com/photo2.jpg", location: "Rome, Italy", caption: "Colosseum tour", tags: ["rome"] },
    ]);
    if (photos.length !== 2) throw new Error("Trip photo batch creation failed");
    console.log(" ✅ PASS: Multi-Image Trip Photo Creation");

    // Test 4: Fetch Trip Photos
    const userPhotos = await userService.getTripPhotos(testUserId);
    if (userPhotos.length !== 2 || userPhotos[0].location !== "Paris, France") {
      throw new Error("Trip photo querying failed");
    }
    console.log(" ✅ PASS: Trip Photo Gallery Querying");

    // Test 5: Edit Trip Photo Details
    const photoToEdit = userPhotos[0];
    const updatedPhoto = await userService.updateTripPhoto(testUserId, photoToEdit.id, {
      caption: "Updated caption sunset",
      tags: ["alex", "paris", "sunset"],
    });
    if (updatedPhoto.caption !== "Updated caption sunset" || updatedPhoto.tags.length !== 3) {
      throw new Error("Trip photo update failed");
    }
    console.log(" ✅ PASS: Trip Photo Details & Tags Update");

    // Test 6: Unauthorized Modification Protection
    try {
      await userService.updateTripPhoto("unauthorized-user-id", photoToEdit.id, { caption: "Hacked caption" });
      throw new Error("Failed to block unauthorized photo modification");
    } catch (err: any) {
      if (!err.message.includes("permission") && !err.message.includes("not found")) {
        throw err;
      }
    }
    console.log(" ✅ PASS: Server-side Ownership Verification for Modification");

    // Test 7: Delete Trip Photo
    await userService.deleteTripPhoto(testUserId, photoToEdit.id);
    const remainingPhotos = await userService.getTripPhotos(testUserId);
    if (remainingPhotos.length !== 1) throw new Error("Trip photo deletion failed");
    console.log(" ✅ PASS: Trip Photo Deletion & Storage Consistency");

    // Test 8: Unauthorized Deletion Protection
    try {
      await userService.deleteTripPhoto("unauthorized-user-id", remainingPhotos[0].id);
      throw new Error("Failed to block unauthorized photo deletion");
    } catch (err: any) {
      if (!err.message.includes("permission") && !err.message.includes("not found")) {
        throw err;
      }
    }
    console.log(" ✅ PASS: Server-side Ownership Verification for Deletion");

    console.log("\n------------------------------------------");
    console.log("Results: 8 PASSED, 0 FAILED");
    console.log("==========================================\n");
  } finally {
    if (testUserId) {
      await prisma.tripPhoto.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } });
    }
  }
}

runGuestProfileTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(" ❌ FAIL:", err);
    process.exit(1);
  });
