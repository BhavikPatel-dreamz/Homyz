import "server-only";

import path from "node:path";
import { nanoid } from "nanoid";
import { Prisma } from "@/generated/prisma/client";
import {
  BookingStatus,
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
import { getEffectivePermissionsForUser } from "@/lib/permissions/admin-permission-service";
import {
  MODERATION_POLICY_VERSION,
  MODERATION_POLICY_CATEGORIES,
  getModerationPolicy,
  isPolicyAppealable,
  getAppealDeadlineDays,
  listAllModerationPolicies,
  type ModerationPolicyCategory,
  type ModerationPolicy,
} from "@/lib/moderation/policies";
import {
  getModerationAnalytics,
  exportModerationAnalyticsCsv,
} from "@/services/moderation-analytics.service";
import {
  getEvidenceRetentionReport,
  applyEvidenceRetentionHold,
  releaseEvidenceRetentionHold,
  purgeEligibleEvidence,
} from "@/services/evidence-retention.service";
import { logSecurityEvent } from "@/lib/moderation/security-monitor";
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

async function assertEligibleModeratorAssignee(assigneeId: string) {
  const assignee = await prisma.user.findUnique({
    where: { id: assigneeId },
    select: { id: true, role: true, adminRoleId: true, adminRole: { select: { slug: true } }, status: true },
  });
  if (!assignee || assignee.status !== "ACTIVE" || (assignee.role !== Role.ADMIN && !assignee.adminRoleId)) {
    throw AppError.badRequest("Assigned moderator must be an active administrator.");
  }

  const requiredPermissions = [PERMISSIONS.MODERATION_CASE_READ, PERMISSIONS.MODERATION_CASE_UPDATE];
  if (assignee.role === Role.ADMIN && !assignee.adminRoleId) {
    const overrides = await prisma.adminPermissionOverride.findMany({
      where: { adminId: assignee.id, permission: { in: requiredPermissions } },
      select: { permission: true, effect: true },
    });
    if (overrides.some((override: { effect: string }) => override.effect === "DENY")) {
      throw AppError.badRequest("Assigned moderator does not have effective moderation case permissions.");
    }
    return;
  }

  const permissions = await getEffectivePermissionsForUser(assignee.id, assignee.role, assignee.adminRole?.slug);
  if (!requiredPermissions.every((permission) => permissions.includes(permission) || permissions.includes("*"))) {
    throw AppError.badRequest("Assigned moderator does not have effective moderation case permissions.");
  }
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

/**
 * Participants must never be sent to staff-only case pages. The reports page
 * is protected by the participant-aware moderation APIs used by its actions.
 */
function moderationParticipantLink(caseId: string, params?: Record<string, string>) {
  const search = new URLSearchParams({ caseId, ...params });
  return `/profile/reports?${search.toString()}`;
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
        authorId: true,
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
      if (actor.id === review.authorId) {
        throw AppError.badRequest("You cannot report a review you authored.");
      }
      const isTargetUser = review.targetUserId === actor.id;
      const isListingHost = review.listing?.hostId === actor.id;
      if (!isTargetUser && !isListingHost) {
        const booking = await prisma.booking.findUnique({
          where: { id: review.bookingId },
          select: { userId: true, listing: { select: { hostId: true } } },
        });
        const isBookingParticipant = booking && (booking.userId === actor.id || booking.listing.hostId === actor.id);
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
      include: { case: { select: { id: true, caseReference: true, status: true, severity: true, updatedAt: true } } },
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
  const reportDateWhere: Prisma.ModerationReportWhereInput = start || end ? { createdAt: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {};
  const [
    totalReports,
    totalCases, newCases, inReviewCases, needsInformationCases, highPriorityOpenCases,
    resolvedCases, dismissedCases, unassignedOpenCases, distributions, workload, recentActivity,
  ] = await Promise.all([
    prisma.moderationReport.count({ where: reportDateWhere }),
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
    counts: { totalReports, totalCases, newCases, inReviewCases, needsInformationCases, highPriorityOpenCases, resolvedCases, dismissedCases, unassignedOpenCases },
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
  enforcementReason?: string | null;
  expectedUpdatedAt?: string;
  reviewAction?: "NONE" | "HIDE" | "DELETE" | "RESTORE";
  listingAction?: "NONE" | "DISMISS" | "WARN_HOST" | "REQUEST_CORRECTION" | "TEMPORARY_RESTRICTION" | "SUSPEND" | "RESTORE";
  mediaAction?: "NONE" | "DISMISS" | "HIDE_PHOTO" | "REMOVE_PHOTO" | "REQUEST_REPLACEMENT" | "RESTORE_PHOTO";
};

export type AdminReviewModerationInput = {
  reviewId: string;
  action: "HIDE" | "DELETE" | "RESTORE";
  reason?: string;
  notes?: string;
};

function hasDecisionMutation(input: UpdateModerationCaseInput) {
  return input.resolutionCategory !== undefined
    || input.resolutionNotes !== undefined
    || (input.reviewAction !== undefined && input.reviewAction !== "NONE")
    || (input.listingAction !== undefined && input.listingAction !== "NONE")
    || (input.mediaAction !== undefined && input.mediaAction !== "NONE");
}

function hasContentEnforcementAction(input: UpdateModerationCaseInput) {
  return (input.reviewAction !== undefined && input.reviewAction !== "NONE")
    || (input.listingAction !== undefined && input.listingAction !== "NONE" && input.listingAction !== "DISMISS")
    || (input.mediaAction !== undefined && input.mediaAction !== "NONE" && input.mediaAction !== "DISMISS");
}

function assertActionMatchesTarget(targetType: ModerationTargetType, input: UpdateModerationCaseInput) {
  if (input.reviewAction && input.reviewAction !== "NONE" && targetType !== "REVIEW") {
    throw AppError.badRequest("Review enforcement can only be applied to a review moderation case.");
  }
  if (input.listingAction && input.listingAction !== "NONE" && targetType !== "LISTING") {
    throw AppError.badRequest("Listing enforcement can only be applied to a listing moderation case.");
  }
  if (input.mediaAction && input.mediaAction !== "NONE" && !["LISTING_PHOTO", "PROFILE", "USER"].includes(targetType)) {
    throw AppError.badRequest("Media enforcement can only be applied to a photo or profile moderation case.");
  }
}

async function recordEnforcementFailure(
  actor: AuthUser,
  caseRecord: { id: string; caseReference: string; targetType: ModerationTargetType; targetId: string },
  input: UpdateModerationCaseInput,
  error: unknown,
) {
  const message = error instanceof Error ? error.message : "Unknown enforcement error";
  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.moderationActivity.create({
        data: {
          caseId: caseRecord.id,
          actorId: actor.id,
          action: "ENFORCEMENT_FAILED",
          metadata: {
            targetType: caseRecord.targetType,
            targetId: caseRecord.targetId,
            reviewAction: input.reviewAction,
            listingAction: input.listingAction,
            mediaAction: input.mediaAction,
            reason: input.enforcementReason?.trim() || input.resolutionCategory || null,
            error: message,
            enforcementResult: "FAILURE",
          },
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          action: "MODERATION_ENFORCEMENT_FAILED",
          resourceType: "MODERATION_CASE",
          resourceId: caseRecord.id,
          description: `Moderation enforcement failed for ${caseRecord.caseReference}: ${message}`,
          status: "FAILURE",
          metadata: { caseId: caseRecord.id, targetType: caseRecord.targetType, targetId: caseRecord.targetId },
        },
      });
    });
  } catch (auditError) {
    console.error("[moderation.service] Failed to record enforcement failure:", auditError);
  }
}

export async function updateModerationCase(actor: AuthUser, caseId: string, input: UpdateModerationCaseInput) {
  if (!canModerate(actor, PERMISSIONS.MODERATION_CASE_UPDATE)) throw AppError.forbidden("Missing moderation case update permission.");
  await assertModerationSchemaReady();
  const existing = await prisma.moderationCase.findUnique({ where: { id: caseId } });
  if (!existing) throw AppError.notFound("Moderation case not found.");
  if (input.expectedUpdatedAt && new Date(input.expectedUpdatedAt).getTime() !== existing.updatedAt.getTime()) {
    throw AppError.conflict("This moderation case changed. Refresh it before making another update.");
  }
  if (input.status) assertValidModerationTransition(existing.status, input.status);
  assertActionMatchesTarget(existing.targetType, input);
  if (input.assignedModeratorId !== undefined) {
    if (!hasPermission(actor, PERMISSIONS.MODERATION_CASE_ASSIGN)) throw AppError.forbidden("Missing moderation case assign permission.");
    if (input.assignedModeratorId) {
      await assertEligibleModeratorAssignee(input.assignedModeratorId);
    }
  }
  if (hasDecisionMutation(input) && !canModerate(actor, PERMISSIONS.MODERATION_DECISION_CREATE)) {
    throw AppError.forbidden("Missing moderation decision permission.");
  }
  if (hasContentEnforcementAction(input) && !canModerate(actor, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE)) {
    throw AppError.forbidden("Missing moderation enforcement permission.");
  }

  let targetListing: { id: string; title: string; hostId: string; isPaused: boolean; published: boolean; status: ListingStatus } | null = null;
  let mediaListing: { id: string; title: string; hostId: string; photos: string[] } | null = null;
  let mediaUser: { id: string; name: string | null; email: string | null; image: string | null } | null = null;
  try {
  // If review action is specified for a review moderation case, apply it via review service
  if (input.reviewAction && input.reviewAction !== "NONE" && existing.targetType === "REVIEW") {
    await reviewService.adminModerateReview({
      reviewId: existing.targetId,
      moderatorId: actor.id,
      action: input.reviewAction,
      reason: input.enforcementReason?.trim() || input.resolutionCategory || "Moderation case decision",
      notes: input.resolutionNotes || undefined,
      caseId: existing.id,
    });
  }

  if (existing.targetType === "LISTING" && input.listingAction && input.listingAction !== "NONE") {
    targetListing = await listingService.applyModerationAction({
      listingId: existing.targetId,
      action: input.listingAction,
      reason: input.resolutionCategory || undefined,
      notes: input.resolutionNotes || undefined,
    });
  }

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
  } catch (error) {
    if (hasContentEnforcementAction(input)) await recordEnforcementFailure(actor, existing, input, error);
    throw error;
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
        after: {
          reviewAction: input.reviewAction,
          targetId: existing.targetId,
          reason: input.enforcementReason?.trim() || input.resolutionCategory || null,
          enforcementResult: "SUCCESS",
        },
      });
    }
    if (targetListing && input.listingAction && input.listingAction !== "NONE" && input.listingAction !== "DISMISS") {
      activities.push({
        caseId,
        actorId: actor.id,
        action: "CONTENT_MODERATED",
        before: { listingAction: null },
        after: {
          listingAction: input.listingAction,
          listingId: targetListing.id,
          notes: input.resolutionNotes,
          reason: input.enforcementReason?.trim() || input.resolutionCategory || null,
          enforcementResult: "SUCCESS",
        },
      });
    }
    if (input.mediaAction && input.mediaAction !== "NONE" && input.mediaAction !== "DISMISS") {
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
          reason: input.enforcementReason?.trim() || input.resolutionCategory || null,
          enforcementResult: "SUCCESS",
        },
      });
    }
    if (activities.length > 0) await tx.moderationActivity.createMany({ data: activities });
    if (activities.length > 0) {
      await tx.auditLog.create({
        data: {
          actorId: actor.id,
          actorEmail: actor.email,
          action: hasContentEnforcementAction(input) ? "MODERATION_ENFORCEMENT_EXECUTED" : "MODERATION_CASE_UPDATED",
          resourceType: "MODERATION_CASE",
          resourceId: caseId,
          description: hasContentEnforcementAction(input)
            ? `Moderation enforcement executed for ${existing.targetType} target ${existing.targetId}.`
            : `Moderation case ${caseRecord.caseReference} was updated.`,
          metadata: {
            caseId,
            caseReference: caseRecord.caseReference,
            targetType: existing.targetType,
            targetId: existing.targetId,
            status: caseRecord.status,
            resolutionCategory: caseRecord.resolutionCategory,
            reviewAction: input.reviewAction,
            listingAction: input.listingAction,
            mediaAction: input.mediaAction,
            enforcementReason: input.enforcementReason?.trim() || undefined,
            enforcementResult: hasContentEnforcementAction(input) ? "SUCCESS" : undefined,
          },
        },
      });
    }
    return caseRecord;
  });

  // Assignment and staff follow-up notifications must be emitted only after
  // the case mutation commits. These helpers intentionally do not notify the
  // assigning moderator about their own action.
  if (input.assignedModeratorId !== undefined && existing.assignedModeratorId !== updated.assignedModeratorId) {
    await notifyCaseAssignment({
      caseId: updated.id,
      caseReference: updated.caseReference,
      actorId: actor.id,
      previousAssigneeId: existing.assignedModeratorId,
      nextAssigneeId: updated.assignedModeratorId,
      status: updated.status,
      updatedAt: updated.updatedAt,
    });
  }
  if (input.status === "NEEDS_INFORMATION" && existing.status !== "NEEDS_INFORMATION") {
    await notifyRequiredInformation({
      caseId: updated.id,
      caseReference: updated.caseReference,
      assigneeId: updated.assignedModeratorId,
      actorId: actor.id,
      updatedAt: updated.updatedAt,
    });
  }

  // User notifications dispatch
  try {
    const reports = await prisma.moderationReport.findMany({
      where: { caseId },
      select: { reporterId: true },
      take: 20,
    });
    const reporterIds: string[] = Array.from(new Set(reports.map((r: { reporterId: string }) => r.reporterId)));

    if (input.reviewAction === "HIDE" || input.reviewAction === "DELETE" || input.reviewAction === "RESTORE") {
      const wasRemoved = input.reviewAction === "HIDE" || input.reviewAction === "DELETE";
      await Promise.all(
        reporterIds.map((reporterId: string) =>
          notificationService.create({
            userId: reporterId,
            type: NotificationType.SYSTEM,
            title: wasRemoved ? "Review removal request approved" : "Review restored following moderation review",
            message: wasRemoved
              ? `Your report for case ${updated.caseReference} was investigated and the review was removed.`
              : `The review in case ${updated.caseReference} has been restored following moderation review.`,
            entityId: updated.id,
            entityType: wasRemoved ? "moderation-review-removed" : "moderation-review-restored",
            link: moderationParticipantLink(updated.id),
            metadata: { caseId: updated.id, caseReference: updated.caseReference },
          }).catch(() => undefined)
        )
      );
      const targetReview = await prisma.review.findUnique({
        where: { id: existing.targetId },
        select: { authorId: true },
      });
      if (targetReview?.authorId) {
        await notificationService.create({
          userId: targetReview.authorId,
          type: NotificationType.SYSTEM,
          title: wasRemoved ? "Review removed under content policy" : "Review restored",
          message: wasRemoved
            ? `A review you authored was moderated and removed for violating Homyz policies (${input.resolutionCategory || "Policy Violation"}).`
            : "A review you authored has been restored following moderation review.",
          entityId: existing.targetId,
          entityType: wasRemoved ? "review-moderated" : "review-restored",
          link: moderationParticipantLink(updated.id),
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
              link: moderationParticipantLink(updated.id),
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
              link: moderationParticipantLink(updated.id),
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
              link: moderationParticipantLink(updated.id),
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
            link: moderationParticipantLink(updated.id),
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
            link: moderationParticipantLink(updated.id),
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

/**
 * Administrative review actions enter through the canonical moderation case
 * lifecycle. Staff-created cases intentionally have no fabricated user report.
 */
export async function moderateReviewFromAdmin(actor: AuthUser, input: AdminReviewModerationInput) {
  assertModerator(actor, PERMISSIONS.MODERATION_CASE_UPDATE);
  assertModerator(actor, PERMISSIONS.MODERATION_DECISION_CREATE);
  assertModerator(actor, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE);
  await assertModerationSchemaReady();

  const review = await prisma.review.findUnique({ where: { id: input.reviewId }, select: { id: true } });
  if (!review) throw AppError.notFound("Review not found.");

  const lockKey = `moderation:review:${input.reviewId}`;
  const caseRecord = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
    const existing = await tx.moderationCase.findFirst({
      where: { targetType: "REVIEW", targetId: input.reviewId },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });
    if (existing) return existing;

    const createdCase = await tx.moderationCase.create({
      data: {
        caseReference: `MOD-${nanoid(10).toUpperCase()}`,
        targetType: "REVIEW",
        targetId: input.reviewId,
        category: "ADMIN_REVIEW_MODERATION",
        severity: "MEDIUM",
        policyVersion: MODERATION_POLICY_VERSION,
      },
    });
    await tx.moderationActivity.create({
      data: {
        caseId: createdCase.id,
        actorId: actor.id,
        action: "CASE_CREATED",
        after: { status: createdCase.status, severity: createdCase.severity },
        metadata: { source: "ADMIN_DIRECT_REVIEW", targetType: "REVIEW", targetId: input.reviewId },
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        action: "MODERATION_CASE_CREATED",
        resourceType: "MODERATION_CASE",
        resourceId: createdCase.id,
        description: `Staff initiated moderation case ${createdCase.caseReference} for review ${input.reviewId}.`,
        metadata: { caseId: createdCase.id, targetType: "REVIEW", targetId: input.reviewId, source: "ADMIN_DIRECT_REVIEW" },
      },
    });
    return createdCase;
  });

  let activeCase = caseRecord;
  if (activeCase.status === "RESOLVED" || activeCase.status === "DISMISSED") {
    activeCase = await updateModerationCase(actor, activeCase.id, {
      status: "REOPENED",
      expectedUpdatedAt: activeCase.updatedAt.toISOString(),
    });
  }

  const updatedCase = await updateModerationCase(actor, activeCase.id, {
    status: "RESOLVED",
    resolutionCategory: "ADMIN_REVIEW_ENFORCEMENT",
    resolutionNotes: input.notes?.trim() || null,
    enforcementReason: input.reason?.trim() || null,
    reviewAction: input.action,
    expectedUpdatedAt: activeCase.updatedAt.toISOString(),
  });
  const updatedReview = await reviewService.getReviewById(input.reviewId);

  return { case: updatedCase, review: updatedReview };
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
  const target = await getModerationTargetSummary(caseRecord.targetType, caseRecord.targetId, caseRecord.id);
  return { case: caseRecord, target };
}

async function getModerationTargetSummary(targetType: ModerationTargetType, targetId: string, caseId: string) {
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
        response: { select: { id: true, comment: true, createdAt: true, author: { select: { id: true, name: true } } } },
        booking: { select: { id: true, startDate: true, endDate: true, status: true, userId: true } },
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
            status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
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
            user: {
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
    const hasMatchingPhotoReport = await prisma.moderationReport.findFirst({
      where: { caseId, targetType: "LISTING_PHOTO", targetId },
      select: { id: true },
    });
    if (!listing && hasMatchingPhotoReport) {
      const pastActivity = await prisma.moderationActivity.findFirst({
        where: {
          caseId,
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
  return evidence;
}

export function validateEvidenceFile(file: { buffer: Buffer; fileName: string; mimeType?: string }) {
  const maxSize = 15 * 1024 * 1024; // 15MB
  const allowed = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);
  if (!file.buffer?.length) throw AppError.badRequest("Evidence file cannot be empty.");
  if (file.buffer.length > maxSize) throw AppError.badRequest("Evidence file must be 15MB or smaller.");

  const rawExtension = path.extname(file.fileName).toLowerCase();
  if (!allowed.has(rawExtension)) {
    throw AppError.badRequest("Evidence must be a JPG, PNG, WEBP image, or PDF document.");
  }

  // Magic bytes signature verification
  const isJpeg = file.buffer.length >= 3 && file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
  const isPng = file.buffer.length >= 8 && file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = file.buffer.length >= 12 && file.buffer.toString("ascii", 0, 4) === "RIFF" && file.buffer.toString("ascii", 8, 12) === "WEBP";
  const isPdf = file.buffer.length >= 5 && file.buffer.toString("ascii", 0, 5) === "%PDF-";

  if (!isJpeg && !isPng && !isWebp && !isPdf) {
    throw AppError.badRequest("Evidence file content does not match a supported format (JPG, PNG, WEBP, or PDF).");
  }

  if (rawExtension === ".pdf" && !isPdf) {
    throw AppError.badRequest("File content does not match declared PDF format.");
  }
  if (rawExtension === ".png" && !isPng) {
    throw AppError.badRequest("File content does not match declared PNG format.");
  }
  if (rawExtension === ".webp" && !isWebp) {
    throw AppError.badRequest("File content does not match declared WebP format.");
  }
  if ((rawExtension === ".jpg" || rawExtension === ".jpeg") && !isJpeg) {
    throw AppError.badRequest("File content does not match declared JPEG format.");
  }

  const cleanExtension = isPdf ? ".pdf" : isWebp ? ".webp" : isPng ? ".png" : rawExtension === ".jpeg" ? ".jpeg" : ".jpg";
  const mimeType = isPdf ? "application/pdf" : isWebp ? "image/webp" : isPng ? "image/png" : "image/jpeg";
  const evidenceType: ModerationEvidenceType = isPdf ? ModerationEvidenceType.DOCUMENT : ModerationEvidenceType.EXISTING_MEDIA;
  const baseName = path.basename(file.fileName, rawExtension).replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 80) || "evidence";
  const cleanFileName = `${baseName}-${nanoid(8)}${cleanExtension}`;

  return { cleanFileName, extension: cleanExtension, mimeType, evidenceType, isPdf };
}

export async function getCaseParticipants(caseId: string) {
  const caseRecord = await prisma.moderationCase.findUnique({
    where: { id: caseId },
    include: {
      reports: {
        select: {
          reporterId: true,
          reporter: { select: { id: true, name: true, email: true, role: true } },
          relatedBooking: {
            select: {
              userId: true,
              user: { select: { id: true, name: true, email: true, role: true } },
              listing: { select: { hostId: true, host: { select: { id: true, name: true, email: true, role: true } } } },
            },
          },
        },
      },
    },
  });

  if (!caseRecord) return null;

  const participantsMap = new Map<string, { id: string; name: string | null; email: string | null; role: string; participantRole: "GUEST" | "HOST" }>();

  for (const report of caseRecord.reports) {
    if (report.reporter) {
      participantsMap.set(report.reporter.id, {
        ...report.reporter,
        participantRole: report.reporter.role === Role.HOST ? "HOST" : "GUEST",
      });
    }
    if (report.relatedBooking?.user) {
      participantsMap.set(report.relatedBooking.user.id, {
        ...report.relatedBooking.user,
        participantRole: "GUEST",
      });
    }
    if (report.relatedBooking?.listing?.host) {
      participantsMap.set(report.relatedBooking.listing.host.id, {
        ...report.relatedBooking.listing.host,
        participantRole: "HOST",
      });
    }
  }

  if (caseRecord.targetType === "LISTING") {
    const listing = await prisma.listing.findUnique({
      where: { id: caseRecord.targetId },
      select: { host: { select: { id: true, name: true, email: true, role: true } } },
    });
    if (listing?.host) {
      participantsMap.set(listing.host.id, { ...listing.host, participantRole: "HOST" });
    }
  } else if (caseRecord.targetType === "LISTING_PHOTO") {
    let listing = await prisma.listing.findFirst({
      where: { photos: { has: caseRecord.targetId } },
      select: { host: { select: { id: true, name: true, email: true, role: true } } },
    });
    if (!listing) {
      const pastActivity = await prisma.moderationActivity.findFirst({
        where: { caseId: caseRecord.id, after: { not: Prisma.DbNull } },
        orderBy: { createdAt: "desc" },
        select: { after: true },
      });
      const listingId = (pastActivity?.after as any)?.listingId;
      if (listingId) {
        listing = await prisma.listing.findUnique({
          where: { id: listingId },
          select: { host: { select: { id: true, name: true, email: true, role: true } } },
        });
      }
    }
    if (listing?.host) {
      participantsMap.set(listing.host.id, { ...listing.host, participantRole: "HOST" });
    }
  } else if (caseRecord.targetType === "REVIEW") {
    const review = await prisma.review.findUnique({
      where: { id: caseRecord.targetId },
      select: {
        author: { select: { id: true, name: true, email: true, role: true } },
        targetUser: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    if (review?.author) {
      participantsMap.set(review.author.id, { ...review.author, participantRole: review.author.role === Role.HOST ? "HOST" : "GUEST" });
    }
    if (review?.targetUser) {
      participantsMap.set(review.targetUser.id, { ...review.targetUser, participantRole: review.targetUser.role === Role.HOST ? "HOST" : "GUEST" });
    }
  } else if (caseRecord.targetType === "USER" || caseRecord.targetType === "PROFILE") {
    const user = await prisma.user.findUnique({
      where: { id: caseRecord.targetId },
      select: { id: true, name: true, email: true, role: true },
    });
    if (user) {
      participantsMap.set(user.id, { ...user, participantRole: user.role === Role.HOST ? "HOST" : "GUEST" });
    }
  } else if (caseRecord.targetType === "MESSAGE") {
    const message = await prisma.message.findUnique({
      where: { id: caseRecord.targetId },
      select: {
        sender: { select: { id: true, name: true, email: true, role: true } },
        conversation: {
          select: {
            host: { select: { id: true, name: true, email: true, role: true } },
            guest: { select: { id: true, name: true, email: true, role: true } },
          },
        },
      },
    });
    if (message?.sender) {
      participantsMap.set(message.sender.id, { ...message.sender, participantRole: message.sender.role === Role.HOST ? "HOST" : "GUEST" });
    }
    if (message?.conversation?.host) {
      participantsMap.set(message.conversation.host.id, { ...message.conversation.host, participantRole: "HOST" });
    }
    if (message?.conversation?.guest) {
      participantsMap.set(message.conversation.guest.id, { ...message.conversation.guest, participantRole: "GUEST" });
    }
  }

  return {
    participants: Array.from(participantsMap.values()),
    isParticipant: (userId: string) => participantsMap.has(userId),
    getParticipant: (userId: string) => participantsMap.get(userId) || null,
  };
}

export async function uploadModerationEvidence(
  actor: AuthUser,
  caseId: string,
  input: {
    file: { buffer: Buffer; fileName: string; mimeType?: string };
    description?: string;
    accessScope?: "MODERATORS_ONLY" | "CASE_PARTICIPANTS";
    informationRequestId?: string;
  },
) {
  await assertModerationSchemaReady();
  const caseRecord = await prisma.moderationCase.findUnique({
    where: { id: caseId },
    select: { id: true, status: true, caseReference: true, assignedModeratorId: true },
  });
  if (!caseRecord) throw AppError.notFound("Moderation case not found.");

  const isModerator = canModerate(actor, PERMISSIONS.MODERATION_EVIDENCE_ADD);
  if (!isModerator) {
    const participantInfo = await getCaseParticipants(caseId);
    if (!participantInfo?.isParticipant(actor.id)) {
      throw AppError.forbidden("You are not an authorized participant on this moderation case.");
    }
    if (["RESOLVED", "DISMISSED"].includes(caseRecord.status)) {
      throw AppError.badRequest("Cannot upload evidence to a closed moderation case.");
    }
  }

  const validated = validateEvidenceFile(input.file);
  const stored = await savePrivateMedia({
    kind: "moderation-evidence",
    fileName: validated.cleanFileName,
    body: input.file.buffer,
    contentType: validated.mimeType,
  });

  const accessScope = isModerator ? (input.accessScope || "MODERATORS_ONLY") : "CASE_PARTICIPANTS";
  const metadata = {
    originalFileName: path.basename(input.file.fileName),
    fileSize: input.file.buffer.length,
    mimeType: validated.mimeType,
    scanStatus: "CLEAN",
    description: input.description?.trim() || null,
    informationRequestId: input.informationRequestId?.trim() || null,
  };

  const evidence = await prisma.moderationEvidence.create({
    data: {
      caseId,
      submittedById: actor.id,
      evidenceType: validated.evidenceType,
      storageReference: stored.storagePath,
      displayName: path.basename(input.file.fileName),
      accessScope,
      metadata,
    },
    select: publicEvidenceSelect(),
  });

  await prisma.moderationActivity.create({
    data: {
      caseId,
      actorId: actor.id,
      action: "EVIDENCE_ATTACHED",
      after: {
        evidenceId: evidence.id,
        displayName: evidence.displayName,
        evidenceType: evidence.evidenceType,
        accessScope,
        informationRequestId: input.informationRequestId || null,
      },
    },
  });

  if (!isModerator && !input.informationRequestId && caseRecord.assignedModeratorId && caseRecord.assignedModeratorId !== actor.id) {
    await notificationService.create({
      userId: caseRecord.assignedModeratorId,
      type: NotificationType.SYSTEM,
      title: "Evidence submitted for moderation case",
      message: `A participant submitted supporting evidence for ${caseRecord.caseReference}.`,
      entityId: evidence.id,
      entityType: "moderation-evidence-submitted",
      link: `/admin/moderation/cases/${caseId}`,
      metadata: {
        moderationCaseId: caseId,
        caseReference: caseRecord.caseReference,
        evidenceId: evidence.id,
        recipientRole: "ADMIN",
      },
    }).catch((err) => console.warn("[moderation.service] Failed to notify moderator of evidence:", err));
  }

  // RFI evidence is confirmed when the participant submits the corresponding
  // response, avoiding two receipt notifications for one logical response.
  if (!isModerator && !input.informationRequestId) {
    await notificationService.create({
      userId: actor.id,
      type: NotificationType.SYSTEM,
      title: "Supporting evidence submitted",
      message: `Your supporting evidence for ${caseRecord.caseReference} was submitted successfully.`,
      entityId: evidence.id,
      entityType: "moderation-evidence-receipt",
      link: moderationParticipantLink(caseId),
      metadata: { moderationCaseId: caseId, caseReference: caseRecord.caseReference, evidenceId: evidence.id },
    }).catch((err) => console.warn("[moderation.service] Failed to create evidence receipt:", err));
  }

  return evidence;
}

export async function getModerationEvidenceStream(actor: AuthUser, caseId: string, evidenceId: string) {
  await assertModerationSchemaReady();
  const evidence = await prisma.moderationEvidence.findFirst({
    where: { id: evidenceId, caseId },
    select: {
      id: true,
      caseId: true,
      submittedById: true,
      displayName: true,
      accessScope: true,
      storageReference: true,
      metadata: true,
    },
  });

  if (!evidence) throw AppError.notFound("Moderation evidence not found.");

  const isModerator = canModerate(actor, PERMISSIONS.MODERATION_EVIDENCE_READ);
  if (!isModerator) {
    if (evidence.submittedById !== actor.id) {
      if (evidence.accessScope !== "CASE_PARTICIPANTS") {
        throw AppError.forbidden("Access denied to confidential moderation evidence.");
      }
      const participantInfo = await getCaseParticipants(caseId);
      if (!participantInfo?.isParticipant(actor.id)) {
        throw AppError.forbidden("You are not authorized to view evidence for this case.");
      }
    }
  }

  const meta = (evidence.metadata as Record<string, any>) || {};
  if (meta.scanStatus === "QUARANTINED") {
    throw AppError.forbidden("This evidence file is currently quarantined by security policy.");
  }

  const buffer = await readPrivateMedia("moderation-evidence", evidence.storageReference);
  const mimeType = (typeof meta.mimeType === "string" && meta.mimeType) || "application/octet-stream";

  // Audit privileged/authorized evidence access (Task 5 & Task 7)
  await prisma.moderationActivity.create({
    data: {
      caseId,
      actorId: actor.id,
      action: "EVIDENCE_ACCESSED",
      after: {
        evidenceId: evidence.id,
        displayName: evidence.displayName,
        accessScope: evidence.accessScope,
        isModerator,
      },
    },
  }).catch((err: any) => console.warn("[moderation.service] Failed to log evidence access audit:", err));

  logSecurityEvent({
    action: "MODERATION_EVIDENCE_ACCESSED",
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    caseId,
    targetType: "MODERATION_EVIDENCE",
    targetId: evidenceId,
    severity: "INFO",
    details: { displayName: evidence.displayName, accessScope: evidence.accessScope },
  });

  return {
    buffer,
    mimeType,
    displayName: evidence.displayName || "evidence",
    fileSize: buffer.length,
  };
}

export async function listModerationEvidence(actor: AuthUser, caseId: string) {
  await assertModerationSchemaReady();
  const caseRecord = await prisma.moderationCase.findUnique({
    where: { id: caseId },
    select: { id: true },
  });
  if (!caseRecord) throw AppError.notFound("Moderation case not found.");

  const isModerator = canModerate(actor, PERMISSIONS.MODERATION_EVIDENCE_READ);
  if (!isModerator) {
    const participantInfo = await getCaseParticipants(caseId);
    if (!participantInfo?.isParticipant(actor.id)) {
      throw AppError.forbidden("You are not an authorized participant on this moderation case.");
    }
  }

  const where: Prisma.ModerationEvidenceWhereInput = { caseId };
  if (!isModerator) {
    where.OR = [
      { submittedById: actor.id },
      { accessScope: "CASE_PARTICIPANTS" },
    ];
  }

  const items = await prisma.moderationEvidence.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: publicEvidenceSelect(),
  });

  if (isModerator) {
    return items;
  }

  // Reporter confidentiality (Task 4): mask other participants' personal info
  return items.map((item: any) => {
    if (item.submittedById === actor.id) {
      return item;
    }
    return {
      ...item,
      submittedById: null,
      submittedBy: item.submittedBy
        ? { id: "confidential", name: "Confidential Participant", email: null }
        : null,
    };
  });
}

export async function createInformationRequest(
  actor: AuthUser,
  caseId: string,
  input: {
    recipientId: string;
    requestText: string;
    deadline?: string;
  },
) {
  if (!canModerate(actor, PERMISSIONS.MODERATION_DECISION_CREATE) && !canModerate(actor, PERMISSIONS.MODERATION_CASE_UPDATE)) {
    throw AppError.forbidden("Missing permission to request moderation information.");
  }
  await assertModerationSchemaReady();

  const caseRecord = await prisma.moderationCase.findUnique({
    where: { id: caseId },
    select: { id: true, status: true, caseReference: true, assignedModeratorId: true },
  });
  if (!caseRecord) throw AppError.notFound("Moderation case not found.");
  if (["RESOLVED", "DISMISSED"].includes(caseRecord.status)) {
    throw AppError.badRequest("Cannot request information on a closed case.");
  }

  const requestText = input.requestText.trim();
  if (!requestText || requestText.length > 5000) {
    throw AppError.badRequest("Request explanation must be between 1 and 5000 characters.");
  }

  const participantInfo = await getCaseParticipants(caseId);
  const recipient = participantInfo?.getParticipant(input.recipientId);
  if (!recipient) {
    throw AppError.badRequest("Recipient is not an authorized participant in this case.");
  }

  const requestId = `rfi_${nanoid(12)}`;
  const now = new Date();
  const deadlineDate = input.deadline ? new Date(input.deadline) : null;

  if (caseRecord.status === "NEW" || caseRecord.status === "IN_REVIEW") {
    await prisma.moderationCase.update({
      where: { id: caseId },
      data: { status: "NEEDS_INFORMATION" },
    });
  }

  const rfiMetadata = {
    requestId,
    recipientId: recipient.id,
    recipientName: recipient.name || recipient.email,
    recipientRole: recipient.participantRole,
    requestText,
    deadline: deadlineDate?.toISOString() || null,
    status: "REQUESTED",
    createdAt: now.toISOString(),
  };

  await prisma.moderationActivity.create({
    data: {
      caseId,
      actorId: actor.id,
      action: "INFORMATION_REQUESTED",
      metadata: rfiMetadata,
    },
  });

  await notificationService.create({
    userId: recipient.id,
    type: NotificationType.SYSTEM,
    title: "Information requested on moderation report",
    message: `Our trust & safety team requested information on ${caseRecord.caseReference}: "${requestText.slice(0, 100)}${requestText.length > 100 ? "..." : ""}"`,
    entityId: caseId,
    entityType: `moderation-rfi-${requestId}`,
    link: moderationParticipantLink(caseId, { requestId }),
    metadata: {
      moderationCaseId: caseId,
      caseReference: caseRecord.caseReference,
      requestId,
      type: "MODERATION_INFORMATION_REQUEST",
    },
  }).catch((err) => console.warn("[moderation.service] Failed to notify RFI recipient:", err));

  await notifyRequiredInformation({
    caseId,
    caseReference: caseRecord.caseReference,
    assigneeId: caseRecord.assignedModeratorId,
    actorId: actor.id,
    updatedAt: now,
  });

  return { id: requestId, caseId, ...rfiMetadata };
}

export async function listInformationRequests(actor: AuthUser, caseId: string) {
  await assertModerationSchemaReady();
  const caseRecord = await prisma.moderationCase.findUnique({
    where: { id: caseId },
    select: { id: true },
  });
  if (!caseRecord) throw AppError.notFound("Moderation case not found.");

  const isModerator = canModerate(actor, PERMISSIONS.MODERATION_CASE_READ);
  if (!isModerator) {
    const participantInfo = await getCaseParticipants(caseId);
    if (!participantInfo?.isParticipant(actor.id)) {
      throw AppError.forbidden("You are not an authorized participant on this moderation case.");
    }
  }

  const activities = await prisma.moderationActivity.findMany({
    where: {
      caseId,
      action: {
        in: [
          "INFORMATION_REQUESTED",
          "INFORMATION_RESPONDED",
          "INFORMATION_REQUEST_REVIEWED",
          "INFORMATION_REQUEST_CLOSED",
        ],
      },
    },
    orderBy: { createdAt: "asc" },
    include: {
      actor: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  const rfiMap = new Map<string, any>();
  for (const act of activities) {
    const meta = (act.metadata as Record<string, any>) || {};
    const reqId = meta.requestId;
    if (!reqId) continue;

    if (act.action === "INFORMATION_REQUESTED") {
      rfiMap.set(reqId, {
        id: reqId,
        caseId,
        requestedBy: act.actor,
        recipientId: meta.recipientId,
        recipientName: meta.recipientName,
        recipientRole: meta.recipientRole,
        requestText: meta.requestText,
        deadline: meta.deadline,
        status: meta.status || "REQUESTED",
        createdAt: act.createdAt,
        responses: [],
      });
    } else if (act.action === "INFORMATION_RESPONDED") {
      const rfi = rfiMap.get(reqId);
      if (rfi) {
        rfi.status = "RESPONDED";
        rfi.responses.push({
          id: act.id,
          actor: act.actor,
          responseText: meta.responseText,
          evidenceIds: meta.evidenceIds || [],
          respondedAt: act.createdAt,
        });
      }
    } else if (act.action === "INFORMATION_REQUEST_REVIEWED") {
      const rfi = rfiMap.get(reqId);
      if (rfi) rfi.status = "REVIEWED";
    } else if (act.action === "INFORMATION_REQUEST_CLOSED") {
      const rfi = rfiMap.get(reqId);
      if (rfi) rfi.status = "CLOSED";
    }
  }

  const allRfis = Array.from(rfiMap.values());
  if (!isModerator) {
    return allRfis.filter((rfi) => rfi.recipientId === actor.id);
  }

  return allRfis;
}

export async function respondToInformationRequest(
  actor: AuthUser,
  caseId: string,
  requestId: string,
  input: {
    responseText?: string;
    evidenceIds?: string[];
  },
) {
  await assertModerationSchemaReady();
  const caseRecord = await prisma.moderationCase.findUnique({
    where: { id: caseId },
    select: { id: true, status: true, caseReference: true, assignedModeratorId: true },
  });
  if (!caseRecord) throw AppError.notFound("Moderation case not found.");

  const rfis = await listInformationRequests(actor, caseId);
  const rfi = rfis.find((r) => r.id === requestId);
  if (!rfi) throw AppError.notFound("Information request not found.");

  if (rfi.recipientId !== actor.id) {
    throw AppError.forbidden("Only the designated recipient can respond to this request.");
  }
  if (rfi.status === "CLOSED") {
    throw AppError.badRequest("This information request has been closed.");
  }

  const responseText = input.responseText?.trim() || "";
  const evidenceIds = Array.isArray(input.evidenceIds) ? input.evidenceIds : [];

  if (!responseText && evidenceIds.length === 0) {
    throw AppError.badRequest("Provide a response explanation or attach evidence.");
  }

  if (caseRecord.status === "NEEDS_INFORMATION") {
    await prisma.moderationCase.update({
      where: { id: caseId },
      data: { status: "IN_REVIEW" },
    });
  }

  await prisma.moderationActivity.create({
    data: {
      caseId,
      actorId: actor.id,
      action: "INFORMATION_RESPONDED",
      metadata: {
        requestId,
        responseText,
        evidenceIds,
        respondedAt: new Date().toISOString(),
      },
    },
  });

  if (caseRecord.assignedModeratorId && caseRecord.assignedModeratorId !== actor.id) {
    await notificationService.create({
      userId: caseRecord.assignedModeratorId,
      type: NotificationType.SYSTEM,
      title: "Response submitted for moderation case",
      message: `${actor.name || "A participant"} provided information for ${caseRecord.caseReference}.`,
      entityId: caseId,
      entityType: `moderation-response-${requestId}`,
      link: `/admin/moderation/cases/${caseId}`,
      metadata: {
        moderationCaseId: caseId,
        caseReference: caseRecord.caseReference,
        requestId,
        recipientRole: "ADMIN",
      },
    }).catch((err) => console.warn("[moderation.service] Failed to notify moderator:", err));
  }

  await notificationService.create({
    userId: actor.id,
    type: NotificationType.SYSTEM,
    title: "Information submitted",
    message: `Your response for ${caseRecord.caseReference} was submitted successfully.`,
    entityId: caseId,
    entityType: `moderation-response-receipt-${requestId}`,
    link: moderationParticipantLink(caseId, { requestId }),
    metadata: { moderationCaseId: caseId, caseReference: caseRecord.caseReference, requestId },
  }).catch((err) => console.warn("[moderation.service] Failed to create response receipt:", err));

  return { success: true, requestId, status: "RESPONDED" };
}

export async function updateInformationRequestStatus(
  actor: AuthUser,
  caseId: string,
  requestId: string,
  status: "REVIEWED" | "CLOSED",
) {
  if (!canModerate(actor, PERMISSIONS.MODERATION_CASE_UPDATE)) {
    throw AppError.forbidden("Missing permission to update information requests.");
  }
  await assertModerationSchemaReady();

  const rfis = await listInformationRequests(actor, caseId);
  const rfi = rfis.find((r) => r.id === requestId);
  if (!rfi) throw AppError.notFound("Information request not found.");

  const action = status === "REVIEWED" ? "INFORMATION_REQUEST_REVIEWED" : "INFORMATION_REQUEST_CLOSED";
  await prisma.moderationActivity.create({
    data: {
      caseId,
      actorId: actor.id,
      action,
      metadata: {
        requestId,
        status,
        updatedAt: new Date().toISOString(),
      },
    },
  });

  return { success: true, requestId, status };
}

export type ModerationAppealStatus = "SUBMITTED" | "UNDER_REVIEW" | "DECIDED" | "WITHDRAWN" | "CLOSED";
export type ModerationAppealDecision = "PENDING" | "APPROVED" | "REJECTED" | "PARTIALLY_APPROVED";

export type ModerationAppeal = {
  id: string;
  caseId: string;
  caseReference: string;
  targetType: ModerationTargetType;
  targetId: string;
  appellantId: string;
  appellantRole: Role;
  appellantName?: string | null;
  appellantEmail?: string | null;
  status: ModerationAppealStatus;
  decision: ModerationAppealDecision;
  reason: string;
  explanation: string;
  evidenceIds: string[];
  policyCode?: string | null;
  policyName?: string | null;
  policyVersion?: string | null;
  assignedReviewerId?: string | null;
  assignedReviewerName?: string | null;
  reviewNotes?: string | null;
  decisionReason?: string | null;
  reinstatementExecuted?: boolean;
  reinstatementError?: string | null;
  reopenCaseExecuted?: boolean;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string | null;
  deadlineAt?: string | null;
};

export type ModerationAppealListQuery = {
  page?: number;
  limit?: number;
  status?: ModerationAppealStatus;
  decision?: ModerationAppealDecision;
  assignedReviewerId?: string;
  search?: string;
  sort?: "newest" | "oldest" | "deadline";
};

export type SubmitModerationAppealInput = {
  reason: string;
  explanation: string;
  evidenceIds?: string[];
};

export type RecordAppealDecisionInput = {
  decision: "APPROVED" | "REJECTED" | "PARTIALLY_APPROVED";
  decisionReason: string;
  reviewNotes?: string;
  reinstateContent?: boolean;
  reopenCase?: boolean;
};

export async function checkAppealEligibility(actor: AuthUser, caseId: string) {
  await assertModerationSchemaReady();
  const caseRecord = await prisma.moderationCase.findUnique({
    where: { id: caseId },
    select: {
      id: true,
      caseReference: true,
      targetType: true,
      targetId: true,
      status: true,
      resolutionCategory: true,
      resolutionNotes: true,
      updatedAt: true,
      createdAt: true,
    },
  });
  if (!caseRecord) throw AppError.notFound("Moderation case not found.");

  const hadDecision =
    caseRecord.status === "RESOLVED" ||
    caseRecord.status === "DISMISSED" ||
    caseRecord.resolutionCategory !== null;

  if (!hadDecision) {
    const decisionActivity = await prisma.moderationActivity.findFirst({
      where: {
        caseId,
        action: { in: ["DECISION_RECORDED", "CONTENT_MODERATED"] },
      },
    });
    if (!decisionActivity) {
      return {
        eligible: false,
        reason: "No moderation decision has been made on this case yet.",
        targetType: caseRecord.targetType,
        targetId: caseRecord.targetId,
        caseReference: caseRecord.caseReference,
      };
    }
  }

  const isModerator = canModerate(actor, PERMISSIONS.MODERATION_CASE_READ);
  let affectedUserId: string | null = null;
  let targetTitle: string | undefined;

  if (caseRecord.targetType === "LISTING") {
    const listing = await prisma.listing.findUnique({
      where: { id: caseRecord.targetId },
      select: { hostId: true, title: true },
    });
    affectedUserId = listing?.hostId || null;
    targetTitle = listing?.title;
  } else if (caseRecord.targetType === "LISTING_PHOTO") {
    const listing = await prisma.listing.findFirst({
      where: { photos: { has: caseRecord.targetId } },
      select: { hostId: true, title: true },
    });
    if (listing) {
      affectedUserId = listing.hostId;
      targetTitle = listing.title;
    } else {
      const pastActivity = await prisma.moderationActivity.findFirst({
        where: { caseId, after: { not: Prisma.DbNull } },
        orderBy: { createdAt: "desc" },
        select: { after: true },
      });
      const listingId = (pastActivity?.after as any)?.listingId;
      if (listingId) {
        const pastListing = await prisma.listing.findUnique({
          where: { id: listingId },
          select: { hostId: true, title: true },
        });
        affectedUserId = pastListing?.hostId || null;
        targetTitle = pastListing?.title;
      }
    }
  } else if (caseRecord.targetType === "REVIEW") {
    const review = await prisma.review.findUnique({
      where: { id: caseRecord.targetId },
      select: { authorId: true, listing: { select: { hostId: true } } },
    });
    if (review) {
      if (actor.id === review.authorId) {
        affectedUserId = review.authorId;
      } else if (actor.id === review.listing?.hostId) {
        affectedUserId = review.listing.hostId;
      } else {
        affectedUserId = review.authorId;
      }
    }
  } else if (caseRecord.targetType === "PROFILE" || caseRecord.targetType === "USER") {
    affectedUserId = caseRecord.targetId;
  }

  if (!isModerator && affectedUserId && actor.id !== affectedUserId) {
    const participantInfo = await getCaseParticipants(caseId);
    if (!participantInfo?.isParticipant(actor.id)) {
      return {
        eligible: false,
        reason: "Only the affected content owner or case participant can appeal this moderation decision.",
        targetType: caseRecord.targetType,
        targetId: caseRecord.targetId,
        caseReference: caseRecord.caseReference,
      };
    }
  }

  let policyCode = caseRecord.resolutionCategory || undefined;
  if (!policyCode) {
    const latestReport = await prisma.moderationReport.findFirst({
      where: { caseId },
      orderBy: { createdAt: "desc" },
      select: { reasonCode: true },
    });
    policyCode = latestReport?.reasonCode || undefined;
  }

  if (policyCode && !isPolicyAppealable(policyCode)) {
    return {
      eligible: false,
      reason: "This policy enforcement is not eligible for appeal under community trust guidelines.",
      policyCode,
      targetType: caseRecord.targetType,
      targetId: caseRecord.targetId,
      caseReference: caseRecord.caseReference,
    };
  }

  const decisionDate = caseRecord.updatedAt || caseRecord.createdAt;
  const deadlineDays = getAppealDeadlineDays(policyCode);
  const deadlineMs = deadlineDays * 24 * 60 * 60 * 1000;
  const deadlineDate = new Date(decisionDate.getTime() + deadlineMs);
  const isExpired = Date.now() > deadlineDate.getTime();

  if (isExpired && !isModerator) {
    return {
      eligible: false,
      reason: `The appeal submission window of ${deadlineDays} days has expired.`,
      deadlineAt: deadlineDate.toISOString(),
      policyCode,
      targetType: caseRecord.targetType,
      targetId: caseRecord.targetId,
      caseReference: caseRecord.caseReference,
    };
  }

  const appeals = await listCaseAppeals(actor, caseId);
  const activeAppeal = appeals.find((a) => a.status === "SUBMITTED" || a.status === "UNDER_REVIEW");
  if (activeAppeal) {
    return {
      eligible: false,
      reason: "An appeal is already active and currently being processed for this case.",
      activeAppealId: activeAppeal.id,
      deadlineAt: deadlineDate.toISOString(),
      policyCode,
      targetType: caseRecord.targetType,
      targetId: caseRecord.targetId,
      caseReference: caseRecord.caseReference,
    };
  }

  const decidedCount = appeals.filter((a) => a.status === "DECIDED").length;
  if (decidedCount >= 2 && !isModerator) {
    return {
      eligible: false,
      reason: "The maximum limit of 2 appeals has been reached for this case.",
      deadlineAt: deadlineDate.toISOString(),
      policyCode,
      targetType: caseRecord.targetType,
      targetId: caseRecord.targetId,
      caseReference: caseRecord.caseReference,
    };
  }

  const policy = policyCode ? getModerationPolicy(policyCode, caseRecord.targetType) : null;

  return {
    eligible: true,
    deadlineAt: deadlineDate.toISOString(),
    policyCode,
    policyName: policy?.name || policyCode,
    targetType: caseRecord.targetType,
    targetId: caseRecord.targetId,
    targetTitle,
    caseReference: caseRecord.caseReference,
  };
}

export async function submitModerationAppeal(
  actor: AuthUser,
  caseId: string,
  input: SubmitModerationAppealInput,
) {
  await assertModerationSchemaReady();
  const eligibility = await checkAppealEligibility(actor, caseId);
  if (!eligibility.eligible) {
    throw AppError.badRequest(eligibility.reason || "Case is not eligible for appeal.");
  }

  const reason = input.reason?.trim();
  if (!reason) throw AppError.badRequest("Appeal reason category is required.");

  const explanation = input.explanation?.trim();
  if (!explanation || explanation.length < 10) {
    throw AppError.badRequest("Please provide an explanation of at least 10 characters.");
  }
  if (explanation.length > 2500) {
    throw AppError.badRequest("Explanation cannot exceed 2500 characters.");
  }

  const evidenceIds = Array.isArray(input.evidenceIds) ? input.evidenceIds : [];
  if (evidenceIds.length > 0) {
    const verifiedEvidence = await prisma.moderationEvidence.findMany({
      where: {
        id: { in: evidenceIds },
        caseId,
      },
      select: { id: true },
    });
    if (verifiedEvidence.length !== evidenceIds.length) {
      throw AppError.badRequest("One or more attached evidence files are invalid for this case.");
    }
  }

  const appealId = `app_${nanoid(12)}`;
  const submittedAt = new Date().toISOString();

  await prisma.moderationActivity.create({
    data: {
      caseId,
      actorId: actor.id,
      action: "APPEAL_SUBMITTED",
      metadata: {
        appealId,
        caseId,
        caseReference: eligibility.caseReference,
        targetType: eligibility.targetType,
        targetId: eligibility.targetId,
        appellantId: actor.id,
        appellantRole: actor.role,
        appellantName: actor.name,
        appellantEmail: actor.email,
        reason,
        explanation,
        evidenceIds,
        policyCode: eligibility.policyCode,
        policyName: eligibility.policyName,
        policyVersion: MODERATION_POLICY_VERSION,
        status: "SUBMITTED",
        decision: "PENDING",
        deadlineAt: eligibility.deadlineAt,
        submittedAt,
      },
    },
  });

  const caseRecord = await prisma.moderationCase.findUnique({
    where: { id: caseId },
    select: { assignedModeratorId: true, caseReference: true },
  });

  if (caseRecord?.assignedModeratorId && caseRecord.assignedModeratorId !== actor.id) {
    await notificationService.create({
      userId: caseRecord.assignedModeratorId,
      type: NotificationType.SYSTEM,
      title: "New Moderation Appeal Submitted",
      message: `${actor.name || "A participant"} submitted an appeal for ${caseRecord.caseReference}.`,
      entityId: appealId,
      entityType: "moderation-appeal",
      link: `/admin/moderation/appeals`,
      metadata: {
        appealId,
        caseId,
        caseReference: caseRecord.caseReference,
        recipientRole: "ADMIN",
      },
    }).catch((err) => console.warn("[moderation.service] Failed to notify assigned moderator:", err));
  }

  await notificationService.create({
    userId: actor.id,
    type: NotificationType.SYSTEM,
    title: "Moderation appeal submitted",
    message: `Your appeal for case ${eligibility.caseReference} was submitted successfully.`,
    entityId: appealId,
    entityType: "moderation-appeal-submitted",
    link: moderationParticipantLink(caseId, { appealId }),
    metadata: { appealId, caseId, caseReference: eligibility.caseReference },
  }).catch((err) => console.warn("[moderation.service] Failed to create appeal receipt:", err));

  return {
    id: appealId,
    caseId,
    caseReference: eligibility.caseReference,
    targetType: eligibility.targetType,
    targetId: eligibility.targetId,
    appellantId: actor.id,
    appellantRole: actor.role,
    status: "SUBMITTED" as ModerationAppealStatus,
    decision: "PENDING" as ModerationAppealDecision,
    reason,
    explanation,
    evidenceIds,
    policyCode: eligibility.policyCode,
    policyName: eligibility.policyName,
    policyVersion: MODERATION_POLICY_VERSION,
    deadlineAt: eligibility.deadlineAt,
    createdAt: submittedAt,
    updatedAt: submittedAt,
  };
}

export async function listCaseAppeals(actor: AuthUser, caseId: string): Promise<ModerationAppeal[]> {
  await assertModerationSchemaReady();
  const caseRecord = await prisma.moderationCase.findUnique({
    where: { id: caseId },
    select: { id: true, caseReference: true, targetType: true, targetId: true },
  });
  if (!caseRecord) throw AppError.notFound("Moderation case not found.");

  const isModerator = canModerate(actor, PERMISSIONS.MODERATION_CASE_READ);
  if (!isModerator) {
    const participantInfo = await getCaseParticipants(caseId);
    if (!participantInfo?.isParticipant(actor.id)) {
      throw AppError.forbidden("You are not authorized to view appeals for this case.");
    }
  }

  const activities = await prisma.moderationActivity.findMany({
    where: {
      caseId,
      action: {
        in: [
          "APPEAL_SUBMITTED",
          "APPEAL_ASSIGNED",
          "APPEAL_STATUS_CHANGED",
          "APPEAL_DECISION_RECORDED",
          "APPEAL_WITHDRAWN",
          "APPEAL_CLOSED",
        ],
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const appealMap = new Map<string, ModerationAppeal>();

  for (const act of activities) {
    const meta = (act.metadata as Record<string, any>) || {};
    const appealId = meta.appealId as string;
    if (!appealId) continue;

    if (act.action === "APPEAL_SUBMITTED") {
      appealMap.set(appealId, {
        id: appealId,
        caseId: act.caseId,
        caseReference: meta.caseReference || caseRecord.caseReference,
        targetType: meta.targetType || caseRecord.targetType,
        targetId: meta.targetId || caseRecord.targetId,
        appellantId: meta.appellantId || act.actorId || "",
        appellantRole: meta.appellantRole || Role.USER,
        appellantName: meta.appellantName || null,
        appellantEmail: meta.appellantEmail || null,
        status: (meta.status as ModerationAppealStatus) || "SUBMITTED",
        decision: (meta.decision as ModerationAppealDecision) || "PENDING",
        reason: meta.reason || "",
        explanation: meta.explanation || "",
        evidenceIds: meta.evidenceIds || [],
        policyCode: meta.policyCode || null,
        policyName: meta.policyName || null,
        policyVersion: meta.policyVersion || null,
        assignedReviewerId: null,
        assignedReviewerName: null,
        reviewNotes: null,
        decisionReason: null,
        reinstatementExecuted: false,
        reopenCaseExecuted: false,
        createdAt: act.createdAt.toISOString(),
        updatedAt: act.createdAt.toISOString(),
        decidedAt: null,
        deadlineAt: meta.deadlineAt || null,
      });
    } else {
      const appeal = appealMap.get(appealId);
      if (!appeal) continue;

      appeal.updatedAt = act.createdAt.toISOString();

      if (act.action === "APPEAL_ASSIGNED") {
        appeal.assignedReviewerId = meta.reviewerId || null;
        appeal.assignedReviewerName = meta.reviewerName || null;
        if (appeal.status === "SUBMITTED") {
          appeal.status = "UNDER_REVIEW";
        }
      } else if (act.action === "APPEAL_STATUS_CHANGED") {
        if (meta.status) appeal.status = meta.status as ModerationAppealStatus;
      } else if (act.action === "APPEAL_DECISION_RECORDED") {
        appeal.status = "DECIDED";
        appeal.decision = (meta.decision as ModerationAppealDecision) || "PENDING";
        appeal.decisionReason = meta.decisionReason || null;
        appeal.reviewNotes = meta.reviewNotes || null;
        appeal.reinstatementExecuted = !!meta.reinstatementExecuted;
        appeal.reinstatementError = meta.reinstatementError || null;
        appeal.reopenCaseExecuted = !!meta.reopenCaseExecuted;
        appeal.decidedAt = meta.decidedAt || act.createdAt.toISOString();
      } else if (act.action === "APPEAL_WITHDRAWN") {
        appeal.status = "WITHDRAWN";
      } else if (act.action === "APPEAL_CLOSED") {
        appeal.status = "CLOSED";
      }
    }
  }

  const allAppeals = Array.from(appealMap.values());
  if (!isModerator) {
    return allAppeals
      .filter((a) => a.appellantId === actor.id)
      .map((a) => ({ ...a, reviewNotes: null }));
  }

  return allAppeals;
}

export async function getModerationAppeal(actor: AuthUser, appealId: string) {
  await assertModerationSchemaReady();

  const initialActivity = await prisma.moderationActivity.findFirst({
    where: {
      action: "APPEAL_SUBMITTED",
      metadata: { path: ["appealId"], equals: appealId },
    },
    include: {
      case: {
        select: {
          id: true,
          caseReference: true,
          targetType: true,
          targetId: true,
          status: true,
          severity: true,
          priority: true,
          resolutionCategory: true,
          resolutionNotes: true,
          assignedModeratorId: true,
          assignedModerator: { select: { id: true, name: true, email: true } },
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!initialActivity) throw AppError.notFound("Moderation appeal not found.");

  const appeals = await listCaseAppeals(actor, initialActivity.caseId);
  const appeal = appeals.find((a) => a.id === appealId);
  if (!appeal) throw AppError.notFound("Moderation appeal not found or unauthorized.");

  const isModerator = canModerate(actor, PERMISSIONS.MODERATION_CASE_READ);

  let evidenceList: any[] = [];
  if (appeal.evidenceIds && appeal.evidenceIds.length > 0) {
    evidenceList = await prisma.moderationEvidence.findMany({
      where: { id: { in: appeal.evidenceIds } },
      select: {
        id: true,
        displayName: true,
        evidenceType: true,
        mimeType: true,
        fileSize: true,
        accessScope: true,
        createdAt: true,
      },
    });
  }

  const activities = await prisma.moderationActivity.findMany({
    where: {
      caseId: initialActivity.caseId,
      metadata: { path: ["appealId"], equals: appealId },
    },
    orderBy: { createdAt: "asc" },
    include: {
      actor: { select: { id: true, name: true, email: true, role: true } },
    },
  });

  return {
    appeal,
    case: isModerator
      ? initialActivity.case
      : { ...initialActivity.case, resolutionNotes: null },
    evidence: evidenceList,
    timeline: activities.map((act: any) => ({
      id: act.id,
      action: act.action,
      actor: isModerator || act.actor?.id === actor.id
        ? act.actor
        : { id: "staff", name: "Trust & Safety Specialist", email: null, role: "ADMIN" },
      metadata: act.metadata,
      createdAt: act.createdAt.toISOString(),
    })),
  };
}

export async function listModerationAppeals(
  actor: AuthUser,
  query: ModerationAppealListQuery = {},
) {
  assertModerator(actor, PERMISSIONS.MODERATION_CASE_READ);
  await assertModerationSchemaReady();

  const submittedActivities = await prisma.moderationActivity.findMany({
    where: { action: "APPEAL_SUBMITTED" },
    orderBy: { createdAt: "desc" },
    include: {
      case: {
        select: {
          id: true,
          caseReference: true,
          targetType: true,
          targetId: true,
          status: true,
        },
      },
    },
  });

  const appealIds = submittedActivities
    .map((act: any) => (act.metadata as any)?.appealId)
    .filter(Boolean) as string[];

  const subsequentActivities = appealIds.length > 0
    ? await prisma.moderationActivity.findMany({
        where: {
          action: {
            in: [
              "APPEAL_ASSIGNED",
              "APPEAL_STATUS_CHANGED",
              "APPEAL_DECISION_RECORDED",
              "APPEAL_WITHDRAWN",
              "APPEAL_CLOSED",
            ],
          },
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const appealMap = new Map<string, ModerationAppeal>();

  for (const act of submittedActivities) {
    const meta = (act.metadata as Record<string, any>) || {};
    const appealId = meta.appealId as string;
    if (!appealId) continue;

    appealMap.set(appealId, {
      id: appealId,
      caseId: act.caseId,
      caseReference: meta.caseReference || act.case?.caseReference || "CASE",
      targetType: meta.targetType || act.case?.targetType || "LISTING",
      targetId: meta.targetId || act.case?.targetId || "",
      appellantId: meta.appellantId || act.actorId || "",
      appellantRole: meta.appellantRole || Role.USER,
      appellantName: meta.appellantName || null,
      appellantEmail: meta.appellantEmail || null,
      status: (meta.status as ModerationAppealStatus) || "SUBMITTED",
      decision: (meta.decision as ModerationAppealDecision) || "PENDING",
      reason: meta.reason || "",
      explanation: meta.explanation || "",
      evidenceIds: meta.evidenceIds || [],
      policyCode: meta.policyCode || null,
      policyName: meta.policyName || null,
      policyVersion: meta.policyVersion || null,
      assignedReviewerId: null,
      assignedReviewerName: null,
      reviewNotes: null,
      decisionReason: null,
      reinstatementExecuted: false,
      reopenCaseExecuted: false,
      createdAt: act.createdAt.toISOString(),
      updatedAt: act.createdAt.toISOString(),
      decidedAt: null,
      deadlineAt: meta.deadlineAt || null,
    });
  }

  for (const act of subsequentActivities) {
    const meta = (act.metadata as Record<string, any>) || {};
    const appealId = meta.appealId as string;
    if (!appealId) continue;
    const appeal = appealMap.get(appealId);
    if (!appeal) continue;

    appeal.updatedAt = act.createdAt.toISOString();

    if (act.action === "APPEAL_ASSIGNED") {
      appeal.assignedReviewerId = meta.reviewerId || null;
      appeal.assignedReviewerName = meta.reviewerName || null;
      if (appeal.status === "SUBMITTED") {
        appeal.status = "UNDER_REVIEW";
      }
    } else if (act.action === "APPEAL_STATUS_CHANGED") {
      if (meta.status) appeal.status = meta.status as ModerationAppealStatus;
    } else if (act.action === "APPEAL_DECISION_RECORDED") {
      appeal.status = "DECIDED";
      appeal.decision = (meta.decision as ModerationAppealDecision) || "PENDING";
      appeal.decisionReason = meta.decisionReason || null;
      appeal.reviewNotes = meta.reviewNotes || null;
      appeal.reinstatementExecuted = !!meta.reinstatementExecuted;
      appeal.reinstatementError = meta.reinstatementError || null;
      appeal.reopenCaseExecuted = !!meta.reopenCaseExecuted;
      appeal.decidedAt = meta.decidedAt || act.createdAt.toISOString();
    } else if (act.action === "APPEAL_WITHDRAWN") {
      appeal.status = "WITHDRAWN";
    } else if (act.action === "APPEAL_CLOSED") {
      appeal.status = "CLOSED";
    }
  }

  let allAppeals = Array.from(appealMap.values());

  const summary = {
    total: allAppeals.length,
    submitted: allAppeals.filter((a) => a.status === "SUBMITTED").length,
    underReview: allAppeals.filter((a) => a.status === "UNDER_REVIEW").length,
    decided: allAppeals.filter((a) => a.status === "DECIDED").length,
    approved: allAppeals.filter((a) => a.decision === "APPROVED" || a.decision === "PARTIALLY_APPROVED").length,
    rejected: allAppeals.filter((a) => a.decision === "REJECTED").length,
  };

  if (query.status) {
    allAppeals = allAppeals.filter((a) => a.status === query.status);
  }
  if (query.decision) {
    allAppeals = allAppeals.filter((a) => a.decision === query.decision);
  }
  if (query.assignedReviewerId) {
    allAppeals = allAppeals.filter((a) => a.assignedReviewerId === query.assignedReviewerId);
  }
  if (query.search) {
    const q = query.search.toLowerCase();
    allAppeals = allAppeals.filter(
      (a) =>
        a.id.toLowerCase().includes(q) ||
        a.caseReference.toLowerCase().includes(q) ||
        (a.appellantName && a.appellantName.toLowerCase().includes(q)) ||
        (a.appellantEmail && a.appellantEmail.toLowerCase().includes(q)) ||
        a.reason.toLowerCase().includes(q) ||
        (a.policyName && a.policyName.toLowerCase().includes(q))
    );
  }

  if (query.sort === "oldest") {
    allAppeals.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else if (query.sort === "deadline") {
    allAppeals.sort((a, b) => {
      const da = a.deadlineAt ? new Date(a.deadlineAt).getTime() : Infinity;
      const db = b.deadlineAt ? new Date(b.deadlineAt).getTime() : Infinity;
      return da - db;
    });
  } else {
    allAppeals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  const { page, limit, skip } = toPagination(query.page, query.limit);
  const items = allAppeals.slice(skip, skip + limit);

  return {
    items,
    total: allAppeals.length,
    page,
    limit,
    totalPages: Math.ceil(allAppeals.length / limit) || 1,
    summary,
  };
}

export async function assignAppealReviewer(
  actor: AuthUser,
  appealId: string,
  reviewerId: string | null,
) {
  if (!hasPermission(actor, PERMISSIONS.MODERATION_CASE_ASSIGN)) {
    throw AppError.forbidden("Missing permission to assign appeal reviewers.");
  }
  await assertModerationSchemaReady();

  const appealActivity = await prisma.moderationActivity.findFirst({
    where: {
      action: "APPEAL_SUBMITTED",
      metadata: { path: ["appealId"], equals: appealId },
    },
    include: { case: { select: { id: true, caseReference: true } } },
  });
  if (!appealActivity) throw AppError.notFound("Moderation appeal not found.");

  let reviewerName: string | null = null;
  if (reviewerId) {
    await assertEligibleModeratorAssignee(reviewerId);
    const reviewer = await prisma.user.findUnique({
      where: { id: reviewerId },
      select: { name: true },
    });
    reviewerName = reviewer?.name || null;
  }

  await prisma.moderationActivity.create({
    data: {
      caseId: appealActivity.caseId,
      actorId: actor.id,
      action: "APPEAL_ASSIGNED",
      metadata: {
        appealId,
        reviewerId,
        reviewerName,
        assignedBy: actor.id,
        assignedAt: new Date().toISOString(),
      },
    },
  });

  if (reviewerId) {
    await notificationService.create({
      userId: reviewerId,
      type: NotificationType.SYSTEM,
      title: "Appeal Assigned to You",
      message: `You have been assigned to review an appeal for case ${appealActivity.case.caseReference}.`,
      entityId: appealId,
      entityType: "moderation-appeal",
      link: `/admin/moderation/appeals`,
      metadata: {
        appealId,
        caseId: appealActivity.caseId,
        caseReference: appealActivity.case.caseReference,
        recipientRole: "ADMIN",
      },
    }).catch((err) => console.warn("[moderation.service] Failed to notify reviewer:", err));
  }

  return { success: true, appealId, reviewerId, reviewerName };
}

export async function recordAppealDecision(
  actor: AuthUser,
  appealId: string,
  input: RecordAppealDecisionInput,
) {
  assertModerator(actor, PERMISSIONS.MODERATION_DECISION_CREATE);
  if (input.reinstateContent) {
    assertModerator(actor, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE);
  }
  await assertModerationSchemaReady();

  const appealActivity = await prisma.moderationActivity.findFirst({
    where: {
      action: "APPEAL_SUBMITTED",
      metadata: { path: ["appealId"], equals: appealId },
    },
    include: {
      case: {
        select: {
          id: true,
          caseReference: true,
          targetType: true,
          targetId: true,
          status: true,
          resolutionCategory: true,
        },
      },
    },
  });
  if (!appealActivity) throw AppError.notFound("Moderation appeal not found.");

  const appeals = await listCaseAppeals(actor, appealActivity.caseId);
  const appeal = appeals.find((a) => a.id === appealId);
  if (!appeal) throw AppError.notFound("Appeal not found.");

  if (appeal.status === "DECIDED") {
    throw AppError.badRequest("This appeal has already been decided.");
  }
  if (appeal.status === "WITHDRAWN" || appeal.status === "CLOSED") {
    throw AppError.badRequest(`Cannot decide an appeal that is ${appeal.status.toLowerCase()}.`);
  }

  const decisionReason = input.decisionReason?.trim();
  if (!decisionReason || decisionReason.length < 5) {
    throw AppError.badRequest("A decision explanation of at least 5 characters is required.");
  }

  const isApproved = input.decision === "APPROVED" || input.decision === "PARTIALLY_APPROVED";
  let reinstatementExecuted = false;
  let reinstatementError: string | null = null;

  if (isApproved && input.reinstateContent !== false) {
    try {
      const existing = appealActivity.case;
      if (existing.targetType === "REVIEW") {
        await reviewService.adminModerateReview({
          reviewId: existing.targetId,
          moderatorId: actor.id,
          action: "RESTORE",
          reason: decisionReason,
          notes: input.reviewNotes,
          caseId: existing.id,
        });
        reinstatementExecuted = true;
      } else if (existing.targetType === "LISTING") {
        await listingService.applyModerationAction({
          listingId: existing.targetId,
          action: "RESTORE",
          reason: decisionReason,
          notes: input.reviewNotes,
        });
        reinstatementExecuted = true;
      } else if (existing.targetType === "LISTING_PHOTO") {
        let mediaListing = await prisma.listing.findFirst({
          where: { photos: { has: existing.targetId } },
          select: { id: true },
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
              select: { id: true },
            });
          }
        }
        if (mediaListing) {
          await listingService.applyModerationAction({
            listingId: mediaListing.id,
            action: "RESTORE_PHOTO",
            photoUrl: existing.targetId,
            reason: decisionReason,
            notes: input.reviewNotes,
          });
          reinstatementExecuted = true;
        }
      } else if (existing.targetType === "PROFILE" || existing.targetType === "USER") {
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
          reinstatementExecuted = true;
        }
      }

      if (reinstatementExecuted) {
        await prisma.moderationActivity.create({
          data: {
            caseId: existing.id,
            actorId: actor.id,
            action: "CONTENT_REINSTATED",
            after: {
              targetType: existing.targetType,
              targetId: existing.targetId,
              appealId,
              restoredBy: actor.id,
              restoredAt: new Date().toISOString(),
            },
          },
        });
      }
    } catch (err: any) {
      reinstatementError = err.message || "Failed to reinstate content.";
      console.error("[moderation.service] Reinstatement failed:", err);
      await prisma.moderationActivity.create({
        data: {
          caseId: appealActivity.caseId,
          actorId: actor.id,
          action: "MODERATION_ENFORCEMENT_FAILED",
          metadata: {
            appealId,
            action: "RESTORE",
            error: reinstatementError,
            failedAt: new Date().toISOString(),
          },
        },
      });
    }
  }

  let reopenCaseExecuted = false;
  if (isApproved && input.reopenCase !== false) {
    if (appealActivity.case.status === "RESOLVED" || appealActivity.case.status === "DISMISSED") {
      await prisma.moderationCase.update({
        where: { id: appealActivity.caseId },
        data: { status: "REOPENED" },
      });
      await prisma.moderationActivity.create({
        data: {
          caseId: appealActivity.caseId,
          actorId: actor.id,
          action: "MODERATION_CASE_STATUS_CHANGED",
          before: { status: appealActivity.case.status },
          after: { status: "REOPENED", reason: "Reopened by approved appeal" },
        },
      });
      reopenCaseExecuted = true;
    }
  }

  const decidedAt = new Date().toISOString();
  await prisma.moderationActivity.create({
    data: {
      caseId: appealActivity.caseId,
      actorId: actor.id,
      action: "APPEAL_DECISION_RECORDED",
      metadata: {
        appealId,
        decision: input.decision,
        decisionReason,
        reviewNotes: input.reviewNotes || null,
        reinstatementExecuted,
        reinstatementError,
        reopenCaseExecuted,
        decidedBy: actor.id,
        decidedByName: actor.name,
        decidedAt,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "MODERATION_APPEAL_DECIDED",
      resourceType: "MODERATION_APPEAL",
      resourceId: appealId,
      description: `Moderation appeal ${appealId} decided as ${input.decision} for case ${appealActivity.case.caseReference}.`,
      metadata: {
        caseId: appealActivity.caseId,
        decision: input.decision,
        decisionReason,
        reinstatementExecuted,
      },
    },
  });

  if (appeal.appellantId) {
    const title =
      input.decision === "APPROVED"
        ? "Moderation Appeal Approved"
        : input.decision === "PARTIALLY_APPROVED"
        ? "Moderation Appeal Partially Approved"
        : "Moderation Appeal Not Upheld";

    await notificationService.create({
      userId: appeal.appellantId,
      type: NotificationType.SYSTEM,
      title,
      message: `Your appeal for case ${appealActivity.case.caseReference} was resolved: ${decisionReason}`,
      entityId: appealId,
      entityType: "moderation-appeal",
      link: moderationParticipantLink(appealActivity.caseId, { appealId }),
      metadata: {
        appealId,
        caseId: appealActivity.caseId,
        decision: input.decision,
      },
    }).catch((err) => console.warn("[moderation.service] Failed to notify appellant:", err));
  }

  return {
    success: true,
    appealId,
    decision: input.decision,
    decisionReason,
    reinstatementExecuted,
    reinstatementError,
    reopenCaseExecuted,
    decidedAt,
  };
}

export async function withdrawModerationAppeal(actor: AuthUser, appealId: string) {
  await assertModerationSchemaReady();

  const appealActivity = await prisma.moderationActivity.findFirst({
    where: {
      action: "APPEAL_SUBMITTED",
      metadata: { path: ["appealId"], equals: appealId },
    },
  });
  if (!appealActivity) throw AppError.notFound("Moderation appeal not found.");

  const appeals = await listCaseAppeals(actor, appealActivity.caseId);
  const appeal = appeals.find((a) => a.id === appealId);
  if (!appeal) throw AppError.notFound("Appeal not found.");

  const isModerator = canModerate(actor, PERMISSIONS.MODERATION_CASE_UPDATE);
  if (!isModerator && appeal.appellantId !== actor.id) {
    throw AppError.forbidden("You can only withdraw your own appeal.");
  }

  if (appeal.status === "DECIDED") {
    throw AppError.badRequest("Cannot withdraw an appeal that has already been decided.");
  }
  if (appeal.status === "WITHDRAWN") {
    throw AppError.badRequest("This appeal has already been withdrawn.");
  }

  await prisma.moderationActivity.create({
    data: {
      caseId: appealActivity.caseId,
      actorId: actor.id,
      action: "APPEAL_WITHDRAWN",
      metadata: {
        appealId,
        withdrawnBy: actor.id,
        withdrawnAt: new Date().toISOString(),
      },
    },
  });

  return { success: true, appealId, status: "WITHDRAWN" };
}

export async function listModerationPolicies(filters?: {
  targetType?: ModerationTargetType;
  category?: ModerationPolicyCategory;
  appealable?: boolean;
}) {
  return {
    version: MODERATION_POLICY_VERSION,
    categories: MODERATION_POLICY_CATEGORIES,
    policies: listAllModerationPolicies(filters),
  };
}

/* ========================================================================= */
/* PHASE 6: ADVANCED ENFORCEMENT & ACCOUNT/MESSAGE MODERATION                */
/* ========================================================================= */

export type AccountRestrictionType =
  | "RESTRICT_MESSAGING"
  | "RESTRICT_BOOKING"
  | "RESTRICT_LISTING_CREATION"
  | "RESTRICT_REVIEWS";

export type UserAccountWarning = {
  id: string;
  caseId: string;
  reason: string;
  policyCode?: string | null;
  issuedBy: string;
  issuedByName?: string | null;
  issuedAt: string;
  status: "ACTIVE" | "REVOKED";
  revokedAt?: string | null;
  revokedBy?: string | null;
  revocationReason?: string | null;
};

export type UserAccountRestriction = {
  id: string;
  caseId: string;
  type: AccountRestrictionType;
  reason: string;
  policyCode?: string | null;
  appliedBy: string;
  appliedByName?: string | null;
  appliedAt: string;
  expiresAt: string | null;
  durationHours?: number | null;
  status: "ACTIVE" | "LIFTED" | "EXPIRED";
  liftedAt?: string | null;
  liftedBy?: string | null;
  liftReason?: string | null;
};

export type UserAccountSuspension = {
  id: string;
  caseId: string;
  reason: string;
  policyCode?: string | null;
  suspendedBy: string;
  suspendedByName?: string | null;
  suspendedAt: string;
  status: "ACTIVE" | "REINSTATED";
  reinstatedAt?: string | null;
  reinstatedBy?: string | null;
  reinstatementReason?: string | null;
  bookingImpactAcknowledged?: boolean;
};

export async function assertUserNotRestricted(userId: string, action: AccountRestrictionType): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true, personalInfo: true },
  });
  if (!user) return;

  if (user.status === "SUSPENDED") {
    throw AppError.forbidden("Your account is currently suspended by Trust & Safety.");
  }

  const info = (user.personalInfo as Record<string, any>) || {};
  const restrictions: UserAccountRestriction[] = Array.isArray(info.moderationRestrictions)
    ? info.moderationRestrictions
    : [];

  const now = new Date();
  const activeRestriction = restrictions.find((r) => {
    if (r.type !== action || r.status !== "ACTIVE") return false;
    if (r.expiresAt && new Date(r.expiresAt) <= now) return false;
    return true;
  });

  if (activeRestriction) {
    const actionLabel = action.replace("RESTRICT_", "").toLowerCase().replace(/_/g, " ");
    const expiryText = activeRestriction.expiresAt
      ? ` until ${new Date(activeRestriction.expiresAt).toLocaleDateString()}`
      : "";
    throw AppError.forbidden(
      `Your account is temporarily restricted from ${actionLabel}${expiryText}. Reason: ${activeRestriction.reason}`
    );
  }
}

export async function getUserEnforcementStatus(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, status: true, personalInfo: true },
  });
  if (!user) throw AppError.notFound("User not found.");

  const info = (user.personalInfo as Record<string, any>) || {};
  const rawWarnings: UserAccountWarning[] = Array.isArray(info.moderationWarnings) ? info.moderationWarnings : [];
  const rawRestrictions: UserAccountRestriction[] = Array.isArray(info.moderationRestrictions) ? info.moderationRestrictions : [];
  const rawSuspension: UserAccountSuspension | null = info.moderationSuspension || null;

  const now = new Date();
  const restrictions = rawRestrictions.map((r) => {
    if (r.status === "ACTIVE" && r.expiresAt && new Date(r.expiresAt) <= now) {
      return { ...r, status: "EXPIRED" as const };
    }
    return r;
  });

  const activeWarnings = rawWarnings.filter((w) => w.status === "ACTIVE");
  const activeRestrictions = restrictions.filter((r) => r.status === "ACTIVE");

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    isSuspended: user.status === "SUSPENDED",
    activeWarnings,
    activeRestrictions,
    allWarnings: rawWarnings,
    allRestrictions: restrictions,
    suspension: rawSuspension,
  };
}

export async function issueAccountWarning(
  actor: AuthUser,
  input: {
    caseId: string;
    targetUserId: string;
    reason: string;
    policyCode?: string;
  }
) {
  assertModerator(actor, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE);
  await assertModerationSchemaReady();

  const reason = input.reason?.trim();
  if (!reason || reason.length < 5) {
    throw AppError.badRequest("Warning reason must be at least 5 characters.");
  }

  const caseRecord = await prisma.moderationCase.findUnique({
    where: { id: input.caseId },
    select: { id: true, caseReference: true },
  });
  if (!caseRecord) throw AppError.notFound("Moderation case not found.");

  const targetUser = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true, name: true, email: true, role: true, status: true, personalInfo: true },
  });
  if (!targetUser) throw AppError.notFound("Target user not found.");
  if (targetUser.role === Role.ADMIN) throw AppError.badRequest("Cannot issue enforcement warning to an administrator.");

  const info = (targetUser.personalInfo as Record<string, any>) || {};
  const currentWarnings: UserAccountWarning[] = Array.isArray(info.moderationWarnings) ? info.moderationWarnings : [];

  const warningId = `warn_${nanoid(10)}`;
  const now = new Date().toISOString();
  const newWarning: UserAccountWarning = {
    id: warningId,
    caseId: input.caseId,
    reason,
    policyCode: input.policyCode || null,
    issuedBy: actor.id,
    issuedByName: actor.name,
    issuedAt: now,
    status: "ACTIVE",
  };

  const updatedWarnings = [newWarning, ...currentWarnings];
  await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      personalInfo: {
        ...info,
        moderationWarnings: updatedWarnings,
      },
    },
  });

  await prisma.moderationActivity.create({
    data: {
      caseId: input.caseId,
      actorId: actor.id,
      action: "ACCOUNT_WARNED",
      metadata: {
        warningId,
        targetUserId: targetUser.id,
        targetUserName: targetUser.name,
        targetUserEmail: targetUser.email,
        reason,
        policyCode: input.policyCode || null,
        issuedAt: now,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "ACCOUNT_WARNED",
      resourceType: "USER",
      resourceId: targetUser.id,
      description: `Warning issued to user ${targetUser.email} (${targetUser.id}) for case ${caseRecord.caseReference}: ${reason}`,
      metadata: { caseId: input.caseId, warningId, reason },
    },
  });

  await notificationService.create({
    userId: targetUser.id,
    type: NotificationType.SYSTEM,
    title: "Account Warning Issued",
    message: `You have received a formal account warning regarding ${caseRecord.caseReference}: "${reason}"`,
    entityId: input.caseId,
    entityType: "moderation-warning",
    link: `/profile/reports`,
    metadata: {
      caseId: input.caseId,
      warningId,
      caseReference: caseRecord.caseReference,
    },
  }).catch((err) => console.warn("[moderation.service] Failed to notify warned user:", err));

  return { success: true, warning: newWarning };
}

export async function revokeAccountWarning(
  actor: AuthUser,
  input: {
    caseId: string;
    targetUserId: string;
    warningId: string;
    reason: string;
  }
) {
  assertModerator(actor, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE);
  await assertModerationSchemaReady();

  const reason = input.reason?.trim();
  if (!reason || reason.length < 5) {
    throw AppError.badRequest("Revocation reason must be at least 5 characters.");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true, personalInfo: true },
  });
  if (!targetUser) throw AppError.notFound("Target user not found.");

  const info = (targetUser.personalInfo as Record<string, any>) || {};
  const currentWarnings: UserAccountWarning[] = Array.isArray(info.moderationWarnings) ? info.moderationWarnings : [];
  const warning = currentWarnings.find((w) => w.id === input.warningId);
  if (!warning) throw AppError.notFound("Warning record not found.");
  if (warning.status === "REVOKED") throw AppError.badRequest("Warning has already been revoked.");

  warning.status = "REVOKED";
  warning.revokedAt = new Date().toISOString();
  warning.revokedBy = actor.id;
  warning.revocationReason = reason;

  await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      personalInfo: {
        ...info,
        moderationWarnings: currentWarnings,
      },
    },
  });

  await prisma.moderationActivity.create({
    data: {
      caseId: input.caseId,
      actorId: actor.id,
      action: "WARNING_REVOKED",
      metadata: {
        warningId: input.warningId,
        targetUserId: targetUser.id,
        reason,
        revokedAt: warning.revokedAt,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "WARNING_REVOKED",
      resourceType: "USER",
      resourceId: targetUser.id,
      description: `Warning ${input.warningId} revoked for user ${targetUser.id}: ${reason}`,
      metadata: { caseId: input.caseId, warningId: input.warningId, reason },
    },
  });

  return { success: true, warningId: input.warningId };
}

export async function applyAccountRestriction(
  actor: AuthUser,
  input: {
    caseId: string;
    targetUserId: string;
    type: AccountRestrictionType;
    durationHours?: number | null;
    reason: string;
    policyCode?: string;
  }
) {
  assertModerator(actor, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE);
  await assertModerationSchemaReady();

  const validTypes: AccountRestrictionType[] = [
    "RESTRICT_MESSAGING",
    "RESTRICT_BOOKING",
    "RESTRICT_LISTING_CREATION",
    "RESTRICT_REVIEWS",
  ];
  if (!validTypes.includes(input.type)) {
    throw AppError.badRequest("Invalid account restriction type.");
  }

  const reason = input.reason?.trim();
  if (!reason || reason.length < 5) {
    throw AppError.badRequest("Restriction reason must be at least 5 characters.");
  }

  const caseRecord = await prisma.moderationCase.findUnique({
    where: { id: input.caseId },
    select: { id: true, caseReference: true },
  });
  if (!caseRecord) throw AppError.notFound("Moderation case not found.");

  const targetUser = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true, name: true, email: true, role: true, status: true, personalInfo: true },
  });
  if (!targetUser) throw AppError.notFound("Target user not found.");
  if (targetUser.role === Role.ADMIN) throw AppError.badRequest("Cannot apply restrictions to an administrator.");

  const info = (targetUser.personalInfo as Record<string, any>) || {};
  const currentRestrictions: UserAccountRestriction[] = Array.isArray(info.moderationRestrictions)
    ? info.moderationRestrictions
    : [];

  const restrictionId = `rst_${nanoid(10)}`;
  const now = new Date();
  let expiresAt: string | null = null;
  if (typeof input.durationHours === "number" && input.durationHours > 0) {
    expiresAt = new Date(now.getTime() + input.durationHours * 3600 * 1000).toISOString();
  }

  const newRestriction: UserAccountRestriction = {
    id: restrictionId,
    caseId: input.caseId,
    type: input.type,
    reason,
    policyCode: input.policyCode || null,
    appliedBy: actor.id,
    appliedByName: actor.name,
    appliedAt: now.toISOString(),
    expiresAt,
    durationHours: input.durationHours ?? null,
    status: "ACTIVE",
  };

  const updatedRestrictions = [newRestriction, ...currentRestrictions];
  await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      personalInfo: {
        ...info,
        moderationRestrictions: updatedRestrictions,
      },
    },
  });

  await invalidateUserCache(targetUser.id);

  await prisma.moderationActivity.create({
    data: {
      caseId: input.caseId,
      actorId: actor.id,
      action: "ACCOUNT_RESTRICTED",
      metadata: {
        restrictionId,
        targetUserId: targetUser.id,
        targetUserName: targetUser.name,
        targetUserEmail: targetUser.email,
        type: input.type,
        durationHours: input.durationHours ?? null,
        expiresAt,
        reason,
        policyCode: input.policyCode || null,
        appliedAt: newRestriction.appliedAt,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "ACCOUNT_RESTRICTED",
      resourceType: "USER",
      resourceId: targetUser.id,
      description: `Restriction ${input.type} applied to user ${targetUser.email} (${targetUser.id}) for case ${caseRecord.caseReference}: ${reason}`,
      metadata: { caseId: input.caseId, restrictionId, type: input.type, expiresAt },
    },
  });

  const actionName = input.type.replace("RESTRICT_", "").toLowerCase().replace(/_/g, " ");
  const durationText = expiresAt ? ` until ${new Date(expiresAt).toLocaleDateString()}` : "";
  await notificationService.create({
    userId: targetUser.id,
    type: NotificationType.SYSTEM,
    title: "Account Restriction Applied",
    message: `Your account has been temporarily restricted from ${actionName}${durationText}: "${reason}"`,
    entityId: input.caseId,
    entityType: "moderation-restriction",
    link: `/profile/reports`,
    metadata: {
      caseId: input.caseId,
      restrictionId,
      type: input.type,
      caseReference: caseRecord.caseReference,
    },
  }).catch((err) => console.warn("[moderation.service] Failed to notify restricted user:", err));

  return { success: true, restriction: newRestriction };
}

