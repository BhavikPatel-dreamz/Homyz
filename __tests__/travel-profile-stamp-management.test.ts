import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { generateDestinationSlug, normalizeCityName, normalizeCountry } from "@/services/travel-destination.service";
import { DEFAULT_STAMP_CATALOG } from "@/services/travel-stamp.service";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("travel stamp destination normalization distinguishes countries and cities", () => {
  assert.deepEqual(normalizeCountry("France"), { countryCode: "FR", countryName: "France" });
  assert.equal(normalizeCityName("  paris  "), "Paris");
  assert.equal(generateDestinationSlug("FR", "Paris"), "city-fr-paris");
  assert.notEqual(generateDestinationSlug("FR", "Paris"), generateDestinationSlug("US", "Paris"));
  assert.equal(normalizeCountry("UnknownFantasyLand123"), null);
});

test("stamp picker supports curated suggestions and personal, unverified destinations", () => {
  assert.ok(DEFAULT_STAMP_CATALOG.some((stamp) => stamp.slug === "stamp-paris"));
  assert.ok(DEFAULT_STAMP_CATALOG.some((stamp) => stamp.slug === "stamp-london-calling"));
  assert.ok(DEFAULT_STAMP_CATALOG.some((stamp) => stamp.slug === "stamp-tokyo-lights"));
  assert.ok(DEFAULT_STAMP_CATALOG.some((stamp) => stamp.slug === "stamp-dubai-skyline"));
  assert.ok(DEFAULT_STAMP_CATALOG.some((stamp) => stamp.slug === "stamp-istanbul-crossroads"));
  assert.ok(DEFAULT_STAMP_CATALOG.some((stamp) => stamp.slug === "stamp-mumbai-mosaic"));

  const service = read("services/travel-stamp.service.ts");
  assert.match(service, /getTravelStampPickerItems/);
  assert.match(service, /createManualTravelStamp/);
  assert.match(service, /updateManualTravelStamp/);
  assert.match(service, /MANUAL_DECLARATION/);
  assert.match(service, /assertDestinationNotCollected/);
  assert.match(service, /setStampPublic/);
  assert.match(service, /reorderTravelStamps/);
  assert.match(service, /isActive: false/);
});

test("stamp manager is a compact catalog picker with server pagination and no collection management", () => {
  const manager = read("components/travel/travel-stamp-manager-modal.tsx");
  const section = read("components/travel/travel-stamps-section.tsx");
  const service = read("services/travel-stamp.service.ts");
  const catalogRoute = read("app/api/v1/travel-media/stamps/catalog/route.ts");
  assert.match(manager, /Search city, country or stamp/);
  assert.match(manager, /PAGE_SIZE = 9/);
  assert.match(manager, /catalog\?/);
  assert.match(manager, /onTouchStart/);
  assert.doesNotMatch(manager, /Your Collected Stamps/);
  assert.doesNotMatch(manager, /Move stamp left/);
  assert.match(service, /getTravelStampPickerPage/);
  assert.match(service, /skip: \(page - 1\) \* limit/);
  assert.match(catalogRoute, /getTravelStampPickerPage/);
  assert.match(section, /Add travel stamp/);
  assert.match(section, /Remove Travel Stamp\?/);
  assert.match(section, /aria-label=\{`Remove/);
  assert.match(section, /role="switch"/);
  assert.match(section, /TravelStampManagerModal/);
});

test("public travel stamps omit individually hidden stamps and profile no longer loads achievements", () => {
  const publicService = read("services/public-travel-profile.service.ts");
  const stampsApi = read("app/api/v1/travel-media/stamps/route.ts");
  const ownerPage = read("app/(protected)/travel-profile/page.tsx");
  const ownerView = read("components/travel/travel-profile-view.tsx");
  const publicView = read("components/travel/public-travel-profile-client.tsx");
  assert.match(publicService, /publicOnly: !access\.isOwner/);
  assert.match(stampsApi, /publicOnly: !isOwner/);
  assert.match(stampsApi, /canViewTravelProfile/);
  assert.doesNotMatch(ownerPage, /getTravelerAchievements|StayElite/);
  assert.doesNotMatch(ownerView, /TravelAchievementsSection|StayEliteRecognitionSection|TravelGalleryTabs/);
  assert.doesNotMatch(publicView, /TravelAchievementsSection|StayEliteRecognitionSection|TravelGalleryTabs/);
});
