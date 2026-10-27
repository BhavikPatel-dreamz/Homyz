import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/lib/db/prisma";
import {
  listAdminTravelStamps,
  createAdminTravelStamp,
  updateAdminTravelStamp,
  toggleAdminTravelStampActive,
  archiveAdminTravelStamp,
  deleteAdminTravelStamp,
  getTravelerStamps,
  getTravelStampPickerItems,
  addTravelStampSelections,
  removeTravelStamp,
  setStampsSectionVisibility,
  ensureStampCatalog,
} from "@/services/travel-stamp.service";

test("Admin-Managed Travel Stamp & Badge Collection System — Comprehensive E2E", async (t) => {
  // Ensure default catalog is populated
  await ensureStampCatalog();

  // Create two distinct test users: Guest A and Guest B
  const userA = await prisma.user.create({
    data: {
      email: `test_traveler_a_${Date.now()}@homyz-test.com`,
      name: "Traveler Alice",
    },
  });

  const userB = await prisma.user.create({
    data: {
      email: `test_traveler_b_${Date.now()}@homyz-test.com`,
      name: "Traveler Bob",
    },
  });

  t.after(async () => {
    // Clean up test data
    await prisma.userTravelStamp.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    });
    await prisma.travelProfile.deleteMany({
      where: { userId: { in: [userA.id, userB.id] } },
    });
    await prisma.travelStamp.deleteMany({
      where: { slug: { startsWith: "stamp-e2e-" } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [userA.id, userB.id] } },
    });
  });

  let createdStampId = "";
  const stampName = `e2e-paris-${Date.now()}`;

  await t.test("1. Admin creates a new custom travel stamp with custom artwork", async () => {
    const stamp = await createAdminTravelStamp({
      displayName: stampName,
      title: "Paris Explorer E2E",
      city: "Paris",
      country: "France",
      countryCode: "FR",
      description: "Unique Paris/Eiffel Tower travel stamp image",
      category: "CITY",
      iconUrl: "/uploads/stamp-icons/stamp_1788426489452_bz1kfx.png",
      displayOrder: 99,
      isActive: true,
    });

    assert.ok(stamp.id, "Stamp should have an id");
    assert.equal(stamp.displayName, stampName);
    assert.equal(stamp.title, "Paris Explorer E2E");
    assert.equal(stamp.city, "Paris");
    assert.equal(stamp.country, "France");
    assert.equal(stamp.isActive, true);
    createdStampId = stamp.id;
  });

  await t.test("2. Stamp appears in Admin Travel Stamp list with filtering and collector count", async () => {
    const list = await listAdminTravelStamps({
      search: stampName,
      status: "ACTIVE",
    });

    const found = list.find((s) => s.id === createdStampId);
    assert.ok(found, "Stamp should be found in admin listing");
    assert.equal(found.collectorCount, 0, "Initially collector count is 0");
    assert.equal(found.city, "Paris");
  });

  await t.test("3. Admin can update stamp details and replace artwork", async () => {
    const updated = await updateAdminTravelStamp(createdStampId, {
      title: "Paris Explorer Deluxe",
      description: "Updated description for Paris explorer",
      displayOrder: 100,
    });

    assert.equal(updated.title, "Paris Explorer Deluxe");
    assert.equal(updated.displayOrder, 100);
  });

  await t.test("4. Guest A browses destination stamps and sees the admin-created stamp", async () => {
    const pickerItems = await getTravelStampPickerItems(userA.id, stampName);
    const item = pickerItems.find((p) => p.id === createdStampId);

    assert.ok(item, "Guest A should see the active admin stamp in the picker");
    assert.equal(item.isAlreadyCollected, false, "Should not be collected yet");
    assert.equal(item.displayName, "Paris Explorer Deluxe");
  });

  await t.test("5. Guest A selects the stamp and it appears under 'Where I've Been'", async () => {
    const collected = await addTravelStampSelections(userA.id, {
      catalogStampIds: [createdStampId],
    });

    const found = collected.find((s) => s.stampId === createdStampId);
    assert.ok(found, "Stamp should be in Guest A collected stamps");
    assert.equal(found.stamp.displayName, stampName);

    // Verify retrieval via getTravelerStamps
    const guestStamps = await getTravelerStamps(userA.id);
    assert.ok(
      guestStamps.some((s) => s.stampId === createdStampId),
      "getTravelerStamps should return the collected stamp"
    );
  });

  await t.test("6. Duplicate prevention: Guest A cannot select the same stamp twice", async () => {
    const pickerItems = await getTravelStampPickerItems(userA.id, stampName);
    const item = pickerItems.find((p) => p.id === createdStampId);
    assert.ok(item, "Item should exist");
    assert.equal(item.isAlreadyCollected, true, "Stamp is marked already collected");

    // Attempt to add it again
    const secondAdd = await addTravelStampSelections(userA.id, {
      catalogStampIds: [createdStampId],
    });

    const matches = secondAdd.filter((s) => s.stampId === createdStampId);
    assert.equal(matches.length, 1, "Duplicate stamp was ignored and not added twice");
  });

  await t.test("7. Guest B can independently select the same stamp", async () => {
    const pickerB = await getTravelStampPickerItems(userB.id, stampName);
    const itemB = pickerB.find((p) => p.id === createdStampId);
    assert.equal(itemB?.isAlreadyCollected, false, "Guest B has not collected it yet");

    const collectedB = await addTravelStampSelections(userB.id, {
      catalogStampIds: [createdStampId],
    });
    assert.ok(
      collectedB.some((s) => s.stampId === createdStampId),
      "Guest B now has the stamp"
    );

    // Verify admin list now shows 2 collectors
    const list = await listAdminTravelStamps({ search: stampName });
    const adminStamp = list.find((s) => s.id === createdStampId);
    assert.equal(adminStamp?.collectorCount, 2, "Collector count should be 2");
  });

  await t.test("8. Guest A can remove the stamp from their profile", async () => {
    const guestStamps = await getTravelerStamps(userA.id);
    const toRemove = guestStamps.find((s) => s.stampId === createdStampId);
    assert.ok(toRemove, "Found stamp to remove");

    await removeTravelStamp(userA.id, toRemove.id);

    const afterRemove = await getTravelerStamps(userA.id);
    assert.ok(
      !afterRemove.some((s) => s.stampId === createdStampId),
      "Stamp should no longer be in Guest A stamps"
    );

    // Guest B still has it
    const stampsB = await getTravelerStamps(userB.id);
    assert.ok(
      stampsB.some((s) => s.stampId === createdStampId),
      "Guest B still retains their stamp"
    );
  });

  await t.test("9. Visibility toggle ON/OFF persists for Where I've Been section", async () => {
    const isHidden = await setStampsSectionVisibility(userA.id, false);
    assert.equal(isHidden, false);

    const profile = await prisma.travelProfile.findUnique({
      where: { userId: userA.id },
    });
    assert.equal(profile?.showStamps, false, "showStamps is false");

    const isVisible = await setStampsSectionVisibility(userA.id, true);
    assert.equal(isVisible, true);

    const profileVisible = await prisma.travelProfile.findUnique({
      where: { userId: userA.id },
    });
    assert.equal(profileVisible?.showStamps, true, "showStamps is true");
  });

  await t.test("10. Admin deactivating a stamp prevents new selections while preserving existing", async () => {
    // Admin toggles active -> inactive
    const toggled = await toggleAdminTravelStampActive(createdStampId);
    assert.equal(toggled.isActive, false, "Stamp is now inactive");

    // Guest A looks at picker -> inactive stamp should NOT appear for selection
    const pickerA = await getTravelStampPickerItems(userA.id, stampName);
    const item = pickerA.find((p) => p.id === createdStampId);
    assert.equal(item, undefined, "Inactive stamp should not be returned in picker");

    // Existing collection for Guest B remains completely intact
    const stampsB = await getTravelerStamps(userB.id);
    const bStamp = stampsB.find((s) => s.stampId === createdStampId);
    assert.ok(bStamp, "Guest B retains their existing stamp even when archived/deactivated");
  });

  await t.test("11. Safe delete/archive: Deleting stamp with active collectors soft-archives it", async () => {
    const deleteResult = await deleteAdminTravelStamp(createdStampId);
    assert.equal(deleteResult.archived, true, "Should soft-archive because Guest B collected it");

    // Verify still in database but inactive
    const dbStamp = await prisma.travelStamp.findUnique({ where: { id: createdStampId } });
    assert.ok(dbStamp, "Stamp record is preserved");
    assert.equal(dbStamp.isActive, false, "Stamp isActive is false");
  });
});
