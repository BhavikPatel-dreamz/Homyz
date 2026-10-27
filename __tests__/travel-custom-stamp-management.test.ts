import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/lib/db/prisma";
import {
  createCustomTravelStamp,
  deleteCustomTravelStamp,
  getTravelStampPickerItems,
  getTravelerStamps,
  setStampPublic,
  updateCustomTravelStamp,
} from "@/services/travel-stamp.service";

test("personal travel stamps are owner-scoped, private-aware, and persist edits", async (t) => {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const owner = await prisma.user.create({
    data: { email: `custom-stamp-owner-${nonce}@example.test`, name: "Custom Stamp Owner" },
  });
  const otherUser = await prisma.user.create({
    data: { email: `custom-stamp-other-${nonce}@example.test`, name: "Custom Stamp Other" },
  });
  t.after(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, otherUser.id] } } });
  });

  const uploadedUrl = `https://media.example.test/stamp-icons/custom_stamp_${owner.id}_${nonce}.png`;
  const [uploaded, repeated] = await Promise.all([
    createCustomTravelStamp(owner.id, {
      displayName: "My custom memory",
      country: "Japan",
      city: "Kyoto",
      artworkUrl: uploadedUrl,
      isPublic: false,
    }),
    createCustomTravelStamp(owner.id, {
      displayName: "My custom memory",
      country: "Japan",
      city: "Kyoto",
      artworkUrl: uploadedUrl,
      isPublic: false,
    }),
  ]);
  assert.equal(uploaded.stamp.isCustom, true);
  assert.equal(uploaded.isPublic, false);
  assert.equal(uploaded.stamp.category, "THEME");

  assert.equal(repeated.id, uploaded.id, "repeated save is idempotent");

  const ownerPicker = await getTravelStampPickerItems(owner.id, "My custom memory");
  assert.equal(ownerPicker.filter((stamp) => stamp.id === uploaded.stampId).length, 1);
  const otherPicker = await getTravelStampPickerItems(otherUser.id, "My custom memory");
  assert.equal(otherPicker.some((stamp) => stamp.id === uploaded.stampId), false);

  await assert.rejects(
    () => updateCustomTravelStamp(otherUser.id, uploaded.stampId, { displayName: "Stolen" }),
    /Custom stamp not found/,
  );

  const updated = await updateCustomTravelStamp(owner.id, uploaded.stampId, {
    displayName: "Kyoto keepsake",
    city: "Kyoto",
  });
  assert.equal(updated.stamp.displayName, "Kyoto keepsake");
  const publiclyVisible = await setStampPublic(owner.id, updated.id, true);
  assert.equal(publiclyVisible.isPublic, true);
  const persisted = await getTravelerStamps(owner.id, { publicOnly: true });
  assert.ok(persisted.some((stamp) => stamp.id === updated.id));

  const photo = await prisma.travelPhoto.create({
    data: {
      userId: owner.id,
      url: "https://media.example.test/travel-photo.jpg",
      mediumUrl: "https://media.example.test/travel-photo-medium.jpg",
    },
  });
  const photoBased = await createCustomTravelStamp(owner.id, {
    displayName: "Photo keepsake",
    sourcePhotoId: photo.id,
  });
  assert.equal(photoBased.stamp.iconUrl, photo.mediumUrl);

  await deleteCustomTravelStamp(owner.id, photoBased.stampId);
  assert.equal(
    (await getTravelerStamps(owner.id)).some((stamp) => stamp.stampId === photoBased.stampId),
    false,
  );
});
