import "server-only";

import path from "node:path";
import { nanoid } from "nanoid";
import { Prisma } from "@/generated/prisma/client";
import {
  ListingStatus,
  ModerationCaseStatus,
  ModerationEvidenceType,
  ModerationSeverity,
  ModerationTargetType,
  NotificationType,
  Role,
} from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import type { AuthUser } from "@/lib/auth/types";
import { hasPermission, PERMISSIONS } from "@/lib/permissions/permissions";
import { MODERATION_POLICY_VERSION, getModerationPolicy } from "@/lib/moderation/policies";
import { assertValidModerationTransition } from "@/lib/moderation/lifecycle";
import { deletePrivateMedia, readPrivateMedia, savePrivateMedia } from "@/lib/storage/media";
import { invalidateListingCache, invalidateUserCache } from "@/lib/redis/invalidation";
import { notificationService } from "@/services/notification.service";
import { reviewService } from "@/services/review.service";
import { listingService } from "@/services/listing.service";

const ACTIVE_CASE_STATUSES: ModerationCaseStatus[] = ["NEW", "IN_REVIEW", "NEEDS_INFORMATION", "REOPENED"];
const MODERATION_SORTS = ["newest", "oldest", "updated", "priority", "severity", "reports"] as const;
let moderationSchemaVerifiedUntil = 0;

export type ModerationCaseListQuery = {
  page?: number;
  limit?: number;
  status?: ModerationCaseStatus;
  targetType?: ModerationTargetType;
  severity?: ModerationSeverity;
  category?: string;
  assigned?: "assigned" | "unassigned";
  attention?: boolean;
  priority?: "elevated" | "normal";
  assignedModeratorId?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  updatedStartDate?: string;
  updatedEndDate?: string;
  sort?: (typeof MODERATION_SORTS)[number];
};

export type ModerationDashboardQuery = Pick<ModerationCaseListQuery, "startDate" | "endDate">;

export type CreateModerationReportInput = {
  targetType: ModerationTargetType;
  targetId: string;
  category: string;
  reasonCode: string;
  description?: string;
  relatedBookingId?: string;
};

type TargetContext = { listingId?: string; ownerId?: string };
type UploadedModerationEvidence = { fileName: string; mimeType: string; buffer: Buffer };

function canModerate(actor: AuthUser, permission: string = PERMISSIONS.MODERATION_CASE_READ) {
  return hasPermission(actor, permission);
}

function canCreateReport(actor: AuthUser) {
  // The existing role model grants ordinary authenticated users report intake;
  // this is the role mapping for moderation.report.create until generalized
  // multi-role RBAC is introduced.
  return actor.role === Role.USER || actor.role === Role.HOST || canModerate(actor, PERMISSIONS.MODERATION_REPORT_CREATE);
}

function assertModerator(actor: AuthUser, permission: string) {
  if (!canModerate(actor, permission)) throw AppError.forbidden(`Missing required permission: ${permission}`);
}

function parseDate(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
    : value);
  if (Number.isNaN(date.getTime())) throw AppError.badRequest("Invalid moderation date filter.");
  return date;
}

function toPagination(page: number | undefined, limit: number | undefined) {
  const resolvedPage = Math.max(1, Number(page) || 1);
  const resolvedLimit = Math.min(50, Math.max(1, Number(limit) || 20));
  return { page: resolvedPage, limit: resolvedLimit, skip: (resolvedPage - 1) * resolvedLimit };
}

function assertEnumValue<T extends Record<string, string>>(value: string | undefined, enumValues: T, label: string) {
  if (value && !Object.values(enumValues).includes(value)) throw AppError.badRequest(`Invalid moderation ${label}.`);
}

function publicEvidenceSelect() {
  return {
    id: true,
    caseId: true,
    submittedById: true,
    evidenceType: true,
    displayName: true,
    accessScope: true,
    retentionUntil: true,
    metadata: true,
    createdAt: true,
    submittedBy: { select: { id: true, name: true, email: true } },
  } as const;
}

function isPriorityCase(caseRecord: { severity: ModerationSeverity; priority: number }) {
  return caseRecord.severity === "HIGH" || caseRecord.severity === "CRITICAL" || caseRecord.priority >= 1;
}

async function notifyEligibleModerators(caseRecord: { id: string; caseReference: string; severity: ModerationSeverity; priority: number }) {
  if (!isPriorityCase(caseRecord)) return;
  const recipients = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { role: Role.ADMIN },
        { adminRole: { is: { permissions: { some: { permission: { slug: { in: [PERMISSIONS.MODERATION_CASE_READ, PERMISSIONS.MODERATION_CASE_UPDATE] } } } } } } },
      ],
    },
    select: { id: true },
    take: 100,
  });
  await Promise.all(recipients.map((recipient: { id: string }) => notificationService.create({
    userId: recipient.id,
    type: NotificationType.SYSTEM,
    title: "High-priority moderation case",
    message: `${caseRecord.caseReference} requires moderation attention.`,
    entityId: caseRecord.id,
    entityType: "moderation-high-priority",
    link: `/admin/moderation/cases/${caseRecord.id}`,
    metadata: { moderationCaseId: caseRecord.id, recipientRole: "ADMIN" },
  }).catch((error) => console.warn("[moderation.service] Failed to notify moderator:", error))));
}

async function notifyCaseAssignment(params: {
  caseId: string;
  caseReference: string;
  actorId: string;
  previousAssigneeId: string | null;
  nextAssigneeId: string | null;
  status: ModerationCaseStatus;
  updatedAt: Date;
}) {
  const event = `moderation-assignment-${params.caseId}-${params.updatedAt.getTime()}`;
  const link = `/admin/moderation/cases/${params.caseId}`;
  const notifications: Promise<unknown>[] = [];
  if (params.previousAssigneeId && params.previousAssigneeId !== params.nextAssigneeId && params.previousAssigneeId !== params.actorId) {
    notifications.push(notificationService.create({
      userId: params.previousAssigneeId,
      type: NotificationType.SYSTEM,
      title: "Moderation case reassigned",
      message: `${params.caseReference} is no longer assigned to you.`,
      entityId: params.caseId,
      entityType: event,
      link,
      metadata: { moderationCaseId: params.caseId, recipientRole: "ADMIN" },
    }));
  }
  if (params.nextAssigneeId && params.nextAssigneeId !== params.actorId) {
    notifications.push(notificationService.create({
      userId: params.nextAssigneeId,
      type: NotificationType.SYSTEM,
      title: params.previousAssigneeId ? "Moderation case reassigned to you" : "Moderation case assigned to you",
      message: `${params.caseReference} requires your review.`,
      entityId: params.caseId,
      entityType: event,
      link,
      metadata: { moderationCaseId: params.caseId, recipientRole: "ADMIN", requiredAction: "REVIEW_CASE" },
    }));
  }
  await Promise.all(notifications.map((notification) => notification.catch((error) => console.warn("[moderation.service] Failed to notify assignment:", error))));
}

