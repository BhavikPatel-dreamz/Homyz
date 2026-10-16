import "server-only";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { PERMISSIONS, hasPermission } from "@/lib/permissions/permissions";
import type { AuthUser } from "@/lib/auth/types";
import { deletePrivateMedia } from "@/lib/storage/media";
import { logSecurityEvent } from "@/lib/moderation/security-monitor";

export type EvidenceLifecycleStatus =
  | "ACTIVE"
  | "LEGAL_HOLD"
  | "PENDING_APPEAL"
  | "RETAINED"
  | "ELIGIBLE_FOR_PURGE"
  | "PURGED";

export interface EvidenceRetentionPolicy {
  defaultRetentionDays: number;
  closedCaseRetentionDays: number;
  requireApprovalForPurge: boolean;
}

export const DEFAULT_RETENTION_POLICY: EvidenceRetentionPolicy = {
  defaultRetentionDays: 180,
  closedCaseRetentionDays: 90,
  requireApprovalForPurge: true,
};

export interface EligibleEvidenceRecord {
  evidenceId: string;
  caseId: string;
  caseReference: string;
  displayName: string | null;
  evidenceType: string;
  createdAt: string;
  daysOld: number;
  reason: string;
}

export interface EvidenceRetentionReport {
  timestamp: string;
  dryRun: boolean;
  retentionPolicy: EvidenceRetentionPolicy;
  totalEvidenceCount: number;
  activeCaseEvidenceCount: number;
  legalHoldEvidenceCount: number;
  pendingAppealEvidenceCount: number;
  retainedWithinPolicyCount: number;
  eligibleForPurgeCount: number;
  purgedCount: number;
  eligibleRecords: EligibleEvidenceRecord[];
}

export interface EvidencePurgeResult {
  dryRun: boolean;
  purgedCount: number;
  skippedCount: number;
  purgedIds: string[];
  skipped: Array<{ evidenceId: string; reason: string }>;
}

let isDbAvailable: boolean | null = null;
let lastDbCheck = 0;

async function checkDbAvailable(): Promise<boolean> {
  const now = Date.now();
  if (isDbAvailable !== null && now - lastDbCheck < 60_000) {
    return isDbAvailable;
  }
  lastDbCheck = now;
  try {
    if (!prisma || typeof (prisma as any).moderationEvidence === "undefined") {
      isDbAvailable = false;
      return false;
    }
    const probePromise = (prisma as any).moderationEvidence.count({ take: 1 });
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("DB probe timeout")), 800)
    );
    await Promise.race([probePromise, timeoutPromise]);
    isDbAvailable = true;
    return true;
  } catch {
    isDbAvailable = false;
    return false;
  }
}

/**
 * Generates an auditable dry-run retention eligibility report without performing
 * any destructive operations.
 */
