import { Prisma } from "@/generated/prisma/client";
import {
  SystemAwardStatus,
  TravelAchievementDefinitionStatus,
  TravelAchievementStatus,
} from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { prisma } from "@/lib/db/prisma";
import {
  achievementDefinitionInputSchema,
  achievementDefinitionUpdateSchema,
  isReservedSystemDefinitionKey,
} from "@/lib/stayelite/admin-achievement-validation";
import { auditService } from "@/services/audit.service";
import { enqueueLoyaltyNotification } from "@/services/stayelite-notification.service";
import { evaluateDestinationAchievementsForEvidence } from "@/services/stayelite-destination-intelligence.service";
import { evaluateQualityBehaviorAchievementsForUser } from "@/services/stayelite-quality-behavior.service";

type DefinitionStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "ARCHIVED";

function displayStatus(definition: { definitionStatus: TravelAchievementDefinitionStatus; isActive: boolean }): DefinitionStatus {
  if (definition.definitionStatus === TravelAchievementDefinitionStatus.ARCHIVED) return "ARCHIVED";
  if (definition.definitionStatus === TravelAchievementDefinitionStatus.DRAFT) return "DRAFT";
  return definition.isActive ? "ACTIVE" : "PAUSED";
}

function toDefinitionDto(definition: {
  id: string; key: string; name: string; description: string; icon: string | null; category: string;
  eligibilityRule: string; threshold: number; eligibilityMetadata: Prisma.JsonValue | null; ruleVersion: number;
  isActive: boolean; awardEnabled: boolean; definitionStatus: TravelAchievementDefinitionStatus;
  publishedAt: Date | null; archivedAt: Date | null; createdAt: Date; updatedAt: Date;
  _count?: { awards: number; userAchievements: number };
}) {
  return {
    ...definition,
    status: displayStatus(definition),
    awardCount: definition._count?.awards ?? 0,
    progressRecordCount: definition._count?.userAchievements ?? 0,
    awardEnabled: false,
  };
}

async function assertDefinitionExists(id: string) {
  const definition = await prisma.travelAchievement.findUnique({
    where: { id },
    include: { _count: { select: { awards: true, userAchievements: true } } },
  });
  if (!definition) throw AppError.notFound("Achievement definition not found.");
  return definition;
}

function assertEditable(definition: Awaited<ReturnType<typeof assertDefinitionExists>>) {
  if (definition.definitionStatus !== TravelAchievementDefinitionStatus.DRAFT) {
    throw AppError.conflict("Published, paused, and archived definitions are immutable. Create a new draft rule version instead.");
  }
  if (definition._count.awards > 0 || definition._count.userAchievements > 0) {
    throw AppError.conflict("A definition with recorded progress or awards is immutable to preserve historical evidence.");
  }
}