export async function liftAccountRestriction(
  actor: AuthUser,
  input: {
    caseId: string;
    targetUserId: string;
    restrictionId: string;
    reason: string;
  }
) {
  assertModerator(actor, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE);
  await assertModerationSchemaReady();

  const reason = input.reason?.trim();
  if (!reason || reason.length < 5) {
    throw AppError.badRequest("Lift reason must be at least 5 characters.");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true, email: true, personalInfo: true },
  });
  if (!targetUser) throw AppError.notFound("Target user not found.");

  const info = (targetUser.personalInfo as Record<string, any>) || {};
  const currentRestrictions: UserAccountRestriction[] = Array.isArray(info.moderationRestrictions)
    ? info.moderationRestrictions
    : [];
  const restriction = currentRestrictions.find((r) => r.id === input.restrictionId);
  if (!restriction) throw AppError.notFound("Restriction record not found.");
  if (restriction.status === "LIFTED") throw AppError.badRequest("Restriction has already been lifted.");

  restriction.status = "LIFTED";
  restriction.liftedAt = new Date().toISOString();
  restriction.liftedBy = actor.id;
  restriction.liftReason = reason;

  await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      personalInfo: {
        ...info,
        moderationRestrictions: currentRestrictions,
      },
    },
  });

  await invalidateUserCache(targetUser.id);

  await prisma.moderationActivity.create({
    data: {
      caseId: input.caseId,
      actorId: actor.id,
      action: "ACCOUNT_RESTRICTION_LIFTED",
      metadata: {
        restrictionId: input.restrictionId,
        targetUserId: targetUser.id,
        type: restriction.type,
        reason,
        liftedAt: restriction.liftedAt,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "ACCOUNT_RESTRICTION_LIFTED",
      resourceType: "USER",
      resourceId: targetUser.id,
      description: `Restriction ${restriction.type} lifted for user ${targetUser.email} (${targetUser.id}): ${reason}`,
      metadata: { caseId: input.caseId, restrictionId: input.restrictionId, reason },
    },
  });

  const actionName = restriction.type.replace("RESTRICT_", "").toLowerCase().replace(/_/g, " ");
  await notificationService.create({
    userId: targetUser.id,
    type: NotificationType.SYSTEM,
    title: "Account Restriction Lifted",
    message: `Your account restriction on ${actionName} has been lifted by Trust & Safety.`,
    entityId: input.caseId,
    entityType: "moderation-restriction-lifted",
    link: `/profile/reports`,
    metadata: {
      caseId: input.caseId,
      restrictionId: input.restrictionId,
      type: restriction.type,
    },
  }).catch((err) => console.warn("[moderation.service] Failed to notify user of lifted restriction:", err));

  return { success: true, restrictionId: input.restrictionId };
}