async function notifyRequiredInformation(params: { caseId: string; caseReference: string; assigneeId: string | null; actorId: string; updatedAt: Date }) {
  if (!params.assigneeId || params.assigneeId === params.actorId) return;
  await notificationService.create({
    userId: params.assigneeId,
    type: NotificationType.SYSTEM,
    title: "Moderation case needs information",
    message: `${params.caseReference} requires a follow-up.`,
    entityId: params.caseId,
    entityType: `moderation-needs-information-${params.caseId}-${params.updatedAt.getTime()}`,
    link: `/admin/moderation/cases/${params.caseId}`,
    metadata: { moderationCaseId: params.caseId, recipientRole: "ADMIN", requiredAction: "REQUEST_INFORMATION" },
  }).catch((error) => console.warn("[moderation.service] Failed to notify required action:", error));
}

/**
 * Prisma generation follows the local schema, but a database can still be
 * behind its additive migration. Check once per short interval so moderation
 * pages fail closed with one actionable error instead of issuing many failing
 * case queries and triggering a Next.js runtime error.
 */
async function assertModerationSchemaReady() {
  if (Date.now() < moderationSchemaVerifiedUntil) return;
  const [tables] = await prisma.$queryRaw<Array<{
    moderationCase: string | null;
    moderationReport: string | null;
    moderationActivity: string | null;
  }>>`SELECT
    to_regclass('public."ModerationCase"')::text AS "moderationCase",
    to_regclass('public."ModerationReport"')::text AS "moderationReport",
    to_regclass('public."ModerationActivity"')::text AS "moderationActivity"`;
  if (!tables?.moderationCase || !tables.moderationReport || !tables.moderationActivity) {
    throw AppError.serviceUnavailable("Moderation setup is pending. Apply the approved moderation migration before using this module.");
  }
  moderationSchemaVerifiedUntil = Date.now() + 30_000;
}

export { assertValidModerationTransition } from "@/lib/moderation/lifecycle";

async function validateTarget(actor: AuthUser, input: CreateModerationReportInput): Promise<TargetContext> {
  if (input.targetType === "REVIEW") {
    const review = await prisma.review.findUnique({
      where: { id: input.targetId },
      select: {
        id: true,
        listingId: true,
        userId: true,
        targetUserId: true,
        direction: true,
        status: true,
        bookingId: true,
        listing: { select: { hostId: true } },
      },
    });
    if (!review) throw AppError.notFound("Review target not found.");
    if (review.status === "PRIVATE") {
      throw AppError.forbidden("Unpublished reciprocal reviews cannot be reported.");
    }
    if (!canModerate(actor)) {
      if (actor.id === review.userId) {
        throw AppError.badRequest("You cannot report a review you authored.");
      }
      const isTargetUser = review.targetUserId === actor.id;
      const isListingHost = review.listing?.hostId === actor.id;
      if (!isTargetUser && !isListingHost) {
        const booking = await prisma.booking.findUnique({
          where: { id: review.bookingId },
          select: { guestId: true, listing: { select: { hostId: true } } },
        });
        const isBookingParticipant = booking && (booking.guestId === actor.id || booking.listing.hostId === actor.id);
        if (!isBookingParticipant) {
          throw AppError.forbidden("You are not authorized to report this review.");
        }
      }
    }
    return { listingId: review.listingId, ownerId: review.listing?.hostId };
  }
  if (input.targetType === "LISTING") {
    const listing = await prisma.listing.findUnique({ where: { id: input.targetId }, select: { id: true, hostId: true } });
    if (!listing) throw AppError.notFound("Listing target not found.");
    return { listingId: listing.id, ownerId: listing.hostId };
  }
  if (input.targetType === "LISTING_PHOTO") {
    const listing = await prisma.listing.findFirst({ where: { photos: { has: input.targetId } }, select: { id: true, hostId: true } });
    if (!listing) throw AppError.notFound("Listing photo target not found.");
    return { listingId: listing.id, ownerId: listing.hostId };
  }
  if (input.targetType === "PROFILE" || input.targetType === "USER") {
    const user = await prisma.user.findUnique({ where: { id: input.targetId }, select: { id: true } });
    if (!user) throw AppError.notFound("User target not found.");
    return {};
  }
  if (input.targetType === "MESSAGE") {
    const message = await prisma.message.findUnique({
      where: { id: input.targetId },
      select: { id: true, conversation: { select: { guestId: true, hostId: true, listingId: true } } },
    });
    if (!message) throw AppError.notFound("Message target not found.");
    if (!canModerate(actor) && actor.id !== message.conversation.guestId && actor.id !== message.conversation.hostId) {
      throw AppError.forbidden("You can report only messages from conversations you participate in.");
    }
    return { listingId: message.conversation.listingId };
  }
  throw AppError.badRequest("OTHER_CONTENT is not enabled for reports in this deployment.");
}

async function validateRelatedBooking(actor: AuthUser, bookingId: string | undefined, target: TargetContext) {
  if (!bookingId) return;
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: { id: true, userId: true, listingId: true, listing: { select: { hostId: true } } },
  });
  if (!booking) throw AppError.notFound("Related booking not found.");
  if (target.listingId && booking.listingId !== target.listingId) {
    throw AppError.badRequest("The related booking does not belong to the reported content.");
  }
  if (!canModerate(actor) && actor.id !== booking.userId && actor.id !== booking.listing.hostId) {
    throw AppError.forbidden("You are not a participant in the related booking.");
  }
}

