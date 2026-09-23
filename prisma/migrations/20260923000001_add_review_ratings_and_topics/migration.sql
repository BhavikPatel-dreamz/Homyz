-- Optional category scores intentionally remain nullable. Older overall-only
-- reviews must not be treated as zeroes in category averages.
ALTER TABLE "Review"
  ADD COLUMN "cleanlinessRating" INTEGER,
  ADD COLUMN "accuracyRating" INTEGER,
  ADD COLUMN "checkInRating" INTEGER,
  ADD COLUMN "communicationRating" INTEGER,
  ADD COLUMN "locationRating" INTEGER,
  ADD COLUMN "valueRating" INTEGER,
  ADD COLUMN "topics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "Review"
  ADD CONSTRAINT "Review_rating_range" CHECK ("rating" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Review_cleanlinessRating_range" CHECK ("cleanlinessRating" IS NULL OR "cleanlinessRating" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Review_accuracyRating_range" CHECK ("accuracyRating" IS NULL OR "accuracyRating" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Review_checkInRating_range" CHECK ("checkInRating" IS NULL OR "checkInRating" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Review_communicationRating_range" CHECK ("communicationRating" IS NULL OR "communicationRating" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Review_locationRating_range" CHECK ("locationRating" IS NULL OR "locationRating" BETWEEN 1 AND 5),
  ADD CONSTRAINT "Review_valueRating_range" CHECK ("valueRating" IS NULL OR "valueRating" BETWEEN 1 AND 5);

CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");
CREATE INDEX "Review_topics_idx" ON "Review" USING GIN ("topics");
