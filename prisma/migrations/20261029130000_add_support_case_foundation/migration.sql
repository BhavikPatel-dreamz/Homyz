-- StayElite Phase 3 support-case foundation.
-- Additive only: this migration creates no support cases and does not change
-- ListingQualityIncident, refund, payment, payout, or booking state.

CREATE TYPE "SupportCaseStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'WAITING_FOR_GUEST', 'WAITING_FOR_HOST', 'WAITING_FOR_ADMIN', 'RESOLVED', 'CLOSED', 'REOPENED', 'ESCALATED');
CREATE TYPE "SupportCasePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "SupportCaseParticipantRole" AS ENUM ('REPORTER', 'GUEST', 'HOST', 'ADMIN');
CREATE TYPE "SupportCaseContentVisibility" AS ENUM ('PARTICIPANTS', 'ADMINS_ONLY');

CREATE TABLE "SupportCase" (
  "id" TEXT NOT NULL,
  "caseNumber" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "reporterId" TEXT,
  "reporterRole" "SupportCaseParticipantRole" NOT NULL,
  "bookingId" TEXT,
  "listingId" TEXT,
  "legacyQualityIncidentId" TEXT,
  "category" TEXT NOT NULL,
  "issueType" TEXT,
  "subject" TEXT NOT NULL,
  "description" TEXT,
  "priority" "SupportCasePriority" NOT NULL DEFAULT 'MEDIUM',
  "status" "SupportCaseStatus" NOT NULL DEFAULT 'OPEN',
  "assignedAdminId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "escalatedAt" TIMESTAMP(3),
  "escalationReason" TEXT,
  "slaDueAt" TIMESTAMP(3),
  "slaBreachedAt" TIMESTAMP(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportCase_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupportCase_version_positive" CHECK ("version" > 0)
);

CREATE TABLE "SupportCaseParticipant" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "SupportCaseParticipantRole" NOT NULL,
  "canView" BOOLEAN NOT NULL DEFAULT true,
  "canPost" BOOLEAN NOT NULL DEFAULT true,
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "removedAt" TIMESTAMP(3),
  CONSTRAINT "SupportCaseParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportCaseMessage" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "idempotencyKey" TEXT,
  "content" TEXT NOT NULL,
  "visibility" "SupportCaseContentVisibility" NOT NULL DEFAULT 'PARTICIPANTS',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportCaseMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportCaseEvidence" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "uploaderId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksum" TEXT,
  "visibility" "SupportCaseContentVisibility" NOT NULL DEFAULT 'PARTICIPANTS',
  "retentionUntil" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportCaseEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupportCaseEvidence_size_nonnegative" CHECK ("sizeBytes" >= 0)
);

CREATE TABLE "SupportCaseEvent" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "actorId" TEXT,
  "eventType" TEXT NOT NULL,
  "visibility" "SupportCaseContentVisibility" NOT NULL DEFAULT 'ADMINS_ONLY',
  "previousState" JSONB,
  "newState" JSONB,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportCaseEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportCaseAssignmentHistory" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "previousAssigneeId" TEXT,
  "newAssigneeId" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupportCaseAssignmentHistory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BookingRefund" ADD COLUMN "supportCaseId" TEXT;

CREATE UNIQUE INDEX "SupportCase_caseNumber_key" ON "SupportCase"("caseNumber");
CREATE UNIQUE INDEX "SupportCase_idempotencyKey_key" ON "SupportCase"("idempotencyKey");
CREATE UNIQUE INDEX "SupportCase_legacyQualityIncidentId_key" ON "SupportCase"("legacyQualityIncidentId");
CREATE INDEX "SupportCase_reporterId_createdAt_idx" ON "SupportCase"("reporterId", "createdAt");
CREATE INDEX "SupportCase_assignedAdminId_status_idx" ON "SupportCase"("assignedAdminId", "status");
CREATE INDEX "SupportCase_bookingId_createdAt_idx" ON "SupportCase"("bookingId", "createdAt");
CREATE INDEX "SupportCase_listingId_createdAt_idx" ON "SupportCase"("listingId", "createdAt");
CREATE INDEX "SupportCase_status_priority_createdAt_idx" ON "SupportCase"("status", "priority", "createdAt");
CREATE INDEX "SupportCase_status_slaDueAt_idx" ON "SupportCase"("status", "slaDueAt");

