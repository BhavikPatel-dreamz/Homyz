import "server-only";

import crypto from "node:crypto";
import path from "node:path";
import { nanoid } from "nanoid";

import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import {
  QualityIncidentSeverity,
  QualityIncidentStatus,
  Role,
  ResolutionOfferStatus,
  SupportCaseEvidenceScanStatus,
  SupportCaseContentVisibility,
  SupportCaseParticipantRole,
  SupportCasePriority,
  SupportCaseStatus,
  UserStatus,
} from "@/generated/prisma/enums";
import { CASE_TRANSITIONS } from "@/lib/support-case/lifecycle";
import { getSupportSlaDeadlines, isSupportCaseOverdue } from "@/lib/support-case/sla";
import { isSupportedGuestSupportRequest, isSupportedHostSupportRequest } from "@/lib/support-case/taxonomy";
import { deletePrivateMedia, readPrivateMedia, savePrivateMedia } from "@/lib/storage/media";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { enqueueSupportNotification, processNotificationOutboxBatch } from "@/services/notification-outbox.service";

const CASE_NUMBER_PREFIX = "SC";
const MAX_PAGE_SIZE = 100;

/**
 * A support mutation first commits its case/outbox transaction. We then make a
 * bounded best-effort delivery attempt so interactive users see the inbox
 * update immediately. Failures remain durable in the outbox for cron/manual
 * retry and never roll back the successful support action.
 */
async function deliverCommittedSupportNotifications() {
  try {
    await processNotificationOutboxBatch({ limit: 25 });
  } catch (error) {
    console.warn("[support] notification delivery will be retried by the outbox worker", error);
  }
}


export interface CreateSupportCaseInput {
  bookingId?: string;
  listingId?: string;
  refundId?: string;
  category: string;
  issueType?: string;
  subject: string;
  description?: string;
  priority?: SupportCasePriority;
  idempotencyKey?: string;
  slaDueAt?: Date;
}

export interface SupportCaseListQuery {
  page?: number;
  limit?: number;
  status?: SupportCaseStatus;
  priority?: SupportCasePriority;
  category?: string;
  bookingId?: string;
  listingId?: string;
  assignedAdminId?: string;
  search?: string;
  reporterId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  sortBy?: "createdAt" | "updatedAt" | "slaDueAt" | "priority";
  sortOrder?: "asc" | "desc";
  /** Limits the participant-facing Resolution Center to cases with an offer. */
  resolutionOnly?: boolean;
  slaState?: "BREACHED" | "ON_TRACK";
}

export interface UpdateSupportCaseStatusInput {
  status: SupportCaseStatus;
  expectedVersion: number;
  reason?: string;
}

export interface AssignSupportCaseInput {
  assignedAdminId?: string | null;
  expectedVersion: number;
  reason?: string;
}

export interface UpdateSupportCasePriorityInput {
  priority: SupportCasePriority;
  expectedVersion: number;
  reason?: string;
}

export interface EscalateSupportCaseInput {
  expectedVersion: number;
  level: number;
  reason: string;
  escalationOwnerId?: string | null;
  idempotencyKey?: string;
}

export interface AddSupportCaseMessageInput {
  content: string;
  visibility?: SupportCaseContentVisibility;
  targetAudience?: "GUEST" | "HOST" | "ALL";
  idempotencyKey?: string;
}

export interface AddSupportCaseParticipantInput {
  userId: string;
  role: SupportCaseParticipantRole;
  canPost?: boolean;
  expectedVersion: number;
}

export interface RegisterSupportCaseEvidenceInput {
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  visibility?: SupportCaseContentVisibility;
  retentionUntil?: Date;
  metadata?: Record<string, unknown>;
}

function requireText(value: string | undefined, field: string, maxLength: number): string {
  const normalized = value?.trim();
  if (!normalized) throw AppError.badRequest(`${field} is required.`);
  if (normalized.length > maxLength) throw AppError.badRequest(`${field} must be at most ${maxLength} characters.`);
  return normalized;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function roleForReporter(actor: AuthUser): SupportCaseParticipantRole {
  if (actor.role === Role.ADMIN) return SupportCaseParticipantRole.ADMIN;
  if (actor.role === Role.HOST) return SupportCaseParticipantRole.HOST;
  return SupportCaseParticipantRole.GUEST;
}

function makeCaseNumber() {
  return `${CASE_NUMBER_PREFIX}-${nanoid(10).toUpperCase()}`;
}

function isAdmin(actor: AuthUser) {
  return actor.role === Role.ADMIN;
}

const PARTICIPANT_MUTABLE_STATUSES = new Set<SupportCaseStatus>([
  SupportCaseStatus.OPEN,
  SupportCaseStatus.IN_REVIEW,
  SupportCaseStatus.WAITING_FOR_GUEST,
  SupportCaseStatus.WAITING_FOR_ADMIN,
  SupportCaseStatus.REOPENED,
  SupportCaseStatus.ESCALATED,
]);

async function getParticipantAccess(actor: AuthUser, caseId: string, requirePost = false) {
  const supportCase = await prisma.supportCase.findUnique({
    where: { id: caseId },
    include: {
      participants: {
        where: { userId: actor.id, removedAt: null },
        select: { id: true, canView: true, canPost: true, role: true },
      },
    },
  });
  if (!supportCase) throw AppError.notFound("Support case not found.");
  if (isAdmin(actor)) return { supportCase, participant: null, admin: true };

  const participant = supportCase.participants[0];
  if (!participant || !participant.canView || (requirePost && !participant.canPost)) {
    throw AppError.forbidden("You do not have access to this support case.");
  }
  return { supportCase, participant, admin: false };
}

async function assertMutationAccessInTransaction(
  tx: Prisma.TransactionClient,
  actor: AuthUser,
  caseId: string,
) {
  if (isAdmin(actor)) return;
  const participant = await tx.supportCaseParticipant.findFirst({
    where: { caseId, userId: actor.id, removedAt: null, canView: true, canPost: true },
    select: { id: true },
  });
  if (!participant) throw AppError.forbidden("You do not have permission to update this support case.");
  const supportCase = await tx.supportCase.findUnique({ where: { id: caseId }, select: { status: true } });
  if (!supportCase) throw AppError.notFound("Support case not found.");
  if (!PARTICIPANT_MUTABLE_STATUSES.has(supportCase.status)) {
    throw AppError.conflict("Replies and evidence can no longer be added to this support case.");
  }
}

async function enqueueCaseParticipantNotification(
  tx: Prisma.TransactionClient,
  options: {
    caseId: string;
    actorId?: string;
    event: string;
    title: string;
    message: string;
    targetAudience?: "GUEST" | "HOST" | "ALL";
  },
) {
  const [participants, supportCase] = await Promise.all([
    tx.supportCaseParticipant.findMany({
    where: {
      caseId: options.caseId,
      removedAt: null,
      canView: true,
      ...(options.actorId ? { userId: { not: options.actorId } } : {}),
    },
    include: {
      user: { select: { id: true, role: true } },
    },
    }),
    tx.supportCase.findUnique({
      where: { id: options.caseId },
      select: { resolutionOffers: { take: 1, select: { id: true } } },
    }),
  ]);
  const recipients = participants.filter(({ user }) => {
    if (user.role === Role.ADMIN) return false;
    if (options.targetAudience === "GUEST") return user.role === Role.USER;
    if (options.targetAudience === "HOST") return user.role === Role.HOST;
    return true;
  });
  if (recipients.length === 0) return;
  const directResolution = Boolean(supportCase?.resolutionOffers.length);
  await enqueueSupportNotification(tx, {
    eventType: options.event,
    entityType: "SUPPORT_CASE",
    entityId: options.caseId,
    idempotencyKey: `support-case:${options.event}:${options.caseId}`,
    recipients: recipients.map(({ user }) => ({
      userId: user.id,
      title: options.title,
      message: options.message,
      link: directResolution
        ? user.role === Role.HOST
          ? `/host/resolution-center/direct?caseId=${encodeURIComponent(options.caseId)}`
          : `/profile/resolution-center?caseId=${encodeURIComponent(options.caseId)}`
        : user.role === Role.HOST
          ? `/host/support?caseId=${encodeURIComponent(options.caseId)}`
          : `/profile/tab/support?caseId=${encodeURIComponent(options.caseId)}`,
    })),
  });
}

async function getSupportQueueRecipients(
  tx: Prisma.TransactionClient,
  assignedAdminId: string | null,
  actorId?: string,
) {
  // A support queue is defined by explicitly granted dispute-management
  // permissions. We do not broadcast private support data to every admin.
  if (assignedAdminId && assignedAdminId !== actorId) {
    const assignee = await tx.user.findFirst({
      where: {
        id: assignedAdminId,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        adminRole: {
          permissions: {
            some: { permission: { slug: { in: [PERMISSIONS.DISPUTES_MANAGE, PERMISSIONS.DISPUTES_VIEW] } } },
          },
        },
      },
      select: { id: true },
    });
    if (assignee) return [assignee];
  }
  return tx.user.findMany({
    where: {
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
      ...(actorId ? { id: { not: actorId } } : {}),
      adminRole: {
        permissions: {
          some: { permission: { slug: { in: [PERMISSIONS.DISPUTES_MANAGE, PERMISSIONS.DISPUTES_VIEW] } } },
        },
      },
    },
    select: { id: true },
    take: 25,
  });
}

function validateEvidenceFile(file: { fileName: string; buffer: Buffer }) {
  const maxSize = 15 * 1024 * 1024;
  if (!file.buffer.length) throw AppError.badRequest("Evidence file cannot be empty.");
  if (file.buffer.length > maxSize) throw AppError.badRequest("Evidence files must be 15 MB or smaller.");
  const extension = path.extname(file.fileName).toLowerCase();
  const allowed = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);
  if (!allowed.has(extension)) throw AppError.badRequest("Evidence must be a JPG, PNG, WEBP image, or PDF document.");
  const isJpeg = file.buffer.length >= 3 && file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
  const isPng = file.buffer.length >= 8 && file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = file.buffer.length >= 12 && file.buffer.toString("ascii", 0, 4) === "RIFF" && file.buffer.toString("ascii", 8, 12) === "WEBP";
  const isPdf = file.buffer.length >= 5 && file.buffer.toString("ascii", 0, 5) === "%PDF-";
  if (!isJpeg && !isPng && !isWebp && !isPdf) throw AppError.badRequest("Evidence file content does not match a supported format.");
  return {
    extension: isPdf ? ".pdf" : isWebp ? ".webp" : isPng ? ".png" : extension === ".jpeg" ? ".jpeg" : ".jpg",
    mimeType: isPdf ? "application/pdf" : isWebp ? "image/webp" : isPng ? "image/png" : "image/jpeg",
  };
}