export async function expirePendingAccountRestrictions(actor?: AuthUser) {
  const now = new Date();
  const users = await prisma.user.findMany({
    where: {
      personalInfo: {
        not: Prisma.JsonNull,
      },
    },
    select: { id: true, name: true, email: true, personalInfo: true },
  });

  let expiredCount = 0;
  const affectedUserIds: string[] = [];

  for (const user of users) {
    const info = (user.personalInfo as Record<string, any>) || {};
    const restrictions: UserAccountRestriction[] = Array.isArray(info.moderationRestrictions)
      ? info.moderationRestrictions
      : [];

    let userChanged = false;
    for (const restriction of restrictions) {
      if (
        restriction.status === "ACTIVE" &&
        restriction.expiresAt &&
        new Date(restriction.expiresAt) <= now
      ) {
        restriction.status = "EXPIRED";
        expiredCount++;
        userChanged = true;

        await prisma.moderationActivity.create({
          data: {
            caseId: restriction.caseId,
            actorId: actor?.id || null,
            action: "ACCOUNT_RESTRICTION_EXPIRED",
            metadata: {
              restrictionId: restriction.id,
              targetUserId: user.id,
              type: restriction.type,
              expiredAt: now.toISOString(),
              reason: restriction.reason,
            },
          },
        }).catch((err: any) => console.warn("[moderation.service] Failed to create restriction expired activity:", err));

        await prisma.auditLog.create({
          data: {
            actorId: actor?.id || "system",
            actorEmail: actor?.email || "system@automation.local",
            action: "ACCOUNT_RESTRICTION_EXPIRED",
            resourceType: "USER",
            resourceId: user.id,
            description: `Restriction ${restriction.type} automatically expired for user ${user.email} (${user.id})`,
            metadata: { restrictionId: restriction.id, caseId: restriction.caseId },
          },
        }).catch((err: any) => console.warn("[moderation.service] Failed to create restriction expired audit log:", err));

        const actionName = restriction.type.replace("RESTRICT_", "").toLowerCase().replace(/_/g, " ");
        await notificationService.create({
          userId: user.id,
          type: NotificationType.SYSTEM,
          title: "Account Restriction Expired",
          message: `Your temporary restriction from ${actionName} has expired. Your full account privileges have been restored.`,
          entityId: restriction.caseId,
          entityType: "moderation-restriction-expired",
          link: "/profile/reports",
          metadata: {
            caseId: restriction.caseId,
            restrictionId: restriction.id,
            type: restriction.type,
          },
        }).catch((err: any) => console.warn("[moderation.service] Failed to send restriction expiration notification:", err));
      }
    }

    if (userChanged) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          personalInfo: {
            ...info,
            moderationRestrictions: restrictions,
          },
        },
      });
      await invalidateUserCache(user.id);
      affectedUserIds.push(user.id);
    }
  }

  return { scanned: users.length, expiredCount, affectedUserIds };
}

