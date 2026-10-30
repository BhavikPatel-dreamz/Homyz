import "server-only";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { deletePrivateMedia } from "@/lib/storage/media";
import { SupportCaseContentVisibility, SupportCaseEvidenceScanStatus } from "@/generated/prisma/enums";

const MAX_CLEANUP_BATCH = 50;

function requireReason(reason: string) {
  const clean = reason.trim();
  if (clean.length < 5 || clean.length > 2_000) throw AppError.badRequest("A 5–2000 character reason is required.");
  return clean;
}

export async function setSupportEvidenceLegalHold(actor: AuthUser, caseId: string, evidenceId: string, input: { hold: boolean; reason: string }) {
  const reason = requireReason(input.reason);
  return prisma.$transaction(async (tx) => {
    const evidence = await tx.supportCaseEvidence.findFirst({ where: { id: evidenceId, caseId }, select: { id: true, caseId: true, legalHold: true } });
    if (!evidence) throw AppError.notFound("Support evidence not found.");
    if (evidence.legalHold === input.hold) throw AppError.conflict(input.hold ? "Evidence is already under legal hold." : "Evidence is not under legal hold.");
    const now = new Date();
    const updated = await tx.supportCaseEvidence.update({ where: { id: evidenceId }, data: input.hold ? { legalHold: true, legalHoldReason: reason, legalHoldAt: now, legalHoldById: actor.id } : { legalHold: false, legalHoldReason: null, legalHoldAt: null, legalHoldById: null } });
    await tx.supportCaseEvidenceHold.create({ data: { evidenceId, actorId: actor.id, action: input.hold ? "PLACED" : "RELEASED", reason } });
    await tx.supportCaseEvent.create({ data: { caseId: evidence.caseId, actorId: actor.id, eventType: input.hold ? "EVIDENCE_LEGAL_HOLD_PLACED" : "EVIDENCE_LEGAL_HOLD_RELEASED", visibility: SupportCaseContentVisibility.ADMINS_ONLY, description: input.hold ? "An administrator placed evidence under legal hold." : "An administrator released an evidence legal hold." } });
    await tx.auditLog.create({ data: { actorId: actor.id, actorEmail: actor.email, action: input.hold ? "SUPPORT_EVIDENCE_LEGAL_HOLD_PLACED" : "SUPPORT_EVIDENCE_LEGAL_HOLD_RELEASED", resourceType: "SUPPORT_CASE_EVIDENCE", resourceId: evidenceId, description: input.hold ? "Legal hold placed on support evidence." : "Legal hold released on support evidence.", status: "SUCCESS", metadata: { caseId: evidence.caseId } } });
    return updated;
  });
}

export async function getSupportEvidenceRetentionReport() {
  const now = new Date();
  const records = await prisma.supportCaseEvidence.findMany({
    where: { deletedAt: null, retentionUntil: { lte: now } },
    orderBy: { retentionUntil: "asc" },
    take: MAX_CLEANUP_BATCH,
    select: { id: true, caseId: true, originalName: true, retentionUntil: true, legalHold: true, scanStatus: true, supportCase: { select: { status: true } } },
  });
  const eligible = records.filter((item) => !item.legalHold && ["RESOLVED", "CLOSED"].includes(item.supportCase.status));
  return {
    dryRun: true,
    policy: "Retention durations require approved business/legal configuration; no default cleanup duration is applied.",
    scanned: records.length,
    eligible: eligible.map((item) => ({ id: item.id, caseId: item.caseId, originalName: item.originalName, retentionUntil: item.retentionUntil, scanStatus: item.scanStatus })),
    excludedLegalHold: records.filter((item) => item.legalHold).length,
  };
}

/** Explicit, bounded and manually invoked only; no route schedules this operation. */
export async function cleanupExpiredSupportEvidence(actor: AuthUser, input: { evidenceIds: string[]; confirm: boolean; dryRun?: boolean }) {
  if (!input.confirm) throw AppError.badRequest("Evidence cleanup requires confirm: true.");
  const ids = [...new Set(input.evidenceIds)].slice(0, MAX_CLEANUP_BATCH);
  if (!ids.length) throw AppError.badRequest("At least one evidence id is required.");
  const dryRun = input.dryRun !== false;
  const records = await prisma.supportCaseEvidence.findMany({ where: { id: { in: ids }, deletedAt: null }, include: { supportCase: { select: { status: true } } } });
  const result = { dryRun, deleted: [] as string[], skipped: [] as Array<{ id: string; reason: string }> };
  for (const record of records) {
    if (record.legalHold) { result.skipped.push({ id: record.id, reason: "legal hold" }); continue; }
    if (!record.retentionUntil || record.retentionUntil > new Date()) { result.skipped.push({ id: record.id, reason: "retention not expired" }); continue; }
    if (!["RESOLVED", "CLOSED"].includes(record.supportCase.status)) { result.skipped.push({ id: record.id, reason: "case is not closed" }); continue; }
    if (dryRun) { result.deleted.push(record.id); continue; }
    try {
      await deletePrivateMedia({ kind: "support-case-evidence", fileName: record.storageKey });
      await prisma.$transaction(async (tx) => {
        await tx.supportCaseEvidence.updateMany({ where: { id: record.id, deletedAt: null, legalHold: false }, data: { deletedAt: new Date(), storageKey: `deleted:${record.id}` } });
        await tx.supportCaseEvent.create({ data: { caseId: record.caseId, actorId: actor.id, eventType: "EVIDENCE_DELETED", visibility: SupportCaseContentVisibility.ADMINS_ONLY, description: "Expired evidence was deleted through an approved retention cleanup." } });
        await tx.auditLog.create({ data: { actorId: actor.id, actorEmail: actor.email, action: "SUPPORT_EVIDENCE_RETENTION_DELETED", resourceType: "SUPPORT_CASE_EVIDENCE", resourceId: record.id, description: "Support evidence deleted after an approved retention cleanup.", status: "SUCCESS", metadata: { caseId: record.caseId } } });
      });
      result.deleted.push(record.id);
    } catch {
      result.skipped.push({ id: record.id, reason: "storage deletion failed" });
    }
  }
  return result;
}

/** No scanner provider is configured in this repository. This function records
 * the only safe outcome for a failed scanner invocation and keeps files blocked. */
export async function markSupportEvidenceScanFailed(evidenceId: string, reason: string) {
  return prisma.supportCaseEvidence.update({ where: { id: evidenceId }, data: { scanStatus: SupportCaseEvidenceScanStatus.SCAN_FAILED, scanAttemptCount: { increment: 1 }, scanLastError: reason.slice(0, 2_000), scannedAt: new Date() } });
}

export const supportCaseEvidenceSecurityService = { setSupportEvidenceLegalHold, getSupportEvidenceRetentionReport, cleanupExpiredSupportEvidence, markSupportEvidenceScanFailed };