function caseStateSnapshot(supportCase: {
  status: SupportCaseStatus;
  priority: SupportCasePriority;
  assignedAdminId: string | null;
  version: number;
  resolvedAt: Date | null;
  closedAt: Date | null;
  escalatedAt: Date | null;
}) {
  return {
    status: supportCase.status,
    priority: supportCase.priority,
    assignedAdminId: supportCase.assignedAdminId,
    version: supportCase.version,
    resolvedAt: supportCase.resolvedAt?.toISOString() ?? null,
    closedAt: supportCase.closedAt?.toISOString() ?? null,
    escalatedAt: supportCase.escalatedAt?.toISOString() ?? null,
  };
}

function mapLegacyStatus(incident: {
  status: QualityIncidentStatus;
  metadata: unknown;
}): SupportCaseStatus {
  const metadata = asRecord(incident.metadata);
  const disputeStatus = typeof metadata.disputeStatus === "string" ? metadata.disputeStatus : "";
  if (incident.status === QualityIncidentStatus.REJECTED || disputeStatus === "CLOSED") return SupportCaseStatus.CLOSED;
  if (incident.status === QualityIncidentStatus.RESOLVED || disputeStatus === "RESOLVED") return SupportCaseStatus.RESOLVED;
  if (disputeStatus === "UNDER_INVESTIGATION") return SupportCaseStatus.IN_REVIEW;
  if (disputeStatus === "AWAITING_INFO") return SupportCaseStatus.WAITING_FOR_ADMIN;
  return SupportCaseStatus.OPEN;
}

function mapLegacyPriority(severity: QualityIncidentSeverity | null): SupportCasePriority {
  if (severity === QualityIncidentSeverity.CRITICAL) return SupportCasePriority.URGENT;
  if (severity === QualityIncidentSeverity.HIGH) return SupportCasePriority.HIGH;
  if (severity === QualityIncidentSeverity.LOW) return SupportCasePriority.LOW;
  return SupportCasePriority.MEDIUM;
}

async function createSupportCase(actor: AuthUser, input: CreateSupportCaseInput) {
  const category = requireText(input.category, "Category", 80).toUpperCase();
  const issueType = input.issueType?.trim().toUpperCase() || undefined;
  if (!isSupportedGuestSupportRequest(category, issueType) && !isSupportedHostSupportRequest(category, issueType)) {
    throw AppError.badRequest("Category or issue type is not supported.");
  }
  const subject = requireText(input.subject, "Subject", 160);
  const description = input.description?.trim();
  if (description && description.length > 10_000) {
    throw AppError.badRequest("Description must be at most 10000 characters.");
  }
  if (issueType && issueType.length > 120) {
    throw AppError.badRequest("Issue type must be at most 120 characters.");
  }

  if (input.idempotencyKey) {
    const existing = await prisma.supportCase.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existing) {
      if (existing.reporterId !== actor.id) throw AppError.conflict("This request key is already in use.");
      return existing;
    }
  }

  const priority = input.priority ?? SupportCasePriority.MEDIUM;
  const created = await prisma.$transaction(async (tx) => {
    let booking: { id: string; userId: string; listingId: string; listing: { hostId: string } } | null = null;
    let listing: { id: string; hostId: string } | null = null;
    if (input.bookingId) {
      booking = await tx.booking.findUnique({
        where: { id: input.bookingId },
        select: { id: true, userId: true, listingId: true, listing: { select: { hostId: true } } },
      });
      if (!booking) throw AppError.notFound("Booking not found.");
      if (input.listingId && input.listingId !== booking.listingId) {
        throw AppError.badRequest("The provided listing does not match the booking.");
      }
      listing = { id: booking.listingId, hostId: booking.listing.hostId };
    } else if (input.listingId) {
      listing = await tx.listing.findUnique({ where: { id: input.listingId }, select: { id: true, hostId: true } });
      if (!listing) throw AppError.notFound("Listing not found.");
    }

    let refund: { id: string; bookingId: string } | null = null;
    if (input.refundId) {
      refund = await tx.bookingRefund.findUnique({ where: { id: input.refundId }, select: { id: true, bookingId: true } });
      if (!refund) throw AppError.notFound("Refund not found.");
      if (booking && refund.bookingId !== booking.id) {
        throw AppError.badRequest("The refund does not belong to the support case booking.");
      }
      if (!booking) {
        booking = await tx.booking.findUnique({
          where: { id: refund.bookingId },
          select: { id: true, userId: true, listingId: true, listing: { select: { hostId: true } } },
        });
        if (!booking) throw AppError.notFound("Booking for refund not found.");
        listing = { id: booking.listingId, hostId: booking.listing.hostId };
      }
    }

    // This runs after a refundId has been resolved to its booking/listing too;
    // callers cannot attach a case to another user's refund by omitting the
    // bookingId from the request.
    if (!isAdmin(actor)) {
      const ownsBooking = booking?.userId === actor.id || booking?.listing?.hostId === actor.id;
      const ownsListing = listing?.hostId === actor.id;
      if ((booking || listing) && !ownsBooking && !ownsListing) {
        throw AppError.forbidden("You may only open a support case for your own reservation or listing.");
      }
    }

    const reporterRole = roleForReporter(actor);
    const now = new Date();
    const sla = getSupportSlaDeadlines(priority, now);
    const supportCase = await tx.supportCase.create({
      data: {
        caseNumber: makeCaseNumber(),
        idempotencyKey: input.idempotencyKey,
        reporterId: actor.id,
        reporterRole,
        bookingId: booking?.id,
        listingId: listing?.id,
        category,
        issueType: issueType || null,
        subject,
        description: description || null,
        priority,
        // Deadlines are derived server-side from the centralized provisional
        // policy. A request payload cannot alter the operational clock.
        slaDueAt: sla.slaDueAt,
        firstResponseDueAt: sla.firstResponseDueAt,
        nextResponseDueAt: sla.nextResponseDueAt,
        slaPolicyVersion: sla.policyVersion,
        participants: {
          create: { userId: actor.id, role: SupportCaseParticipantRole.REPORTER },
        },
        events: {
          create: {
            actorId: actor.id,
            eventType: "CASE_CREATED",
            visibility: SupportCaseContentVisibility.PARTICIPANTS,
            newState: {
              status: SupportCaseStatus.OPEN,
              priority,
              reporterRole,
            },
            description: "Support case created.",
          },
        },
      },
    });

    if (refund) {
      await tx.bookingRefund.update({ where: { id: refund.id }, data: { supportCaseId: supportCase.id } });
    }
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        action: "SUPPORT_CASE_CREATED",
        resourceType: "SUPPORT_CASE",
        resourceId: supportCase.id,
        description: `Support case ${supportCase.caseNumber} created.`,
        status: "SUCCESS",
        metadata: {
          bookingId: supportCase.bookingId,
          listingId: supportCase.listingId,
          category: supportCase.category,
          createdAt: now.toISOString(),
        },
      },
    });
    await enqueueSupportNotification(tx, {
      eventType: "SUPPORT_CASE_CREATED",
      entityType: "SUPPORT_CASE",
      entityId: supportCase.id,
      idempotencyKey: `support-case:created:${supportCase.id}`,
      recipients: [{
        userId: actor.id,
        title: "Support request received",
        message: `Your support request ${supportCase.caseNumber} was created.`,
        link: actor.role === Role.HOST
          ? `/host/support?caseId=${encodeURIComponent(supportCase.id)}`
          : `/profile/tab/support?caseId=${encodeURIComponent(supportCase.id)}`,
      }],
    });
    const queue = await getSupportQueueRecipients(tx, supportCase.assignedAdminId, actor.id);
    await enqueueSupportNotification(tx, {
      eventType: actor.role === Role.HOST ? "HOST_SUPPORT_CASE_CREATED" : "GUEST_SUPPORT_CASE_CREATED",
      entityType: "SUPPORT_CASE",
      entityId: supportCase.id,
      idempotencyKey: `support-case:queue-created:${supportCase.id}`,
      recipients: queue.map(({ id }) => ({
        userId: id,
        title: actor.role === Role.HOST ? "New host support request" : "New guest support request",
        message: `${actor.role === Role.HOST ? "A host" : "A guest"} opened support case ${supportCase.caseNumber}.`,
        link: `/admin/support/${encodeURIComponent(supportCase.id)}`,
      })),
    });
    return { supportCase, now };
  });
  await deliverCommittedSupportNotifications();
  return created.supportCase;
}

