import { randomUUID } from "crypto";

import {
  ReferralRewardStatus,
  StayEliteReconciliationDomain,
  StayEliteReconciliationMode,
  StayEliteReconciliationStatus,
} from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { auditService } from "@/services/audit.service";
import { reconcileAchievementEvidence, reconcileStayEliteAchievementIntelligence } from "@/services/achievement-reconciliation.service";
import { getAdminLoyaltyAnalytics } from "@/services/admin-loyalty-analytics.service";
import { getLoyaltyDeliveryDiagnostics } from "@/services/admin-loyalty-delivery.service";
import { reconcileStayEliteTiers } from "@/services/stayelite-tier.service";

export const RECONCILIATION_DOMAINS = Object.values(StayEliteReconciliationDomain);
export const RECONCILIATION_MODES = Object.values(StayEliteReconciliationMode);

export type ReconciliationActor = { id: string; email?: string | null };
export type ReconciliationInput = {
  domain: StayEliteReconciliationDomain;
  mode?: StayEliteReconciliationMode;
  batchSize?: number;
  userId?: string;
  cursor?: string;
  idempotencyKey?: string;
};

type BatchSummary = {
  scanned: number;
  matching: number;
  missing: number;
  inconsistent: number;
  blocked: number;
  corrected: number;
  nextCursor: string | null;
  issues: Array<{ severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; code: string; count: number; sourceIds?: string[]; detail?: string }>;
  report: Record<string, unknown>;
};

function boundedBatchSize(value?: number) { return Math.min(200, Math.max(1, value ?? 50)); }
function json(value: unknown) { return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue; }
function assertMode(input: ReconciliationInput) {
  const mode = input.mode ?? StayEliteReconciliationMode.DRY_RUN;
  if (!RECONCILIATION_MODES.includes(mode)) throw AppError.validation("Unsupported reconciliation mode.");
  if (!RECONCILIATION_DOMAINS.includes(input.domain)) throw AppError.validation("Unsupported reconciliation domain.");
  if (mode === StayEliteReconciliationMode.EVIDENCE_ONLY && input.domain !== StayEliteReconciliationDomain.BOOKING_EVIDENCE) {
    throw AppError.validation("Evidence-only mode is currently supported only for booking evidence.");
  }
  return mode;
}

/** Creates an auditable job record. Creation has no business side effects. */
export async function createStayEliteReconciliationRun(actor: ReconciliationActor, input: ReconciliationInput) {
  const mode = assertMode(input);
  const idempotencyKey = input.idempotencyKey?.trim() || `stayelite-reconciliation:${actor.id}:${randomUUID()}`;
  const existing = await prisma.stayEliteReconciliationRun.findUnique({ where: { idempotencyKey } });
  if (existing) return existing;
  const run = await prisma.stayEliteReconciliationRun.create({
    data: {
      domain: input.domain, mode, batchSize: boundedBatchSize(input.batchSize), initiatedById: actor.id,
      correlationId: randomUUID(), idempotencyKey,
      cursor: input.cursor ?? null,
      scope: input.userId ? { userId: input.userId } : undefined,
    },
  });
  await auditService.record({ actorId: actor.id, actorEmail: actor.email ?? null, action: "STAYELITE_RECONCILIATION_CREATED", resourceType: "STAYELITE_RECONCILIATION_RUN", resourceId: run.id, description: "Created a bounded StayElite reconciliation run.", metadata: { domain: run.domain, mode: run.mode, correlationId: run.correlationId } });
  return run;
}

async function bookingEvidenceBatch(run: { id: string; mode: StayEliteReconciliationMode; batchSize: number; cursor: string | null }) : Promise<BatchSummary> {
  const result = await reconcileAchievementEvidence({
    dryRun: run.mode === StayEliteReconciliationMode.DRY_RUN,
    persistEvidence: run.mode === StayEliteReconciliationMode.EVIDENCE_ONLY,
    limit: run.batchSize, cursor: run.cursor ?? undefined, checkpointScope: `stayelite-phase-12:${run.id}`,
  });
  const matching = Math.max(0, result.scannedCount - result.candidateCount - result.unsupportedCount - result.skippedIncompleteCount);
  return {
    scanned: result.scannedCount, matching, missing: result.candidateCount, inconsistent: result.duplicateCount,
    blocked: result.unsupportedCount + result.skippedIncompleteCount, corrected: result.persisted ? result.candidateCount : 0,
    nextCursor: result.nextCursor,
    issues: [
      ...(result.candidateCount ? [{ severity: "HIGH" as const, code: "MISSING_CANDIDATE_EVIDENCE", count: result.candidateCount }] : []),
      ...(result.duplicateCount ? [{ severity: "HIGH" as const, code: "DUPLICATE_OR_EXISTING_EVIDENCE", count: result.duplicateCount }] : []),
      ...(result.unsupportedCount ? [{ severity: "MEDIUM" as const, code: "MISSING_DESTINATION", count: result.unsupportedCount }] : []),
      ...(result.skippedIncompleteCount ? [{ severity: "MEDIUM" as const, code: "COMPLETION_POLICY_OR_INCOMPLETE_SOURCE", count: result.skippedIncompleteCount }] : []),
    ], report: result as unknown as Record<string, unknown>,
  };
}

