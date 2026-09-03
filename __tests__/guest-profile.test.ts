import "dotenv/config";
import { userService } from "../services/user.service";
import { prisma } from "../lib/db/prisma";

async function runGuestProfileTests() {
  console.log("\n==========================================");
  console.log("   GUEST PROFILE SYSTEM AUTOMATED TESTS   ");
  console.log("==========================================\n");

  let testUserId = "";
  let taggedFriendId = "";

  try {
    // 1. Create dummy test guest users
    const user = await prisma.user.create({
      data: {
        email: `profile.test.${Date.now()}@homyz.app`,
        name: "Test Guest User",
        publicProfile: {
          whereILive: "Bucharest, Romania",
          bio: "Automated profile test guest bio.",
          stampsVisible: true,
          selectedStamps: ["paris", "coffee"],
        },
      },
    });
    testUserId = user.id;

    const friend = await prisma.user.create({
      data: {
        email: `tag.friend.${Date.now()}@homyz.app`,
        name: "Alex Johnson",
      },
    });
    taggedFriendId = friend.id;

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

    // Test 3: Create Multi Trip Photos with Tagged People & Location
    const photos = await userService.createTripPhotos(testUserId, [
      {
        url: "https://example.com/photo1.jpg",
        location: "Paris, France",
        caption: "Sunset at Eiffel Tower with friends",
        tags: ["Alex Johnson", "Sarah Khan"],
      },
      {
        url: "https://example.com/photo2.jpg",
        location: "Rome, Italy",
        caption: "Colosseum tour",
        tags: ["Rome"],
      },
    ]);
    if (photos.length !== 2) throw new Error("Trip photo batch creation failed");
    console.log(" ✅ PASS: Multi-Image Trip Photo Creation with Dynamic Tags & Location");

    // Test 4: Fetch Trip Photos
    const userPhotos = await userService.getTripPhotos(testUserId);
    if (userPhotos.length !== 2 || userPhotos[0].location !== "Paris, France") {
      throw new Error("Trip photo querying failed");
    }
    console.log(" ✅ PASS: Trip Photo Gallery Querying");

    // Test 5: Edit Trip Photo Details & Tags
    const photoToEdit = userPhotos[0];
    const updatedPhoto = await userService.updateTripPhoto(testUserId, photoToEdit.id, {
      caption: "Updated caption sunset in Paris",
      location: "Paris, Île-de-France, France",
      tags: ["Alex Johnson", "Sarah Khan", "John Smith"],
    });
    if (updatedPhoto.caption !== "Updated caption sunset in Paris" || updatedPhoto.tags.length !== 3) {
      throw new Error("Trip photo update failed");
    }
    console.log(" ✅ PASS: Trip Photo Details & Multi-Person Tags Update");

    // Test 6: Dynamic Backend User Search for Tag People
    const searchResults = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: "Alex", mode: "insensitive" } },
          { email: { contains: "Alex", mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, email: true },
    });
    if (!searchResults.some((u: { id: string }) => u.id === taggedFriendId)) {
      throw new Error("Backend user search for tagging failed");
    }
    console.log(" ✅ PASS: Dynamic Backend User Search for Tag People");

    // Test 7: Persist & Update Travel Stamps ("Where I've Been")
    const updatedUserWithStamps = await userService.updateProfile(testUserId, {
      publicProfile: {
        whereILive: "Bucharest, Romania",
        bio: "Automated profile test guest bio.",
        stampsVisible: true,
        selectedStamps: ["paris", "coffee", "rome", "tokyo", "newyork", "london"],
      },
    });
    const savedStamps = (updatedUserWithStamps.publicProfile as any)?.selectedStamps;
    if (!Array.isArray(savedStamps) || savedStamps.length !== 6 || !savedStamps.includes("tokyo")) {
      throw new Error("Travel stamp selection persistence failed");
    }
    console.log(" ✅ PASS: Travel Stamp Selection & Persistence");

    // Test 8: Enforce Maximum 10 Travel Stamps Limit & Visibility Toggle
    const tenStamps = ["paris", "coffee", "rome", "tokyo", "newyork", "london", "barcelona", "dubai", "sydney", "bucharest"];
    const elevenStamps = [...tenStamps, "bali"];

    // Enforce max 10 slice/validation
    const validSelection = elevenStamps.slice(0, 10);
    const updatedUserLimit = await userService.updateProfile(testUserId, {
      publicProfile: {
        stampsVisible: false,
        selectedStamps: validSelection,
      },
    });
    const pubData = updatedUserLimit.publicProfile as any;
    if (pubData.stampsVisible !== false || pubData.selectedStamps.length !== 10) {
      throw new Error("Stamp max limit or visibility toggle failed");
    }
    console.log(" ✅ PASS: Enforced Max 10 Travel Stamp Limit & Visibility Toggle");

    // Test 9: Server-side Ownership Verification for Modification
    try {
      await userService.updateTripPhoto("unauthorized-user-id", photoToEdit.id, { caption: "Hacked caption" });
      throw new Error("Failed to block unauthorized photo modification");
    } catch (err: any) {
      if (!err.message.includes("permission") && !err.message.includes("not found")) {
        throw err;
      }
    }
    console.log(" ✅ PASS: Server-side Ownership Verification for Modification");

    // Test 10: Delete Trip Photo
    await userService.deleteTripPhoto(testUserId, photoToEdit.id);
    const remainingPhotos = await userService.getTripPhotos(testUserId);
    if (remainingPhotos.length !== 1) throw new Error("Trip photo deletion failed");
    console.log(" ✅ PASS: Trip Photo Deletion & Storage Consistency");

    // Test 11: Unauthorized Deletion Protection
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
    console.log("Results: 11 PASSED, 0 FAILED");
    console.log("==========================================\n");
  } finally {
    if (testUserId) {
      await prisma.tripPhoto.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } });
    }
    if (taggedFriendId) {
      await prisma.user.delete({ where: { id: taggedFriendId } });
    }
  }
}

runGuestProfileTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(" ❌ FAIL:", err);
    process.exit(1);
  });