async function listSupportCases(actor: AuthUser, query: SupportCaseListQuery = {}) {
  const page = Math.max(1, Math.trunc(query.page ?? 1));
  const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(query.limit ?? 20)));
  const where: Prisma.SupportCaseWhereInput = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.category ? { category: query.category.trim() } : {}),
    ...(query.bookingId ? { bookingId: query.bookingId } : {}),
    ...(query.listingId ? { listingId: query.listingId } : {}),
    ...(isAdmin(actor) && query.reporterId ? { reporterId: query.reporterId } : {}),
    ...(isAdmin(actor) && query.assignedAdminId
      ? { assignedAdminId: query.assignedAdminId === "unassigned" ? null : query.assignedAdminId }
      : {}),
    ...(query.resolutionOnly ? { resolutionOffers: { some: {} } } : {}),
    ...(query.dateFrom || query.dateTo ? { createdAt: { ...(query.dateFrom ? { gte: query.dateFrom } : {}), ...(query.dateTo ? { lte: query.dateTo } : {}) } } : {}),
  };
  if (!isAdmin(actor)) {
    where.participants = { some: { userId: actor.id, removedAt: null, canView: true } };
  }
  const andConditions = () => Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
  if (query.slaState === "BREACHED") {
    where.AND = [...andConditions(), {
      slaDueAt: { lt: new Date() },
      status: { notIn: [SupportCaseStatus.RESOLVED, SupportCaseStatus.CLOSED] },
    }];
  }
  if (query.slaState === "ON_TRACK") {
    where.AND = [...andConditions(), {
      OR: [
        { slaDueAt: null },
        { slaDueAt: { gte: new Date() } },
        { status: { in: [SupportCaseStatus.RESOLVED, SupportCaseStatus.CLOSED] } },
      ],
    }];
  }
  if (query.search?.trim()) {
    const value = query.search.trim().slice(0, 160);
    const searchConditions: Prisma.SupportCaseWhereInput[] = [
      { caseNumber: { contains: value, mode: "insensitive" } },
      { subject: { contains: value, mode: "insensitive" } },
      ...(isAdmin(actor) ? [
        { reporter: { OR: [{ name: { contains: value, mode: "insensitive" as const } }, { email: { contains: value, mode: "insensitive" as const } }] } },
        { booking: { OR: [{ id: { contains: value, mode: "insensitive" as const } }, { user: { OR: [{ name: { contains: value, mode: "insensitive" as const } }, { email: { contains: value, mode: "insensitive" as const } }] } }] } },
        { listing: { host: { OR: [{ name: { contains: value, mode: "insensitive" as const } }, { email: { contains: value, mode: "insensitive" as const } }] } } },
      ] : []),
    ];
    if (where.OR) where.AND = [...andConditions(), { OR: searchConditions }];
    else where.OR = searchConditions;
  }
  const sortBy = query.sortBy ?? "updatedAt";
  const sortOrder = query.sortOrder ?? "desc";

  const [cases, total] = await Promise.all([
    prisma.supportCase.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: sortBy === "priority"
        ? [{ priority: sortOrder }, { updatedAt: "desc" }]
        : [{ [sortBy]: sortOrder }, { createdAt: "desc" }],
      include: {
        reporter: { select: { id: true, name: true, image: true } },
        assignedAdmin: isAdmin(actor) ? { select: { id: true, name: true, email: true } } : false,
        booking: { select: { id: true, submissionId: true, user: isAdmin(actor) ? { select: { id: true, name: true, email: true } } : false } },
        listing: { select: { id: true, title: true, photos: true } },
      },
    }),
    prisma.supportCase.count({ where }),
  ]);

  const caseIds = cases.map((item) => item.id);
  const unreadCounts = (!isAdmin(actor) && caseIds.length > 0)
    ? await prisma.notification.groupBy({
        by: ["entityId"],
        where: {
          userId: actor.id,
          isRead: false,
          entityId: { in: caseIds },
        },
        _count: { id: true },
      })
    : [];

  const unreadMap = new Map(unreadCounts.map((entry) => [entry.entityId, entry._count.id]));
  const casesWithUnread = cases.map((item) => ({
    ...item,
    unreadCount: unreadMap.get(item.id) || 0,
  }));

  return {
    cases: casesWithUnread,
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

async function getSupportCaseDetails(actor: AuthUser, caseId: string) {
  const access = await getParticipantAccess(actor, caseId);
  const supportCase = await prisma.supportCase.findUniqueOrThrow({
    where: { id: caseId },
    include: {
      reporter: { select: { id: true, name: true, image: true } },
      assignedAdmin: access.admin ? { select: { id: true, name: true, email: true } } : false,
      escalationOwner: access.admin ? { select: { id: true, name: true, email: true } } : false,
      booking: { select: { id: true, submissionId: true, startDate: true, endDate: true, status: true } },
      listing: { select: { id: true, title: true, city: true, photos: true } },
      participants: access.admin
        ? { where: { removedAt: null }, include: { user: { select: { id: true, name: true, email: true, role: true } } } }
        : { where: { userId: actor.id, removedAt: null }, include: { user: { select: { id: true, name: true, role: true } } } },
      messages: {
        where: access.admin ? {} : { visibility: SupportCaseContentVisibility.PARTICIPANTS },
        orderBy: { createdAt: "asc" },
        take: 100,
        include: { sender: { select: { id: true, name: true, image: true, role: true } } },
      },
      evidence: {
        where: access.admin ? { deletedAt: null } : { deletedAt: null, visibility: SupportCaseContentVisibility.PARTICIPANTS },
        orderBy: { createdAt: "asc" },
        select: {
          id: true, originalName: true, mimeType: true, sizeBytes: true, checksum: true,
          visibility: true, retentionUntil: true, scanStatus: true, scanAttemptCount: true,
          scanLastError: access.admin ? true : false, scannedAt: true, quarantinedAt: true,
          legalHold: access.admin ? true : false, legalHoldReason: access.admin ? true : false,
          legalHoldAt: access.admin ? true : false, createdAt: true,
          uploader: { select: { id: true, name: true } },
        },
      },
      events: {
        where: access.admin ? {} : { visibility: SupportCaseContentVisibility.PARTICIPANTS },
        orderBy: { createdAt: "asc" },
        take: 200,
        include: { actor: { select: { id: true, name: true } } },
      },
      assignmentHistory: access.admin
        ? {
            orderBy: { createdAt: "desc" },
            take: 100,
            include: {
              previousAssignee: { select: { id: true, name: true, email: true } },
              newAssignee: { select: { id: true, name: true, email: true } },
            },
          }
        : false,
      refunds: access.admin ? { select: { id: true, refundReference: true, status: true, amount: true, currency: true } } : false,
      resolutionOffers: {
        orderBy: { createdAt: "asc" },
        include: {
          proposer: { select: { id: true, name: true } },
          recipient: { select: { id: true, name: true } },
        },
      },
    },
  });

  const isHostViewer = access.participant?.role === SupportCaseParticipantRole.HOST || (supportCase.reporterId === actor.id && supportCase.reporterRole === "HOST");
  const parsedMessages = supportCase.messages
    .map((m) => {
      const match = m.content.match(/^<!--audience:(GUEST|HOST|ALL|ADMINS_ONLY)-->\n?/);
      const targetAudience = match
        ? (match[1] as "GUEST" | "HOST" | "ALL" | "ADMINS_ONLY")
        : (m.visibility === SupportCaseContentVisibility.ADMINS_ONLY ? "ADMINS_ONLY" : "ALL");
      const cleanContent = match ? m.content.slice(match[0].length) : m.content;
      return {
        ...m,
        content: cleanContent,
        targetAudience,
      };
    })
    .filter((m) => {
      if (access.admin) return true;
      if (m.visibility === SupportCaseContentVisibility.ADMINS_ONLY) return false;
      if (isHostViewer) return m.targetAudience !== "GUEST";
      return m.targetAudience !== "HOST";
    });

  if (!access.admin) {
    try {
      await prisma.notification.updateMany({
        where: {
          userId: actor.id,
          entityId: caseId,
          isRead: false,
        },
        data: {
          isRead: true,
          readAt: new Date(),
        },
      });
    } catch {
      // Non-critical notification background sync
    }
  }

  return { ...supportCase, messages: parsedMessages, viewer: { id: actor.id, isAdmin: access.admin, role: access.participant?.role ?? (access.admin ? "ADMIN" : null) } };
}

async function getSupportCaseAdminDashboard(actor: AuthUser) {
  if (!isAdmin(actor)) throw AppError.forbidden("Only an administrator can view support-case metrics.");
  const now = new Date();
  const [statusCounts, unassignedCount, dueCases, resolvedCases] = await Promise.all([
    prisma.supportCase.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.supportCase.count({
      where: {
        assignedAdminId: null,
        status: { notIn: [SupportCaseStatus.RESOLVED, SupportCaseStatus.CLOSED] },
      },
    }),
    prisma.supportCase.findMany({
      where: { status: { notIn: [SupportCaseStatus.RESOLVED, SupportCaseStatus.CLOSED] }, slaDueAt: { not: null } },
      select: { id: true, status: true, priority: true, slaDueAt: true },
      take: 500,
    }),
    prisma.supportCase.findMany({
      where: { resolvedAt: { not: null } },
      select: { createdAt: true, resolvedAt: true },
      orderBy: { resolvedAt: "desc" },
      take: 500,
    }),
  ]);
  const counts = Object.fromEntries(statusCounts.map((row) => [row.status, row._count._all]));
  const overdue = dueCases.filter((item) => isSupportCaseOverdue(item.status, item.slaDueAt, now));
  const resolutionMinutes = resolvedCases.reduce((sum, item) => sum + ((item.resolvedAt!.getTime() - item.createdAt.getTime()) / 60_000), 0);
  return {
    total: statusCounts.reduce((sum, row) => sum + row._count._all, 0),
    open: counts.OPEN ?? 0,
    inReview: counts.IN_REVIEW ?? 0,
    waitingForGuest: counts.WAITING_FOR_GUEST ?? 0,
    waitingForHost: counts.WAITING_FOR_HOST ?? 0,
    waitingForAdmin: counts.WAITING_FOR_ADMIN ?? 0,
    unassigned: unassignedCount,
    escalated: counts.ESCALATED ?? 0,
    resolved: counts.RESOLVED ?? 0,
    closed: counts.CLOSED ?? 0,
    slaBreaches: overdue.length,
    immediateAttention: overdue.filter((item) => item.priority === SupportCasePriority.HIGH || item.priority === SupportCasePriority.URGENT).length,
    averageResolutionMinutes: resolvedCases.length ? Math.round(resolutionMinutes / resolvedCases.length) : null,
    generatedAt: now.toISOString(),
  };
}

/**
 * Queues at most one approaching and one breached SLA alert per case/policy.
 * The scheduler invokes this in a bounded batch; delivery itself remains the
 * responsibility of the existing transactional notification outbox worker.
 */
async function queueSupportSlaNotifications(options: { limit?: number; now?: Date } = {}) {
  const now = options.now ?? new Date();
  const limit = Math.min(50, Math.max(1, Math.trunc(options.limit ?? 25)));
  const activeCases = await prisma.supportCase.findMany({
    where: {
      status: { notIn: [SupportCaseStatus.RESOLVED, SupportCaseStatus.CLOSED] },
      slaDueAt: { not: null, lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
    },
    orderBy: { slaDueAt: "asc" },
    take: limit,
    select: {
      id: true,
      caseNumber: true,
      assignedAdminId: true,
      slaDueAt: true,
      slaPolicyVersion: true,
      slaBreachedAt: true,
    },
  });

  const result = { scanned: activeCases.length, approaching: 0, breached: 0 };
  for (const supportCase of activeCases) {
    const dueAt = supportCase.slaDueAt;
    if (!dueAt) continue;
    const breached = dueAt <= now;
    if (breached && supportCase.slaBreachedAt) continue;

    await prisma.$transaction(async (tx) => {
      const recipients = await getSupportQueueRecipients(tx, supportCase.assignedAdminId);
      if (!recipients.length) return;

      const milestone = breached ? "BREACHED" : "APPROACHING";
      await enqueueSupportNotification(tx, {
        eventType: `SUPPORT_SLA_${milestone}`,
        entityType: "SUPPORT_CASE",
        entityId: supportCase.id,
        idempotencyKey: `support-case:sla:${supportCase.id}:${supportCase.slaPolicyVersion ?? "unknown"}:${milestone}`,
        recipients: recipients.map(({ id }) => ({
          userId: id,
          title: breached ? "Support SLA breached" : "Support SLA approaching",
          message: breached
            ? `${supportCase.caseNumber} is past its support SLA and needs review.`
            : `${supportCase.caseNumber} is due for support review within 24 hours.`,
          link: `/admin/support/${encodeURIComponent(supportCase.id)}`,
        })),
      });
      if (breached) {
        await tx.supportCase.updateMany({
          where: { id: supportCase.id, slaBreachedAt: null },
          data: { slaBreachedAt: now },
        });
      }
    });
    if (breached) result.breached += 1;
    else result.approaching += 1;
  }
  return result;
}

async function updateSupportCaseStatus(actor: AuthUser, caseId: string, input: UpdateSupportCaseStatusInput) {
  if (!isAdmin(actor)) throw AppError.forbidden("Only an administrator can change support-case status.");
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw AppError.badRequest("A valid expectedVersion is required.");
  }
  const reason = input.reason?.trim();
  if (reason && reason.length > 2_000) throw AppError.badRequest("Reason must be at most 2000 characters.");

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.supportCase.findUnique({ where: { id: caseId } });
    if (!current) throw AppError.notFound("Support case not found.");
    if (current.version !== input.expectedVersion) {
      throw AppError.conflict("This support case changed since it was loaded. Refresh before updating it.");
    }
    if (!CASE_TRANSITIONS[current.status].has(input.status)) {
      throw AppError.conflict(`Cannot transition support case from ${current.status} to ${input.status}.`);
    }
    if (input.status === SupportCaseStatus.CLOSED) {
      const outstandingOffers = await tx.resolutionOffer.count({ where: { caseId, status: ResolutionOfferStatus.PENDING } });
      if (outstandingOffers) throw AppError.conflict("Withdraw, reject, or resolve pending resolution offers before closing this case.");
    }
    if ((input.status === SupportCaseStatus.REOPENED || input.status === SupportCaseStatus.ESCALATED) && !reason) {
      throw AppError.badRequest("A reason is required when reopening or escalating a support case.");
    }

    const now = new Date();
    const update = await tx.supportCase.updateMany({
      where: { id: caseId, version: input.expectedVersion },
      data: {
        status: input.status,
        version: { increment: 1 },
        resolvedAt: input.status === SupportCaseStatus.RESOLVED ? now : current.resolvedAt,
        closedAt: input.status === SupportCaseStatus.CLOSED ? now : current.closedAt,
        escalatedAt: input.status === SupportCaseStatus.ESCALATED ? now : current.escalatedAt,
        escalationReason: input.status === SupportCaseStatus.ESCALATED ? reason ?? null : current.escalationReason,
      },
    });
    if (update.count !== 1) throw AppError.conflict("This support case changed since it was loaded. Refresh before updating it.");
    const updated = await tx.supportCase.findUniqueOrThrow({ where: { id: caseId } });
    await tx.supportCaseEvent.create({
      data: {
        caseId,
        actorId: actor.id,
        eventType: `STATUS_${input.status}`,
        visibility: SupportCaseContentVisibility.PARTICIPANTS,
        previousState: caseStateSnapshot(current),
        newState: caseStateSnapshot(updated),
        description: reason || `Status changed to ${input.status}.`,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id, actorEmail: actor.email, action: "SUPPORT_CASE_STATUS_CHANGED",
        resourceType: "SUPPORT_CASE", resourceId: caseId,
        description: `Support case ${updated.caseNumber} status changed from ${current.status} to ${updated.status}.`,
        status: "SUCCESS", metadata: { previousStatus: current.status, newStatus: updated.status, expectedVersion: input.expectedVersion },
      },
    });
    await enqueueCaseParticipantNotification(tx, {
      caseId, actorId: actor.id, event: `STATUS_${updated.status}_${updated.version}`,
      title: "Support case updated",
      message: `Your support case ${updated.caseNumber} is now ${updated.status.replaceAll("_", " ").toLowerCase()}.`,
    });
    return { current, updated };
  });
  await deliverCommittedSupportNotifications();
  return result.updated;
}

