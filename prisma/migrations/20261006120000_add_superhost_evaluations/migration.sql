-- Persisted, quarterly-only official Superhost status and its non-sensitive
-- evaluation snapshot. Live progress remains calculated at request time.
ALTER TABLE "User"
  ADD COLUMN "isSuperhost" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "superhostQualifiedAt" TIMESTAMP(3),
  ADD COLUMN "superhostLastEvaluatedAt" TIMESTAMP(3),
  ADD COLUMN "superhostNextEvaluationAt" TIMESTAMP(3);

CREATE TABLE "SuperhostEvaluation" (
  "id" TEXT NOT NULL,
  "hostId" TEXT NOT NULL,
  "evaluationDate" DATE NOT NULL,
  "windowStart" DATE NOT NULL,
  "windowEnd" DATE NOT NULL,
  "completedReservations" INTEGER NOT NULL,
  "completedNights" INTEGER NOT NULL,
  "overallRating" DOUBLE PRECISION,
  "publishedReviewCount" INTEGER NOT NULL,
  "responseRatePercentage" DOUBLE PRECISION,
  "totalGuestInquiries" INTEGER NOT NULL,
  "hostCancellationRatePercentage" DOUBLE PRECISION NOT NULL,
  "hostCancellationCount" INTEGER NOT NULL,
  "cancellationDenominator" INTEGER NOT NULL,
  "accountGoodStanding" BOOLEAN NOT NULL,
  "qualified" BOOLEAN NOT NULL,
  "failureReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SuperhostEvaluation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "User_isSuperhost_idx" ON "User"("isSuperhost");
CREATE UNIQUE INDEX "SuperhostEvaluation_hostId_evaluationDate_key" ON "SuperhostEvaluation"("hostId", "evaluationDate");
CREATE INDEX "SuperhostEvaluation_evaluationDate_idx" ON "SuperhostEvaluation"("evaluationDate");
CREATE INDEX "SuperhostEvaluation_hostId_evaluationDate_idx" ON "SuperhostEvaluation"("hostId", "evaluationDate");

ALTER TABLE "SuperhostEvaluation"
  ADD CONSTRAINT "SuperhostEvaluation_hostId_fkey"
  FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