export async function listAdminAchievementDefinitions(filters: {
  search?: string; status?: DefinitionStatus | "ALL"; category?: string; page?: number; limit?: number;
} = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 25));
  const search = filters.search?.trim();
  const status = filters.status ?? "ALL";
  const where: Prisma.TravelAchievementWhereInput = {
    ...(filters.category ? { category: filters.category as never } : {}),
    ...(status === "DRAFT" ? { definitionStatus: TravelAchievementDefinitionStatus.DRAFT } : {}),
    ...(status === "ARCHIVED" ? { definitionStatus: TravelAchievementDefinitionStatus.ARCHIVED } : {}),
    ...(status === "ACTIVE" ? { definitionStatus: TravelAchievementDefinitionStatus.PUBLISHED, isActive: true } : {}),
    ...(status === "PAUSED" ? { definitionStatus: TravelAchievementDefinitionStatus.PUBLISHED, isActive: false } : {}),
    ...(search ? { OR: [
      { key: { contains: search, mode: "insensitive" } }, { name: { contains: search, mode: "insensitive" } },
      { description: { contains: search, mode: "insensitive" } }, { eligibilityRule: { contains: search, mode: "insensitive" } },
    ] } : {}),
  };
  const [definitions, total] = await Promise.all([
    prisma.travelAchievement.findMany({ where, include: { _count: { select: { awards: true, userAchievements: true } } }, orderBy: [{ updatedAt: "desc" }, { key: "asc" }], skip: (page - 1) * limit, take: limit }),
    prisma.travelAchievement.count({ where }),
  ]);
  return { data: definitions.map(toDefinitionDto), pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function getAdminAchievementDefinition(id: string) {
  return toDefinitionDto(await assertDefinitionExists(id));
}

export async function createAdminAchievementDefinition(actor: AuthUser, input: unknown) {
  const parsed = achievementDefinitionInputSchema.parse(input);
  if (isReservedSystemDefinitionKey(parsed.key)) {
    throw AppError.forbidden("System-managed definition keys may only be created by the approved evaluator catalog.");
  }
  const definition = await prisma.travelAchievement.create({
    data: { ...parsed, icon: parsed.icon ?? null, eligibilityMetadata: (parsed.eligibilityMetadata ?? {}) as Prisma.InputJsonValue,
      definitionStatus: TravelAchievementDefinitionStatus.DRAFT, isActive: false, awardEnabled: false, ruleVersion: 1 },
    include: { _count: { select: { awards: true, userAchievements: true } } },
  });
  await auditService.record({ actorId: actor.id, actorEmail: actor.email ?? null, action: "ACHIEVEMENT_DEFINITION_CREATED", resourceType: "TRAVEL_ACHIEVEMENT", resourceId: definition.id, description: "Created a draft achievement definition.", metadata: { key: definition.key, ruleVersion: definition.ruleVersion } });
  return toDefinitionDto(definition);
}

export async function updateAdminAchievementDefinition(actor: AuthUser, id: string, input: unknown) {
  const parsed = achievementDefinitionUpdateSchema.parse(input);
  const existing = await assertDefinitionExists(id);
  assertEditable(existing);
  const definition = await prisma.travelAchievement.update({
    where: { id }, data: { ...parsed, icon: parsed.icon === undefined ? undefined : parsed.icon, eligibilityMetadata: parsed.eligibilityMetadata as Prisma.InputJsonValue | undefined, ruleVersion: { increment: 1 } },
    include: { _count: { select: { awards: true, userAchievements: true } } },
  });
  await auditService.record({ actorId: actor.id, actorEmail: actor.email ?? null, action: "ACHIEVEMENT_DEFINITION_UPDATED", resourceType: "TRAVEL_ACHIEVEMENT", resourceId: id, description: "Updated a draft achievement definition.", metadata: { key: definition.key, ruleVersion: definition.ruleVersion } });
  return toDefinitionDto(definition);
}

export async function publishAdminAchievementDefinition(actor: AuthUser, id: string) {
  const existing = await assertDefinitionExists(id);
  if (existing.definitionStatus !== TravelAchievementDefinitionStatus.DRAFT) throw AppError.conflict("Only draft definitions can be published.");
  const definition = await prisma.travelAchievement.update({
    where: { id }, data: { definitionStatus: TravelAchievementDefinitionStatus.PUBLISHED, isActive: true, awardEnabled: false, publishedAt: new Date() },
    include: { _count: { select: { awards: true, userAchievements: true } } },
  });
  await auditService.record({ actorId: actor.id, actorEmail: actor.email ?? null, action: "ACHIEVEMENT_DEFINITION_PUBLISHED", resourceType: "TRAVEL_ACHIEVEMENT", resourceId: id, description: "Published an achievement definition with automatic awarding disabled.", metadata: { key: definition.key, ruleVersion: definition.ruleVersion, automaticAwarding: false } });
  return toDefinitionDto(definition);
}

export async function setAdminAchievementDefinitionPaused(actor: AuthUser, id: string, paused: boolean) {
  const existing = await assertDefinitionExists(id);
  if (existing.definitionStatus !== TravelAchievementDefinitionStatus.PUBLISHED) throw AppError.conflict("Only published definitions can be paused or resumed.");
  const definition = await prisma.travelAchievement.update({ where: { id }, data: { isActive: !paused, awardEnabled: false }, include: { _count: { select: { awards: true, userAchievements: true } } } });
  await auditService.record({ actorId: actor.id, actorEmail: actor.email ?? null, action: paused ? "ACHIEVEMENT_DEFINITION_PAUSED" : "ACHIEVEMENT_DEFINITION_RESUMED", resourceType: "TRAVEL_ACHIEVEMENT", resourceId: id, description: `${paused ? "Paused" : "Resumed"} an achievement definition; automatic awarding remains disabled.`, metadata: { key: definition.key, ruleVersion: definition.ruleVersion } });
  return toDefinitionDto(definition);
}

export async function archiveAdminAchievementDefinition(actor: AuthUser, id: string) {
  const existing = await assertDefinitionExists(id);
  const definition = await prisma.travelAchievement.update({ where: { id }, data: { definitionStatus: TravelAchievementDefinitionStatus.ARCHIVED, isActive: false, awardEnabled: false, archivedAt: new Date() }, include: { _count: { select: { awards: true, userAchievements: true } } } });
  await auditService.record({ actorId: actor.id, actorEmail: actor.email ?? null, action: "ACHIEVEMENT_DEFINITION_ARCHIVED", resourceType: "TRAVEL_ACHIEVEMENT", resourceId: id, description: "Archived an achievement definition without deleting historical progress or awards.", metadata: { key: definition.key, wasSystemManaged: isReservedSystemDefinitionKey(definition.key) } });
  return toDefinitionDto(definition);
}

export async function previewAdminAchievementEligibility(id: string, userId: string) {
  const definition = await assertDefinitionExists(id);
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!user) throw AppError.notFound("Guest not found.");
  const quality = await evaluateQualityBehaviorAchievementsForUser(userId);
  const match = quality.find((result) => result.key === definition.key);
  if (match) return { definitionId: id, userId, previewOnly: true, evaluator: "QUALITY_BEHAVIOR", result: match, awarded: false };
  if (definition.eligibilityRule === "DESTINATION_INTELLIGENCE") {
    const evidence = await prisma.bookingVisitEvidence.findFirst({ where: { userId, status: "QUALIFIED" }, orderBy: { updatedAt: "desc" }, select: { id: true } });
    if (!evidence) return { definitionId: id, userId, previewOnly: true, evaluator: "DESTINATION_INTELLIGENCE", result: null, awarded: false, blockers: ["NO_QUALIFYING_DESTINATION_EVIDENCE"] };
    const destination = await evaluateDestinationAchievementsForEvidence(evidence.id);
    return { definitionId: id, userId, previewOnly: true, evaluator: "DESTINATION_INTELLIGENCE", result: destination.results.find((result) => result.key === definition.key) ?? null, awarded: false };
  }
  return { definitionId: id, userId, previewOnly: true, evaluator: "UNSUPPORTED_RULE_ADAPTER", result: null, awarded: false, blockers: ["NO_APPROVED_EVALUATOR_REGISTERED_FOR_THIS_DEFINITION"] };
}

