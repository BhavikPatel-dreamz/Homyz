import "dotenv/config";
import { seedCuratedLocations, COUNTRY_SETTING_CATEGORY, CITY_SETTING_CATEGORY } from "@/lib/location/seed";
import { prisma } from "@/lib/db/prisma";

async function main() {
  console.log("\n==================================================");
  console.log("   SEEDING CURATED COUNTRIES & LOCATIONS");
  console.log("==================================================\n");

  const result = await seedCuratedLocations();

  console.log("Seed completed successfully\n");
  console.log(`Countries created/updated: ${result.countries}`);
  console.log(`Locations created/updated: ${result.locations}\n`);

  console.log("==================================================");
  console.log("   DATABASE VERIFICATION (FROM DB)");
  console.log("==================================================\n");
  console.log(`country count for seeded dataset = ${result.dbCountryCount}`);
  console.log(`location count for seeded dataset = ${result.dbLocationCount}\n`);

  // Verify each country has exactly 5 locations in DB
  const countries = await prisma.appSettings.findMany({
    where: { category: COUNTRY_SETTING_CATEGORY },
    select: { key: true, value: true },
  });

  let allValid = true;
  for (const c of countries) {
    const code = c.key.replace("COUNTRY_", "");
    const locCount = await prisma.appSettings.count({
      where: {
        category: CITY_SETTING_CATEGORY,
        key: { startsWith: `LOCATION_${code}_` },
      },
    });
    if (locCount !== 5) {
      console.error(`❌ Country ${code} has ${locCount} locations (expected 5)`);
      allValid = false;
    }
  }

  if (allValid && result.dbCountryCount === 20 && result.dbLocationCount === 100) {
    console.log("✅ All 20 countries verified with exactly 5 locations each (100 total).");
  } else {
    console.error("❌ Verification failed!");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error seeding locations:", err);
    process.exit(1);
  });

