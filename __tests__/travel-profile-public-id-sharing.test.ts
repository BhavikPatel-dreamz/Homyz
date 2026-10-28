import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  getCanonicalProfileUrl,
  getPublicTravelProfileByPublicId,
  normalizePublicProfileId,
} from "@/services/public-travel-profile.service";
import { prisma } from "@/lib/db/prisma";
import { TravelProfileVisibility } from "@/generated/prisma/client";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("public profile IDs are opaque, canonical, and reject the old generic segment", () => {
  const first = "trv_a8f29b7c1234abcd";
  const second = "trv_92c7d4e15678beef";

  assert.notEqual(first, second);
  assert.equal(normalizePublicProfileId(first.toUpperCase()), first);
  assert.equal(normalizePublicProfileId("traveler"), null);
  assert.equal(normalizePublicProfileId("trv_not-an-id"), null);
  assert.match(getCanonicalProfileUrl(first), /\/travelers\/trv_a8f29b7c1234abcd$/);
});

test("schema and migration persist unique public IDs for existing and new profiles", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20261028110000_add_travel_profile_public_ids/migration.sql");

  assert.match(schema, /publicId\s+String\s+@unique/);
  assert.match(migration, /UPDATE "TravelProfile"[\s\S]*"publicId" = 'trv_'/);
  assert.match(migration, /SET NOT NULL/);
  assert.match(migration, /TravelProfile_publicId_key/);
});

test("database-generated public IDs are unique, stable, and resolve to the correct owner", async (t) => {
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [firstUser, secondUser] = await Promise.all([
    prisma.user.create({ data: { email: `public-id-first-${nonce}@example.test`, name: "First traveler" } }),
    prisma.user.create({ data: { email: `public-id-second-${nonce}@example.test`, name: "Second traveler" } }),
  ]);
  t.after(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [firstUser.id, secondUser.id] } } });
  });

  const [firstProfile, secondProfile] = await Promise.all([
    prisma.travelProfile.create({ data: { userId: firstUser.id, visibility: TravelProfileVisibility.PUBLIC } }),
    prisma.travelProfile.create({ data: { userId: secondUser.id, visibility: TravelProfileVisibility.PUBLIC } }),
  ]);

  assert.match(firstProfile.publicId, /^trv_[a-f0-9]{16}$/);
  assert.match(secondProfile.publicId, /^trv_[a-f0-9]{16}$/);
  assert.notEqual(firstProfile.publicId, secondProfile.publicId);

  await prisma.travelProfile.update({
    where: { id: firstProfile.id },
    data: { displayName: "Renamed traveler" },
  });
  const reloaded = await prisma.travelProfile.findUniqueOrThrow({ where: { id: firstProfile.id } });
  assert.equal(reloaded.publicId, firstProfile.publicId);

  const resolved = await getPublicTravelProfileByPublicId(firstProfile.publicId, null);
  assert.equal(resolved.userId, firstUser.id);
  await assert.rejects(() => getPublicTravelProfileByPublicId("trv_not-a-real-id", null));
});

test("all public profile URL entry points use publicProfileId, while handles only support legacy redirects", () => {
  const resolver = read("services/public-travel-profile.service.ts");
  const page = read("app/travelers/[handle]/page.tsx");
  const shareModal = read("components/travel/travel-profile-share-modal.tsx");
  const ownProfile = read("components/travel/travel-profile-view.tsx");
  const publicProfile = read("components/travel/public-travel-profile-client.tsx");
  const followList = read("components/travel/travel-follow-list-modal.tsx");

  assert.match(resolver, /where:\s*\{ publicId: normalized \}/);
  assert.match(resolver, /handle === "traveler"/);
  assert.match(page, /resolvePublicTravelProfile/);
  assert.match(page, /redirect\(`\/travelers\/\$\{encodeURIComponent\(profile\.publicProfileId\)\}`\)/);
  assert.match(shareModal, /encodeURIComponent\(publicProfileId\)/);
  assert.match(ownProfile, /initialProfile\.publicProfileId/);
  assert.match(publicProfile, /profile\.publicProfileId/);
  assert.match(followList, /item\.publicProfileId/);
});
