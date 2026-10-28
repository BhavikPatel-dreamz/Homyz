ALTER TABLE "TravelStamp"
  ADD COLUMN IF NOT EXISTS "ownerId" TEXT,
  ADD COLUMN IF NOT EXISTS "isCustom" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "TravelStamp_ownerId_isCustom_idx"
  ON "TravelStamp"("ownerId", "isCustom");

CREATE UNIQUE INDEX IF NOT EXISTS "TravelStamp_ownerId_displayName_iconUrl_key"
  ON "TravelStamp"("ownerId", "displayName", "iconUrl");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TravelStamp_ownerId_fkey'
  ) THEN
    ALTER TABLE "TravelStamp"
      ADD CONSTRAINT "TravelStamp_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