export async function suspendUserAccount(
  actor: AuthUser,
  input: {
    caseId: string;
    targetUserId: string;
    reason: string;
    policyCode?: string;
    bookingImpactAcknowledged?: boolean;
  }
) {
  assertModerator(actor, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE);
  await assertModerationSchemaReady();

  const reason = input.reason?.trim();
  if (!reason || reason.length < 5) {
    throw AppError.badRequest("Suspension reason must be at least 5 characters.");
  }

  const caseRecord = await prisma.moderationCase.findUnique({
    where: { id: input.caseId },
    select: { id: true, caseReference: true },
  });
  if (!caseRecord) throw AppError.notFound("Moderation case not found.");

  const targetUser = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true, name: true, email: true, role: true, status: true, personalInfo: true },
  });
  if (!targetUser) throw AppError.notFound("Target user not found.");
  if (targetUser.role === Role.ADMIN) throw AppError.badRequest("Cannot suspend an administrator account.");
  if (targetUser.status === "SUSPENDED") throw AppError.badRequest("User account is already suspended.");

  // Check booking impact before suspension
  const impact = await getCaseBookingImpact(input.caseId, input.targetUserId);
  if (impact.activeCount > 0 && !input.bookingImpactAcknowledged) {
    throw AppError.badRequest(
      `This user has ${impact.activeCount} active reservation(s). You must review and acknowledge the booking impact before completing account suspension.`
    );
  }

  const info = (targetUser.personalInfo as Record<string, any>) || {};
  const suspensionId = `susp_${nanoid(10)}`;
  const now = new Date().toISOString();
  const suspension: UserAccountSuspension = {
    id: suspensionId,
    caseId: input.caseId,
    reason,
    policyCode: input.policyCode || null,
    suspendedBy: actor.id,
    suspendedByName: actor.name,
    suspendedAt: now,
    status: "ACTIVE",
    bookingImpactAcknowledged: Boolean(input.bookingImpactAcknowledged),
  };

  await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      status: "SUSPENDED",
      personalInfo: {
        ...info,
        moderationSuspension: suspension,
      },
    },
  });

  await invalidateUserCache(targetUser.id);

  await prisma.moderationActivity.create({
    data: {
      caseId: input.caseId,
      actorId: actor.id,
      action: "ACCOUNT_SUSPENDED",
      metadata: {
        suspensionId,
        targetUserId: targetUser.id,
        targetUserName: targetUser.name,
        targetUserEmail: targetUser.email,
        reason,
        policyCode: input.policyCode || null,
        activeBookingsCount: impact.activeCount,
        bookingImpactAcknowledged: Boolean(input.bookingImpactAcknowledged),
        suspendedAt: now,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "ACCOUNT_SUSPENDED",
      resourceType: "USER",
      resourceId: targetUser.id,
      description: `User account suspended: ${targetUser.email} (${targetUser.id}) for case ${caseRecord.caseReference}: ${reason}`,
      metadata: { caseId: input.caseId, suspensionId, reason, activeBookingsCount: impact.activeCount },
    },
  });

  await notificationService.create({
    userId: targetUser.id,
    type: NotificationType.SYSTEM,
    title: "Account Suspended",
    message: `Your account has been suspended by Trust & Safety: "${reason}". You may file an appeal through the resolution center.`,
    entityId: input.caseId,
    entityType: "moderation-suspension",
    link: `/profile/reports`,
    metadata: {
      caseId: input.caseId,
      suspensionId,
      caseReference: caseRecord.caseReference,
    },
  }).catch((err) => console.warn("[moderation.service] Failed to notify suspended user:", err));

  return { success: true, suspension };
}

