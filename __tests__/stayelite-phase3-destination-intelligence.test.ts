import "dotenv/config";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  BookingVisitEvidenceStatus,
  DestinationClassificationType,
  TravelAchievementStatus,
} from "@/generated/prisma/enums";
import {
  CITY_STICKER_DEFINITIONS,
  DESTINATION_ACHIEVEMENT_DEFINITIONS,
  evaluateDestinationAchievementProgress,
  normalizeDestinationAlias,
  resolveCuratedCityAlias,
} from "@/services/stayelite-destination-intelligence.service";

const qualified = (id: string, countryCode: string, cityName: string, destinationId = id, listingId = `listing-${id}`) => ({
  id, destinationId, listingId, countryCode, cityName, status: BookingVisitEvidenceStatus.QUALIFIED,
});

const progressByKey = (input: Parameters<typeof evaluateDestinationAchievementProgress>[0]) =>
  new Map(evaluateDestinationAchievementProgress(input).map((result) => [result.key, result]));

test("canonical aliases are country-scoped, normalized, and never accept missing or wrong-country cities", () => {
  assert.equal(normalizeDestinationAlias("  VÉNEZIA  "), "venezia");
  assert.deepEqual(resolveCuratedCityAlias({ country: "Italy", city: "Venezia" }), {
    status: "RESOLVED", countryCode: "IT", countryName: "Italy", citySlug: "venice", cityName: "Venezia", matchedBy: "CURATED_ALIAS",
  });
  assert.equal(resolveCuratedCityAlias({ country: "United States", city: "London" }).status, "UNRESOLVED");
  assert.equal(resolveCuratedCityAlias({ city: "Paris" }).status, "UNRESOLVED");
  assert.equal(resolveCuratedCityAlias({ country: "France", city: "London" }).status, "UNRESOLVED");
  assert.equal(resolveCuratedCityAlias({ country: "United States", city: "NYC" }).citySlug, "new-york");
});

test("all eight city stickers use exact canonical country/city pairs and Desert Dreams remains one definition", () => {
  assert.equal(CITY_STICKER_DEFINITIONS.length, 8);
  for (const definition of CITY_STICKER_DEFINITIONS) {
    for (const [index, destination] of (definition.destinations ?? []).entries()) {
      const cityName = destination.citySlug.replace(/-/g, " ");
      const results = progressByKey({
        evidence: [qualified(`${definition.key}-${index}`, destination.countryCode, cityName)],
        classifications: [],
      });
      assert.equal(results.get(definition.key)?.status, TravelAchievementStatus.ELIGIBLE, definition.key);
    }
  }
  const desert = CITY_STICKER_DEFINITIONS.find((definition) => definition.key === "STICKER_DESERT_DREAMS_V1");
  assert.equal(desert?.destinations?.length, 2);
  assert.equal(new Set(DESTINATION_ACHIEVEMENT_DEFINITIONS.map((definition) => definition.key)).size, 14);
});

test("geographic evaluators require curated classifications and count distinct cities/continents", () => {
  const evidence = [
    qualified("beach", "US", "Miami", "miami"),
    qualified("mountain", "SA", "Abha", "abha"),
    qualified("cultural", "IT", "Venice", "venice"),
    qualified("nature", "AE", "Dubai", "dubai", "nature-listing"),
    qualified("metro-paris", "FR", "Paris", "paris"),
    qualified("metro-london", "GB", "London", "london"),
    qualified("metro-tokyo", "JP", "Tokyo", "tokyo"),
    qualified("metro-ny", "US", "New York", "new-york"),
    qualified("metro-sf", "US", "San Francisco", "san-francisco"),
    qualified("repeat-london", "GB", "London", "london"),
  ];
  const classifications = [
    { subject: "DESTINATION", destinationId: "miami", listingId: null, countryCode: null, classificationType: DestinationClassificationType.BEACH, classificationValue: null },
    { subject: "DESTINATION", destinationId: "abha", listingId: null, countryCode: null, classificationType: DestinationClassificationType.MOUNTAIN, classificationValue: null },
    { subject: "DESTINATION", destinationId: "venice", listingId: null, countryCode: null, classificationType: DestinationClassificationType.CULTURAL, classificationValue: null },
    { subject: "LISTING", destinationId: null, listingId: "nature-listing", countryCode: null, classificationType: DestinationClassificationType.NATURE, classificationValue: null },
    ...["paris", "london", "tokyo", "new-york", "san-francisco"].map((destinationId) => ({ subject: "DESTINATION", destinationId, listingId: null, countryCode: null, classificationType: DestinationClassificationType.METROPOLITAN, classificationValue: null })),
    { subject: "COUNTRY", destinationId: null, listingId: null, countryCode: "US", classificationType: DestinationClassificationType.CONTINENT, classificationValue: "NA" },
    { subject: "COUNTRY", destinationId: null, listingId: null, countryCode: "FR", classificationType: DestinationClassificationType.CONTINENT, classificationValue: "EU" },
    { subject: "COUNTRY", destinationId: null, listingId: null, countryCode: "JP", classificationType: DestinationClassificationType.CONTINENT, classificationValue: "AS" },
  ];
  const results = progressByKey({ evidence, classifications });
  for (const key of ["STICKER_BEACH_BUM_V1", "STICKER_MOUNTAIN_MOVER_V1", "STICKER_NATURE_NOMAD_V1", "STICKER_CULTURAL_EXPLORER_V1", "STICKER_CITY_LIGHTS_V1", "STICKER_CONTINENT_COLLECTOR_V1"]) {
    assert.equal(results.get(key)?.status, TravelAchievementStatus.ELIGIBLE, key);
    assert.equal(results.get(key)?.blockedByPolicy, true, key);
  }
  assert.equal(results.get("STICKER_CITY_LIGHTS_V1")?.progress, 5, "repeat London cannot count twice");
  assert.equal(results.get("STICKER_CONTINENT_COLLECTOR_V1")?.progress, 3, "multiple North American cities count once");
});

test("legacy static Tokyo stamp catalog has exactly one entry and no public achievement-claim route exists", () => {
  const stamps = fs.readFileSync(path.join(process.cwd(), "services/travel-stamp.service.ts"), "utf8");
  assert.equal((stamps.match(/slug: "stamp-tokyo-lights"/g) ?? []).length, 1);
  assert.equal(fs.existsSync(path.join(process.cwd(), "app/api/v1/achievements/events/route.ts")), false);
});
