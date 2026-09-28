-- Store the date needed by the mandatory first-time profile-completion flow.
ALTER TABLE "User" ADD COLUMN "birthDate" DATE;
