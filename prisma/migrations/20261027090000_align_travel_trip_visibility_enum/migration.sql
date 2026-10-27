-- The initial travel-trip table may predate the travel-profile privacy enum.
-- Prisma now correctly models trip visibility as TravelProfileVisibility, so
-- convert only legacy columns that still use TravelTripVisibility. The cast
-- preserves the shared PUBLIC/PRIVATE labels and unlocks FOLLOWERS_ONLY.
DO $$
DECLARE
  visibility_type TEXT;
BEGIN
  SELECT c.udt_name
    INTO visibility_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'TravelTrip'
    AND c.column_name = 'visibility';

  IF visibility_type = 'TravelTripVisibility' THEN
    ALTER TABLE "TravelTrip"
      ALTER COLUMN "visibility" DROP DEFAULT;
    ALTER TABLE "TravelTrip"
      ALTER COLUMN "visibility" TYPE "TravelProfileVisibility"
      USING "visibility"::text::"TravelProfileVisibility";
    ALTER TABLE "TravelTrip"
      ALTER COLUMN "visibility" SET DEFAULT 'PUBLIC'::"TravelProfileVisibility";
  END IF;
END $$;