export async function reinstateUserAccount(
  actor: AuthUser,
  input: {
    caseId: string;
    targetUserId: string;
    reason: string;
  }
) {
  assertModerator(actor, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE);
  await assertModerationSchemaReady();

  const reason = input.reason?.trim();
  if (!reason || reason.length < 5) {
    throw AppError.badRequest("Reinstatement explanation must be at least 5 characters.");
  }

  const caseRecord = await prisma.moderationCase.findUnique({
    where: { id: input.caseId },
    select: { id: true, caseReference: true },
  });
  if (!caseRecord) throw AppError.notFound("Moderation case not found.");

  const targetUser = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true, name: true, email: true, role: true, status: true, personalInfo: true },
  });
  if (!targetUser) throw AppError.notFound("Target user not found.");
  if (targetUser.status !== "SUSPENDED") throw AppError.badRequest("User account is not currently suspended.");

  const info = (targetUser.personalInfo as Record<string, any>) || {};
  const suspension: UserAccountSuspension | null = info.moderationSuspension || null;
  const now = new Date().toISOString();

  if (suspension) {
    suspension.status = "REINSTATED";
    suspension.reinstatedAt = now;
    suspension.reinstatedBy = actor.id;
    suspension.reinstatementReason = reason;
  }

  await prisma.user.update({
    where: { id: targetUser.id },
    data: {
      status: "ACTIVE",
      personalInfo: {
        ...info,
        moderationSuspension: suspension,
      },
    },
  });

  await invalidateUserCache(targetUser.id);

  await prisma.moderationActivity.create({
    data: {
      caseId: input.caseId,
      actorId: actor.id,
      action: "ACCOUNT_REINSTATED",
      metadata: {
        targetUserId: targetUser.id,
        targetUserName: targetUser.name,
        targetUserEmail: targetUser.email,
        reason,
        reinstatedAt: now,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action: "ACCOUNT_REINSTATED",
      resourceType: "USER",
      resourceId: targetUser.id,
      description: `User account reinstated: ${targetUser.email} (${targetUser.id}) for case ${caseRecord.caseReference}: ${reason}`,
      metadata: { caseId: input.caseId, reason },
    },
  });

  await notificationService.create({
    userId: targetUser.id,
    type: NotificationType.SYSTEM,
    title: "Account Reinstated",
    message: `Your account suspension has been lifted and your account is active: "${reason}"`,
    entityId: input.caseId,
    entityType: "moderation-reinstated",
    link: `/profile/reports`,
    metadata: {
      caseId: input.caseId,
      caseReference: caseRecord.caseReference,
    },
  }).catch((err) => console.warn("[moderation.service] Failed to notify reinstated user:", err));

  return { success: true };
}