async function assignSupportCase(actor: AuthUser, caseId: string, input: AssignSupportCaseInput) {
  if (!isAdmin(actor)) throw AppError.forbidden("Only an administrator can assign support cases.");
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw AppError.badRequest("A valid expectedVersion is required.");
  }
  const reason = input.reason?.trim();
  if (reason && reason.length > 2_000) throw AppError.badRequest("Reason must be at most 2000 characters.");

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.supportCase.findUnique({ where: { id: caseId } });
    if (!current) throw AppError.notFound("Support case not found.");
    if (current.version !== input.expectedVersion) throw AppError.conflict("This support case changed since it was loaded. Refresh before updating it.");
    if (input.assignedAdminId) {
      const assignee = await tx.user.findFirst({
        where: {
          id: input.assignedAdminId,
          role: Role.ADMIN,
          status: UserStatus.ACTIVE,
          adminRole: { permissions: { some: { permission: { slug: { in: [PERMISSIONS.DISPUTES_MANAGE, PERMISSIONS.DISPUTES_VIEW] } } } } },
        },
        select: { id: true },
      });
      if (!assignee) {
        throw AppError.badRequest("Support cases can only be assigned to active administrators authorized for support cases.");
      }
    }
    if (current.assignedAdminId === (input.assignedAdminId ?? null)) {
      throw AppError.conflict("The support case already has this assignment.");
    }
    const update = await tx.supportCase.updateMany({
      where: { id: caseId, version: input.expectedVersion },
      data: { assignedAdminId: input.assignedAdminId ?? null, version: { increment: 1 } },
    });
    if (update.count !== 1) throw AppError.conflict("This support case changed since it was loaded. Refresh before updating it.");
    const updated = await tx.supportCase.findUniqueOrThrow({ where: { id: caseId } });
    await tx.supportCaseAssignmentHistory.create({
      data: { caseId, previousAssigneeId: current.assignedAdminId, newAssigneeId: input.assignedAdminId ?? null, reason: reason || null },
    });
    await tx.supportCaseEvent.create({
      data: {
        caseId, actorId: actor.id, eventType: "ASSIGNMENT_CHANGED", visibility: SupportCaseContentVisibility.ADMINS_ONLY,
        previousState: caseStateSnapshot(current), newState: caseStateSnapshot(updated),
        description: reason || "Case assignment changed.",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id, actorEmail: actor.email, action: "SUPPORT_CASE_ASSIGNED", resourceType: "SUPPORT_CASE", resourceId: caseId,
        description: `Support case ${updated.caseNumber} assignment changed.`, status: "SUCCESS",
        metadata: { previousAssigneeId: current.assignedAdminId, newAssigneeId: updated.assignedAdminId, expectedVersion: input.expectedVersion },
      },
    });
    if (updated.assignedAdminId) {
      await enqueueSupportNotification(tx, {
        eventType: current.assignedAdminId ? "SUPPORT_CASE_REASSIGNED" : "SUPPORT_CASE_ASSIGNED",
        entityType: "SUPPORT_CASE",
        entityId: caseId,
        idempotencyKey: `support-case:assignment:${caseId}:${updated.version}:${updated.assignedAdminId}`,
        recipients: [{ userId: updated.assignedAdminId, title: "Support case assigned", message: `You were assigned support case ${updated.caseNumber}.`, link: `/admin/support/${encodeURIComponent(caseId)}` }],
      });
    }
    return { current, updated };
  });
  await deliverCommittedSupportNotifications();
  return result.updated;
}