export async function createModerationReport(actor: AuthUser, input: CreateModerationReportInput) {
  if (!canCreateReport(actor)) throw AppError.forbidden("Missing moderation report create permission.");
  await assertModerationSchemaReady();
  const policy = getModerationPolicy(input.reasonCode, input.targetType);
  if (!policy) throw AppError.badRequest("The report reason is not valid for this content type.");
  const target = await validateTarget(actor, input);
  await validateRelatedBooking(actor, input.relatedBookingId, target);

  // Reports group by target/category, not reporter. Serializing this grouping
  // key prevents simultaneous reporters from each creating an active case.
  const lockKey = `moderation:case:${input.targetType}:${input.targetId}:${input.category.trim()}`;
  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;

    const existing = await tx.moderationReport.findFirst({
      where: { reporterId: actor.id, targetType: input.targetType, targetId: input.targetId, category: input.category, reasonCode: input.reasonCode },
      orderBy: { createdAt: "desc" },
      select: { id: true, caseId: true },
    });
    if (existing) return { reportId: existing.id, caseId: existing.caseId, duplicate: true, createdCase: null };

    let caseRecord = await tx.moderationCase.findFirst({
      where: { targetType: input.targetType, targetId: input.targetId, category: input.category, status: { in: ACTIVE_CASE_STATUSES } },
      orderBy: { createdAt: "desc" },
    });
    let createdCase = false;
    if (!caseRecord) {
      createdCase = true;
      caseRecord = await tx.moderationCase.create({
        data: {
          caseReference: `MOD-${nanoid(10).toUpperCase()}`,
          targetType: input.targetType,
          targetId: input.targetId,
          category: input.category,
          severity: policy.defaultSeverity,
          policyVersion: MODERATION_POLICY_VERSION,
        },
      });
      await tx.moderationActivity.create({
        data: { caseId: caseRecord.id, actorId: actor.id, action: "CASE_CREATED", after: { status: caseRecord.status, severity: caseRecord.severity } },
      });
    }

    const report = await tx.moderationReport.create({
      data: {
        reporterId: actor.id,
        targetType: input.targetType,
        targetId: input.targetId,
        category: input.category,
        reasonCode: input.reasonCode,
        description: input.description?.trim() || null,
        relatedBookingId: input.relatedBookingId,
        caseId: caseRecord.id,
        source: "USER",
      },
    });
    await tx.moderationActivity.create({
      data: {
        caseId: caseRecord.id,
        actorId: actor.id,
        action: "REPORT_ATTACHED",
        after: {
          reportId: report.id,
          reasonCode: report.reasonCode,
          listingId: target.listingId,
          ownerId: target.ownerId,
        },
      },
    });
    return { reportId: report.id, caseId: caseRecord.id, caseReference: caseRecord.caseReference, duplicate: false, createdCase: createdCase ? caseRecord : null };
  });
  if (result.createdCase) {
    await notifyEligibleModerators(result.createdCase).catch((error) => console.warn("[moderation.service] Failed to notify priority case:", error));
  }
  const { createdCase: _createdCase, ...report } = result;
  return report;
}

export async function listMyModerationReports(actor: AuthUser, page = 1, limit = 20) {
  await assertModerationSchemaReady();
  const take = Math.min(100, Math.max(1, limit));
  const skip = (Math.max(1, page) - 1) * take;
  const [reports, total] = await Promise.all([
    prisma.moderationReport.findMany({
      where: { reporterId: actor.id }, skip, take, orderBy: { createdAt: "desc" },
      include: { case: { select: { caseReference: true, status: true, severity: true, updatedAt: true } } },
    }),
    prisma.moderationReport.count({ where: { reporterId: actor.id } }),
  ]);
  return { reports, pagination: { page: Math.max(1, page), limit: take, total, totalPages: Math.max(1, Math.ceil(total / take)) } };
}

