import { CURATED_LOCATION_COUNTRIES, CURATED_LOCATION_COUNT, validateCuratedLocationSeed, SeedCountry, SeedLocation } from "@/data/locations.seed";
import { prisma } from "@/lib/db/prisma";

export const CURATED_LOCATIONS_SETTING_KEY = "CURATED_LOCATIONS_V1";
export const COUNTRY_SETTING_CATEGORY = "LOCATIONS_COUNTRY";
export const CITY_SETTING_CATEGORY = "LOCATIONS_CITY";

export interface SeedLocationsResult {
  countries: number;
  locations: number;
  dbCountryCount: number;
  dbLocationCount: number;
}

/**
 * Persists the catalogue within the existing AppSettings model without requiring
 * unnecessary schema migrations. Each country and location is stored with its
 * respective category and unique key for idempotent, relational querying.
 */
export async function seedCuratedLocations(): Promise<SeedLocationsResult> {
  // 1. Validate dataset before DB insertion
  validateCuratedLocationSeed();

  let countriesUpserted = 0;
  let locationsUpserted = 0;

  // 2. Idempotent insertion per country in atomic transactions
  for (const country of CURATED_LOCATION_COUNTRIES) {
    await prisma.$transaction(async (tx: any) => {
      // Upsert Country
      await tx.appSettings.upsert({
        where: { key: `COUNTRY_${country.code}` },
        update: {
          value: JSON.stringify({
            name: country.name,
            code: country.code,
            currencyCode: country.currencyCode,
            isActive: country.isActive,
          }),
          description: `Seeded country: ${country.name} (${country.code})`,
          dataType: "JSON",
          category: COUNTRY_SETTING_CATEGORY,
          isPublic: true,
          updatedAt: new Date(),
        },
        create: {
          key: `COUNTRY_${country.code}`,
          value: JSON.stringify({
            name: country.name,
            code: country.code,
            currencyCode: country.currencyCode,
            isActive: country.isActive,
          }),
          description: `Seeded country: ${country.name} (${country.code})`,
          dataType: "JSON",
          category: COUNTRY_SETTING_CATEGORY,
          isPublic: true,
        },
      });
      countriesUpserted++;

      // Upsert each of the 5 locations for this country
      for (const loc of country.locations) {
        const locationKey = `LOCATION_${country.code}_${loc.slug}`;
        await tx.appSettings.upsert({
          where: { key: locationKey },
          update: {
            value: JSON.stringify({
              name: loc.name,
              slug: loc.slug,
              countryCode: country.code,
              countryName: country.name,
              type: loc.type,
              latitude: loc.latitude,
              longitude: loc.longitude,
              timezone: loc.timezone,
              currency: loc.currencyCode,
              currencyCode: loc.currencyCode,
              isActive: loc.isActive,
              isFeatured: loc.isFeatured,
              isPopular: loc.isPopular,
              displayOrder: loc.displayOrder,
            }),
            description: `Seeded location: ${loc.name}, ${country.name}`,
            dataType: "JSON",
            category: CITY_SETTING_CATEGORY,
            isPublic: true,
            updatedAt: new Date(),
          },
          create: {
            key: locationKey,
            value: JSON.stringify({
              name: loc.name,
              slug: loc.slug,
              countryCode: country.code,
              countryName: country.name,
              type: loc.type,
              latitude: loc.latitude,
              longitude: loc.longitude,
              timezone: loc.timezone,
              currency: loc.currencyCode,
              currencyCode: loc.currencyCode,
              isActive: loc.isActive,
              isFeatured: loc.isFeatured,
              isPopular: loc.isPopular,
              displayOrder: loc.displayOrder,
            }),
            description: `Seeded location: ${loc.name}, ${country.name}`,
            dataType: "JSON",
            category: CITY_SETTING_CATEGORY,
            isPublic: true,
          },
        });
        locationsUpserted++;
      }
    });
  }

  // 3. Persist master catalogue entry
  await prisma.appSettings.upsert({
    where: { key: CURATED_LOCATIONS_SETTING_KEY },
    update: {
      value: JSON.stringify({ countries: CURATED_LOCATION_COUNTRIES }),
      description: "Initial curated worldwide destination catalogue (20 countries × 5 locations).",
      dataType: "JSON",
      category: "LOCATIONS",
      isPublic: false,
      updatedAt: new Date(),
    },
    create: {
      key: CURATED_LOCATIONS_SETTING_KEY,
      value: JSON.stringify({ countries: CURATED_LOCATION_COUNTRIES }),
      description: "Initial curated worldwide destination catalogue (20 countries × 5 locations).",
      dataType: "JSON",
      category: "LOCATIONS",
      isPublic: false,
    },
  });

  // 4. Verify from DB
  const seededCountryKeys = CURATED_LOCATION_COUNTRIES.map((c) => `COUNTRY_${c.code}`);
  const seededLocationKeys = CURATED_LOCATION_COUNTRIES.flatMap((c) =>
    c.locations.map((loc) => `LOCATION_${c.code}_${loc.slug}`)
  );

  const dbCountryCount = await prisma.appSettings.count({
    where: {
      category: COUNTRY_SETTING_CATEGORY,
      key: { in: seededCountryKeys },
    },
  });
  const dbLocationCount = await prisma.appSettings.count({
    where: {
      category: CITY_SETTING_CATEGORY,
      key: { in: seededLocationKeys },
    },
  });

  return {
    countries: countriesUpserted,
    locations: locationsUpserted,
    dbCountryCount,
    dbLocationCount,
  };
}