async function intelligenceBatch(run: { batchSize: number; cursor: string | null; scope: Prisma.JsonValue | null }): Promise<BatchSummary> {
  const userId = typeof (run.scope as { userId?: unknown } | null)?.userId === "string" ? (run.scope as { userId: string }).userId : undefined;
  const result = await reconcileStayEliteAchievementIntelligence({ userId, cursor: run.cursor ?? undefined, limit: run.batchSize });
  const destination = result.destination;
  const quality = result.qualityBehavior;
  const tiers = result.tiers;
  const missing = destination.unresolvedDestinationCount + destination.missingTaxonomyEvidenceIds.length;
  const inconsistent = destination.duplicateDefinitionKeys.length;
  const blocked = quality.reports.flatMap((report) => report.results).filter((item) => item.policyBlockers.length > 0).length
    + tiers.reports.filter((report) => report.result.policyBlockers.length > 0).length;
  return {
    scanned: destination.scannedEvidenceCount + quality.processedUsers + tiers.processedUsers,
    matching: destination.qualifiedEvidenceCount, missing, inconsistent, blocked, corrected: 0,
    nextCursor: destination.nextCursor ?? quality.nextCursor ?? tiers.nextCursor,
    issues: [
      ...(missing ? [{ severity: "HIGH" as const, code: "DESTINATION_EVIDENCE_REQUIRES_REVIEW", count: missing, sourceIds: destination.missingTaxonomyEvidenceIds.slice(0, 50) }] : []),
      ...(inconsistent ? [{ severity: "HIGH" as const, code: "DUPLICATE_ACHIEVEMENT_DEFINITION_KEY", count: inconsistent }] : []),
      ...(blocked ? [{ severity: "MEDIUM" as const, code: "POLICY_BLOCKED_ACHIEVEMENT_OR_TIER_PROGRESS", count: blocked }] : []),
    ],
    report: { destination, qualityBehavior: quality, tiers, awardIssued: false },
  };
}

async function tierBatch(run: { batchSize: number; cursor: string | null; scope: Prisma.JsonValue | null }): Promise<BatchSummary> {
  const userId = typeof (run.scope as { userId?: unknown } | null)?.userId === "string" ? (run.scope as { userId: string }).userId : undefined;
  const result = await reconcileStayEliteTiers({ userId, cursor: run.cursor ?? undefined, limit: run.batchSize, persist: false });
  const blocked = result.reports.filter(({ result: value }) => value.policyBlockers.length > 0).length;
  const proposed = result.reports.filter(({ result: value }) => Boolean(value.proposedTransition)).length;
  const missingMembership = result.reports.filter(({ result: value }) => !value.currentTier && value.completedQualifyingStayCount > 0).length;
  return {
    scanned: result.processedUsers, matching: Math.max(0, result.processedUsers - blocked - proposed - missingMembership), missing: missingMembership,
    inconsistent: proposed, blocked, corrected: 0, nextCursor: result.nextCursor,
    issues: [
      ...(missingMembership ? [{ severity: "HIGH" as const, code: "MISSING_MEMBERSHIP_PROJECTION", count: missingMembership }] : []),
      ...(proposed ? [{ severity: "HIGH" as const, code: "MEMBERSHIP_DIFFERS_FROM_RECOMPUTED_ELIGIBILITY", count: proposed }] : []),
      ...(blocked ? [{ severity: "MEDIUM" as const, code: "TIER_POLICY_BLOCKED", count: blocked }] : []),
    ], report: result,
  };
}

