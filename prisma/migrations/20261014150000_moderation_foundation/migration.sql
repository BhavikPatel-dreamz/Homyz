-- Phase 1: central content moderation foundation.
-- This migration is additive. It deliberately does not change reviews,
-- listing lifecycle states, booking disputes, or financial records.

CREATE TYPE "ModerationTargetType" AS ENUM (
  'REVIEW', 'LISTING', 'LISTING_PHOTO', 'PROFILE', 'USER', 'MESSAGE', 'OTHER_CONTENT'
);

CREATE TYPE "ModerationCaseStatus" AS ENUM (
  'NEW', 'IN_REVIEW', 'NEEDS_INFORMATION', 'RESOLVED', 'DISMISSED', 'REOPENED'
);

CREATE TYPE "ModerationSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

CREATE TYPE "ModerationEvidenceType" AS ENUM (
  'EXISTING_MEDIA', 'MESSAGE_ATTACHMENT', 'DOCUMENT', 'EXTERNAL_REFERENCE', 'TEXT_NOTE'
);

CREATE TABLE "ModerationCase" (
  "id" TEXT NOT NULL,
  "caseReference" TEXT NOT NULL,
  "targetType" "ModerationTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "status" "ModerationCaseStatus" NOT NULL DEFAULT 'NEW',
  "severity" "ModerationSeverity" NOT NULL DEFAULT 'MEDIUM',
  "priority" INTEGER NOT NULL DEFAULT 0,
  "assignedModeratorId" TEXT,
  "resolutionCategory" TEXT,
  "resolutionNotes" TEXT,
  "policyVersion" TEXT DEFAULT 'moderation-policy-v1',
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ModerationCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationReport" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "targetType" "ModerationTargetType" NOT NULL,
  "targetId" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "reasonCode" TEXT NOT NULL,
  "description" TEXT,
  "relatedBookingId" TEXT,
  "caseId" TEXT,
  "source" TEXT NOT NULL DEFAULT 'USER',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerationReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationEvidence" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "submittedById" TEXT,
  "evidenceType" "ModerationEvidenceType" NOT NULL,
  "storageReference" TEXT NOT NULL,
  "displayName" TEXT,
  "accessScope" TEXT NOT NULL DEFAULT 'MODERATORS_ONLY',
  "retentionUntil" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerationEvidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ModerationActivity" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ModerationActivity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ModerationCase_caseReference_key" ON "ModerationCase"("caseReference");
CREATE INDEX "ModerationCase_targetType_targetId_category_status_idx" ON "ModerationCase"("targetType", "targetId", "category", "status");
CREATE INDEX "ModerationCase_status_severity_priority_createdAt_idx" ON "ModerationCase"("status", "severity", "priority", "createdAt");
CREATE INDEX "ModerationCase_assignedModeratorId_status_idx" ON "ModerationCase"("assignedModeratorId", "status");
CREATE INDEX "ModerationCase_status_updatedAt_idx" ON "ModerationCase"("status", "updatedAt");
CREATE INDEX "ModerationCase_category_createdAt_idx" ON "ModerationCase"("category", "createdAt");
CREATE INDEX "ModerationReport_reporterId_createdAt_idx" ON "ModerationReport"("reporterId", "createdAt");
CREATE INDEX "ModerationReport_targetType_targetId_category_createdAt_idx" ON "ModerationReport"("targetType", "targetId", "category", "createdAt");
CREATE INDEX "ModerationReport_caseId_createdAt_idx" ON "ModerationReport"("caseId", "createdAt");
CREATE INDEX "ModerationReport_relatedBookingId_idx" ON "ModerationReport"("relatedBookingId");
CREATE INDEX "ModerationEvidence_caseId_createdAt_idx" ON "ModerationEvidence"("caseId", "createdAt");
CREATE INDEX "ModerationEvidence_submittedById_idx" ON "ModerationEvidence"("submittedById");
CREATE INDEX "ModerationActivity_caseId_createdAt_idx" ON "ModerationActivity"("caseId", "createdAt");
CREATE INDEX "ModerationActivity_actorId_createdAt_idx" ON "ModerationActivity"("actorId", "createdAt");
CREATE INDEX "ModerationActivity_action_createdAt_idx" ON "ModerationActivity"("action", "createdAt");

ALTER TABLE "ModerationCase"
  ADD CONSTRAINT "ModerationCase_assignedModeratorId_fkey"
  FOREIGN KEY ("assignedModeratorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModerationReport"
  ADD CONSTRAINT "ModerationReport_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ModerationReport_relatedBookingId_fkey"
  FOREIGN KEY ("relatedBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ModerationReport_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModerationEvidence"
  ADD CONSTRAINT "ModerationEvidence_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ModerationEvidence_submittedById_fkey"
  FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ModerationActivity"
  ADD CONSTRAINT "ModerationActivity_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "ModerationCase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "ModerationActivity_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
