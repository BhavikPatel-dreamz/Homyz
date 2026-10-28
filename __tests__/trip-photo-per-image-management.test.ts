import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { prisma } from "@/lib/db/prisma";
import {
  searchTaggableTravelUsers,
  updateTravelPhotoMetadata,
  deleteTravelPhoto,
  MAX_PHOTOS_PER_TRIP,
} from "@/services/travel-photo.service";
import { TravelProfileVisibility } from "@/generated/prisma/client";

test("per-image editing persists photo-scoped tags, selected locations, and captions", async (t) => {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const [owner, eligible, privateUser, blockedUser] = await Promise.all(
    ["owner", "eligible", "private", "blocked"].map((role) =>
      prisma.user.create({ data: { email: `photo-edit-${role}-${nonce}@example.test`, name: role } }),
    ),
  );
  await Promise.all([
    prisma.travelProfile.create({ data: { userId: owner.id, handle: `photo-owner-${nonce}`, visibility: TravelProfileVisibility.PUBLIC } }),
    prisma.travelProfile.create({ data: { userId: eligible.id, handle: `photo-eligible-${nonce}`, visibility: TravelProfileVisibility.PUBLIC } }),
    prisma.travelProfile.create({ data: { userId: privateUser.id, handle: `photo-private-${nonce}`, visibility: TravelProfileVisibility.PRIVATE } }),
    prisma.travelProfile.create({ data: { userId: blockedUser.id, handle: `photo-blocked-${nonce}`, visibility: TravelProfileVisibility.PUBLIC } }),
  ]);
  const photo = await prisma.travelPhoto.create({
    data: { userId: owner.id, url: `https://example.test/${nonce}.jpg` },
  });
  await prisma.userBlock.create({ data: { blockerId: owner.id, blockedId: blockedUser.id } });
  t.after(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, eligible.id, privateUser.id, blockedUser.id] } } });
  });

  const suggestions = await searchTaggableTravelUsers(owner.id, "photo-");
  assert.ok(suggestions.some((user) => user.id === eligible.id));
  assert.ok(!suggestions.some((user) => user.id === privateUser.id));
  assert.ok(!suggestions.some((user) => user.id === blockedUser.id));

  const updated = await updateTravelPhotoMetadata(owner.id, photo.id, {
    caption: "Sunset over Paris",
    location: "Paris, France",
    locationData: {
      city: "Paris",
      country: "France",
      countryCode: "FR",
      latitude: 48.8566,
      longitude: 2.3522,
    },
    taggedUserIds: [eligible.id, eligible.id],
  });
  assert.equal(updated.caption, "Sunset over Paris");
  assert.equal(updated.location, "Paris, France");
  assert.equal(updated.taggedPeople?.length, 1, "duplicate people tags are normalized");
  assert.equal(updated.taggedPeople?.[0]?.id, eligible.id);
  assert.ok(updated.destinationId, "selected location is connected to the existing destination model");

  const stored = await prisma.travelPhoto.findUniqueOrThrow({
    where: { id: photo.id },
    include: { personTags: true },
  });
  assert.equal(stored.personTags.length, 1);
  const destination = await prisma.destination.findUniqueOrThrow({ where: { id: stored.destinationId! } });
  assert.equal(destination.cityName, "Paris");

  const cleared = await updateTravelPhotoMetadata(owner.id, photo.id, {
    caption: null,
    location: null,
    locationData: null,
    taggedUserIds: [],
  });
  assert.equal(cleared.caption, null);
  assert.equal(cleared.location, null);
  assert.equal(cleared.destinationId, null);
  assert.deepEqual(cleared.taggedPeople, []);

  await assert.rejects(
    () => updateTravelPhotoMetadata(eligible.id, photo.id, { caption: "not allowed" }),
    /permission to modify this photo/,
  );
  await assert.rejects(
    () => updateTravelPhotoMetadata(owner.id, photo.id, { caption: "a".repeat(301) }),
    /300 characters or fewer/,
  );

  const trip = await prisma.travelTrip.create({ data: { userId: owner.id, title: `Removal ${nonce}` } });
  const removable = await prisma.travelPhoto.create({
    data: { userId: owner.id, tripId: trip.id, url: `https://example.test/remove-${nonce}.jpg` },
  });
  await prisma.travelTrip.update({ where: { id: trip.id }, data: { coverPhotoId: removable.id } });
  await assert.rejects(
    () => deleteTravelPhoto(eligible.id, removable.id),
    /permission to delete this photo/,
  );
  await deleteTravelPhoto(owner.id, removable.id);
  assert.equal(await prisma.travelPhoto.findUnique({ where: { id: removable.id } }), null);
  assert.equal((await prisma.travelTrip.findUniqueOrThrow({ where: { id: trip.id } })).coverPhotoId, null);
});

test("per-image editor retains confirmation, independent save controls, and the five-photo contract", () => {
  const client = fs.readFileSync(path.join(process.cwd(), "app/(protected)/profile-management/profile-management-client.tsx"), "utf8");
  const service = fs.readFileSync(path.join(process.cwd(), "services/travel-photo.service.ts"), "utf8");
  assert.match(client, /function DeleteTripPhotoModal/);
  assert.match(client, /Confirm Delete/);
  assert.match(client, /setDeletePhotoModal\(photo\)/);
  assert.match(client, /taggedUserIds: taggedUsers\.map/);
  assert.match(client, /locationData:/);
  assert.match(client, /locationWasEdited/);
  assert.match(client, /Edit photo/);
  assert.match(client, /Remove image/);
  assert.match(service, /MAX_PHOTOS_PER_TRIP = 5/);
  assert.equal(MAX_PHOTOS_PER_TRIP, 5);
});