export async function manuallyAwardAchievement(actor: AuthUser, input: { achievementId: string; userId: string; reason: string }) {
  if (!input.reason?.trim()) throw AppError.validation("An override reason is required.");
  const definition = await assertDefinitionExists(input.achievementId);
  if (definition.definitionStatus !== TravelAchievementDefinitionStatus.PUBLISHED || !definition.isActive) throw AppError.conflict("Only active published definitions may receive an authorized manual award.");
  const guest = await prisma.user.findUnique({ where: { id: input.userId }, select: { id: true } });
  if (!guest) throw AppError.notFound("Guest not found.");
  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.achievementAward.findUnique({ where: { userId_achievementId_ruleVersion: { userId: input.userId, achievementId: definition.id, ruleVersion: definition.ruleVersion } } });
    if (existing?.status === SystemAwardStatus.ACTIVE) return { award: existing, duplicate: true };
    const progress = await tx.userTravelAchievement.upsert({ where: { userId_achievementId: { userId: input.userId, achievementId: definition.id } }, create: { userId: input.userId, achievementId: definition.id, status: TravelAchievementStatus.UNLOCKED, progress: definition.threshold, awardedAt: new Date(), ruleVersion: definition.ruleVersion, lastEvaluatedAt: new Date(), auditMetadata: { manualOverride: true, reason: input.reason.trim(), actorId: actor.id } }, update: { status: TravelAchievementStatus.UNLOCKED, progress: definition.threshold, awardedAt: new Date(), revokedAt: null, revocationReason: null, ruleVersion: definition.ruleVersion, lastEvaluatedAt: new Date(), auditMetadata: { manualOverride: true, reason: input.reason.trim(), actorId: actor.id } } });
    const award = existing ? await tx.achievementAward.update({ where: { id: existing.id }, data: { status: SystemAwardStatus.ACTIVE, awardedAt: new Date(), revokedAt: null, revocationReason: null, revokedByUserId: null, userAchievementId: progress.id, evidenceSnapshot: { manualOverride: true, reason: input.reason.trim(), actorId: actor.id } } }) : await tx.achievementAward.create({ data: { userId: input.userId, achievementId: definition.id, userAchievementId: progress.id, ruleVersion: definition.ruleVersion, evidenceSnapshot: { manualOverride: true, reason: input.reason.trim(), actorId: actor.id } } });
    return { award, duplicate: false };
  });
  await auditService.record({ actorId: actor.id, actorEmail: actor.email ?? null, action: "ACHIEVEMENT_MANUAL_AWARD", resourceType: "ACHIEVEMENT_AWARD", resourceId: result.award.id, description: "Applied an authorized, auditable manual achievement award.", metadata: { achievementId: definition.id, guestId: input.userId, reason: input.reason.trim(), duplicate: result.duplicate } });
  if (!result.duplicate) {
    await enqueueLoyaltyNotification({ event: "ACHIEVEMENT_EARNED", userId: input.userId, sourceId: result.award.id, sourceType: "ACHIEVEMENT_AWARD", label: definition.name, occurredAt: result.award.awardedAt, metadata: { achievementId: definition.id, ruleVersion: definition.ruleVersion, override: true } });
  }
  return result;
}

