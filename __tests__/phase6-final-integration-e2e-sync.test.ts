import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("Phase 6: travelTab is URL-driven and safely falls back to Photos", () => {
  const client = read("app/(protected)/profile-management/profile-management-client.tsx");
  assert.match(client, /rawTravelTab === "trips" \? "trips" : "photos"/);
  assert.match(client, /params\.set\("travelTab", tab\)/);
  assert.match(client, /router\.push\(`\$\{pathname\}\?\$\{params\.toString\(\)\}`/);
});

test("Phase 6: Profile Management reads the shared TravelPhoto compatibility view", () => {
  const loader = read("lib/profile/profile-loader.ts");
  assert.match(loader, /getTravelPhotos\(actor\.id, \{ actorId: actor\.id \}\)/);
  assert.match(loader, /tags: photo\.tags \|\| \[\]/);

  const client = read("app/(protected)/profile-management/profile-management-client.tsx");
  assert.match(client, /TravelPhotoUploadModal/);
  assert.match(client, /TravelTripManageModal/);
});

test("Phase 6: new and legacy photo edits use the correct persisted model", () => {
  const actions = read("actions/user/tripPhotos.ts");
  assert.match(actions, /prisma\.tripPhoto\.findUnique/);
  assert.match(actions, /userService\.updateTripPhoto/);
  assert.match(actions, /updateTravelPhotoMetadata/);
  assert.match(actions, /deleteTravelPhoto/);
});

test("Phase 6: compatibility reads de-duplicate migrated photos", () => {
  const service = read("services/travel-photo.service.ts");
  assert.match(service, /function dedupePhotoEntries/);
  assert.match(service, /dedupePhotoEntries\(\[\.\.\.items, \.\.\.legacyDtos\]\)/);
  assert.match(service, /tags: lp\.tags/);
});

test("Phase 6: guest and travel profile statistics share the canonical aggregation", () => {
  const userService = read("services/user.service.ts");
  assert.match(userService, /getTravelProfileStats\(userId\)/);
  assert.doesNotMatch(userService, /trips:\s*Math\.max\(tripsCount, photosCount\)/);
});

test("Phase 6: all travel mutations invalidate owner management and public traveler views", () => {
  for (const file of ["actions/travel/travelPhotos.ts", "actions/user/tripPhotos.ts"]) {
    const actions = read(file);
    assert.match(actions, /revalidatePath\("\/travel-profile"\)/);
    assert.match(actions, /revalidatePath\("\/profile\/tab\/profile_management\/trip_photos"\)/);
    assert.match(actions, /revalidatePath\("\/travelers\/\[handle\]", "page"\)/);
  }
});

test("Phase 6: public albums exclude photos more private than the viewing relationship", () => {
  const service = read("services/public-travel-profile.service.ts");
  assert.match(service, /canExposePhotoVisibility/);
  assert.match(service, /t\.photos\.filter\(\(photo\) => canExposePhotoVisibility\(photo\.visibility\)\)/);
  assert.match(service, /const safeHighlights = \[\.\.\.safeHighlightMap\.values\(\)\]/);
});

test("Phase 6: TravelTrip management remains separate from booking management", () => {
  const actions = read("actions/travel/travelPhotos.ts");
  const service = read("services/travel-photo.service.ts");
  assert.match(actions, /deleteTravelTripAction/);
  assert.match(service, /policy:\s*"UNLINK_PHOTOS" \| "DELETE_PHOTOS"/);
  assert.doesNotMatch(service, /prisma\.booking\.delete/);
});