export async function listModerationCases(actor: AuthUser, query: ModerationCaseListQuery = {}) {
  assertModerator(actor, PERMISSIONS.MODERATION_CASE_READ);
  await assertModerationSchemaReady();
  assertEnumValue(query.status, ModerationCaseStatus, "status");
  assertEnumValue(query.targetType, ModerationTargetType, "content type");
  assertEnumValue(query.severity, ModerationSeverity, "severity");
  if (query.assigned && query.assigned !== "assigned" && query.assigned !== "unassigned") throw AppError.badRequest("Invalid moderation assignment filter.");
  if (query.priority && query.priority !== "elevated" && query.priority !== "normal") throw AppError.badRequest("Invalid moderation priority filter.");
  const { page, limit, skip } = toPagination(query.page, query.limit);
  const where: Prisma.ModerationCaseWhereInput = {};
  const conditions: Prisma.ModerationCaseWhereInput[] = [];
  if (query.status) where.status = query.status;
  if (query.targetType) where.targetType = query.targetType;
  if (query.severity) where.severity = query.severity;
  if (query.category?.trim()) where.category = { equals: query.category.trim(), mode: "insensitive" };
  if (query.assigned === "assigned") where.assignedModeratorId = { not: null };
  if (query.assigned === "unassigned") where.assignedModeratorId = null;
  if (query.assignedModeratorId) where.assignedModeratorId = query.assignedModeratorId;
  if (query.priority === "elevated") where.priority = { gte: 1 };
  if (query.priority === "normal") where.priority = { lte: 0 };
  if (query.attention) conditions.push({ OR: [{ severity: { in: ["HIGH", "CRITICAL"] } }, { priority: { gte: 1 } }] });
  const createdStart = parseDate(query.startDate);
  const createdEnd = parseDate(query.endDate, true);
  if (createdStart || createdEnd) where.createdAt = { ...(createdStart ? { gte: createdStart } : {}), ...(createdEnd ? { lte: createdEnd } : {}) };
  const updatedStart = parseDate(query.updatedStartDate);
  const updatedEnd = parseDate(query.updatedEndDate, true);
  if (updatedStart || updatedEnd) where.updatedAt = { ...(updatedStart ? { gte: updatedStart } : {}), ...(updatedEnd ? { lte: updatedEnd } : {}) };
  if (query.search?.trim()) {
    const term = query.search.trim().slice(0, 160);
    conditions.push({
      OR: [
        { caseReference: { startsWith: term, mode: "insensitive" } },
        { targetId: { startsWith: term, mode: "insensitive" } },
        { category: { startsWith: term, mode: "insensitive" } },
        { reports: { some: { OR: [
          { id: { startsWith: term, mode: "insensitive" } },
          { relatedBookingId: { startsWith: term, mode: "insensitive" } },
          { reasonCode: { startsWith: term, mode: "insensitive" } },
          { reporter: { is: { name: { startsWith: term, mode: "insensitive" } } } },
          { reporter: { is: { email: { startsWith: term, mode: "insensitive" } } } },
        ] } } },
      ],
    });
  }
  if (conditions.length) where.AND = conditions;
  const sort = MODERATION_SORTS.includes(query.sort ?? "newest") ? query.sort ?? "newest" : "newest";
  const orderBy: Prisma.ModerationCaseOrderByWithRelationInput[] = sort === "oldest"
    ? [{ createdAt: "asc" }, { id: "asc" }]
    : sort === "updated"
      ? [{ updatedAt: "desc" }, { id: "desc" }]
      : sort === "priority"
        ? [{ priority: "desc" }, { createdAt: "asc" }, { id: "asc" }]
        : sort === "reports"
          ? [{ reports: { _count: "desc" } }, { createdAt: "desc" }, { id: "desc" }]
          : sort === "severity"
            ? [{ severity: "desc" }, { priority: "desc" }, { createdAt: "desc" }, { id: "desc" }]
          : [{ createdAt: "desc" }, { id: "desc" }];
  const [cases, total] = await Promise.all([
    prisma.moderationCase.findMany({
      where, skip, take: limit, orderBy,
      include: {
        _count: { select: { reports: true, evidence: true } },
        assignedModerator: { select: { id: true, name: true, email: true } },
        reports: { take: 1, orderBy: { createdAt: "asc" }, select: { reasonCode: true, relatedBookingId: true } },
      },
    }),
    prisma.moderationCase.count({ where }),
  ]);
  return { cases, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

export async function getModerationDashboardSummary(actor: AuthUser, query: ModerationDashboardQuery = {}) {
  assertModerator(actor, PERMISSIONS.MODERATION_CASE_READ);
  await assertModerationSchemaReady();
  const start = parseDate(query.startDate);
  const end = parseDate(query.endDate, true);
  const dateWhere: Prisma.ModerationCaseWhereInput = start || end ? { createdAt: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {};
  const openWhere: Prisma.ModerationCaseWhereInput = { ...dateWhere, status: { in: ACTIVE_CASE_STATUSES } };
  const [
    totalCases, newCases, inReviewCases, needsInformationCases, highPriorityOpenCases,
    resolvedCases, dismissedCases, unassignedOpenCases, distributions, workload, recentActivity,
  ] = await Promise.all([
    prisma.moderationCase.count({ where: dateWhere }),
    prisma.moderationCase.count({ where: { ...dateWhere, status: "NEW" } }),
    prisma.moderationCase.count({ where: { ...dateWhere, status: "IN_REVIEW" } }),
    prisma.moderationCase.count({ where: { ...dateWhere, status: "NEEDS_INFORMATION" } }),
    prisma.moderationCase.count({ where: { ...openWhere, OR: [{ severity: { in: ["HIGH", "CRITICAL"] } }, { priority: { gte: 1 } }] } }),
    prisma.moderationCase.count({ where: { ...dateWhere, status: "RESOLVED" } }),
    prisma.moderationCase.count({ where: { ...dateWhere, status: "DISMISSED" } }),
    prisma.moderationCase.count({ where: { ...openWhere, assignedModeratorId: null } }),
    prisma.moderationCase.groupBy({ by: ["targetType"], where: dateWhere, _count: { _all: true } }),
    prisma.moderationCase.groupBy({ by: ["assignedModeratorId"], where: openWhere, _count: { _all: true } }),
    prisma.moderationActivity.findMany({
      where: { case: { is: dateWhere } }, take: 12, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true, action: true, createdAt: true, before: true, after: true, actor: { select: { id: true, name: true, email: true } }, case: { select: { id: true, caseReference: true } } },
    }),
  ]);
  const distributionRows = distributions as Array<{ targetType: ModerationTargetType; _count: { _all: number } }>;
  const workloadRows = workload as Array<{ assignedModeratorId: string | null; _count: { _all: number } }>;
  const moderatorIds = workloadRows.map((entry) => entry.assignedModeratorId).filter((id): id is string => Boolean(id));
  const moderators: Array<{ id: string; name: string | null; email: string | null }> = moderatorIds.length
    ? await prisma.user.findMany({ where: { id: { in: moderatorIds } }, select: { id: true, name: true, email: true } })
    : [];
  const moderatorById = new Map(moderators.map((moderator) => [moderator.id, moderator]));
  return {
    counts: { totalCases, newCases, inReviewCases, needsInformationCases, highPriorityOpenCases, resolvedCases, dismissedCases, unassignedOpenCases },
    distribution: distributionRows.map((entry) => ({ targetType: entry.targetType, count: entry._count._all })),
    workload: workloadRows.map((entry) => ({ assignedModeratorId: entry.assignedModeratorId, moderator: entry.assignedModeratorId ? moderatorById.get(entry.assignedModeratorId) ?? null : null, count: entry._count._all })),
    recentActivity,
  };
}

export type UpdateModerationCaseInput = {
  status?: ModerationCaseStatus;
  severity?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  priority?: number;
  assignedModeratorId?: string | null;
  resolutionCategory?: string | null;
  resolutionNotes?: string | null;
  expectedUpdatedAt?: string;
  reviewAction?: "NONE" | "HIDE" | "DELETE" | "RESTORE";
  listingAction?: "NONE" | "DISMISS" | "WARN_HOST" | "REQUEST_CORRECTION" | "TEMPORARY_RESTRICTION" | "SUSPEND" | "RESTORE";
  mediaAction?: "NONE" | "DISMISS" | "HIDE_PHOTO" | "REMOVE_PHOTO" | "REQUEST_REPLACEMENT" | "RESTORE_PHOTO";
};

export async function updateModerationCase(actor: AuthUser, caseId: string, input: UpdateModerationCaseInput) {
  if (!canModerate(actor, PERMISSIONS.MODERATION_CASE_UPDATE)) throw AppError.forbidden("Missing moderation case update permission.");
  await assertModerationSchemaReady();
  const existing = await prisma.moderationCase.findUnique({ where: { id: caseId } });
  if (!existing) throw AppError.notFound("Moderation case not found.");
  if (input.expectedUpdatedAt && new Date(input.expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()) {
    throw AppError.conflict("This moderation case changed. Refresh it before making another update.");
  }
  if (input.status) assertValidModerationTransition(existing.status, input.status);
  if (input.assignedModeratorId !== undefined) {
    if (!hasPermission(actor, PERMISSIONS.MODERATION_CASE_ASSIGN)) throw AppError.forbidden("Missing moderation case assign permission.");
    if (input.assignedModeratorId) {
      const assignee = await prisma.user.findUnique({ where: { id: input.assignedModeratorId }, select: { id: true, role: true, adminRoleId: true, status: true } });
      if (!assignee || assignee.status !== "ACTIVE" || (assignee.role !== Role.ADMIN && !assignee.adminRoleId)) throw AppError.badRequest("Assigned moderator must be an active administrator.");
    }
  }
  if ((input.resolutionCategory !== undefined || input.resolutionNotes !== undefined) && !canModerate(actor, PERMISSIONS.MODERATION_DECISION_CREATE)) {
    throw AppError.forbidden("Missing moderation decision permission.");
  }
  if (input.reviewAction && input.reviewAction !== "NONE" && !canModerate(actor, PERMISSIONS.MODERATION_DECISION_CREATE)) {
    throw AppError.forbidden("Missing moderation decision permission to apply review action.");
  }
  if (input.listingAction && input.listingAction !== "NONE" && !canModerate(actor, PERMISSIONS.MODERATION_DECISION_CREATE)) {
    throw AppError.forbidden("Missing moderation decision permission to apply listing action.");
  }
  if (input.mediaAction && input.mediaAction !== "NONE" && !canModerate(actor, PERMISSIONS.MODERATION_DECISION_CREATE)) {
    throw AppError.forbidden("Missing moderation decision permission to apply media action.");
  }

  // If review action is specified for a review moderation case, apply it via review service
  if (input.reviewAction && input.reviewAction !== "NONE" && existing.targetType === "REVIEW") {
    await reviewService.adminModerateReview({
      reviewId: existing.targetId,
      moderatorId: actor.id,
      action: input.reviewAction,
      reason: input.resolutionCategory || "Moderation case decision",
      notes: input.resolutionNotes || undefined,
      caseId: existing.id,
    });
  }

  let targetListing: { id: string; title: string; hostId: string; isPaused: boolean; published: boolean; status: ListingStatus } | null = null;
  if (existing.targetType === "LISTING" && input.listingAction && input.listingAction !== "NONE") {
    targetListing = await listingService.applyModerationAction({
      listingId: existing.targetId,
      action: input.listingAction,
      reason: input.resolutionCategory || undefined,
      notes: input.resolutionNotes || undefined,
    });
  }

  let mediaListing: { id: string; title: string; hostId: string; photos: string[] } | null = null;
  if (existing.targetType === "LISTING_PHOTO" && input.mediaAction && input.mediaAction !== "NONE") {
    mediaListing = await prisma.listing.findFirst({
      where: { photos: { has: existing.targetId } },
      select: { id: true, title: true, hostId: true, photos: true },
    });
    if (!mediaListing) {
      const pastActivity = await prisma.moderationActivity.findFirst({
        where: { caseId: existing.id, after: { not: Prisma.DbNull } },
        orderBy: { createdAt: "desc" },
        select: { after: true },
      });
      const listingId = (pastActivity?.after as any)?.listingId;
      if (listingId) {
        mediaListing = await prisma.listing.findUnique({
          where: { id: listingId },
          select: { id: true, title: true, hostId: true, photos: true },
        });
      }
    }

    if (mediaListing && input.mediaAction !== "DISMISS") {
      await listingService.applyModerationAction({
        listingId: mediaListing.id,
        action: input.mediaAction,
        photoUrl: existing.targetId,
        reason: input.resolutionCategory || undefined,
        notes: input.resolutionNotes || undefined,
      });
    }
  }

  let mediaUser: { id: string; name: string | null; email: string | null; image: string | null } | null = null;
  if ((existing.targetType === "PROFILE" || existing.targetType === "USER") && input.mediaAction && input.mediaAction !== "NONE") {
    mediaUser = await prisma.user.findUnique({
      where: { id: existing.targetId },
      select: { id: true, name: true, email: true, image: true },
    });
    if (mediaUser) {
      if (input.mediaAction === "REMOVE_PHOTO" || input.mediaAction === "HIDE_PHOTO") {
        await prisma.user.update({
          where: { id: existing.targetId },
          data: { image: null },
        });
        await invalidateUserCache(existing.targetId);
      } else if (input.mediaAction === "RESTORE_PHOTO") {
        const pastActivity = await prisma.moderationActivity.findFirst({
          where: { caseId: existing.id, action: "CONTENT_MODERATED" },
          orderBy: { createdAt: "desc" },
          select: { before: true },
        });
        const prevImage = (pastActivity?.before as any)?.previousImage;
        if (prevImage) {
          await prisma.user.update({
            where: { id: existing.targetId },
            data: { image: prevImage },
          });
          await invalidateUserCache(existing.targetId);
        }
      }
    }
  }

  const nextStatus = input.status ?? existing.status;
  const updateData: Prisma.ModerationCaseUpdateInput = {
    status: input.status,
    severity: input.severity,
    priority: input.priority,
    resolutionCategory: input.resolutionCategory,
    resolutionNotes: input.resolutionNotes,
  };
  if (input.assignedModeratorId !== undefined) {
    updateData.assignedModerator = input.assignedModeratorId
      ? { connect: { id: input.assignedModeratorId } }
      : { disconnect: true };
  }
  if (input.status !== undefined) {
    updateData.resolvedAt = nextStatus === "RESOLVED" || nextStatus === "DISMISSED" ? new Date() : null;
  }
  const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (input.expectedUpdatedAt) {
      const unchanged = await tx.moderationCase.count({ where: { id: caseId, updatedAt: existing.updatedAt } });
      if (!unchanged) throw AppError.conflict("This moderation case changed. Refresh it before making another update.");
    }
    const caseRecord = await tx.moderationCase.update({
      where: { id: caseId },
      data: updateData,
    });
    const activities: Prisma.ModerationActivityCreateManyInput[] = [];
    if (input.status !== undefined) {
      activities.push({
        caseId,
        actorId: actor.id,
        action: input.status === "REOPENED" ? "CASE_REOPENED" : "STATUS_CHANGED",
        before: { status: existing.status },
        after: { status: caseRecord.status },
      });
    }
    if (input.assignedModeratorId !== undefined) {
      activities.push({
        caseId,
        actorId: actor.id,
        action: "MODERATOR_ASSIGNED",
        before: { assignedModeratorId: existing.assignedModeratorId },
        after: { assignedModeratorId: caseRecord.assignedModeratorId },
      });
    }
    if (input.priority !== undefined || input.severity !== undefined) {
      activities.push({
        caseId,
        actorId: actor.id,
        action: "CASE_TRIAGED",
        before: { priority: existing.priority, severity: existing.severity },
        after: { priority: caseRecord.priority, severity: caseRecord.severity },
      });
    }
    if (input.resolutionCategory !== undefined || input.resolutionNotes !== undefined) {
      activities.push({
        caseId,
        actorId: actor.id,
        action: "DECISION_RECORDED",
        before: { resolutionCategory: existing.resolutionCategory, resolutionNotes: existing.resolutionNotes },
        after: { resolutionCategory: caseRecord.resolutionCategory, resolutionNotes: caseRecord.resolutionNotes },
      });
    }
    if (input.reviewAction && input.reviewAction !== "NONE") {
      activities.push({
        caseId,
        actorId: actor.id,
        action: "CONTENT_MODERATED",
        before: { reviewAction: null },
        after: { reviewAction: input.reviewAction, targetId: existing.targetId },
      });
    }
    if (targetListing && input.listingAction && input.listingAction !== "NONE") {
      activities.push({
        caseId,
        actorId: actor.id,
        action: "CONTENT_MODERATED",
        before: { listingAction: null },
        after: { listingAction: input.listingAction, listingId: targetListing.id, notes: input.resolutionNotes },
      });
    }
    if (input.mediaAction && input.mediaAction !== "NONE") {
      activities.push({
        caseId,
        actorId: actor.id,
        action: "CONTENT_MODERATED",
        before: {
          mediaAction: null,
          ...(mediaUser ? { previousImage: mediaUser.image } : {}),
        },
        after: {
          mediaAction: input.mediaAction,
          targetType: existing.targetType,
          targetId: existing.targetId,
          ...(mediaListing ? { listingId: mediaListing.id } : {}),
          notes: input.resolutionNotes,
        },
      });
    }
    if (activities.length > 0) await tx.moderationActivity.createMany({ data: activities });
    return caseRecord;
  });

  // User notifications dispatch
  try {
    const reports = await prisma.moderationReport.findMany({
      where: { caseId },
      select: { reporterId: true },
      take: 20,
    });
    const reporterIds: string[] = Array.from(new Set(reports.map((r: { reporterId: string }) => r.reporterId)));

    if (input.reviewAction === "HIDE" || input.reviewAction === "DELETE") {
      await Promise.all(
        reporterIds.map((reporterId: string) =>
          notificationService.create({
            userId: reporterId,
            type: NotificationType.SYSTEM,
            title: "Review removal request approved",
            message: `Your report for case ${updated.caseReference} was investigated and the review was removed.`,
            entityId: updated.id,
            entityType: "moderation-approved",
            link: `/profile/tab/reports`,
            metadata: { caseId: updated.id, caseReference: updated.caseReference },
          }).catch(() => undefined)
        )
      );
      const targetReview = await prisma.review.findUnique({
        where: { id: existing.targetId },
        select: { userId: true },
      });
      if (targetReview?.userId) {
        await notificationService.create({
          userId: targetReview.userId,
          type: NotificationType.SYSTEM,
          title: "Review removed under content policy",
          message: `A review you authored was moderated and removed for violating Homyz policies (${input.resolutionCategory || "Policy Violation"}).`,
          entityId: existing.targetId,
          entityType: "review-moderated",
          link: `/profile/tab/reviews`,
          metadata: { reviewId: existing.targetId, caseId: updated.id },
        }).catch(() => undefined);
      }
    } else if (targetListing && input.listingAction && input.listingAction !== "NONE") {
      let hostNotice: { title: string; message: string; entityType: string } | null = null;
      if (input.listingAction === "WARN_HOST") {
        hostNotice = {
          title: "Listing compliance warning",
          message: `Your listing "${targetListing.title}" has received an administrative warning: ${input.resolutionNotes || input.resolutionCategory || "Please review our listing standards."}`,
          entityType: "listing-warning",
        };
      } else if (input.listingAction === "REQUEST_CORRECTION") {
        hostNotice = {
          title: "Listing updates requested",
          message: `Our trust and safety team requested corrections for "${targetListing.title}". Reason: ${input.resolutionNotes || "Action required"}`,
          entityType: "listing-correction-requested",
        };
      } else if (input.listingAction === "TEMPORARY_RESTRICTION") {
        hostNotice = {
          title: "Listing temporarily restricted",
          message: `Your listing "${targetListing.title}" has been temporarily paused and unlisted while under moderation review. Existing confirmed reservations remain valid.`,
          entityType: "listing-restricted",
        };
      } else if (input.listingAction === "SUSPEND") {
        hostNotice = {
          title: "Listing suspended",
          message: `Your listing "${targetListing.title}" has been suspended due to trust and safety violations. Reason: ${input.resolutionNotes || input.resolutionCategory || "Policy violation"}.`,
          entityType: "listing-suspended",
        };
      } else if (input.listingAction === "RESTORE") {
        hostNotice = {
          title: "Listing restored",
          message: `Your listing "${targetListing.title}" has been reviewed, restored, and is now active on Homyz.`,
          entityType: "listing-restored",
        };
      }

      if (hostNotice) {
        await notificationService.create({
          userId: targetListing.hostId,
          type: NotificationType.SYSTEM,
          title: hostNotice.title,
          message: hostNotice.message,
          entityId: targetListing.id,
          entityType: hostNotice.entityType,
          link: `/host/listings`,
          metadata: { listingId: targetListing.id, caseId: updated.id, caseReference: updated.caseReference },
        }).catch(() => undefined);
      }

      if (input.status === "RESOLVED" || input.status === "DISMISSED") {
        await Promise.all(
          reporterIds.map((reporterId: string) =>
            notificationService.create({
              userId: reporterId,
              type: NotificationType.SYSTEM,
              title: "Listing report concluded",
              message: `Your report regarding listing "${targetListing.title}" has been investigated and concluded (${input.resolutionCategory || "Case Concluded"}).`,
              entityId: updated.id,
              entityType: "listing-report-concluded",
              link: `/profile/tab/reports`,
              metadata: { caseId: updated.id, caseReference: updated.caseReference, listingId: targetListing.id },
            }).catch(() => undefined)
          )
        );
      }
    } else if (mediaListing && input.mediaAction && input.mediaAction !== "NONE") {
      if (input.mediaAction === "REMOVE_PHOTO" || input.mediaAction === "HIDE_PHOTO") {
        const hasFewerThan5 = (mediaListing.photos.length - 1) < 5;
        await notificationService.create({
          userId: mediaListing.hostId,
          type: NotificationType.SYSTEM,
          title: "Listing photo removed",
          message: `A photo on your listing "${mediaListing.title}" was removed for violating community guidelines (${input.resolutionCategory || "Policy Violation"}).${hasFewerThan5 ? " Your listing has fewer than the required 5 photos. Please upload replacements." : ""}`,
          entityId: mediaListing.id,
          entityType: "listing-photo-removed",
          link: `/host/listings`,
          metadata: { listingId: mediaListing.id, caseId: updated.id, caseReference: updated.caseReference },
        }).catch(() => undefined);

        await Promise.all(
          reporterIds.map((reporterId: string) =>
            notificationService.create({
              userId: reporterId,
              type: NotificationType.SYSTEM,
              title: "Photo report resolved",
              message: `Your report regarding a listing photo on "${mediaListing!.title}" has been investigated and the photo was removed.`,
              entityId: updated.id,
              entityType: "photo-report-resolved",
              link: `/profile/tab/reports`,
              metadata: { caseId: updated.id, caseReference: updated.caseReference },
            }).catch(() => undefined)
          )
        );
      } else if (input.mediaAction === "REQUEST_REPLACEMENT") {
        await notificationService.create({
          userId: mediaListing.hostId,
          type: NotificationType.SYSTEM,
          title: "Photo replacement requested",
          message: `Our trust & safety team requested a replacement photo for "${mediaListing.title}". Reason: ${input.resolutionNotes || "Image guideline compliance"}`,
          entityId: mediaListing.id,
          entityType: "listing-photo-replacement-requested",
          link: `/host/listings`,
          metadata: { listingId: mediaListing.id, caseId: updated.id, caseReference: updated.caseReference },
        }).catch(() => undefined);
      } else if (input.mediaAction === "RESTORE_PHOTO") {
        await notificationService.create({
          userId: mediaListing.hostId,
          type: NotificationType.SYSTEM,
          title: "Listing photo restored",
          message: `A photo on your listing "${mediaListing.title}" has been restored to your gallery.`,
          entityId: mediaListing.id,
          entityType: "listing-photo-restored",
          link: `/host/listings`,
          metadata: { listingId: mediaListing.id, caseId: updated.id },
        }).catch(() => undefined);
      }
    } else if (mediaUser && input.mediaAction && input.mediaAction !== "NONE") {
      if (input.mediaAction === "REMOVE_PHOTO" || input.mediaAction === "HIDE_PHOTO") {
        await notificationService.create({
          userId: mediaUser.id,
          type: NotificationType.SYSTEM,
          title: "Profile photo removed",
          message: `Your profile photo was removed for violating Homyz profile image policies (${input.resolutionCategory || "Policy Violation"}). Please upload a photo that meets our standards.`,
          entityId: mediaUser.id,
          entityType: "profile-photo-removed",
          link: `/profile`,
          metadata: { userId: mediaUser.id, caseId: updated.id },
        }).catch(() => undefined);

        await Promise.all(
          reporterIds.map((reporterId: string) =>
            notificationService.create({
              userId: reporterId,
              type: NotificationType.SYSTEM,
              title: "Profile photo report resolved",
              message: `Your report regarding a profile photo has been investigated and the photo was removed.`,
              entityId: updated.id,
              entityType: "profile-report-resolved",
              link: `/profile/tab/reports`,
              metadata: { caseId: updated.id, caseReference: updated.caseReference },
            }).catch(() => undefined)
          )
        );
      }
    } else if (input.status === "NEEDS_INFORMATION") {
      await Promise.all(
        reporterIds.map((reporterId: string) =>
          notificationService.create({
            userId: reporterId,
            type: NotificationType.SYSTEM,
            title: "Additional information requested",
            message: `Our trust & safety team requested more information regarding case ${updated.caseReference}.`,
            entityId: updated.id,
            entityType: "moderation-needs-info",
            link: `/profile/tab/reports`,
            metadata: { caseId: updated.id, caseReference: updated.caseReference },
          }).catch(() => undefined)
        )
      );
    } else if (input.status === "DISMISSED" || (input.status === "RESOLVED" && (!input.reviewAction || input.reviewAction === "NONE") && (!input.listingAction || input.listingAction === "NONE") && (!input.mediaAction || input.mediaAction === "NONE"))) {
      await Promise.all(
        reporterIds.map((reporterId: string) =>
          notificationService.create({
            userId: reporterId,
            type: NotificationType.SYSTEM,
            title: "Moderation report concluded",
            message: `Your report regarding case ${updated.caseReference} has been concluded (${input.resolutionCategory || "Case Concluded"}).`,
            entityId: updated.id,
            entityType: "moderation-concluded",
            link: `/profile/tab/reports`,
            metadata: { caseId: updated.id, caseReference: updated.caseReference },
          }).catch(() => undefined)
        )
      );
    }
  } catch (err) {
    console.warn("[moderation.service] Failed to dispatch decision notifications:", err);
  }

  return updated;
}

export async function getModerationCaseDetails(actor: AuthUser, caseId: string) {
  assertModerator(actor, PERMISSIONS.MODERATION_CASE_READ);
  await assertModerationSchemaReady();
  const caseRecord = await prisma.moderationCase.findUnique({
    where: { id: caseId },
    include: {
      assignedModerator: { select: { id: true, name: true, email: true } },
      reports: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          reporter: { select: { id: true, name: true, email: true } },
          relatedBooking: { select: { id: true, status: true, startDate: true, endDate: true, listing: { select: { id: true, title: true } } } },
        },
      },
      evidence: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: publicEvidenceSelect() },
      activities: {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 100,
        include: { actor: { select: { id: true, name: true, email: true } } },
      },
      _count: { select: { reports: true, evidence: true } },
    },
  });
  if (!caseRecord) throw AppError.notFound("Moderation case not found.");
  const target = await getModerationTargetSummary(caseRecord.targetType, caseRecord.targetId);
  return { case: caseRecord, target };
}

