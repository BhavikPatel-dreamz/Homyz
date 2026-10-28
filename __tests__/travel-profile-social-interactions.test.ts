import "dotenv/config";
import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/lib/db/prisma";
import { TravelProfileVisibility } from "@/generated/prisma/client";
import { togglePhotoLike } from "@/services/travel-photo.service";
import { createPhotoComment, deletePhotoComment, getPhotoComments, getTripLikeStatus, toggleTripLike, updatePhotoComment } from "@/services/travel-social.service";
import { followTraveler, getTravelFollowCounts, getTravelFollowList, updateProfileVisibility } from "@/services/travel-privacy.service";

test("travel social interactions are persisted, private-aware, and owner-authorized", async (t) => {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const [owner, viewer, outsider] = await Promise.all(["owner", "viewer", "outsider"].map((role) => prisma.user.create({ data: { email: `social-${role}-${nonce}@example.test`, name: role } })));
  await Promise.all([
    prisma.travelProfile.create({ data: { userId: owner.id, handle: `social-owner-${nonce}`, visibility: TravelProfileVisibility.PUBLIC } }),
    prisma.travelProfile.create({ data: { userId: viewer.id, handle: `social-viewer-${nonce}`, visibility: TravelProfileVisibility.PUBLIC } }),
    prisma.travelProfile.create({ data: { userId: outsider.id, handle: `social-outsider-${nonce}`, visibility: TravelProfileVisibility.PUBLIC } }),
  ]);
  const trip = await prisma.travelTrip.create({ data: { userId: owner.id, title: "Social test trip" } });
  const photo = await prisma.travelPhoto.create({ data: { userId: owner.id, tripId: trip.id, url: "https://example.test/social.jpg" } });
  t.after(async () => { await prisma.user.deleteMany({ where: { id: { in: [owner.id, viewer.id, outsider.id] } } }); });

  assert.deepEqual(await togglePhotoLike(viewer.id, photo.id), { liked: true, count: 1 });
  assert.deepEqual(await togglePhotoLike(viewer.id, photo.id), { liked: false, count: 0 });
  await assert.rejects(() => togglePhotoLike(owner.id, photo.id), /own travel photo/);
  assert.deepEqual(await toggleTripLike(viewer.id, trip.id), { liked: true, count: 1 });
  assert.deepEqual(await getTripLikeStatus(viewer.id, trip.id), { liked: true, count: 1 });

  const comment = await createPhotoComment(viewer.id, photo.id, "Wonderful journey!");
  assert.equal(comment.content, "Wonderful journey!");
  const edited = await updatePhotoComment(viewer.id, comment.id, "Wonderful journey, thanks for sharing!");
  assert.match(edited.content, /thanks/);
  await assert.rejects(() => updatePhotoComment(outsider.id, comment.id, "Nope"), /Only the comment author/);
  await deletePhotoComment(owner.id, comment.id);
  assert.equal((await getPhotoComments(owner.id, photo.id)).totalCount, 0, "owner can moderate comments");

  await followTraveler(viewer.id, owner.id);
  await followTraveler(viewer.id, owner.id);
  assert.deepEqual(await getTravelFollowCounts(owner.id), { followersCount: 1, followingCount: 0 });
  const followers = await getTravelFollowList(owner.id, owner.id, "followers");
  assert.equal(followers.items[0]?.id, viewer.id);
  await assert.rejects(() => followTraveler(owner.id, owner.id), /cannot follow yourself/);

  await updateProfileVisibility(owner.id, TravelProfileVisibility.PRIVATE);
  await assert.rejects(() => getPhotoComments(outsider.id, photo.id), /cannot view comments/);
  await assert.rejects(() => getTravelFollowList(outsider.id, owner.id, "followers"), /follower list is private/);
});