async function updateSupportCasePriority(actor: AuthUser, caseId: string, input: UpdateSupportCasePriorityInput) {
  if (!isAdmin(actor)) throw AppError.forbidden("Only an administrator can change support-case priority.");
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw AppError.badRequest("A valid expectedVersion is required.");
  const reason = input.reason?.trim();
  if (reason && reason.length > 2_000) throw AppError.badRequest("Reason must be at most 2000 characters.");
  const updatedPriority = await prisma.$transaction(async (tx) => {
    const current = await tx.supportCase.findUnique({ where: { id: caseId } });
    if (!current) throw AppError.notFound("Support case not found.");
    if (current.version !== input.expectedVersion) throw AppError.conflict("This support case changed since it was loaded. Refresh before updating it.");
    const sla = getSupportSlaDeadlines(input.priority, current.createdAt);
    const result = await tx.supportCase.updateMany({
      where: { id: caseId, version: input.expectedVersion },
      data: { priority: input.priority, slaDueAt: sla.slaDueAt, firstResponseDueAt: sla.firstResponseDueAt, nextResponseDueAt: sla.nextResponseDueAt, slaPolicyVersion: sla.policyVersion, version: { increment: 1 } },
    });
    if (result.count !== 1) throw AppError.conflict("This support case changed since it was loaded. Refresh before updating it.");
    const updated = await tx.supportCase.findUniqueOrThrow({ where: { id: caseId } });
    await tx.supportCaseEvent.create({ data: { caseId, actorId: actor.id, eventType: "PRIORITY_CHANGED", visibility: SupportCaseContentVisibility.ADMINS_ONLY, previousState: caseStateSnapshot(current), newState: caseStateSnapshot(updated), description: reason || `Priority changed to ${input.priority}.` } });
    await tx.auditLog.create({ data: { actorId: actor.id, actorEmail: actor.email, action: "SUPPORT_CASE_PRIORITY_CHANGED", resourceType: "SUPPORT_CASE", resourceId: caseId, description: `Support case priority changed to ${input.priority}.`, status: "SUCCESS", metadata: { previousPriority: current.priority, priority: input.priority, expectedVersion: input.expectedVersion } } });
    await enqueueCaseParticipantNotification(tx, { caseId, actorId: actor.id, event: `PRIORITY_CHANGED_${updated.version}`, title: "Support case priority updated", message: `The priority for support case ${updated.caseNumber} was updated.`, });
    return updated;
  });
  await deliverCommittedSupportNotifications();
  return updatedPriority;
}