async function getModerationTargetSummary(targetType: ModerationTargetType, targetId: string) {
  if (targetType === "REVIEW") {
    const review = await prisma.review.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        rating: true,
        cleanliness: true,
        accuracy: true,
        communication: true,
        location: true,
        checkIn: true,
        value: true,
        houseRulesRating: true,
        recommendGuest: true,
        comment: true,
        status: true,
        direction: true,
        createdAt: true,
        publishedAt: true,
        bookingId: true,
        author: { select: { id: true, name: true, email: true, image: true } },
        targetUser: { select: { id: true, name: true, email: true, image: true } },
        listing: { select: { id: true, title: true, city: true, host: { select: { id: true, name: true, email: true } } } },
        response: { select: { id: true, content: true, createdAt: true, user: { select: { id: true, name: true } } } },
        booking: { select: { id: true, startDate: true, endDate: true, status: true, guestId: true } },
      },
    });
    return review ? { type: targetType, available: true, data: review } : { type: targetType, available: false };
  }
  if (targetType === "LISTING") {
    const listing = await prisma.listing.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        photos: true,
        address: true,
        city: true,
        country: true,
        status: true,
        published: true,
        isPaused: true,
        amenities: true,
        propertyType: true,
        listingType: true,
        rejectionReason: true,
        requestedChanges: true,
        createdAt: true,
        host: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            status: true,
            createdAt: true,
          },
        },
        bookings: {
          where: {
            status: { in: ["PENDING", "CONFIRMED", "CHECKED_IN"] },
            endDate: { gte: new Date() },
          },
          orderBy: { startDate: "asc" },
          take: 10,
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            totalPrice: true,
            guest: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        qualityIncidents: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            category: true,
            severity: true,
            status: true,
            description: true,
            createdAt: true,
          },
        },
      },
    });
    if (!listing) return { type: targetType, available: false };

    const relatedCases = await prisma.moderationCase.findMany({
      where: {
        targetType: "LISTING",
        targetId,
      },
      take: 10,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        caseReference: true,
        status: true,
        severity: true,
        priority: true,
        category: true,
        resolutionCategory: true,
        createdAt: true,
      },
    });

    return {
      type: targetType,
      available: true,
      data: {
        ...listing,
        relatedCases,
      },
    };
  }
  if (targetType === "LISTING_PHOTO") {
    let listing = await prisma.listing.findFirst({
      where: { photos: { has: targetId } },
      select: {
        id: true,
        title: true,
        photos: true,
        status: true,
        published: true,
        isPaused: true,
        host: { select: { id: true, name: true, email: true, image: true } },
      },
    });
    if (!listing) {
      const pastActivity = await prisma.moderationActivity.findFirst({
        where: {
          action: { in: ["REPORT_ATTACHED", "CONTENT_MODERATED"] },
          after: { not: Prisma.DbNull },
        },
        orderBy: { createdAt: "desc" },
        select: { after: true },
      });
      const listingId = (pastActivity?.after as any)?.listingId;
      if (listingId) {
        listing = await prisma.listing.findUnique({
          where: { id: listingId },
          select: {
            id: true,
            title: true,
            photos: true,
            status: true,
            published: true,
            isPaused: true,
            host: { select: { id: true, name: true, email: true, image: true } },
          },
        });
      }
    }
    return listing
      ? {
          type: targetType,
          available: true,
          data: {
            ...listing,
            photoUrl: targetId,
            isCurrentlyInGallery: listing.photos.includes(targetId),
          },
        }
      : {
          type: targetType,
          available: true,
          data: {
            photoUrl: targetId,
            isCurrentlyInGallery: false,
          },
        };
  }
  if (targetType === "PROFILE" || targetType === "USER") {
    const user = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true, email: true, image: true, role: true, status: true, createdAt: true },
    });
    return user ? { type: targetType, available: true, data: { ...user, photoUrl: user.image } } : { type: targetType, available: false };
  }
  if (targetType === "MESSAGE") {
    const message = await prisma.message.findUnique({ where: { id: targetId }, select: { id: true, content: true, type: true, createdAt: true, sender: { select: { id: true, name: true, email: true } }, conversation: { select: { id: true, listing: { select: { id: true, title: true } } } } } });
    return message ? { type: targetType, available: true, data: message } : { type: targetType, available: false };
  }
  return { type: targetType, available: false };
}

