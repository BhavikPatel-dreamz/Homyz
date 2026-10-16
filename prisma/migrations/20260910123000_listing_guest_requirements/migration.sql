-- Persist the profile-photo requirement configured in Guest requirements.
ALTER TABLE "Listing"
ADD COLUMN IF NOT EXISTS "requireProfilePhoto" BOOLEAN NOT NULL DEFAULT false;