async function referralBatch(run: { batchSize: number; cursor: string | null; scope: Prisma.JsonValue | null }): Promise<BatchSummary> {
  const userId = typeof (run.scope as { userId?: unknown } | null)?.userId === "string" ? (run.scope as { userId: string }).userId : undefined;
  const rows = await prisma.referralReward.findMany({
    where: { ...(run.cursor ? { id: { gt: run.cursor } } : {}), ...(userId ? { inviterId: userId } : {}) }, orderBy: { id: "asc" }, take: run.batchSize,
    select: { id: true, inviterId: true, referredUserId: true, status: true, qualifyingBooking: { select: { userId: true } } },
  });
  const selfReferral = rows.filter((row) => row.inviterId === row.referredUserId).map((row) => row.id);
  const wrongBookingOwner = rows.filter((row) => row.qualifyingBooking.userId !== row.referredUserId).map((row) => row.id);
  const pending = rows.filter((row) => row.status === ReferralRewardStatus.PENDING).length;
  return {
    scanned: rows.length, matching: Math.max(0, rows.length - selfReferral.length - wrongBookingOwner.length - pending), missing: 0,
    inconsistent: selfReferral.length + wrongBookingOwner.length, blocked: pending, corrected: 0,
    nextCursor: rows.length === run.batchSize ? rows.at(-1)?.id ?? null : null,
    issues: [
      ...(selfReferral.length ? [{ severity: "CRITICAL" as const, code: "SELF_REFERRAL", count: selfReferral.length, sourceIds: selfReferral.slice(0, 50) }] : []),
      ...(wrongBookingOwner.length ? [{ severity: "HIGH" as const, code: "REFERRAL_BOOKING_OWNER_MISMATCH", count: wrongBookingOwner.length, sourceIds: wrongBookingOwner.slice(0, 50) }] : []),
      ...(pending ? [{ severity: "MEDIUM" as const, code: "REFERRAL_PENDING_REVIEW_NOT_QUALIFIED", count: pending }] : []),
    ], report: { pendingNotQualified: pending, rewardIssuance: "No points ledger is implemented; no reward issuance or balance repair was attempted." },
  };
}

async function notificationActivityBatch(run: { batchSize: number; cursor: string | null }): Promise<BatchSummary> {
  const [activities, diagnostics] = await Promise.all([
    prisma.loyaltyActivity.findMany({ where: run.cursor ? { id: { gt: run.cursor } } : {}, orderBy: { id: "asc" }, take: run.batchSize, select: { id: true, sourceType: true, sourceId: true } }),
    getLoyaltyDeliveryDiagnostics(run.batchSize),
  ]);
  const invalidSource = activities.filter((item) => !item.sourceType || !item.sourceId).map((item) => item.id);
  const failed = diagnostics.items.filter((item) => item.lastError).length;
  return {
    scanned: activities.length + diagnostics.scanned, matching: Math.max(0, activities.length - invalidSource.length), missing: 0,
    inconsistent: invalidSource.length, blocked: failed, corrected: 0,
    nextCursor: activities.length === run.batchSize ? activities.at(-1)?.id ?? null : null,
    issues: [
      ...(invalidSource.length ? [{ severity: "MEDIUM" as const, code: "ACTIVITY_MISSING_SOURCE_REFERENCE", count: invalidSource.length, sourceIds: invalidSource.slice(0, 50) }] : []),
      ...(failed ? [{ severity: "MEDIUM" as const, code: "LOYALTY_NOTIFICATION_DELIVERY_FAILURE", count: failed }] : []),
      { severity: "LOW" as const, code: "HISTORICAL_DELIVERY_UNVERIFIABLE", count: diagnostics.scanned, detail: "Persisted in-app intents do not prove email, SMS, or push delivery." },
    ], report: { diagnostics, historicalInstrumentation: "Pre-Phase-11 activity and notification intent cannot be reconstructed without a trusted source event." },
  };
}

async function analyticsBatch(): Promise<BatchSummary> {
  const result = await getAdminLoyaltyAnalytics();
  return { scanned: 0, matching: 0, missing: 0, inconsistent: 0, blocked: 3, corrected: 0, nextCursor: null,
    issues: [
      { severity: "LOW", code: "POINTS_ANALYTICS_UNAVAILABLE", count: 1, detail: result.unavailable.points },
      { severity: "LOW", code: "REWARDS_ANALYTICS_UNAVAILABLE", count: 1, detail: result.unavailable.rewards },
      { severity: "LOW", code: "CAMPAIGN_ANALYTICS_UNAVAILABLE", count: 1, detail: result.unavailable.campaigns },
    ], report: result };
}

async function unavailableBatch(domain: StayEliteReconciliationDomain): Promise<BatchSummary> {
  const capability = domain === StayEliteReconciliationDomain.POINTS_LEDGER ? "points ledger" : "reward redemption and fulfillment";
  return { scanned: 0, matching: 0, missing: 0, inconsistent: 0, blocked: 1, corrected: 0, nextCursor: null,
    issues: [{ severity: "CRITICAL", code: "CAPABILITY_NOT_IMPLEMENTED", count: 1, detail: `No authoritative ${capability} exists in this repository; no replacement ledger or redemption data was created.` }],
    report: { available: false, domain, capability } };
}