export async function listEligibleModerators(actor: AuthUser) {
  assertModerator(actor, PERMISSIONS.MODERATION_CASE_ASSIGN);
  await assertModerationSchemaReady();
  return prisma.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { role: Role.ADMIN },
        { adminRole: { is: { permissions: { some: { permission: { slug: { in: [PERMISSIONS.MODERATION_CASE_READ, PERMISSIONS.MODERATION_CASE_UPDATE] } } } } } } },
      ],
    },
    select: { id: true, name: true, email: true, adminRole: { select: { name: true, slug: true } } },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 100,
  });
}

export async function listModerationAssigneeFilters(actor: AuthUser) {
  assertModerator(actor, PERMISSIONS.MODERATION_CASE_READ);
  await assertModerationSchemaReady();
  return prisma.user.findMany({
    where: { assignedModerationCases: { some: {} } },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 100,
  });
}

export async function addModerationNote(actor: AuthUser, caseId: string, note: string) {
  assertModerator(actor, PERMISSIONS.MODERATION_DECISION_CREATE);
  await assertModerationSchemaReady();
  const content = note.trim();
  if (!content || content.length > 5_000) throw AppError.badRequest("A moderation note must be between 1 and 5000 characters.");
  const exists = await prisma.moderationCase.findUnique({ where: { id: caseId }, select: { id: true } });
  if (!exists) throw AppError.notFound("Moderation case not found.");
  return prisma.moderationActivity.create({
    data: { caseId, actorId: actor.id, action: "INTERNAL_NOTE_ADDED", metadata: { note: content, visibility: "MODERATORS_ONLY" } },
    include: { actor: { select: { id: true, name: true, email: true } } },
  });
}

