import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { hasExpectedImageSignature, validatePublicImageUpload } from "../lib/media/public-image-validation";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

test("public image uploads verify bytes instead of trusting browser MIME metadata", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  assert.equal(hasExpectedImageSignature("image/jpeg", jpeg), true);
  assert.equal(hasExpectedImageSignature("image/jpeg", Buffer.from("<script>alert(1)</script>")), false);

  const rejected = validatePublicImageUpload({
    fileName: "photo.jpg",
    mimeType: "image/jpeg",
    size: 6,
    buffer: Buffer.from("not-an-image"),
  });
  assert.deepEqual(rejected, {
    status: 415,
    message: "The file content does not match its declared image type.",
  });
});

test("production media and proxy boundaries enforce ownership and do not trust request headers", () => {
  const deleteRoute = read("app/api/v1/upload/route.ts");
  const proxy = read("proxy.ts");
  const publicMediaRoute = read("app/uploads/[...path]/route.ts");

  assert.match(deleteRoute, /actorOwnsReferencedPublicMedia/);
  assert.match(deleteRoute, /photos: \{ has: url \}/);
  assert.match(deleteRoute, /You cannot delete this media/);
  assert.doesNotMatch(proxy, /process\.env\.(NEXTAUTH_URL|APP_URL|AUTH_TRUST_HOST)\s*=/);
  assert.match(publicMediaRoute, /X-Content-Type-Options.*nosniff/);
});

test("dashboard includes the complete host portfolio and scopes private guest data", () => {
  const dashboard = read("services/host-dashboard.service.ts");
  const listings = read("services/listing.service.ts");

  assert.match(dashboard, /listForHost\(actor, \{ take: null \}\)/);
  assert.match(dashboard, /guestIdsNeedingOrigin/);
  assert.match(dashboard, /personalInfoByGuestId/);
  assert.match(listings, /take\?: number \| null/);
  assert.match(listings, /take === null \? \{\} : \{ take \}/);
});

test("public availability calendar has a bounded range and excludes non-public listings", () => {
  const route = read("app/api/v1/listings/[id]/booked-dates/route.ts");

  assert.match(route, /MAX_CALENDAR_RANGE_DAYS = 366/);
  assert.match(route, /published: true/);
  assert.match(route, /status: ListingStatus\.ACTIVE/);
  assert.match(route, /deletedAt: null/);
});