async function escalateSupportCase(actor: AuthUser, caseId: string, input: EscalateSupportCaseInput) {
  if (!isAdmin(actor)) throw AppError.forbidden("Only an administrator can escalate support cases.");
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1 || !Number.isInteger(input.level) || input.level < 1 || input.level > 4) {
    throw AppError.badRequest("A valid version and escalation level are required.");
  }
  const reason = requireText(input.reason, "Escalation reason", 2_000);
  const escalated = await prisma.$transaction(async (tx) => {
    const current = await tx.supportCase.findUnique({ where: { id: caseId } });
    if (!current) throw AppError.notFound("Support case not found.");
    if (current.version !== input.expectedVersion) {
      throw AppError.conflict("This support case changed since it was loaded. Refresh before escalating it.");
    }
    if (current.status === SupportCaseStatus.ESCALATED && current.escalationLevel === input.level) {
      throw AppError.conflict(`This support case is already escalated to Level ${input.level}.`);
    }
    if (!CASE_TRANSITIONS[current.status].has(SupportCaseStatus.ESCALATED) && current.status !== SupportCaseStatus.ESCALATED) {
      throw AppError.conflict(`Cannot escalate support case from ${current.status}.`);
    }
    if (input.escalationOwnerId) {
      const owner = await tx.user.findFirst({
        where: {
          id: input.escalationOwnerId,
          role: Role.ADMIN,
          status: UserStatus.ACTIVE,
          adminRole: { permissions: { some: { permission: { slug: { in: [PERMISSIONS.DISPUTES_MANAGE, PERMISSIONS.DISPUTES_VIEW] } } } } },
        },
        select: { id: true },
      });
      if (!owner) {
        throw AppError.badRequest("Escalation owner must be an active administrator authorized for support cases.");
      }
    }
    const updated = await tx.supportCase.update({
      where: { id: caseId },
      data: {
        status: SupportCaseStatus.ESCALATED,
        escalationLevel: input.level,
        escalationReason: reason,
        escalationOwnerId: input.escalationOwnerId ?? current.escalationOwnerId,
        escalatedAt: new Date(),
        version: { increment: 1 },
      },
    });
    await tx.supportCaseEvent.create({
      data: {
        caseId,
        actorId: actor.id,
        eventType: "CASE_ESCALATED",
        visibility: SupportCaseContentVisibility.PARTICIPANTS,
        previousState: caseStateSnapshot(current),
        newState: caseStateSnapshot(updated),
        description: `Support escalated this case to Level ${input.level}.`,
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id,
        actorEmail: actor.email,
        action: "SUPPORT_CASE_ESCALATED",
        resourceType: "SUPPORT_CASE",
        resourceId: caseId,
        description: `Support case escalated to level ${input.level}.`,
        status: "SUCCESS",
        metadata: { reason, level: input.level, escalationOwnerId: updated.escalationOwnerId },
      },
    });
    await enqueueCaseParticipantNotification(tx, {
      caseId,
      actorId: actor.id,
      event: `CASE_ESCALATED_${updated.version}`,
      title: "Support case escalated",
      message: `Support case ${updated.caseNumber} was escalated to Level ${input.level} for review.`,
    });
    const escalationReviewers = await getSupportQueueRecipients(tx, updated.escalationOwnerId, actor.id);
    await enqueueSupportNotification(tx, {
      eventType: "SUPPORT_CASE_ESCALATED_FOR_REVIEW",
      entityType: "SUPPORT_CASE",
      entityId: caseId,
      idempotencyKey: `support-case:escalation-review:${caseId}:${updated.version}`,
      recipients: escalationReviewers.map(({ id }) => ({
        userId: id,
        title: updated.escalationOwnerId === id ? "Escalated support case assigned" : "Escalated support case needs review",
        message: updated.escalationOwnerId === id
          ? `You are the escalation owner for ${updated.caseNumber}.`
          : `${updated.caseNumber} was escalated to Level ${input.level} and needs review.`,
        link: `/admin/support/${encodeURIComponent(caseId)}`,
      })),
    });
    return updated;
  });
  await deliverCommittedSupportNotifications();
  return escalated;
}

async function addSupportCaseParticipant(actor: AuthUser, caseId: string, input: AddSupportCaseParticipantInput) {
  if (!isAdmin(actor)) throw AppError.forbidden("Only an administrator can add support-case participants.");
  if (input.role === SupportCaseParticipantRole.REPORTER) {
    throw AppError.badRequest("REPORTER is reserved for the user who opened the support case.");
  }
  if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
    throw AppError.badRequest("A valid expectedVersion is required.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const current = await tx.supportCase.findUnique({ where: { id: caseId } });
    if (!current) throw AppError.notFound("Support case not found.");
    if (current.version !== input.expectedVersion) throw AppError.conflict("This support case changed since it was loaded. Refresh before updating it.");

    const participantUser = await tx.user.findUnique({ where: { id: input.userId }, select: { role: true, status: true } });
    if (!participantUser || participantUser.status !== UserStatus.ACTIVE) {
      throw AppError.badRequest("Only active users can participate in a support case.");
    }
    const expectedRole = input.role === SupportCaseParticipantRole.GUEST
      ? Role.USER
      : input.role === SupportCaseParticipantRole.HOST
        ? Role.HOST
        : input.role === SupportCaseParticipantRole.ADMIN
          ? Role.ADMIN
          : participantUser.role;
    if (participantUser.role !== expectedRole) {
      throw AppError.badRequest("The participant role does not match the user account role.");
    }

    const currentParticipant = await tx.supportCaseParticipant.findUnique({
      where: { caseId_userId: { caseId, userId: input.userId } },
      select: { id: true, removedAt: true },
    });
    if (currentParticipant && !currentParticipant.removedAt) {
      throw AppError.conflict("This user is already a support-case participant.");
    }

    const caseUpdate = await tx.supportCase.updateMany({
      where: { id: caseId, version: input.expectedVersion },
      data: { version: { increment: 1 } },
    });
    if (caseUpdate.count !== 1) throw AppError.conflict("This support case changed since it was loaded. Refresh before updating it.");

    const participant = currentParticipant
      ? await tx.supportCaseParticipant.update({
          where: { id: currentParticipant.id },
          data: { role: input.role, canView: true, canPost: input.canPost ?? true, removedAt: null },
        })
      : await tx.supportCaseParticipant.create({
          data: { caseId, userId: input.userId, role: input.role, canPost: input.canPost ?? true },
        });
    const updated = await tx.supportCase.findUniqueOrThrow({ where: { id: caseId } });
    await tx.supportCaseEvent.create({
      data: {
        caseId, actorId: actor.id, eventType: "PARTICIPANT_ADDED", visibility: SupportCaseContentVisibility.ADMINS_ONLY,
        previousState: caseStateSnapshot(current), newState: caseStateSnapshot(updated),
        description: "Case participant added or restored.",
      },
    });
    await tx.auditLog.create({
      data: {
        actorId: actor.id, actorEmail: actor.email, action: "SUPPORT_CASE_PARTICIPANT_ADDED", resourceType: "SUPPORT_CASE", resourceId: caseId,
        description: `Participant added to support case ${updated.caseNumber}.`, status: "SUCCESS",
        metadata: { participantId: participant.id, userId: input.userId, role: input.role, expectedVersion: input.expectedVersion },
      },
    });
    return { participant, supportCase: updated };
  });
  return result;
}