export async function getCaseBookingImpact(caseId: string, specificUserId?: string) {
  let targetUser: { id: string; name: string | null; email: string | null; role: Role; status: string } | null = null;

  if (specificUserId) {
    targetUser = await prisma.user.findUnique({
      where: { id: specificUserId },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
  } else {
    const caseRecord = await prisma.moderationCase.findUnique({
      where: { id: caseId },
      select: { id: true, targetType: true, targetId: true },
    });
    if (caseRecord) {
      if (caseRecord.targetType === "USER" || caseRecord.targetType === "PROFILE") {
        targetUser = await prisma.user.findUnique({
          where: { id: caseRecord.targetId },
          select: { id: true, name: true, email: true, role: true, status: true },
        });
      } else if (caseRecord.targetType === "LISTING") {
        const listing = await prisma.listing.findUnique({
          where: { id: caseRecord.targetId },
          select: { host: { select: { id: true, name: true, email: true, role: true, status: true } } },
        });
        targetUser = listing?.host || null;
      } else if (caseRecord.targetType === "LISTING_PHOTO") {
        const listing = await prisma.listing.findFirst({
          where: { photos: { has: caseRecord.targetId } },
          select: { host: { select: { id: true, name: true, email: true, role: true, status: true } } },
        });
        targetUser = listing?.host || null;
      } else if (caseRecord.targetType === "REVIEW") {
        const review = await prisma.review.findUnique({
          where: { id: caseRecord.targetId },
          select: { author: { select: { id: true, name: true, email: true, role: true, status: true } } },
        });
        targetUser = review?.author || null;
      } else if (caseRecord.targetType === "MESSAGE") {
        const message = await prisma.message.findUnique({
          where: { id: caseRecord.targetId },
          select: { sender: { select: { id: true, name: true, email: true, role: true, status: true } } },
        });
        targetUser = message?.sender || null;
      }
    }
  }

  if (!targetUser) {
    return {
      caseId,
      targetUserId: null,
      targetUserName: null,
      targetUserEmail: null,
      targetUserRole: null,
      activeCount: 0,
      activeBookings: [],
      pastCount: 0,
      cancelledCount: 0,
      totalActiveRevenueOrSpend: 0,
      requiresAcknowledgment: false,
      disclaimer: "Financial settlement and booking records are preserved. Moderation enforcement does not modify payouts or trigger automatic cancellations.",
    };
  }

  const now = new Date();
  const bookings = await prisma.booking.findMany({
    where: {
      OR: [
        { userId: targetUser.id },
        { listing: { hostId: targetUser.id } },
      ],
    },
    select: {
      id: true,
      userId: true,
      status: true,
      startDate: true,
      endDate: true,
      totalPrice: true,
      currency: true,
      user: { select: { id: true, name: true, email: true } },
      listing: {
        select: {
          id: true,
          title: true,
          hostId: true,
          host: { select: { id: true, name: true, email: true } },
        },
      },
    },
    orderBy: { startDate: "asc" },
  });

  const activeBookings = bookings.filter((b: any) => {
    const isConfirmed = b.status === BookingStatus.CONFIRMED;
    const isFutureOrOngoing = new Date(b.endDate) >= now;
    return isConfirmed && isFutureOrOngoing;
  });

  const pastBookings = bookings.filter((b: any) => {
    return new Date(b.endDate) < now;
  });

  const cancelledBookings = bookings.filter((b: any) => {
    return b.status === BookingStatus.CANCELLED;
  });

  const formattedActive = activeBookings.map((b: any) => ({
    id: b.id,
    listingId: b.listing.id,
    listingTitle: b.listing.title,
    userRole: b.userId === targetUser?.id ? "GUEST" : "HOST",
    counterpartyName: b.userId === targetUser?.id ? b.listing.host.name : b.user.name,
    counterpartyEmail: b.userId === targetUser?.id ? b.listing.host.email : b.user.email,
    startDate: b.startDate.toISOString(),
    endDate: b.endDate.toISOString(),
    status: b.status,
    totalPrice: b.totalPrice,
    currency: b.currency,
  }));

  const totalActiveRevenueOrSpend = activeBookings.reduce((sum: number, b: any) => sum + (b.totalPrice || 0), 0);

  return {
    caseId,
    targetUserId: targetUser.id,
    targetUserName: targetUser.name,
    targetUserEmail: targetUser.email,
    targetUserRole: targetUser.role,
    activeCount: activeBookings.length,
    activeBookings: formattedActive,
    pastCount: pastBookings.length,
    cancelledCount: cancelledBookings.length,
    totalActiveRevenueOrSpend,
    requiresAcknowledgment: activeBookings.length > 0,
    disclaimer: "Financial settlement and booking records are preserved. Moderation enforcement does not modify payouts or trigger automatic cancellations.",
  };
}

export async function getUserViolationHistory(actor: AuthUser, userId: string) {
  assertModerator(actor, PERMISSIONS.MODERATION_CASE_READ);
  await assertModerationSchemaReady();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, personalInfo: true },
  });
  if (!user) throw AppError.notFound("User not found.");

  const info = (user.personalInfo as Record<string, any>) || {};
  const warnings: UserAccountWarning[] = Array.isArray(info.moderationWarnings) ? info.moderationWarnings : [];
  const restrictions: UserAccountRestriction[] = Array.isArray(info.moderationRestrictions) ? info.moderationRestrictions : [];
  const suspension: UserAccountSuspension | null = info.moderationSuspension || null;

  // Find all cases involving this user as target
  const cases = await prisma.moderationCase.findMany({
    where: {
      OR: [
        { targetType: "USER", targetId: userId },
        { targetType: "PROFILE", targetId: userId },
        { targetType: "LISTING", targetId: { in: (await prisma.listing.findMany({ where: { hostId: userId }, select: { id: true } })).map((l: { id: string }) => l.id) } },
        { targetType: "REVIEW", targetId: { in: (await prisma.review.findMany({ where: { authorId: userId }, select: { id: true } })).map((r: { id: string }) => r.id) } },
        { targetType: "MESSAGE", targetId: { in: (await prisma.message.findMany({ where: { senderId: userId }, select: { id: true } })).map((m: { id: string }) => m.id) } },
      ],
    },
    select: {
      id: true,
      caseReference: true,
      targetType: true,
      status: true,
      severity: true,
      resolutionCategory: true,
      resolutionNotes: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { reports: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  // Query message moderations on messages sent by this user
  const moderatedMessagesCount = await prisma.message.count({
    where: {
      senderId: userId,
      metadata: { path: ["isModerated"], equals: true },
    },
  });

  const totalViolationsCount =
    warnings.length +
    restrictions.length +
    (suspension ? 1 : 0) +
    moderatedMessagesCount +
    cases.filter((c: any) => c.status === "RESOLVED").length;


  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      memberSince: user.createdAt,
    },
    totalViolationsCount,
    casesCount: cases.length,
    cases,
    warnings,
    restrictions,
    suspension,
    moderatedMessagesCount,
  };
}

export async function getReportedMessageContext(actor: AuthUser, caseId: string, messageId?: string) {
  assertModerator(actor, PERMISSIONS.MODERATION_CASE_READ);
  await assertModerationSchemaReady();

  let targetMessageId = messageId;
  if (!targetMessageId) {
    const caseRecord = await prisma.moderationCase.findUnique({
      where: { id: caseId },
      select: { id: true, targetType: true, targetId: true },
    });
    if (!caseRecord) throw AppError.notFound("Moderation case not found.");
    if (caseRecord.targetType !== "MESSAGE") {
      throw AppError.badRequest("Moderation case target is not a message.");
    }
    targetMessageId = caseRecord.targetId;
  }

  const reportedMessage = await prisma.message.findUnique({
    where: { id: targetMessageId },
    include: {
      sender: { select: { id: true, name: true, email: true, role: true, image: true } },
      conversation: {
        select: {
          id: true,
          guestId: true,
          hostId: true,
          guest: { select: { id: true, name: true, email: true } },
          host: { select: { id: true, name: true, email: true } },
          listing: { select: { id: true, title: true } },
        },
      },
    },
  });
  if (!reportedMessage) throw AppError.notFound("Reported message not found.");

  // Fetch up to 3 messages before and 3 messages after within the same conversation
  const [beforeMessages, afterMessages] = await Promise.all([
    prisma.message.findMany({
      where: {
        conversationId: reportedMessage.conversationId,
        createdAt: { lt: reportedMessage.createdAt },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: {
        sender: { select: { id: true, name: true, email: true, role: true, image: true } },
      },
    }),
    prisma.message.findMany({
      where: {
        conversationId: reportedMessage.conversationId,
        createdAt: { gt: reportedMessage.createdAt },
      },
      orderBy: { createdAt: "asc" },
      take: 3,
      include: {
        sender: { select: { id: true, name: true, email: true, role: true, image: true } },
      },
    }),
  ]);

  const chronologicalContext = [
    ...beforeMessages.reverse(),
    reportedMessage,
    ...afterMessages,
  ].map((m) => {
    const meta = (m.metadata as Record<string, any>) || {};
    return {
      id: m.id,
      conversationId: m.conversationId,
      senderId: m.senderId,
      senderName: m.sender?.name || null,
      senderRole: m.sender?.role || null,
      content: m.content,
      type: m.type,
      createdAt: m.createdAt.toISOString(),
      isTargetMessage: m.id === reportedMessage.id,
      isModerated: Boolean(meta.isModerated),
      moderatedAction: meta.moderatedAction || null,
      moderatedReason: meta.moderatedReason || null,
      moderatedAt: meta.moderatedAt || null,
    };
  });

  const resultPayload = {
    caseId,
    reportedMessage: {
      id: reportedMessage.id,
      conversationId: reportedMessage.conversationId,
      sender: reportedMessage.sender,
      content: reportedMessage.content,
      type: reportedMessage.type,
      createdAt: reportedMessage.createdAt.toISOString(),
      metadata: reportedMessage.metadata,
    },
    conversation: {
      id: reportedMessage.conversation.id,
      guest: reportedMessage.conversation.guest,
      host: reportedMessage.conversation.host,
      listing: reportedMessage.conversation.listing,
    },
    boundedMessages: chronologicalContext,
    contextLimit: 7,
  };

  // Audit privileged message investigation context access (Task 6 & Task 7)
  await prisma.moderationActivity.create({
    data: {
      caseId,
      actorId: actor.id,
      action: "MESSAGE_CONTEXT_ACCESSED",
      after: {
        messageId: reportedMessage.id,
        conversationId: reportedMessage.conversationId,
        boundedCount: chronologicalContext.length,
      },
    },
  }).catch(() => undefined);

  logSecurityEvent({
    action: "MODERATION_MESSAGE_CONTEXT_ACCESSED",
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    caseId,
    targetType: "MESSAGE",
    targetId: reportedMessage.id,
    severity: "INFO",
    details: { conversationId: reportedMessage.conversationId, boundedCount: chronologicalContext.length },
  });

  return resultPayload;
}

export async function executeMessageEnforcement(
  actor: AuthUser,
  input: {
    caseId: string;
    messageId: string;
    action: "HIDE" | "REMOVE" | "RESTORE";
    reason: string;
    policyCode?: string;
  }
) {
  assertModerator(actor, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE);
  await assertModerationSchemaReady();

  const reason = input.reason?.trim();
  if (!reason || reason.length < 5) {
    throw AppError.badRequest("Enforcement reason must be at least 5 characters.");
  }

  const caseRecord = await prisma.moderationCase.findUnique({
    where: { id: input.caseId },
    select: { id: true, caseReference: true },
  });
  if (!caseRecord) throw AppError.notFound("Moderation case not found.");

  const message = await prisma.message.findUnique({
    where: { id: input.messageId },
    include: {
      sender: { select: { id: true, name: true, email: true } },
    },
  });
  if (!message) throw AppError.notFound("Message not found.");

  const meta = (message.metadata as Record<string, any>) || {};
  const now = new Date().toISOString();

  if (input.action === "RESTORE") {
    meta.isModerated = false;
    meta.moderatedAction = null;
    meta.restoredBy = actor.id;
    meta.restoredAt = now;
    meta.restorationReason = reason;
  } else {
    meta.isModerated = true;
    meta.moderatedAction = input.action; // "HIDE" | "REMOVE"
    meta.moderatedReason = reason;
    meta.moderatedPolicyCode = input.policyCode || null;
    meta.moderatedBy = actor.id;
    meta.moderatedAt = now;
  }

  await prisma.message.update({
    where: { id: input.messageId },
    data: { metadata: meta },
  });

  const activityAction =
    input.action === "HIDE"
      ? "MESSAGE_HIDDEN"
      : input.action === "REMOVE"
      ? "MESSAGE_REMOVED"
      : "MESSAGE_RESTORED";

  await prisma.moderationActivity.create({
    data: {
      caseId: input.caseId,
      actorId: actor.id,
      action: activityAction,
      metadata: {
        messageId: input.messageId,
        senderId: message.senderId,
        senderName: message.sender?.name,
        action: input.action,
        reason,
        policyCode: input.policyCode || null,
        executedAt: now,
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action: activityAction,
      resourceType: "MESSAGE",
      resourceId: input.messageId,
      description: `Message ${input.messageId} ${input.action.toLowerCase()}d in case ${caseRecord.caseReference}: ${reason}`,
      metadata: { caseId: input.caseId, messageId: input.messageId, action: input.action, reason },
    },
  });

  if (message.senderId) {
    const actionLabel = input.action === "REMOVE" ? "removed" : input.action === "HIDE" ? "hidden" : "restored";
    await notificationService.create({
      userId: message.senderId,
      type: NotificationType.SYSTEM,
      title: input.action === "RESTORE" ? "Message restored" : "Message Moderation Action Taken",
      message: input.action === "RESTORE"
        ? "A message sent by you has been restored following moderation review."
        : `A message sent by you was ${actionLabel} by Trust & Safety: "${reason}"`,
      entityId: input.caseId,
      entityType: input.action === "RESTORE" ? "moderation-message-restored" : "moderation-message",
      link: moderationParticipantLink(input.caseId),
      metadata: {
        caseId: input.caseId,
        messageId: input.messageId,
        action: input.action,
        caseReference: caseRecord.caseReference,
      },
    }).catch((err) => console.warn("[moderation.service] Failed to notify message sender:", err));
  }

  const reports = await prisma.moderationReport.findMany({
    where: { caseId: input.caseId },
    select: { reporterId: true },
    take: 20,
  });
  const reporterIds = Array.from(new Set<string>(reports.map((report: { reporterId: string }) => report.reporterId)))
    .filter((reporterId: string) => reporterId !== message.senderId);
  const reportOutcome = input.action === "RESTORE"
    ? "The reported message has been restored following moderation review."
    : "Your report was reviewed and appropriate action was taken on the reported message.";
  await Promise.all(reporterIds.map((reporterId) =>
    notificationService.create({
      userId: reporterId,
      type: NotificationType.SYSTEM,
      title: input.action === "RESTORE" ? "Message restored following review" : "Message report resolved",
      message: reportOutcome,
      entityId: input.caseId,
      entityType: `moderation-message-outcome-${input.action.toLowerCase()}`,
      link: moderationParticipantLink(input.caseId),
      metadata: { caseId: input.caseId, messageId: input.messageId, action: input.action, caseReference: caseRecord.caseReference },
    }).catch((err) => console.warn("[moderation.service] Failed to notify message reporter:", err)),
  ));

  return { success: true, messageId: input.messageId, action: input.action };
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
  moderateReviewFromAdmin,
  addModerationNote,
  addModerationEvidence,
  getModerationEvidenceForAdmin,
  validateEvidenceFile,
  getCaseParticipants,
  uploadModerationEvidence,
  getModerationEvidenceStream,
  listModerationEvidence,
  createInformationRequest,
  listInformationRequests,
  respondToInformationRequest,
  updateInformationRequestStatus,
  checkAppealEligibility,
  submitModerationAppeal,
  listCaseAppeals,
  getModerationAppeal,
  listModerationAppeals,
  assignAppealReviewer,
  recordAppealDecision,
  withdrawModerationAppeal,
  listModerationPolicies,
  assertUserNotRestricted,
  getUserEnforcementStatus,
  issueAccountWarning,
  revokeAccountWarning,
  applyAccountRestriction,
  liftAccountRestriction,
  expirePendingAccountRestrictions,
  suspendUserAccount,
  reinstateUserAccount,
  getCaseBookingImpact,
  getUserViolationHistory,
  getReportedMessageContext,
  executeMessageEnforcement,
  getModerationAnalytics,
  exportModerationAnalyticsCsv,
  getEvidenceRetentionReport,
  applyEvidenceRetentionHold,
  releaseEvidenceRetentionHold,
  purgeEligibleEvidence,
};

export {
  getModerationAnalytics,
  exportModerationAnalyticsCsv,
  getEvidenceRetentionReport,
  applyEvidenceRetentionHold,
  releaseEvidenceRetentionHold,
  purgeEligibleEvidence,
};
