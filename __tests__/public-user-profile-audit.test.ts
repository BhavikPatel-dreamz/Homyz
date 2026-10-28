import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Public user profile safeguards", () => {
  const service = read("services/user.service.ts");
  const publicLoader = service.slice(service.indexOf("async function getPublicHostProfile"), service.indexOf("async function searchUsers"));

  it("only serializes whitelisted public-profile fields", () => {
    assert.match(service, /function toSafePublicProfile/);
    assert.match(service, /PUBLIC_PROFILE_STRING_FIELDS/);
    assert.match(service, /PUBLIC_PROFILE_LIST_FIELDS/);
    assert.match(service, /PUBLIC_PROMPT_FIELDS/);
    assert.doesNotMatch(publicLoader, /email: true|phone: true|personalInfo: true|birthDate: true/);
  });

  it("hides inactive and profile-private users", () => {
    assert.match(publicLoader, /host\.status !== UserStatus\.ACTIVE/);
    assert.match(publicLoader, /rawProfile\.profileVisible === false/);
  });

  it("keeps host reputation tied to public inventory and returns the actual listing count", () => {
    assert.match(publicLoader, /published: true/);
    assert.match(publicLoader, /status: ListingStatus\.ACTIVE/);
    assert.match(publicLoader, /isPaused: false/);
    assert.match(publicLoader, /prisma\.listing\.count\(\{ where: publicListingWhere \}\)/);
    assert.match(publicLoader, /direction: ReviewDirection\.GUEST_TO_PROPERTY/);
  });

  it("returns guest feedback separately and never exposes private travel-profile links", () => {
    assert.match(publicLoader, /direction: ReviewDirection\.HOST_TO_GUEST/);
    assert.match(publicLoader, /targetUserId: host\.id/);
    assert.match(publicLoader, /host\.travelProfile\?\.visibility === TravelProfileVisibility\.PUBLIC/);
  });

  it("renders role-aware cards and conditions the Travel Profile link on server-approved data", () => {
    const view = read("components/users/public-host-profile-view.tsx");
    const card = read("components/users/public-host-identity-card.tsx");
    assert.match(view, /roleLabel=\{host\.isHost \? "Host" : "Guest"\}/);
    assert.match(view, /host\.publicTravelProfileId/);
    assert.match(view, /href=\{`\/travelers\/\$\{encodeURIComponent\(host\.publicTravelProfileId\)\}`\}/);
    assert.match(view, /guestReviews\.length > 0/);
    assert.match(card, /roleLabel = "Host"/);
    assert.match(card, /averageRating === null \? "—"/);
  });
});