async function addSupportCaseMessage(actor: AuthUser, caseId: string, input: AddSupportCaseMessageInput) {
  const content = requireText(input.content, "Message content", 10_000);
  const visibility = input.visibility ?? SupportCaseContentVisibility.PARTICIPANTS;
  const idempotencyKey = input.idempotencyKey?.trim();
  if (idempotencyKey && (idempotencyKey.length < 8 || idempotencyKey.length > 200)) {
    throw AppError.badRequest("Message idempotency key must be between 8 and 200 characters.");
  }
  const access = await getParticipantAccess(actor, caseId, !isAdmin(actor));
  if (visibility === SupportCaseContentVisibility.ADMINS_ONLY && !access.admin) {
    throw AppError.forbidden("Only administrators can add internal notes.");
  }

  if (idempotencyKey) {
    const existing = await prisma.supportCaseMessage.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.caseId !== caseId || existing.senderId !== actor.id) throw AppError.conflict("This message request key is already in use.");
      const match = existing.content.match(/^<!--audience:(GUEST|HOST|ALL|ADMINS_ONLY)-->\n?/);
      return {
        ...existing,
        content: match ? existing.content.slice(match[0].length) : existing.content,
        targetAudience: match ? match[1] : (existing.visibility === SupportCaseContentVisibility.ADMINS_ONLY ? "ADMINS_ONLY" : "ALL"),
      };
    }
  }

  const message = await prisma.$transaction(async (tx) => {
    await assertMutationAccessInTransaction(tx, actor, caseId);
    if (idempotencyKey) {
      const existing = await tx.supportCaseMessage.findUnique({ where: { idempotencyKey } });
      if (existing) {
        if (existing.caseId !== caseId || existing.senderId !== actor.id) throw AppError.conflict("This message request key is already in use.");
        const match = existing.content.match(/^<!--audience:(GUEST|HOST|ALL|ADMINS_ONLY)-->\n?/);
        return {
          ...existing,
          content: match ? existing.content.slice(match[0].length) : existing.content,
          targetAudience: match ? match[1] : (existing.visibility === SupportCaseContentVisibility.ADMINS_ONLY ? "ADMINS_ONLY" : "ALL"),
        };
      }
    }

    const currentCase = await tx.supportCase.findUniqueOrThrow({
      where: { id: caseId },
      include: {
        participants: { where: { removedAt: null } },
        resolutionOffers: { take: 1, select: { id: true } },
      },
    });

    let targetAudience: "GUEST" | "HOST" | "ALL" | "ADMINS_ONLY" = input.targetAudience ?? "ALL";
    let finalContent = content;

    if (visibility === SupportCaseContentVisibility.ADMINS_ONLY) {
      targetAudience = "ADMINS_ONLY";
      finalContent = `<!--audience:ADMINS_ONLY-->\n${content}`;
    } else if (isAdmin(actor)) {
      if (targetAudience === "HOST") {
        const hasHost = currentCase.participants.some(
          (p) => p.role === SupportCaseParticipantRole.HOST || (p.role === SupportCaseParticipantRole.REPORTER && currentCase.reporterRole === SupportCaseParticipantRole.HOST)
        );
        if (!hasHost) {
          throw AppError.badRequest("Host is not an authorized participant in this support case.");
        }
      }
      finalContent = `<!--audience:${targetAudience}-->\n${content}`;
    } else {
      targetAudience = "ALL";
      finalContent = `<!--audience:ALL-->\n${content}`;
    }

    const created = await tx.supportCaseMessage.create({
      data: { caseId, senderId: actor.id, content: finalContent, visibility, idempotencyKey },
    });

    // Response responsibility updates when participant replies
    if (!isAdmin(actor)) {
      const participantRole = access.participant?.role;
      const isGuest = participantRole === SupportCaseParticipantRole.GUEST || participantRole === SupportCaseParticipantRole.REPORTER || (currentCase.reporterId === actor.id && currentCase.reporterRole === "GUEST");
      const isHost = participantRole === SupportCaseParticipantRole.HOST || (currentCase.reporterId === actor.id && currentCase.reporterRole === "HOST");

      if (isGuest && currentCase.status === SupportCaseStatus.WAITING_FOR_GUEST) {
        await tx.supportCase.update({
          where: { id: caseId },
          data: { status: SupportCaseStatus.IN_REVIEW, version: { increment: 1 }, updatedAt: new Date() },
        });
        await tx.supportCaseEvent.create({
          data: {
            caseId, actorId: actor.id, eventType: "CASE_STATUS_CHANGED",
            visibility: SupportCaseContentVisibility.PARTICIPANTS,
            description: "Status updated to In review following guest reply.",
          },
        });
      } else if (isHost && currentCase.status === SupportCaseStatus.WAITING_FOR_HOST) {
        await tx.supportCase.update({
          where: { id: caseId },
          data: { status: SupportCaseStatus.IN_REVIEW, version: { increment: 1 }, updatedAt: new Date() },
        });
        await tx.supportCaseEvent.create({
          data: {
            caseId, actorId: actor.id, eventType: "CASE_STATUS_CHANGED",
            visibility: SupportCaseContentVisibility.PARTICIPANTS,
            description: "Status updated to In review following host reply.",
          },
        });
      } else {
        await tx.supportCase.update({ where: { id: caseId }, data: { updatedAt: new Date() } });
      }
    } else {
      await tx.supportCase.update({ where: { id: caseId }, data: { updatedAt: new Date() } });
    }

    await tx.supportCaseEvent.create({
      data: {
        caseId,
        actorId: actor.id,
        eventType: visibility === SupportCaseContentVisibility.ADMINS_ONLY ? "INTERNAL_NOTE_ADDED" : "MESSAGE_ADDED",
        visibility: visibility === SupportCaseContentVisibility.ADMINS_ONLY ? SupportCaseContentVisibility.ADMINS_ONLY : SupportCaseContentVisibility.PARTICIPANTS,
        description: visibility === SupportCaseContentVisibility.ADMINS_ONLY
          ? "Internal note added."
          : (isAdmin(actor)
            ? (targetAudience === "GUEST" ? "Reply sent to guest." : targetAudience === "HOST" ? "Reply sent to host." : "Reply added to case.")
            : "Participant reply added."),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId: actor.id, actorEmail: actor.email, action: "SUPPORT_CASE_MESSAGE_ADDED", resourceType: "SUPPORT_CASE", resourceId: caseId,
        description: "Support case message added.", status: "SUCCESS", metadata: { visibility, targetAudience },
      },
    });

    if (visibility === SupportCaseContentVisibility.PARTICIPANTS) {
      if (isAdmin(actor)) {
        await enqueueCaseParticipantNotification(tx, {
          caseId,
          actorId: actor.id,
          event: `MESSAGE_ADDED_${created.id}`,
          title: "New reply from Support",
          message: `Support replied to case ${currentCase.caseNumber}.`,
          targetAudience: targetAudience as "GUEST" | "HOST" | "ALL",
        });
      } else {
        const isHost = access.participant?.role === SupportCaseParticipantRole.HOST || (currentCase.reporterId === actor.id && currentCase.reporterRole === "HOST");
        // Standard support replies are private to the reporter and support.
        // Only a booking-linked direct-resolution case may notify the other
        // participant about a participant message.
        if (currentCase.resolutionOffers.length) {
          await enqueueCaseParticipantNotification(tx, {
            caseId,
            actorId: actor.id,
            event: `MESSAGE_ADDED_${created.id}`,
            title: isHost ? "Host reply received" : "Guest reply received",
            message: `${actor.name || (isHost ? "Host" : "Guest")} replied to support case ${currentCase.caseNumber}.`,
            targetAudience: "ALL",
          });
        }

        if (!currentCase.resolutionOffers.length) {
          const reviewers = await getSupportQueueRecipients(tx, currentCase.assignedAdminId, actor.id);
          await enqueueSupportNotification(tx, {
            eventType: isHost ? "HOST_REPLIED" : "GUEST_REPLIED",
            entityType: "SUPPORT_CASE",
            entityId: caseId,
            idempotencyKey: `support-case:${created.id}:admin-notify`,
            recipients: reviewers.map(({ id }) => ({
              userId: id,
              title: isHost ? "Host replied to support case" : "Guest replied to support case",
              message: `${actor.name || (isHost ? "Host" : "Guest")} replied to ${currentCase.caseNumber}.`,
              link: `/admin/support/${encodeURIComponent(caseId)}`,
            })),
          });
        }
      }
    }

    return {
      ...created,
      content,
      targetAudience,
    };
  });
  await deliverCommittedSupportNotifications();
  return message;
}

