import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { prisma } from "@/lib/db/prisma";
import {
  BookingStatus,
  TravelProfileVisibility,
} from "@/generated/prisma/client";
import { getCountryHighlights, getPaginatedTravelPhotos } from "@/services/travel-photo.service";
import { getTravelerStamps, removeTravelStamp } from "@/services/travel-stamp.service";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("fresh travel profiles are empty and gallery queries exclude confirmed placeholder rows", async (t) => {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const owner = await prisma.user.create({ data: { email: `clean-profile-${nonce}@example.test` } });
  await prisma.travelProfile.create({
    data: { userId: owner.id, handle: `clean-profile-${nonce}`, visibility: TravelProfileVisibility.PUBLIC },
  });
  t.after(async () => {
    await prisma.user.delete({ where: { id: owner.id } });
  });

  assert.deepEqual(await getTravelerStamps(owner.id), []);
  const emptyPhotos = await getPaginatedTravelPhotos({ userId: owner.id, actorId: owner.id });
  assert.equal(emptyPhotos.totalCount, 0);
  assert.deepEqual(await getCountryHighlights(owner.id), []);

  await prisma.travelPhoto.createMany({
    data: [
      { userId: owner.id, url: "" },
      { userId: owner.id, url: "/images/auth-traveler-water.jpg" },
      { userId: owner.id, url: `https://example.test/${nonce}.jpg`, location: "Paris, France" },
    ],
  });
  const photos = await getPaginatedTravelPhotos({ userId: owner.id, actorId: owner.id });
  assert.equal(photos.totalCount, 1);
  assert.equal(photos.items[0]?.url, `https://example.test/${nonce}.jpg`);
  assert.deepEqual((await getCountryHighlights(owner.id)).map((item) => item.country), ["France"]);

  const stamp = await prisma.travelStamp.create({
    data: {
      slug: `selected-${nonce}`,
      displayName: "Selected by traveler",
      category: "THEME",
      eligibilityRule: "MANUAL",
      ruleThreshold: 0,
      isActive: true,
    },
  });
  const collected = await prisma.userTravelStamp.create({
    data: { userId: owner.id, stampId: stamp.id, evidenceMetadata: { source: "USER_SELECTED" } },
    include: { stamp: true },
  });
  assert.equal((await getTravelerStamps(owner.id)).length, 1);
  await removeTravelStamp(owner.id, collected.id);
  assert.deepEqual(await getTravelerStamps(owner.id), []);
});

test("owner highlights include a completed Paris booking before destination reconciliation", async (t) => {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const [host, guest] = await Promise.all([
    prisma.user.create({ data: { email: `paris-host-${nonce}@example.test` } }),
    prisma.user.create({ data: { email: `paris-guest-${nonce}@example.test` } }),
  ]);
  t.after(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [host.id, guest.id] } } });
  });

  const listing = await prisma.listing.create({
    data: {
      hostId: host.id,
      title: `Paris stay ${nonce}`,
      description: "Completed-stay destination test listing",
      price: 20000,
      city: "Paris",
      country: "France",
    },
  });
  const now = Date.now();
  await prisma.booking.create({
    data: {
      userId: guest.id,
      listingId: listing.id,
      status: BookingStatus.CONFIRMED,
      startDate: new Date(now - 10 * 24 * 60 * 60 * 1000),
      endDate: new Date(now - 3 * 24 * 60 * 60 * 1000),
    },
  });

  const highlights = await getCountryHighlights(guest.id, { actorId: guest.id });
  assert.deepEqual(highlights, [
    {
      country: "France",
      countryCode: "FR",
      photoCount: 0,
      coverUrl: null,
      sampleLocation: "France",
      isVerified: true,
    },
  ]);
  assert.equal(
    await prisma.userDestination.count({ where: { userId: guest.id } }),
    0,
    "reading a profile must not write destination history",
  );
});

test("profile reads do not mutate award history or expose unrestricted highlights", () => {
  const ownerPage = read("app/(protected)/travel-profile/page.tsx");
  const reconcile = read("services/travel-reconciliation.service.ts");
  const highlightsRoute = read("app/api/v1/travel-media/highlights/route.ts");
  const photos = read("services/travel-photo.service.ts");

  assert.doesNotMatch(ownerPage, /reconcileTravelerHistory/);
  assert.match(reconcile, /awardSystemTravelStamps/);
  assert.match(reconcile, /awardedStampsCount:\s*awardResult\.awardedCount/);
  assert.match(highlightsRoute, /canViewTravelProfile/);
  assert.match(photos, /SYSTEM_PLACEHOLDER_PHOTO_URLS/);
  assert.match(photos, /url:\s*renderablePhotoUrlWhere/);
});