/** Executes one stable cursor batch. It never promotes, downgrades, awards, issues points, or changes rewards. */
export async function executeStayEliteReconciliationRun(runId: string, actor?: ReconciliationActor) {
  const claimed = await prisma.stayEliteReconciliationRun.updateMany({
    where: { id: runId, status: { in: [StayEliteReconciliationStatus.CREATED, StayEliteReconciliationStatus.FAILED, StayEliteReconciliationStatus.COMPLETED_WITH_ISSUES] } },
    data: { status: StayEliteReconciliationStatus.RUNNING, startedAt: new Date(), lastError: null },
  });
  if (!claimed.count) throw AppError.conflict("This reconciliation run is already running, cancelled, or completed.");
  const run = await prisma.stayEliteReconciliationRun.findUniqueOrThrow({ where: { id: runId } });
  try {
    const batch = await (async () => {
      switch (run.domain) {
        case StayEliteReconciliationDomain.BOOKING_EVIDENCE: return bookingEvidenceBatch(run);
        case StayEliteReconciliationDomain.ACHIEVEMENT_INTELLIGENCE: return intelligenceBatch(run);
        case StayEliteReconciliationDomain.TIER_MEMBERSHIP: return tierBatch(run);
        case StayEliteReconciliationDomain.REFERRAL: return referralBatch(run);
        case StayEliteReconciliationDomain.NOTIFICATION_ACTIVITY: return notificationActivityBatch(run);
        case StayEliteReconciliationDomain.ANALYTICS: return analyticsBatch();
        case StayEliteReconciliationDomain.POINTS_LEDGER:
        case StayEliteReconciliationDomain.REWARD_REDEMPTION: return unavailableBatch(run.domain);
      }
    })();
    const isComplete = batch.nextCursor === null;
    const hasIssues = batch.missing + batch.inconsistent + batch.blocked > 0;
    const updated = await prisma.stayEliteReconciliationRun.update({ where: { id: run.id }, data: {
      cursor: batch.nextCursor,
      scannedCount: { increment: batch.scanned }, matchingCount: { increment: batch.matching }, missingCount: { increment: batch.missing }, inconsistentCount: { increment: batch.inconsistent }, blockedCount: { increment: batch.blocked }, correctedCount: { increment: batch.corrected },
      status: isComplete ? (hasIssues ? StayEliteReconciliationStatus.COMPLETED_WITH_ISSUES : StayEliteReconciliationStatus.COMPLETED) : StayEliteReconciliationStatus.CREATED,
      completedAt: isComplete ? new Date() : null, report: json({ ...batch.report, issues: batch.issues, latestBatch: { scanned: batch.scanned, matching: batch.matching, missing: batch.missing, inconsistent: batch.inconsistent, blocked: batch.blocked, corrected: batch.corrected, nextCursor: batch.nextCursor } }),
    } });
    await auditService.record({ actorId: actor?.id ?? run.initiatedById, actorEmail: actor?.email ?? null, action: "STAYELITE_RECONCILIATION_BATCH_EXECUTED", resourceType: "STAYELITE_RECONCILIATION_RUN", resourceId: run.id, description: "Executed a bounded StayElite reconciliation batch.", metadata: { domain: run.domain, mode: run.mode, correlationId: run.correlationId, nextCursor: batch.nextCursor, issues: batch.issues.map(({ code, count }) => ({ code, count })) } });
    return updated;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown reconciliation failure";
    await prisma.stayEliteReconciliationRun.update({ where: { id: run.id }, data: { status: StayEliteReconciliationStatus.FAILED, errorCount: { increment: 1 }, lastError: message, completedAt: new Date() } });
    throw error;
  }
}

export async function listStayEliteReconciliationRuns(limit = 50) {
  return prisma.stayEliteReconciliationRun.findMany({ orderBy: { createdAt: "desc" }, take: Math.min(100, Math.max(1, limit)), select: { id: true, domain: true, mode: true, status: true, correlationId: true, cursor: true, batchSize: true, scannedCount: true, matchingCount: true, missingCount: true, inconsistentCount: true, blockedCount: true, correctedCount: true, errorCount: true, report: true, lastError: true, startedAt: true, completedAt: true, createdAt: true, initiatedBy: { select: { id: true, name: true, email: true } } } });
}

export async function cancelStayEliteReconciliationRun(runId: string, actor: ReconciliationActor) {
  const run = await prisma.stayEliteReconciliationRun.update({ where: { id: runId, status: { in: [StayEliteReconciliationStatus.CREATED, StayEliteReconciliationStatus.FAILED] } }, data: { status: StayEliteReconciliationStatus.CANCELLED, completedAt: new Date() } }).catch(() => { throw AppError.conflict("Only a queued or failed reconciliation run can be cancelled."); });
  await auditService.record({ actorId: actor.id, actorEmail: actor.email ?? null, action: "STAYELITE_RECONCILIATION_CANCELLED", resourceType: "STAYELITE_RECONCILIATION_RUN", resourceId: run.id, description: "Cancelled a queued StayElite reconciliation run.", metadata: { correlationId: run.correlationId } });
  return run;
}