async function registerSupportCaseEvidence(actor: AuthUser, caseId: string, input: RegisterSupportCaseEvidenceInput) {
  const storageKey = requireText(input.storageKey, "Storage key", 1_000);
  if (storageKey.includes("..") || /^https?:\/\//i.test(storageKey)) throw AppError.badRequest("Evidence must use a private storage key.");
  const originalName = requireText(input.originalName, "Original file name", 255);
  const mimeType = requireText(input.mimeType, "MIME type", 120);
  if (!Number.isInteger(input.sizeBytes) || input.sizeBytes < 0 || input.sizeBytes > 25 * 1024 * 1024) {
    throw AppError.badRequest("Evidence size must be an integer no larger than 25 MB.");
  }
  const visibility = input.visibility ?? SupportCaseContentVisibility.PARTICIPANTS;
  const access = await getParticipantAccess(actor, caseId, !isAdmin(actor));
  if (visibility === SupportCaseContentVisibility.ADMINS_ONLY && !access.admin) throw AppError.forbidden("Only administrators can add private evidence.");

  try {
    const evidence = await prisma.$transaction(async (tx) => {
      await assertMutationAccessInTransaction(tx, actor, caseId);
      const supportCase = await tx.supportCase.findUniqueOrThrow({
        where: { id: caseId },
        select: { caseNumber: true, assignedAdminId: true },
      });
      const created = await tx.supportCaseEvidence.create({
        data: {
          caseId, uploaderId: actor.id, storageKey, originalName, mimeType, sizeBytes: input.sizeBytes,
          checksum: input.checksum?.trim() || null, visibility, retentionUntil: input.retentionUntil ?? null,
          metadata: (input.metadata as Prisma.InputJsonValue) ?? undefined,
          scanStatus: SupportCaseEvidenceScanStatus.CLEAN,
          scannedAt: new Date(),
        },
      });
      await tx.supportCase.update({ where: { id: caseId }, data: { updatedAt: new Date() } });
      await tx.supportCaseEvent.create({
        data: {
          caseId,
          actorId: actor.id,
          eventType: "EVIDENCE_UPLOADED",
          visibility: SupportCaseContentVisibility.PARTICIPANTS,
          description: `Evidence file ${input.originalName} was uploaded and verified.`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: actor.id, actorEmail: actor.email, action: "SUPPORT_CASE_EVIDENCE_REGISTERED", resourceType: "SUPPORT_CASE", resourceId: caseId,
          description: "Support case evidence metadata registered.", status: "SUCCESS",
          metadata: { evidenceId: created.id, visibility, sizeBytes: created.sizeBytes },
        },
      });
      const reviewers = await getSupportQueueRecipients(tx, supportCase.assignedAdminId, actor.id);
      await enqueueSupportNotification(tx, {
        eventType: "SUPPORT_EVIDENCE_UPLOADED",
        entityType: "SUPPORT_CASE_EVIDENCE",
        entityId: created.id,
        idempotencyKey: `support-evidence:uploaded:${created.id}`,
        recipients: reviewers.map(({ id }) => ({
          userId: id,
          title: "Support evidence submitted",
          message: `New evidence was submitted for ${supportCase.caseNumber}.`,
          link: `/admin/support/${caseId}`,
        })),
      });
      return created;
    });
    await deliverCommittedSupportNotifications();
    return evidence;
  } catch (error: unknown) {
    if (typeof error === "object" && error && "code" in error && error.code === "P2002") {
      throw AppError.conflict("This evidence storage key is already registered.");
    }
    throw error;
  }
}

async function uploadSupportCaseEvidence(actor: AuthUser, caseId: string, file: { fileName: string; buffer: Buffer }) {
  // Verify case access before storing a binary object. Registration repeats the
  // check inside its transaction to close the upload-to-persist race.
  await getParticipantAccess(actor, caseId, !isAdmin(actor));
  const validated = validateEvidenceFile(file);
  const originalBase = path.basename(file.fileName, path.extname(file.fileName))
    .replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 80) || "evidence";
  const stored = await savePrivateMedia({
    kind: "support-case-evidence",
    fileName: `support_case_${caseId}_${Date.now()}_${crypto.randomBytes(12).toString("hex")}${validated.extension}`,
    body: file.buffer,
    contentType: validated.mimeType,
  });
  try {
    return await registerSupportCaseEvidence(actor, caseId, {
      storageKey: stored.storagePath,
      originalName: `${originalBase}${validated.extension}`,
      mimeType: validated.mimeType,
      sizeBytes: file.buffer.length,
      checksum: crypto.createHash("sha256").update(file.buffer).digest("hex"),
    });
  } catch (error) {
    await deletePrivateMedia({ kind: "support-case-evidence", fileName: stored.storagePath }).catch(() => undefined);
    throw error;
  }
}

async function getSupportCaseEvidenceForParticipant(actor: AuthUser, caseId: string, evidenceId: string) {
  const access = await getParticipantAccess(actor, caseId);
  const evidence = await prisma.supportCaseEvidence.findFirst({
    where: {
      id: evidenceId,
      caseId,
      deletedAt: null,
      ...(access.admin ? {} : { visibility: SupportCaseContentVisibility.PARTICIPANTS }),
    },
    select: { id: true, originalName: true, mimeType: true, storageKey: true, scanStatus: true },
  });
  if (!evidence) throw AppError.notFound("Evidence file not found.");
  if (!access.admin && evidence.scanStatus !== SupportCaseEvidenceScanStatus.CLEAN) {
    throw AppError.conflict("Evidence is pending security verification and cannot be downloaded.");
  }
  let buffer: Buffer;
  try {
    buffer = await readPrivateMedia("support-case-evidence", evidence.storageKey);
  } catch {
    throw AppError.notFound("Evidence file not found.");
  }
  return { evidence, buffer };
}

/**
 * Idempotent compatibility operation for legacy disputes. It is deliberately
 * not called by request handlers or migrations: rollout uses a dry run first,
 * then an explicitly approved non-production/production backfill invocation.
 */
async function backfillLegacyDisputeSupportCases(options: { dryRun?: boolean; take?: number; cursor?: string } = {}) {
  const take = Math.min(MAX_PAGE_SIZE, Math.max(1, options.take ?? 50));
  const incidents = await prisma.listingQualityIncident.findMany({
    where: { supportCase: null },
    orderBy: { id: "asc" },
    take,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    select: {
      id: true, bookingId: true, listingId: true, reportedById: true, category: true, status: true,
      severity: true, description: true, metadata: true, createdAt: true, resolvedAt: true,
    },
  });
  if (options.dryRun) {
    return { dryRun: true, scanned: incidents.length, created: 0, skipped: 0, nextCursor: incidents.at(-1)?.id ?? null };
  }

  let created = 0;
  let skipped = 0;
  for (const incident of incidents) {
    const outcome = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${incident.id}))`;
      const current = await tx.listingQualityIncident.findUnique({
        where: { id: incident.id },
        include: { supportCase: { select: { id: true } } },
      });
      if (!current || current.supportCase) return "skipped" as const;
      const metadata = asRecord(current.metadata);
      const reporterRole = metadata.reporterRole === "HOST"
        ? SupportCaseParticipantRole.HOST
        : metadata.reporterRole === "ADMIN"
          ? SupportCaseParticipantRole.ADMIN
          : SupportCaseParticipantRole.GUEST;
      const status = mapLegacyStatus(current);
      const supportCase = await tx.supportCase.create({
        data: {
          caseNumber: `SC-LEGACY-${current.id.toUpperCase()}`,
          reporterId: current.reportedById,
          reporterRole,
          bookingId: current.bookingId,
          listingId: current.listingId,
          legacyQualityIncidentId: current.id,
          category: `LEGACY_${current.category}`,
          issueType: typeof metadata.disputeStatus === "string" ? metadata.disputeStatus : null,
          subject: `Legacy dispute ${current.id}`,
          description: current.description,
          priority: mapLegacyPriority(current.severity),
          status,
          resolvedAt: status === SupportCaseStatus.RESOLVED ? current.resolvedAt ?? current.updatedAt : null,
          closedAt: status === SupportCaseStatus.CLOSED ? current.resolvedAt ?? current.updatedAt : null,
          participants: current.reportedById ? { create: { userId: current.reportedById, role: SupportCaseParticipantRole.REPORTER } } : undefined,
          events: {
            create: {
              actorId: current.reportedById,
              eventType: "LEGACY_DISPUTE_LINKED",
              visibility: SupportCaseContentVisibility.ADMINS_ONLY,
              newState: { legacyQualityIncidentId: current.id, legacyStatus: current.status, mappedStatus: status },
              description: "Linked to existing ListingQualityIncident by the idempotent support-case backfill.",
              createdAt: current.createdAt,
            },
          },
        },
      });
      return supportCase.id;
    });
    if (outcome === "skipped") skipped += 1;
    else created += 1;
  }
  return { dryRun: false, scanned: incidents.length, created, skipped, nextCursor: incidents.at(-1)?.id ?? null };
}

export const supportCaseService = {
  createSupportCase,
  listSupportCases,
  getSupportCaseDetails,
  getSupportCaseAdminDashboard,
  queueSupportSlaNotifications,
  updateSupportCaseStatus,
  assignSupportCase,
  updateSupportCasePriority,
  escalateSupportCase,
  addSupportCaseParticipant,
  addSupportCaseMessage,
  registerSupportCaseEvidence,
  uploadSupportCaseEvidence,
  getSupportCaseEvidenceForParticipant,
  backfillLegacyDisputeSupportCases,
};

export { CASE_TRANSITIONS };