CREATE UNIQUE INDEX "SupportCaseParticipant_caseId_userId_key" ON "SupportCaseParticipant"("caseId", "userId");
CREATE INDEX "SupportCaseParticipant_userId_removedAt_idx" ON "SupportCaseParticipant"("userId", "removedAt");
CREATE INDEX "SupportCaseParticipant_caseId_removedAt_idx" ON "SupportCaseParticipant"("caseId", "removedAt");
CREATE INDEX "SupportCaseMessage_caseId_createdAt_idx" ON "SupportCaseMessage"("caseId", "createdAt");
CREATE INDEX "SupportCaseMessage_senderId_createdAt_idx" ON "SupportCaseMessage"("senderId", "createdAt");
CREATE UNIQUE INDEX "SupportCaseMessage_idempotencyKey_key" ON "SupportCaseMessage"("idempotencyKey");
CREATE UNIQUE INDEX "SupportCaseEvidence_storageKey_key" ON "SupportCaseEvidence"("storageKey");
CREATE INDEX "SupportCaseEvidence_caseId_createdAt_idx" ON "SupportCaseEvidence"("caseId", "createdAt");
CREATE INDEX "SupportCaseEvidence_uploaderId_createdAt_idx" ON "SupportCaseEvidence"("uploaderId", "createdAt");
CREATE INDEX "SupportCaseEvidence_retentionUntil_idx" ON "SupportCaseEvidence"("retentionUntil");
CREATE INDEX "SupportCaseEvent_caseId_createdAt_idx" ON "SupportCaseEvent"("caseId", "createdAt");
CREATE INDEX "SupportCaseEvent_actorId_createdAt_idx" ON "SupportCaseEvent"("actorId", "createdAt");
CREATE INDEX "SupportCaseEvent_eventType_createdAt_idx" ON "SupportCaseEvent"("eventType", "createdAt");
CREATE INDEX "SupportCaseAssignmentHistory_caseId_createdAt_idx" ON "SupportCaseAssignmentHistory"("caseId", "createdAt");
CREATE INDEX "SupportCaseAssignmentHistory_newAssigneeId_createdAt_idx" ON "SupportCaseAssignmentHistory"("newAssigneeId", "createdAt");
CREATE INDEX "BookingRefund_supportCaseId_idx" ON "BookingRefund"("supportCaseId");

ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_assignedAdminId_fkey" FOREIGN KEY ("assignedAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportCase" ADD CONSTRAINT "SupportCase_legacyQualityIncidentId_fkey" FOREIGN KEY ("legacyQualityIncidentId") REFERENCES "ListingQualityIncident"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportCaseParticipant" ADD CONSTRAINT "SupportCaseParticipant_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportCaseParticipant" ADD CONSTRAINT "SupportCaseParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportCaseMessage" ADD CONSTRAINT "SupportCaseMessage_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportCaseMessage" ADD CONSTRAINT "SupportCaseMessage_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportCaseEvidence" ADD CONSTRAINT "SupportCaseEvidence_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportCaseEvidence" ADD CONSTRAINT "SupportCaseEvidence_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportCaseEvent" ADD CONSTRAINT "SupportCaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportCaseEvent" ADD CONSTRAINT "SupportCaseEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportCaseAssignmentHistory" ADD CONSTRAINT "SupportCaseAssignmentHistory_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SupportCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportCaseAssignmentHistory" ADD CONSTRAINT "SupportCaseAssignmentHistory_previousAssigneeId_fkey" FOREIGN KEY ("previousAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportCaseAssignmentHistory" ADD CONSTRAINT "SupportCaseAssignmentHistory_newAssigneeId_fkey" FOREIGN KEY ("newAssigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingRefund" ADD CONSTRAINT "BookingRefund_supportCaseId_fkey" FOREIGN KEY ("supportCaseId") REFERENCES "SupportCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SupportCaseEvent is immutable activity history. Service code uses only
-- INSERTs, and the trigger protects that invariant from accidental SQL writes.
CREATE OR REPLACE FUNCTION stayelite_prevent_support_case_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'SupportCaseEvent is append-only; create a new event instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SupportCaseEvent_no_update"
  BEFORE UPDATE ON "SupportCaseEvent"
  FOR EACH ROW EXECUTE FUNCTION stayelite_prevent_support_case_event_mutation();
CREATE TRIGGER "SupportCaseEvent_no_delete"
  BEFORE DELETE ON "SupportCaseEvent"
  FOR EACH ROW EXECUTE FUNCTION stayelite_prevent_support_case_event_mutation();
