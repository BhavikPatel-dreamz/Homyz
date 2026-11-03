-- Keep user-selected stamps separate from verified system-earned awards.
-- Existing rows retain USER_MANAGED ownership through the schema default.
DROP INDEX IF EXISTS "UserTravelStamp_userId_stampId_key";

CREATE UNIQUE INDEX "UserTravelStamp_userId_stampId_ownership_key"
  ON "UserTravelStamp"("userId", "stampId", "ownership");