export async function addModerationEvidence(actor: AuthUser, caseId: string, input: { evidenceType: ModerationEvidenceType; storageReference: string; displayName?: string }) {
  if (!canModerate(actor, PERMISSIONS.MODERATION_EVIDENCE_ADD)) throw AppError.forbidden("Missing moderation evidence add permission.");
  await assertModerationSchemaReady();
  const caseRecord = await prisma.moderationCase.findUnique({ where: { id: caseId }, select: { id: true } });
  if (!caseRecord) throw AppError.notFound("Moderation case not found.");
  const storageReference = input.storageReference.trim();
  if (!storageReference || storageReference.length > 1_024) throw AppError.badRequest("Evidence reference is invalid.");
  const evidence = await prisma.moderationEvidence.create({ data: { caseId, submittedById: actor.id, evidenceType: input.evidenceType, storageReference, displayName: input.displayName?.trim() || null } });
  await prisma.moderationActivity.create({ data: { caseId, actorId: actor.id, action: "EVIDENCE_ATTACHED", after: { evidenceId: evidence.id, evidenceType: evidence.evidenceType } } });
  return evidence;
}

export async function getModerationEvidenceForAdmin(actor: AuthUser, caseId: string, evidenceId: string) {
  if (!canModerate(actor, PERMISSIONS.MODERATION_EVIDENCE_READ)) throw AppError.forbidden("Missing moderation evidence read permission.");
  await assertModerationSchemaReady();
  const evidence = await prisma.moderationEvidence.findFirst({
    where: { id: evidenceId, caseId },
    select: {
      id: true,
      caseId: true,
      submittedById: true,
      evidenceType: true,
      displayName: true,
      accessScope: true,
      retentionUntil: true,
      metadata: true,
      createdAt: true,
    },
  });
  if (!evidence) throw AppError.notFound("Moderation evidence not found.");
  // A future authorized storage proxy may resolve the omitted internal storage
  // reference after this permission check; it is never returned to a browser.
  return evidence;
}

export const moderationService = {
  createModerationReport,
  listMyModerationReports,
  listModerationCases,
  getModerationDashboardSummary,
  getModerationCaseDetails,
  listEligibleModerators,
  listModerationAssigneeFilters,
  updateModerationCase,
  addModerationNote,
  addModerationEvidence,
  getModerationEvidenceForAdmin,
};