export async function revokeAchievementAward(actor: AuthUser, input: { awardId: string; reason: string }) {
  if (!input.reason?.trim()) throw AppError.validation("A revocation reason is required.");
  const award = await prisma.achievementAward.findUnique({ where: { id: input.awardId }, include: { userAchievement: true } });
  if (!award) throw AppError.notFound("Achievement award not found.");
  if (award.status === SystemAwardStatus.REVOKED) return award;
  const revoked = await prisma.$transaction(async (tx) => {
    const updated = await tx.achievementAward.update({ where: { id: award.id }, data: { status: SystemAwardStatus.REVOKED, revokedAt: new Date(), revocationReason: input.reason.trim(), revokedByUserId: actor.id } });
    if (award.userAchievementId) await tx.userTravelAchievement.update({ where: { id: award.userAchievementId }, data: { status: TravelAchievementStatus.REVOKED, revokedAt: new Date(), revocationReason: input.reason.trim() } });
    return updated;
  });
  await auditService.record({ actorId: actor.id, actorEmail: actor.email ?? null, action: "ACHIEVEMENT_AWARD_REVOKED", resourceType: "ACHIEVEMENT_AWARD", resourceId: award.id, description: "Revoked an achievement award without deleting provenance.", metadata: { achievementId: award.achievementId, guestId: award.userId, reason: input.reason.trim() } });
  await enqueueLoyaltyNotification({ event: "ACHIEVEMENT_REVOKED", userId: award.userId, sourceId: award.id, sourceType: "ACHIEVEMENT_AWARD", occurredAt: revoked.revokedAt ?? new Date(), metadata: { achievementId: award.achievementId } });
  return revoked;
}

export const adminAchievementService = { listAdminAchievementDefinitions, getAdminAchievementDefinition, createAdminAchievementDefinition, updateAdminAchievementDefinition, publishAdminAchievementDefinition, setAdminAchievementDefinitionPaused, archiveAdminAchievementDefinition, previewAdminAchievementEligibility, manuallyAwardAchievement, revokeAchievementAward };
