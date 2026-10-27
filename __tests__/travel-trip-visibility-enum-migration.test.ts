import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

test("TravelTrip visibility uses the same enum as Prisma and has a safe legacy cast migration", () => {
  const schema = read("prisma/schema.prisma");
  const migration = read("prisma/migrations/20261027090000_align_travel_trip_visibility_enum/migration.sql");

  assert.match(schema, /model TravelTrip[\s\S]*?visibility\s+TravelProfileVisibility\s+@default\(PUBLIC\)/);
  assert.match(migration, /visibility_type = 'TravelTripVisibility'/);
  assert.match(migration, /ALTER COLUMN "visibility" DROP DEFAULT/);
  assert.match(migration, /TYPE "TravelProfileVisibility"/);
  assert.match(migration, /SET DEFAULT 'PUBLIC'::"TravelProfileVisibility"/);
});