export async function getEvidenceRetentionReport(
  actor: AuthUser,
  options?: { retentionDays?: number; dryRun?: boolean }
): Promise<EvidenceRetentionReport> {
  if (!hasPermission(actor, PERMISSIONS.MODERATION_RETENTION_MANAGE) && !hasPermission(actor, PERMISSIONS.MODERATION_CASE_READ)) {
    throw AppError.forbidden("Missing required permission to access evidence retention reports.");
  }

  const dryRun = options?.dryRun !== false; // defaults to dryRun: true
  const policy: EvidenceRetentionPolicy = {
    ...DEFAULT_RETENTION_POLICY,
    closedCaseRetentionDays: options?.retentionDays ?? DEFAULT_RETENTION_POLICY.closedCaseRetentionDays,
  };

  const dbReady = await checkDbAvailable();
  if (!dbReady) {
    return {
      timestamp: new Date().toISOString(),
      dryRun,
      retentionPolicy: policy,
      totalEvidenceCount: 0,
      activeCaseEvidenceCount: 0,
      legalHoldEvidenceCount: 0,
      pendingAppealEvidenceCount: 0,
      retainedWithinPolicyCount: 0,
      eligibleForPurgeCount: 0,
      purgedCount: 0,
      eligibleRecords: [],
    };
  }

  const allEvidence = await prisma.moderationEvidence.findMany({
    include: {
      case: {
        select: {
          id: true,
          caseReference: true,
          status: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Fetch pending appeal case IDs to strictly preserve evidence under appeal
  const pendingAppealActivities = await prisma.moderationActivity.findMany({
    where: {
      action: { in: ["APPEAL_SUBMITTED", "APPEAL_ASSIGNED"] },
    },
    select: { caseId: true },
  });
  const pendingAppealCaseIds = new Set(pendingAppealActivities.map((a: { caseId: string }) => a.caseId));

  const now = new Date();
  let totalEvidenceCount = 0;
  let activeCaseEvidenceCount = 0;
  let legalHoldEvidenceCount = 0;
  let pendingAppealEvidenceCount = 0;
  let retainedWithinPolicyCount = 0;
  let eligibleForPurgeCount = 0;
  let purgedCount = 0;
  const eligibleRecords: EligibleEvidenceRecord[] = [];

  for (const item of allEvidence) {
    totalEvidenceCount++;
    const meta = (item.metadata as Record<string, any>) || {};

    // Already purged
    if (meta.purged || item.storageReference === "PURGED") {
      purgedCount++;
      continue;
    }

    // Explicit Legal / Preservation Hold
    if (meta.retentionHold === true) {
      legalHoldEvidenceCount++;
      continue;
    }

    // Active Investigation
    const isActiveCase = ["NEW", "IN_REVIEW", "NEEDS_INFORMATION", "REOPENED"].includes(item.case.status);
    if (isActiveCase) {
      activeCaseEvidenceCount++;
      continue;
    }

    // Pending Appeal
    if (pendingAppealCaseIds.has(item.caseId)) {
      pendingAppealEvidenceCount++;
      continue;
    }

    // Case Closed — check retention period
    const closedDate = new Date(item.case.updatedAt);
    const msSinceClosed = now.getTime() - closedDate.getTime();
    const daysSinceClosed = Math.floor(msSinceClosed / (1000 * 60 * 60 * 24));

    // Custom retentionUntil override on record
    const hasExplicitRetentionExpired = item.retentionUntil ? item.retentionUntil.getTime() <= now.getTime() : false;
    const hasPolicyExpired = daysSinceClosed >= policy.closedCaseRetentionDays;

    if (hasExplicitRetentionExpired || hasPolicyExpired) {
      eligibleForPurgeCount++;
      eligibleRecords.push({
        evidenceId: item.id,
        caseId: item.caseId,
        caseReference: item.case.caseReference,
        displayName: item.displayName,
        evidenceType: item.evidenceType,
        createdAt: item.createdAt.toISOString(),
        daysOld: daysSinceClosed,
        reason: hasExplicitRetentionExpired
          ? "Explicit retention period expired"
          : `Case closed for ${daysSinceClosed} days (policy threshold: ${policy.closedCaseRetentionDays} days)`,
      });
    } else {
      retainedWithinPolicyCount++;
    }
  }

  logSecurityEvent({
    action: "EVIDENCE_RETENTION_REPORT_GENERATED",
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    severity: "INFO",
    details: {
      dryRun,
      totalEvidenceCount,
      eligibleForPurgeCount,
      legalHoldEvidenceCount,
      activeCaseEvidenceCount,
    },
  });

  return {
    timestamp: now.toISOString(),
    dryRun,
    retentionPolicy: policy,
    totalEvidenceCount,
    activeCaseEvidenceCount,
    legalHoldEvidenceCount,
    pendingAppealEvidenceCount,
    retainedWithinPolicyCount,
    eligibleForPurgeCount,
    purgedCount,
    eligibleRecords,
  };
}

/**
 * Applies an authorized legal or preservation hold to prevent evidence deletion.
 */
export async function applyEvidenceRetentionHold(
  actor: AuthUser,
  evidenceId: string,
  reason: string
): Promise<{ success: boolean; evidenceId: string; holdAppliedAt: string }> {
  if (!hasPermission(actor, PERMISSIONS.MODERATION_RETENTION_MANAGE) && !hasPermission(actor, PERMISSIONS.MODERATION_CASE_UPDATE)) {
    throw AppError.forbidden("Missing permission to apply retention hold.");
  }

  const cleanReason = (reason || "").trim();
  if (!cleanReason || cleanReason.length < 5) {
    throw AppError.badRequest("Retention hold reason is required (minimum 5 characters).");
  }

  const evidence = await prisma.moderationEvidence.findUnique({
    where: { id: evidenceId },
    select: { id: true, caseId: true, displayName: true, metadata: true },
  });
  if (!evidence) throw AppError.notFound("Moderation evidence record not found.");

  const currentMeta = (evidence.metadata as Record<string, any>) || {};
  const now = new Date().toISOString();

  await prisma.moderationEvidence.update({
    where: { id: evidenceId },
    data: {
      metadata: {
        ...currentMeta,
        retentionHold: true,
        retentionHoldReason: cleanReason,
        retentionHoldAppliedBy: actor.id,
        retentionHoldAppliedAt: now,
      },
    },
  });

  await prisma.moderationActivity.create({
    data: {
      caseId: evidence.caseId,
      actorId: actor.id,
      action: "EVIDENCE_RETENTION_HOLD_APPLIED",
      after: {
        evidenceId,
        displayName: evidence.displayName,
        reason: cleanReason,
        appliedAt: now,
      },
    },
  });

  logSecurityEvent({
    action: "EVIDENCE_RETENTION_HOLD_APPLIED",
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    caseId: evidence.caseId,
    targetType: "MODERATION_EVIDENCE",
    targetId: evidenceId,
    severity: "INFO",
    details: { reason: cleanReason },
  });

  return { success: true, evidenceId, holdAppliedAt: now };
}

/**
 * Releases a previously applied retention hold.
 */
export async function releaseEvidenceRetentionHold(
  actor: AuthUser,
  evidenceId: string,
  reason: string
): Promise<{ success: boolean; evidenceId: string; holdReleasedAt: string }> {
  if (!hasPermission(actor, PERMISSIONS.MODERATION_RETENTION_MANAGE) && !hasPermission(actor, PERMISSIONS.MODERATION_CASE_UPDATE)) {
    throw AppError.forbidden("Missing permission to release retention hold.");
  }

  const cleanReason = (reason || "").trim();
  if (!cleanReason || cleanReason.length < 5) {
    throw AppError.badRequest("Hold release justification is required (minimum 5 characters).");
  }

  const evidence = await prisma.moderationEvidence.findUnique({
    where: { id: evidenceId },
    select: { id: true, caseId: true, displayName: true, metadata: true },
  });
  if (!evidence) throw AppError.notFound("Moderation evidence record not found.");

  const currentMeta = (evidence.metadata as Record<string, any>) || {};
  if (!currentMeta.retentionHold) {
    throw AppError.badRequest("Evidence is not currently on retention hold.");
  }

  const now = new Date().toISOString();

  await prisma.moderationEvidence.update({
    where: { id: evidenceId },
    data: {
      metadata: {
        ...currentMeta,
        retentionHold: false,
        retentionHoldReleasedBy: actor.id,
        retentionHoldReleasedAt: now,
        retentionHoldReleaseReason: cleanReason,
      },
    },
  });

  await prisma.moderationActivity.create({
    data: {
      caseId: evidence.caseId,
      actorId: actor.id,
      action: "EVIDENCE_RETENTION_HOLD_RELEASED",
      after: {
        evidenceId,
        displayName: evidence.displayName,
        reason: cleanReason,
        releasedAt: now,
      },
    },
  });

  logSecurityEvent({
    action: "EVIDENCE_RETENTION_HOLD_RELEASED",
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    caseId: evidence.caseId,
    targetType: "MODERATION_EVIDENCE",
    targetId: evidenceId,
    severity: "INFO",
    details: { reason: cleanReason },
  });

  return { success: true, evidenceId, holdReleasedAt: now };
}

/**
 * Executes an authorized, permanent purge of eligible moderation evidence files.
 * Strictly blocked for active cases, pending appeals, or records under retention hold.
 */
export async function purgeEligibleEvidence(
  actor: AuthUser,
  options: {
    evidenceIds: string[];
    confirmPurge: boolean;
    dryRun?: boolean;
    reason?: string;
  }
): Promise<EvidencePurgeResult> {
  if (!hasPermission(actor, PERMISSIONS.MODERATION_EVIDENCE_PURGE) && !hasPermission(actor, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE)) {
    throw AppError.forbidden("Missing required permission to purge moderation evidence.");
  }

  if (options.confirmPurge !== true) {
    throw AppError.badRequest("Destructive evidence purge requires explicit confirmPurge: true verification flag.");
  }

  const evidenceIds = Array.isArray(options.evidenceIds) ? options.evidenceIds.filter(Boolean) : [];
  if (evidenceIds.length === 0) {
    throw AppError.badRequest("No evidence IDs specified for purge.");
  }

  const dryRun = Boolean(options.dryRun);
  const result: EvidencePurgeResult = {
    dryRun,
    purgedCount: 0,
    skippedCount: 0,
    purgedIds: [],
    skipped: [],
  };

  const records = await prisma.moderationEvidence.findMany({
    where: { id: { in: evidenceIds } },
    include: {
      case: {
        select: {
          id: true,
          caseReference: true,
          status: true,
        },
      },
    },
  });

  // Check pending appeals
  const caseIds = records.map((r: { caseId: string }) => r.caseId);
  const pendingAppeals = await prisma.moderationActivity.findMany({
    where: {
      caseId: { in: caseIds },
      action: { in: ["APPEAL_SUBMITTED", "APPEAL_ASSIGNED"] },
    },
    select: { caseId: true },
  });
  const appealPendingCaseIds = new Set(pendingAppeals.map((a: { caseId: string }) => a.caseId));

  for (const record of records) {
    const meta = (record.metadata as Record<string, any>) || {};

    // 1. Already purged
    if (meta.purged || record.storageReference === "PURGED") {
      result.skipped.push({ evidenceId: record.id, reason: "Already purged" });
      result.skippedCount++;
      continue;
    }

    // 2. Retention hold check
    if (meta.retentionHold === true) {
      result.skipped.push({ evidenceId: record.id, reason: "Blocked: Record has active legal/retention hold" });
      result.skippedCount++;
      continue;
    }

    // 3. Active investigation check
    if (["NEW", "IN_REVIEW", "NEEDS_INFORMATION", "REOPENED"].includes(record.case.status)) {
      result.skipped.push({ evidenceId: record.id, reason: `Blocked: Case is currently active (${record.case.status})` });
      result.skippedCount++;
      continue;
    }

    // 4. Pending appeal check
    if (appealPendingCaseIds.has(record.caseId)) {
      result.skipped.push({ evidenceId: record.id, reason: "Blocked: Case has a pending moderation appeal" });
      result.skippedCount++;
      continue;
    }

    // Record is eligible for purge
    if (dryRun) {
      result.purgedIds.push(record.id);
      result.purgedCount++;
      continue;
    }

    // Perform permanent storage deletion
    try {
      if (record.storageReference && record.storageReference !== "PURGED") {
        await deletePrivateMedia({
          kind: "moderation-evidence",
          fileName: record.storageReference,
        }).catch((err) => {
          console.warn(`[storage] Could not remove physical media file ${record.storageReference}:`, err);
        });
      }

      const now = new Date().toISOString();
      await prisma.moderationEvidence.update({
        where: { id: record.id },
        data: {
          storageReference: "PURGED",
          metadata: {
            ...meta,
            purged: true,
            purgedAt: now,
            purgedBy: actor.id,
            purgeReason: options.reason || "Approved lifecycle retention deletion",
          },
        },
      });

      await prisma.moderationActivity.create({
        data: {
          caseId: record.caseId,
          actorId: actor.id,
          action: "EVIDENCE_PURGED",
          after: {
            evidenceId: record.id,
            displayName: record.displayName,
            purgedAt: now,
            reason: options.reason || "Approved lifecycle retention deletion",
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          action: "MODERATION_EVIDENCE_PURGED",
          resourceType: "MODERATION_EVIDENCE",
          resourceId: record.id,
          description: `Evidence ${record.displayName || record.id} permanently purged under retention policy`,
          metadata: { caseId: record.caseId, caseReference: record.case.caseReference },
        },
      }).catch(() => undefined);

      result.purgedIds.push(record.id);
      result.purgedCount++;
    } catch (err: any) {
      result.skipped.push({
        evidenceId: record.id,
        reason: `Deletion failure: ${err?.message || "Unknown storage error"}`,
      });
      result.skippedCount++;
    }
  }

  logSecurityEvent({
    action: "EVIDENCE_PURGE_EXECUTED",
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    severity: dryRun ? "INFO" : "WARN",
    details: {
      dryRun,
      purgedCount: result.purgedCount,
      skippedCount: result.skippedCount,
    },
  });

  return result;
}

export const evidenceRetentionService = {
  getEvidenceRetentionReport,
  applyEvidenceRetentionHold,
  releaseEvidenceRetentionHold,
  purgeEligibleEvidence,
};

