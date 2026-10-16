-- Complete Host Guidebooks: multiple photos, explicit city-advice metadata,
-- display labels for custom categories, and reusable guidebook categories.
ALTER TABLE "GuidebookItem"
  ADD COLUMN IF NOT EXISTS "categoryLabel" TEXT,
  ADD COLUMN IF NOT EXISTS "adviceType" TEXT,
  ADD COLUMN IF NOT EXISTS "photos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "GuidebookItem"
SET "photos" = ARRAY["photo"]
WHERE "photo" IS NOT NULL AND cardinality("photos") = 0;

CREATE TABLE IF NOT EXISTS "GuidebookCategory" (
  "id" TEXT NOT NULL,
  "guidebookId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "normalized" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GuidebookCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GuidebookCategory_guidebookId_normalized_key"
  ON "GuidebookCategory"("guidebookId", "normalized");
CREATE INDEX IF NOT EXISTS "GuidebookCategory_guidebookId_idx"
  ON "GuidebookCategory"("guidebookId");

ALTER TABLE "GuidebookCategory" DROP CONSTRAINT IF EXISTS "GuidebookCategory_guidebookId_fkey";
ALTER TABLE "GuidebookCategory" ADD CONSTRAINT "GuidebookCategory_guidebookId_fkey"
  FOREIGN KEY ("guidebookId") REFERENCES "Guidebook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
