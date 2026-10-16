-- AlterTable Review
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "privateNoteToHost" TEXT NOT NULL DEFAULT '';
