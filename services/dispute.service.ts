import "server-only";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import {
  Role,
  QualityIncidentCategory,
  QualityIncidentSeverity,
  QualityIncidentStatus,
  NotificationType,
  UserStatus,
} from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { assertRole } from "@/lib/permissions/authorize";
import { auditService } from "@/services/audit.service";
import { notificationService } from "@/services/notification.service";
import { nanoid } from "nanoid";
import path from "node:path";
import crypto from "node:crypto";
import { deletePrivateMedia, readPrivateMedia, savePrivateMedia } from "@/lib/storage/media";
import { resolveDisputeNotificationDestination } from "@/lib/notifications/dispute-destination";

export interface CreateDisputeInput {
  bookingId: string;
  category: QualityIncidentCategory;
  severity?: QualityIncidentSeverity;
  description: string;
  incidentDate?: string;
  evidenceUrls?: string[];
}

export interface DisputeListQuery {
  page?: number;
  limit?: number;
  tab?: string;
  search?: string;
  category?: string;
  status?: string;
  severity?: string;
  assignedAdminId?: string;
  assignedAdminEmail?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: "createdAt" | "severity" | "updatedAt";
  sortOrder?: "asc" | "desc";
}

export interface DisputeSummaryData {
  totalCases: number;
  newCases: number;
  openCases: number;
  underInvestigationCount: number;
  awaitingInfoCount: number;
  resolvedCases: number;
  closedCases: number;
  attentionCases: number;
}

export interface ResolveDisputeInput {
  decisionCategory: string;
  explanation: string;
  refundRequestId?: string;
  financialAdjustmentNote?: string;
}

export interface HostDisputeListQuery {
  page?: number;
  limit?: number;
  tab?: "all" | "response_required" | "open" | "resolved";
  search?: string;
  propertyId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  bookingId?: string;
}

type UploadedEvidenceInput = {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
};

const DISPUTE_DECISION_CATEGORIES = new Set([
  "RESOLVED_NO_FINANCIAL_ADJUSTMENT",
  "REFERRED_TO_REFUND",
  "REFERRED_TO_OPERATIONS",
  "CLOSED_AFTER_REVIEW",
]);

const OPEN_INCIDENT_STATUSES = [
  QualityIncidentStatus.PENDING,
  QualityIncidentStatus.CONFIRMED,
];

const HOST_VISIBLE_TIMELINE_EVENTS = new Set([
  "CASE_CREATED",
  "INFO_REQUESTED",
  "HOST_RESPONSE_SUBMITTED",
  "HOST_REPLY_SENT",
  "HOST_RESOLUTION_PROPOSED",
  "HOST_COMPLAINT_RESOLVED",
  "HOST_COMPLAINT_WITHDRAWN",
  "CASE_RESOLVED",
  "CASE_CLOSED",
]);

type HostPrivateNote = {
  id: string;
  hostId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

function disputeNotificationLink(
  disputeId: string,
  recipient: "ADMIN" | "GUEST" | "HOST",
  bookingId?: string | null,
) {
  return resolveDisputeNotificationDestination({ disputeId, recipient, bookingId });
}

function isHostResponseRequired(metadata: Record<string, any>, status?: string) {
  if (status === QualityIncidentStatus.RESOLVED || status === "RESOLVED") {
    return false;
  }
  if (metadata.disputeStatus === "CLOSED" || metadata.disputeStatus === "RESOLVED") {
    return false;
  }
  return Array.isArray(metadata.infoRequests) && metadata.infoRequests.some(
    (request) => request?.target === "HOST" && request?.status === "PENDING_RESPONSE",
  );
}

function hostResponseRequiredWhere() {
  return {
    metadata: {
      path: ["infoRequests"],
      array_contains: [{ target: "HOST", status: "PENDING_RESPONSE" }],
    },
  } as any;
}

/**
 * A host may work a case they filed themselves, or a guest case after an
 * administrator has explicitly invited the host to participate. The legacy
 * request predicate keeps already-requested cases accessible after rollout.
 */
function hostCaseVisibilityWhere(hostId: string) {
  return {
    listing: { hostId },
    OR: [
      { reportedById: hostId },
      { metadata: { path: ["hostParticipation", "hostId"], equals: hostId } },
      { metadata: { path: ["infoRequests"], array_contains: [{ target: "HOST" }] } },
    ],
  } as any;
}

function hostCaseWhere(hostId: string, disputeId?: string) {
  return {
    ...hostCaseVisibilityWhere(hostId),
    ...(disputeId ? { id: disputeId } : {}),
  } as any;
}

function isClosedDispute(incident: { status: QualityIncidentStatus; metadata: unknown }) {
  const metadata = (incident.metadata as Record<string, unknown>) || {};
  return metadata.disputeStatus === "CLOSED" || incident.status === QualityIncidentStatus.REJECTED;
}

function metadataPathEquals(path: string[], value: string) {
  return { metadata: { path, equals: value } } as any;
}

function metadataPathNotEquals(path: string[], value: string) {
  return { metadata: { path, not: value } } as any;
}

function assertOpenForInvestigation(incident: { status: QualityIncidentStatus; metadata: unknown }) {
  const metadata = (incident.metadata as Record<string, unknown>) || {};
  if (metadata.disputeStatus === "CLOSED" || incident.status === QualityIncidentStatus.REJECTED) {
    throw AppError.conflict("Closed dispute cases cannot be changed.");
  }
}

function parseFilterDate(value: string, endOfDay = false): Date {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}Z`
    : value);
  if (Number.isNaN(date.getTime())) throw AppError.badRequest("Invalid dispute date filter.");
  return date;
}

function sanitizeListing(listing: any) {
  if (!listing) return null;
  const { doorCode, wifiPassword, lockboxCode, ...safeListing } = listing;
  return safeListing;
}

/**
 * Returns KPI aggregate summary for dispute cases.
 */
export async function getDisputeSummaryForAdmin(actor: AuthUser): Promise<DisputeSummaryData> {
  assertRole(actor, [Role.ADMIN]);

  const [
    totalCases,
    newCases,
    openCases,
    underInvestigationCount,
    awaitingInfoCount,
    resolvedCases,
    closedCases,
    attentionCases,
  ] = await Promise.all([
    prisma.listingQualityIncident.count(),
    prisma.listingQualityIncident.count({ where: { status: QualityIncidentStatus.PENDING } }),
    prisma.listingQualityIncident.count({ where: { status: { in: OPEN_INCIDENT_STATUSES } } }),
    prisma.listingQualityIncident.count({
      where: metadataPathEquals(["disputeStatus"], "UNDER_INVESTIGATION"),
    }),
    prisma.listingQualityIncident.count({
      where: metadataPathEquals(["disputeStatus"], "AWAITING_INFO"),
    }),
    prisma.listingQualityIncident.count({
      where: {
        status: QualityIncidentStatus.RESOLVED,
        AND: [metadataPathNotEquals(["disputeStatus"], "CLOSED")],
      } as any,
    }),
    prisma.listingQualityIncident.count({
      where: {
        OR: [
          { status: QualityIncidentStatus.REJECTED },
          metadataPathEquals(["disputeStatus"], "CLOSED"),
        ],
      } as any,
    }),
    prisma.listingQualityIncident.count({
      where: {
        status: { in: OPEN_INCIDENT_STATUSES },
        OR: [
          { severity: { in: [QualityIncidentSeverity.HIGH, QualityIncidentSeverity.CRITICAL] } },
          { createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
        ],
      },
    }),
  ]);

  return {
    totalCases,
    newCases,
    openCases,
    underInvestigationCount,
    awaitingInfoCount,
    resolvedCases,
    closedCases,
    attentionCases,
  };
}

/**
 * Lists paginated dispute cases with multi-facet filters.
 */
export async function listDisputesForAdmin(
  actor: AuthUser,
  query: DisputeListQuery,
): Promise<{
  disputes: any[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}> {
  assertRole(actor, [Role.ADMIN]);

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const skip = (page - 1) * limit;

  const where: any = {};
  const conditions: any[] = [];

  // Status Tab filtering
  if (query.tab && query.tab !== "all") {
    switch (query.tab) {
      case "new":
        where.status = QualityIncidentStatus.PENDING;
        break;
      case "open":
        where.status = { in: OPEN_INCIDENT_STATUSES };
        break;
      case "resolved":
        where.status = QualityIncidentStatus.RESOLVED;
        conditions.push(metadataPathNotEquals(["disputeStatus"], "CLOSED"));
        break;
      case "closed":
        conditions.push({
          OR: [
            { status: QualityIncidentStatus.REJECTED },
            metadataPathEquals(["disputeStatus"], "CLOSED"),
          ],
        });
        break;
      case "attention":
        where.status = { in: OPEN_INCIDENT_STATUSES };
        conditions.push({ OR: [
          { severity: { in: [QualityIncidentSeverity.HIGH, QualityIncidentSeverity.CRITICAL] } },
          {
            createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        ] });
        break;
    }
  } else if (query.status && query.status !== "ALL") {
    where.status = query.status as QualityIncidentStatus;
  }

  // Category filter
  if (query.category && query.category !== "ALL") {
    where.category = query.category as QualityIncidentCategory;
  }

  // Severity / Priority filter
  if (query.severity && query.severity !== "ALL") {
    where.severity = query.severity as QualityIncidentSeverity;
  }

  if (query.assignedAdminId) {
    conditions.push(metadataPathEquals(["assignedAdmin", "id"], query.assignedAdminId));
  }
  if (query.assignedAdminEmail) {
    conditions.push(metadataPathEquals(["assignedAdmin", "email"], query.assignedAdminEmail));
  }

  // Date range filter
  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) where.createdAt.gte = parseFilterDate(query.startDate);
    if (query.endDate) where.createdAt.lte = parseFilterDate(query.endDate, true);
  }

  // Search filter
  if (query.search?.trim()) {
    const term = query.search.trim();
    conditions.push({ OR: [
      { id: { contains: term, mode: "insensitive" } },
      { bookingId: { contains: term, mode: "insensitive" } },
      metadataPathEquals(["caseReference"], term.toUpperCase()),
      { description: { contains: term, mode: "insensitive" } },
      { listing: { title: { contains: term, mode: "insensitive" } } },
      { reportedBy: { name: { contains: term, mode: "insensitive" } } },
      { reportedBy: { email: { contains: term, mode: "insensitive" } } },
      { booking: { user: { name: { contains: term, mode: "insensitive" } } } },
      { booking: { listing: { host: { name: { contains: term, mode: "insensitive" } } } } },
    ] });
  }

  if (conditions.length > 0) where.AND = conditions;

  const sortField = query.sortBy || "createdAt";
  const sortDir = query.sortOrder || "desc";
  const orderBy: any[] = [{ [sortField]: sortDir }, { id: "desc" }];

  const [incidents, total] = await Promise.all([
    prisma.listingQualityIncident.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            city: true,
            photos: true,
            host: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        booking: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            totalPrice: true,
            currency: true,
            user: { select: { id: true, name: true, email: true, image: true } },
          },
        },
        reportedBy: { select: { id: true, name: true, email: true, image: true, role: true } },
      },
    }),
    prisma.listingQualityIncident.count({ where }),
  ]);

  const disputes = incidents.map((inc: any) => {
    const meta = (inc.metadata as Record<string, any>) || {};
    return {
      id: inc.id,
      caseReference: meta.caseReference || `DSP-${inc.id.slice(-6).toUpperCase()}`,
      category: inc.category,
      status: inc.status,
      disputeWorkflowStatus: meta.disputeStatus || (inc.status === "RESOLVED" ? "RESOLVED" : "OPEN"),
      severity: inc.severity || "MEDIUM",
      description: inc.description,
      reportedBy: inc.reportedBy,
      reporterRole: meta.reporterRole || (inc.reportedBy?.role === "HOST" ? "HOST" : "GUEST"),
      assignedAdmin: meta.assignedAdmin || null,
      booking: inc.booking,
      listing: sanitizeListing(inc.listing),
      internalNotesCount: Array.isArray(meta.internalNotes) ? meta.internalNotes.length : 0,
      evidenceCount: Array.isArray(meta.evidence) ? meta.evidence.length : 0,
      createdAt: inc.createdAt,
      updatedAt: inc.updatedAt,
      resolvedAt: inc.resolvedAt,
    };
  });

  return {
    disputes,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Creates an authorized dispute case linked to a booking.
 */
export async function createDispute(
  actor: AuthUser,
  input: CreateDisputeInput,
): Promise<any> {
  const { bookingId, category, severity = QualityIncidentSeverity.MEDIUM, description, incidentDate, evidenceUrls = [] } = input;

  if (!bookingId) throw AppError.badRequest("Booking ID is required");
  if (!description?.trim()) throw AppError.badRequest("Dispute description is required");
  if (!Object.values(QualityIncidentCategory).includes(category)) {
    throw AppError.badRequest("Unsupported dispute category.");
  }
  if (!Object.values(QualityIncidentSeverity).includes(severity)) {
    throw AppError.badRequest("Unsupported dispute priority.");
  }

  // Load and verify booking
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      listing: { select: { id: true, hostId: true, title: true } },
      user: { select: { id: true, email: true, name: true } },
    },
  });

  if (!booking) throw AppError.notFound(`Booking ${bookingId} not found`);

  // Authorization check: Must be ADMIN, or Guest on booking, or Host of listing
  const isAdmin = actor.role === Role.ADMIN;
  const isGuest = booking.userId === actor.id;
  const isHost = booking.listing.hostId === actor.id;

  if (!isAdmin && !isGuest && !isHost) {
    throw AppError.forbidden("You are not authorized to create a dispute for this reservation.");
  }

  const reporterRole = isAdmin ? "ADMIN" : isHost ? "HOST" : "GUEST";
  const caseReference = `DSP-${nanoid(6).toUpperCase()}`;
  const now = new Date();

  const evidence = (evidenceUrls || []).map((url) => ({
    id: nanoid(8),
    url,
    uploadedBy: actor.email,
    createdAt: now.toISOString(),
  }));

  const initialTimeline = [
    {
      id: nanoid(8),
      event: "CASE_CREATED",
      actorEmail: actor.email,
      actorRole: reporterRole,
      title: "Dispute Case Filed",
      description: `Dispute filed under category "${category}": "${description.slice(0, 100)}"`,
      timestamp: now.toISOString(),
    },
  ];

  const metadata: any = {
    caseReference,
    reporterRole,
    incidentDate: incidentDate || now.toISOString(),
    disputeStatus: "OPEN",
    evidence,
    internalNotes: [],
    infoRequests: [],
    timeline: initialTimeline,
  };

  const incident = await prisma.listingQualityIncident.create({
    data: {
      listingId: booking.listingId,
      bookingId: booking.id,
      reportedById: actor.id,
      category,
      status: QualityIncidentStatus.PENDING,
      severity,
      description: description.trim(),
      metadata,
    },
    include: {
      listing: { select: { id: true, title: true } },
      booking: true,
      reportedBy: { select: { id: true, name: true, email: true } },
    },
  });

  // Audit Log
  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "DISPUTE_CREATED",
    resourceType: "BOOKING",
    resourceId: booking.id,
    description: `Dispute ${caseReference} opened by ${reporterRole} (${actor.email}) for booking ${booking.id}.`,
    status: "SUCCESS",
    metadata: {
      disputeId: incident.id,
      caseReference,
      category,
      severity,
    },
  });

  // Guest complaints are Admin-review-first. The Host is neither notified nor
  // granted access until an administrator explicitly requests participation.
  const recipientUserId = isHost ? booking.userId : null;
  if (recipientUserId) {
    try {
      await notificationService.create({
        userId: recipientUserId,
        type: NotificationType.BOOKING,
        title: "New dispute case filed",
        message: `A dispute case was filed for your reservation at ${booking.listing.title}. Homyz Support will review it.`,
        entityId: incident.id,
        entityType: "dispute-case-created",
        link: disputeNotificationLink(incident.id, isGuest ? "HOST" : "GUEST", booking.id),
        metadata: { disputeId: incident.id, bookingId: booking.id, caseReference, recipientRole: isGuest ? "HOST" : "GUEST" },
      });
    } catch (err) {
      console.warn("[dispute.service] Failed to send dispute creation notification:", err);
    }
  }

  if (!isAdmin) {
    const administrators = await prisma.user.findMany({
      where: { role: Role.ADMIN },
      select: { id: true },
      take: 50,
    });
    await Promise.all(administrators.map(async (administrator: { id: string }) => {
      try {
        await notificationService.create({
          userId: administrator.id,
          type: NotificationType.BOOKING,
          title: `New ${reporterRole.toLowerCase()} dispute case`,
          message: `A ${reporterRole.toLowerCase()} opened ${caseReference} for ${booking.listing.title}.`,
          entityId: incident.id,
          entityType: "dispute-case-created-admin",
          link: disputeNotificationLink(incident.id, "ADMIN", booking.id),
          metadata: { disputeId: incident.id, bookingId: booking.id, caseReference, recipientRole: "ADMIN", reporterRole },
        });
      } catch (err) {
        console.warn("[dispute.service] Failed to send new dispute notification to admin:", err);
      }
    }));
  }

  return incident;
}

/**
 * Returns complete dispute case details with booking, financials, evidence, notes, and timeline.
 */
export async function getDisputeDetailsForAdmin(
  actor: AuthUser,
  disputeId: string,
): Promise<any> {
  assertRole(actor, [Role.ADMIN]);

  const incident = await prisma.listingQualityIncident.findUnique({
    where: { id: disputeId },
    include: {
      listing: {
        select: {
          id: true,
          title: true,
          city: true,
          country: true,
          photos: true,
          host: { select: { id: true, name: true, email: true, image: true, phone: true } },
        },
      },
      booking: {
        include: {
          user: { select: { id: true, name: true, email: true, image: true, phone: true } },
          payments: true,
          refunds: true,
        },
      },
      reportedBy: { select: { id: true, name: true, email: true, image: true, role: true } },
    },
  });

  if (!incident) throw AppError.notFound(`Dispute case ${disputeId} not found`);

  const meta = (incident.metadata as Record<string, any>) || {};

  return {
    dispute: {
      id: incident.id,
      caseReference: meta.caseReference || `DSP-${incident.id.slice(-6).toUpperCase()}`,
      category: incident.category,
      status: incident.status,
      disputeWorkflowStatus: meta.disputeStatus || (incident.status === "RESOLVED" ? "RESOLVED" : "OPEN"),
      severity: incident.severity || "MEDIUM",
      description: incident.description,
      resolutionNotes: incident.resolutionNotes,
      reportedBy: incident.reportedBy,
      reporterRole: meta.reporterRole || "GUEST",
      incidentDate: meta.incidentDate || incident.createdAt.toISOString(),
      assignedAdmin: meta.assignedAdmin || null,
      internalNotes: Array.isArray(meta.internalNotes) ? meta.internalNotes : [],
      evidence: Array.isArray(meta.evidence) ? meta.evidence.map((evidence: any) => ({
        ...evidence,
        url: evidence?.storagePath && evidence?.id
          ? `/api/v1/disputes/${incident.id}/evidence/${evidence.id}`
          : evidence?.url,
      })) : [],
      infoRequests: Array.isArray(meta.infoRequests) ? meta.infoRequests : [],
      partyResponses: Array.isArray(meta.partyResponses) ? meta.partyResponses : [],
      timeline: Array.isArray(meta.timeline) ? meta.timeline : [],
      resolution: meta.resolution || null,
      createdAt: incident.createdAt,
      updatedAt: incident.updatedAt,
      resolvedAt: incident.resolvedAt,
    },
    booking: incident.booking
      ? {
          ...incident.booking,
          listing: sanitizeListing(incident.listing),
        }
      : null,
    listing: sanitizeListing(incident.listing),
  };
}

/**
 * Assigns a dispute case to an administrative reviewer.
 */
export async function assignDispute(
  actor: AuthUser,
  disputeId: string,
  assignedToId?: string,
  assignedToEmail?: string,
): Promise<any> {
  assertRole(actor, [Role.ADMIN]);

  const incident = await prisma.listingQualityIncident.findUnique({
    where: { id: disputeId },
  });
  if (!incident) throw AppError.notFound("Dispute case not found");
  assertOpenForInvestigation(incident);

  const assignee = await prisma.user.findFirst({
    where: {
      role: Role.ADMIN,
      ...(assignedToId && assignedToEmail
        ? { id: assignedToId, email: assignedToEmail }
        : assignedToId
          ? { id: assignedToId }
          : assignedToEmail
            ? { email: assignedToEmail }
            : { id: actor.id }),
    },
    select: { id: true, email: true },
  });
  if (!assignee || !assignee.email) {
    throw AppError.badRequest("Select an active administrator as the case reviewer.");
  }

  const meta = (incident.metadata as Record<string, any>) || {};
  const now = new Date();

  const assignedAdmin = {
    id: assignee.id,
    email: assignee.email,
    assignedAt: now.toISOString(),
    assignedByEmail: actor.email,
  };

  const timeline = [
    ...(Array.isArray(meta.timeline) ? meta.timeline : []),
    {
      id: nanoid(8),
      event: "CASE_ASSIGNED",
      actorEmail: actor.email,
      title: "Case Assigned",
      description: `Dispute assigned to ${assignee.email} by ${actor.email}.`,
      timestamp: now.toISOString(),
    },
  ];

  const updated = await prisma.listingQualityIncident.update({
    where: { id: disputeId },
    data: {
      metadata: {
        ...meta,
        assignedAdmin,
        disputeStatus: meta.disputeStatus === "OPEN" ? "UNDER_INVESTIGATION" : meta.disputeStatus,
        timeline,
      },
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "DISPUTE_ASSIGNED",
    resourceType: "BOOKING",
    resourceId: incident.bookingId || incident.listingId,
    description: `Dispute ${incident.id} assigned to ${assignee.email}.`,
    status: "SUCCESS",
    metadata: { disputeId, assignedToId: assignee.id, assignedToEmail: assignee.email },
  });

  if (assignee.id !== actor.id) {
    try {
      await notificationService.create({
        userId: assignee.id,
        type: NotificationType.BOOKING,
        title: "Dispute case assigned to you",
        message: `You have been assigned ${meta.caseReference || incident.id}.`,
        entityId: incident.id,
        entityType: `dispute-assignment-${timeline.at(-1)?.id}`,
        link: disputeNotificationLink(incident.id, "ADMIN", incident.bookingId),
        metadata: { disputeId: incident.id, bookingId: incident.bookingId, assignedById: actor.id, recipientRole: "ADMIN" },
      });
    } catch (error) {
      console.warn("[dispute.service] Failed to notify assigned admin:", error);
    }
  }

  return updated;
}

/**
 * Adds an internal investigation note (strictly private to administrators).
 */
export async function addInvestigationNote(
  actor: AuthUser,
  disputeId: string,
  content: string,
): Promise<any> {
  assertRole(actor, [Role.ADMIN]);

  if (!content?.trim()) throw AppError.badRequest("Note content cannot be empty.");

  const incident = await prisma.listingQualityIncident.findUnique({
    where: { id: disputeId },
  });
  if (!incident) throw AppError.notFound("Dispute case not found");
  assertOpenForInvestigation(incident);

  const meta = (incident.metadata as Record<string, any>) || {};
  const now = new Date();

  const newNote = {
    id: nanoid(8),
    authorId: actor.id,
    authorEmail: actor.email,
    content: content.trim(),
    createdAt: now.toISOString(),
  };

  const internalNotes = [...(Array.isArray(meta.internalNotes) ? meta.internalNotes : []), newNote];
  const timeline = [
    ...(Array.isArray(meta.timeline) ? meta.timeline : []),
    {
      id: nanoid(8),
      event: "INTERNAL_NOTE_ADDED",
      actorEmail: actor.email,
      title: "Internal Note Added",
      description: "An administrator added an internal investigation note.",
      timestamp: now.toISOString(),
    },
  ];

  const updated = await prisma.listingQualityIncident.update({
    where: { id: disputeId },
    data: {
      metadata: {
        ...meta,
        internalNotes,
        timeline,
      },
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "DISPUTE_NOTE_ADDED",
    resourceType: "BOOKING",
    resourceId: incident.bookingId || incident.listingId,
    description: `Internal note added to dispute ${incident.id}.`,
    status: "SUCCESS",
    metadata: { disputeId, noteId: newNote.id },
  });

  return newNote;
}

/**
 * Requests information or evidence from the guest or host.
 */
export async function requestDisputeInfo(
  actor: AuthUser,
  disputeId: string,
  target: "GUEST" | "HOST",
  message: string,
): Promise<any> {
  assertRole(actor, [Role.ADMIN]);

  if (target !== "GUEST" && target !== "HOST") {
    throw AppError.badRequest("Information requests must target the guest or host.");
  }
  if (!message?.trim()) throw AppError.badRequest("Request message cannot be empty.");
  if (message.trim().length > 4_000) throw AppError.badRequest("Request instructions must be 4,000 characters or fewer.");

  const incident = await prisma.listingQualityIncident.findUnique({
    where: { id: disputeId },
    include: {
      booking: {
        select: {
          id: true,
          userId: true,
          listing: {
            select: {
              hostId: true,
              title: true,
              host: { select: { id: true, role: true, status: true } },
            },
          },
        },
      },
    },
  });
  if (!incident) throw AppError.notFound("Dispute case not found");
  assertOpenForInvestigation(incident);

  const meta = (incident.metadata as Record<string, any>) || {};
  const now = new Date();

  if (target === "HOST") {
    const host = incident.booking?.listing.host;
    if (!host || host.id !== incident.booking.listing.hostId || host.role !== Role.HOST || host.status !== UserStatus.ACTIVE) {
      throw AppError.conflict("The booking does not have an eligible active host to request a response from.");
    }
    if (Array.isArray(meta.infoRequests) && meta.infoRequests.some(
      (request: any) => request?.target === "HOST" && request?.status === "PENDING_RESPONSE",
    )) {
      throw AppError.conflict("A host response is already pending for this case.");
    }
  }

  const newRequest = {
    id: nanoid(8),
    target,
    requestedById: actor.id,
    requestedByEmail: actor.email,
    message: message.trim(),
    status: "PENDING_RESPONSE",
    createdAt: now.toISOString(),
  };

  const infoRequests = [...(Array.isArray(meta.infoRequests) ? meta.infoRequests : []), newRequest];
  const timeline = [
    ...(Array.isArray(meta.timeline) ? meta.timeline : []),
    {
      id: nanoid(8),
      event: "INFO_REQUESTED",
      target,
      actorEmail: actor.email,
      title: `Information Requested from ${target}`,
      description: `Administrator requested information: "${message.trim().slice(0, 100)}"`,
      timestamp: now.toISOString(),
    },
  ];

  const updated = await prisma.listingQualityIncident.update({
    where: { id: disputeId },
    data: {
      metadata: {
        ...meta,
        disputeStatus: "AWAITING_INFO",
        ...(target === "HOST"
          ? {
              hostParticipation: {
                hostId: incident.booking!.listing.hostId,
                requestedById: actor.id,
                requestedAt: now.toISOString(),
                requestId: newRequest.id,
              },
            }
          : {}),
        infoRequests,
        timeline,
      },
    },
  });

  // Send Notification to recipient if booking is attached
  if (incident.booking) {
    const recipientUserId = target === "GUEST" ? incident.booking.userId : incident.booking.listing.hostId;
    try {
      await notificationService.create({
        userId: recipientUserId,
        type: NotificationType.BOOKING,
        title: target === "HOST" ? "Response Required — Dispute" : "Information Requested — Dispute",
        message: target === "HOST"
          ? "An Admin has requested your response regarding a booking dispute."
          : `Homyz Support has requested details regarding your reservation at ${incident.booking.listing.title}: "${message.trim().slice(0, 120)}"`,
        entityId: incident.id,
        entityType: target === "HOST" ? `dispute-host-response-required-${newRequest.id}` : `dispute-guest-info-request-${newRequest.id}`,
        link: disputeNotificationLink(incident.id, target, incident.booking.id),
        metadata: { disputeId: incident.id, bookingId: incident.booking.id, requestId: newRequest.id, target, recipientRole: target },
      });
    } catch (err) {
      console.warn("[dispute.service] Failed to send info request notification:", err);
    }
  }

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "DISPUTE_INFO_REQUESTED",
    resourceType: "BOOKING",
    resourceId: incident.bookingId || incident.listingId,
    description: `Information requested from ${target} for dispute ${incident.id}.`,
    status: "SUCCESS",
    metadata: { disputeId, requestId: newRequest.id, target },
  });

  return newRequest;
}

/**
 * Resolves a dispute case with decision category, explanation, and optional linked refund.
 */
export async function resolveDispute(
  actor: AuthUser,
  disputeId: string,
  resolution: ResolveDisputeInput,
): Promise<any> {
  assertRole(actor, [Role.ADMIN]);

  const { decisionCategory, explanation, refundRequestId, financialAdjustmentNote } = resolution;
  if (!explanation?.trim()) throw AppError.badRequest("A resolution explanation is required.");
  if (!DISPUTE_DECISION_CATEGORIES.has(decisionCategory)) {
    throw AppError.badRequest("Unsupported resolution decision.");
  }

  const incident = await prisma.listingQualityIncident.findUnique({
    where: { id: disputeId },
    include: { booking: { select: { id: true, userId: true, listing: { select: { hostId: true, title: true } } } } },
  });
  if (!incident) throw AppError.notFound("Dispute case not found");
  assertOpenForInvestigation(incident);
  if (incident.status === QualityIncidentStatus.RESOLVED) {
    throw AppError.conflict("This dispute is already resolved.");
  }

  if (refundRequestId) {
    const refund = await prisma.bookingRefund.findFirst({
      where: { id: refundRequestId, bookingId: incident.bookingId || undefined },
      select: { id: true },
    });
    if (!refund) throw AppError.badRequest("The linked refund must belong to this dispute's booking.");
  }

  const meta = (incident.metadata as Record<string, any>) || {};
  const now = new Date();

  const resolutionRecord = {
    decisionCategory,
    explanation: explanation.trim(),
    refundRequestId: refundRequestId || null,
    financialAdjustmentNote: financialAdjustmentNote?.trim() || null,
    resolvedById: actor.id,
    resolvedByEmail: actor.email,
    resolvedAt: now.toISOString(),
  };

  const timeline = [
    ...(Array.isArray(meta.timeline) ? meta.timeline : []),
    {
      id: nanoid(8),
      event: "CASE_RESOLVED",
      actorEmail: actor.email,
      title: "Case Resolved",
      description: `Dispute resolved under category "${decisionCategory}": "${explanation.trim().slice(0, 120)}"`,
      timestamp: now.toISOString(),
    },
  ];

  const updated = await prisma.listingQualityIncident.update({
    where: { id: disputeId },
    data: {
      status: QualityIncidentStatus.RESOLVED,
      resolutionNotes: explanation.trim(),
      resolvedAt: now,
      metadata: {
        ...meta,
        disputeStatus: "RESOLVED",
        resolution: resolutionRecord,
        timeline,
      },
    },
  });

  // Audit Log
  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "DISPUTE_RESOLVED",
    resourceType: "BOOKING",
    resourceId: incident.bookingId || incident.listingId,
    description: `Dispute ${incident.id} resolved by ${actor.email}: "${decisionCategory}".`,
    status: "SUCCESS",
    metadata: {
      disputeId,
      decisionCategory,
      refundRequestId,
    },
  });

  if (incident.booking) {
    const recipients = [
      { userId: incident.booking.userId, role: "GUEST" as const },
      { userId: incident.booking.listing.hostId, role: "HOST" as const },
    ];
    await Promise.all(recipients.map(async (recipient) => {
      try {
        await notificationService.create({
          userId: recipient.userId,
          type: NotificationType.BOOKING,
          title: "Dispute case resolved",
          message: `A decision is available for the dispute concerning ${incident.booking!.listing.title}.`,
          entityId: incident.id,
          entityType: `dispute-resolution-${recipient.role.toLowerCase()}`,
          link: disputeNotificationLink(incident.id, recipient.role, incident.booking!.id),
          metadata: { disputeId: incident.id, bookingId: incident.booking!.id, recipientRole: recipient.role },
        });
      } catch (err) {
        console.warn("[dispute.service] Failed to send dispute resolution notification:", err);
      }
    }));
  }

  return updated;
}

/**
 * Closes a dispute case after review.
 */
export async function closeDispute(
  actor: AuthUser,
  disputeId: string,
  closingNotes?: string,
): Promise<any> {
  assertRole(actor, [Role.ADMIN]);

  const incident = await prisma.listingQualityIncident.findUnique({
    where: { id: disputeId },
    include: { booking: { select: { id: true, userId: true, listing: { select: { hostId: true, title: true } } } } },
  });
  if (!incident) throw AppError.notFound("Dispute case not found");
  const meta = (incident.metadata as Record<string, any>) || {};
  if (meta.disputeStatus === "CLOSED") {
    throw AppError.conflict("This dispute is already closed.");
  }
  if (incident.status !== QualityIncidentStatus.RESOLVED) {
    throw AppError.conflict("Only resolved dispute cases can be closed.");
  }

  const now = new Date();

  const timeline = [
    ...(Array.isArray(meta.timeline) ? meta.timeline : []),
    {
      id: nanoid(8),
      event: "CASE_CLOSED",
      actorEmail: actor.email,
      title: "Case Closed",
      description: `Dispute case closed: ${closingNotes || "Administrative closure without further action."}`,
      timestamp: now.toISOString(),
    },
  ];

  const updated = await prisma.listingQualityIncident.update({
    where: { id: disputeId },
    data: {
      status: incident.status === "RESOLVED" ? QualityIncidentStatus.RESOLVED : QualityIncidentStatus.REJECTED,
      metadata: {
        ...meta,
        disputeStatus: "CLOSED",
        closingNotes: closingNotes || null,
        closedAt: now.toISOString(),
        timeline,
      },
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "DISPUTE_CLOSED",
    resourceType: "BOOKING",
    resourceId: incident.bookingId || incident.listingId,
    description: `Dispute ${incident.id} closed by ${actor.email}.`,
    status: "SUCCESS",
    metadata: { disputeId },
  });

  if (incident.booking) {
    await Promise.all([
      { userId: incident.booking.userId, recipient: "GUEST" as const },
      { userId: incident.booking.listing.hostId, recipient: "HOST" as const },
    ].map(async ({ userId, recipient }) => {
      try {
        await notificationService.create({
          userId,
          type: NotificationType.BOOKING,
          title: "Dispute case closed",
          message: `The dispute concerning ${incident.booking!.listing.title} has been closed.`,
          entityId: incident.id,
          entityType: `dispute-closed-${recipient.toLowerCase()}`,
          link: disputeNotificationLink(incident.id, recipient, incident.booking!.id),
          metadata: { disputeId: incident.id, bookingId: incident.booking!.id, recipientRole: recipient },
        });
      } catch (error) {
        console.warn("[dispute.service] Failed to notify participant about dispute closure:", error);
      }
    }));
  }

  return updated;
}

/** Host-scoped case list. It deliberately selects no guest contact or admin-only data. */
export async function listDisputesForHost(actor: AuthUser, query: HostDisputeListQuery) {
  assertRole(actor, [Role.HOST]);

  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
  const where: any = hostCaseWhere(actor.id);
  const conditions: any[] = [];

  if (query.bookingId) where.bookingId = query.bookingId;
  if (query.propertyId) where.listingId = query.propertyId;
  if (query.status && query.status !== "ALL") where.status = query.status as QualityIncidentStatus;
  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) where.createdAt.gte = parseFilterDate(query.startDate);
    if (query.endDate) where.createdAt.lte = parseFilterDate(query.endDate, true);
  }

  switch (query.tab) {
    case "response_required":
      conditions.push(hostResponseRequiredWhere());
      break;
    case "open":
      where.status = { in: OPEN_INCIDENT_STATUSES };
      conditions.push(metadataPathNotEquals(["disputeStatus"], "CLOSED"));
      break;
    case "resolved":
      conditions.push({ OR: [
        { status: QualityIncidentStatus.RESOLVED },
        metadataPathEquals(["disputeStatus"], "CLOSED"),
      ] });
      break;
  }

  if (query.search?.trim()) {
    const term = query.search.trim();
    conditions.push({ OR: [
      { id: { contains: term, mode: "insensitive" } },
      { bookingId: { contains: term, mode: "insensitive" } },
      metadataPathEquals(["caseReference"], term.toUpperCase()),
      { listing: { title: { contains: term, mode: "insensitive" } } },
    ] });
  }
  if (conditions.length) where.AND = conditions;

  const select = {
    id: true,
    bookingId: true,
    listingId: true,
    category: true,
    status: true,
    severity: true,
    metadata: true,
    createdAt: true,
    updatedAt: true,
    resolvedAt: true,
    listing: { select: { id: true, title: true, photos: true, city: true, country: true } },
    booking: { select: { id: true, startDate: true, endDate: true, status: true, totalPrice: true, currency: true } },
  } as const;

  const [incidents, total, responseRequired, underReview, resolved] = await Promise.all([
    prisma.listingQualityIncident.findMany({
      where,
      select,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.listingQualityIncident.count({ where }),
    prisma.listingQualityIncident.count({
      where: {
        ...hostCaseVisibilityWhere(actor.id),
        status: { in: OPEN_INCIDENT_STATUSES },
        AND: [
          hostResponseRequiredWhere(),
          metadataPathNotEquals(["disputeStatus"], "CLOSED"),
          metadataPathNotEquals(["disputeStatus"], "RESOLVED"),
        ],
      } as any,
    }),
    prisma.listingQualityIncident.count({
      where: { ...hostCaseVisibilityWhere(actor.id), status: { in: OPEN_INCIDENT_STATUSES }, AND: [metadataPathNotEquals(["disputeStatus"], "CLOSED")] } as any,
    }),
    prisma.listingQualityIncident.count({
      where: {
        ...hostCaseVisibilityWhere(actor.id),
        AND: [{ OR: [{ status: QualityIncidentStatus.RESOLVED }, metadataPathEquals(["disputeStatus"], "CLOSED")] }],
      } as any,
    }),
  ]);

  return {
    disputes: incidents.map((incident: any) => {
      const metadata = (incident.metadata as Record<string, any>) || {};
      return {
        id: incident.id,
        caseReference: metadata.caseReference || `DSP-${incident.id.slice(-6).toUpperCase()}`,
        category: incident.category,
        status: incident.status,
        disputeWorkflowStatus: metadata.disputeStatus || (incident.status === "RESOLVED" ? "RESOLVED" : "OPEN"),
        severity: incident.severity || "MEDIUM",
        responseRequired: isHostResponseRequired(metadata, incident.status),
        reporterRole: metadata.reporterRole || "GUEST",
        booking: incident.booking,
        listing: incident.listing,
        createdAt: incident.createdAt,
        updatedAt: incident.updatedAt,
        resolvedAt: incident.resolvedAt,
      };
    }),
    summary: { totalCases: total, responseRequired, underReview, resolved },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/** Returns a deliberately host-safe view of a case owned by the current host. */
export async function getDisputeDetailsForHost(actor: AuthUser, disputeId: string) {
  assertRole(actor, [Role.HOST]);
  const incident = await prisma.listingQualityIncident.findFirst({
    where: hostCaseWhere(actor.id, disputeId),
    select: {
      id: true,
      reportedById: true,
      bookingId: true,
      category: true,
      status: true,
      severity: true,
      description: true,
      resolutionNotes: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
      listing: { select: { id: true, title: true, city: true, country: true } },
      booking: {
        select: {
          id: true,
          status: true,
          startDate: true,
          endDate: true,
          guests: true,
          totalPrice: true,
          currency: true,
          user: {
            select: {
              id: true,
              name: true,
              image: true,
            },
          },
        },
      },
    },
  });
  if (!incident) throw AppError.notFound("Dispute case not found");

  const metadata = (incident.metadata as Record<string, any>) || {};
  const hostEvidence = (Array.isArray(metadata.evidence) ? metadata.evidence : [])
    .filter((evidence: any) => evidence?.uploadedById === actor.id && evidence?.id && evidence?.storagePath)
    .map((evidence: any) => ({
      id: evidence.id,
      fileName: evidence.fileName || "Evidence file",
      mimeType: evidence.mimeType || "application/octet-stream",
      createdAt: evidence.createdAt,
      url: `/api/v1/disputes/${incident.id}/evidence/${evidence.id}`,
    }));
  const infoRequests = (Array.isArray(metadata.infoRequests) ? metadata.infoRequests : [])
    .filter((request: any) => request?.target === "HOST")
    .map((request: any) => ({ id: request.id, message: request.message, status: request.status, createdAt: request.createdAt, respondedAt: request.respondedAt || null }));
  const timeline = (Array.isArray(metadata.timeline) ? metadata.timeline : [])
    .filter((event: any) => HOST_VISIBLE_TIMELINE_EVENTS.has(event?.event))
    .filter((event: any) => event.event !== "INFO_REQUESTED" || event.target === "HOST" || /HOST/i.test(event.title || ""))
    .map((event: any) => ({ id: event.id, event: event.event, title: event.title, description: event.description, timestamp: event.timestamp }));
  const replies = (Array.isArray(metadata.partyResponses) ? metadata.partyResponses : [])
    .filter((response: any) => response?.submittedById === actor.id)
    .map((response: any) => ({
      id: response.id,
      content: response.content || null,
      audience: response.audience === "ADMIN_ONLY" ? "ADMIN_ONLY" : "CASE_PARTICIPANTS",
      createdAt: response.createdAt,
      evidenceIds: Array.isArray(response.evidenceIds) ? response.evidenceIds : [],
    }));
  const privateNotes = (Array.isArray(metadata.hostPrivateNotes) ? metadata.hostPrivateNotes : [])
    .filter((note: HostPrivateNote) => note?.hostId === actor.id)
    .map((note: HostPrivateNote) => ({ id: note.id, content: note.content, createdAt: note.createdAt, updatedAt: note.updatedAt }));
  const resolutionProposals = (Array.isArray(metadata.resolutionProposals) ? metadata.resolutionProposals : [])
    .filter((p: any) => p?.hostId === actor.id)
    .map((p: any) => ({
      id: p.id,
      proposalType: p.proposalType,
      explanation: p.explanation,
      status: p.status,
      createdAt: p.createdAt,
      evidenceIds: Array.isArray(p.evidenceIds) ? p.evidenceIds : [],
    }));

  return {
    dispute: {
      id: incident.id,
      caseReference: metadata.caseReference || `DSP-${incident.id.slice(-6).toUpperCase()}`,
      category: incident.category,
      status: incident.status,
      disputeWorkflowStatus: metadata.disputeStatus || (incident.status === "RESOLVED" ? "RESOLVED" : "OPEN"),
      severity: incident.severity || "MEDIUM",
      description: incident.description,
      resolutionNotes: incident.resolutionNotes,
      createdAt: incident.createdAt,
      updatedAt: incident.updatedAt,
      resolvedAt: incident.resolvedAt,
      responseRequired: isHostResponseRequired(metadata, incident.status),
      reporterRole: metadata.reporterRole || "GUEST",
      isReporter: incident.reportedById === actor.id || metadata.reporterRole === "HOST",
      hasAssignedReviewer: Boolean(metadata.assignedAdmin),
      resolution: metadata.resolution ? {
        decisionCategory: metadata.resolution.decisionCategory,
        explanation: metadata.resolution.explanation,
        resolvedAt: metadata.resolution.resolvedAt,
        resolvedByEmail: metadata.resolution.resolvedByEmail,
        refundRequestId: metadata.resolution.refundRequestId,
      } : null,
      resolutionProposals,
      infoRequests,
      timeline,
      evidence: hostEvidence,
      replies,
      privateNotes,
      closed: isClosedDispute(incident),
    },
    booking: incident.booking,
    listing: incident.listing,
  };
}

function validateEvidence(file: UploadedEvidenceInput) {
  const maxSize = 15 * 1024 * 1024;
  const allowed = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf"]);
  if (!file.buffer?.length) throw AppError.badRequest("Evidence file cannot be empty.");
  if (file.buffer.length > maxSize) throw AppError.badRequest("Evidence files must be 15MB or smaller.");
  const extension = path.extname(file.fileName).toLowerCase();
  if (!allowed.has(extension)) throw AppError.badRequest("Evidence must be a JPG, PNG, WEBP image, or PDF document.");
  const isJpeg = file.buffer.length >= 3 && file.buffer[0] === 0xff && file.buffer[1] === 0xd8 && file.buffer[2] === 0xff;
  const isPng = file.buffer.length >= 8 && file.buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = file.buffer.length >= 12 && file.buffer.toString("ascii", 0, 4) === "RIFF" && file.buffer.toString("ascii", 8, 12) === "WEBP";
  const isPdf = file.buffer.length >= 5 && file.buffer.toString("ascii", 0, 5) === "%PDF-";
  if (!isJpeg && !isPng && !isWebp && !isPdf) throw AppError.badRequest("Evidence file content does not match a supported format.");
  return { extension: isPdf ? ".pdf" : isWebp ? ".webp" : isPng ? ".png" : extension === ".jpeg" ? ".jpeg" : ".jpg", mimeType: isPdf ? "application/pdf" : isWebp ? "image/webp" : isPng ? "image/png" : "image/jpeg" };
}

/** Saves the single pending host response, its optional private evidence, and an auditable timeline event. */
export async function submitHostDisputeResponse(
  actor: AuthUser,
  disputeId: string,
  input: { content?: string; evidenceFiles?: UploadedEvidenceInput[] },
) {
  assertRole(actor, [Role.HOST]);
  const content = input.content?.trim() || "";
  const evidenceFiles = input.evidenceFiles || [];
  if (!content && evidenceFiles.length === 0) throw AppError.badRequest("Provide a response or at least one evidence file.");
  if (evidenceFiles.length > 5) throw AppError.badRequest("You can submit up to five evidence files at once.");

  const incident = await prisma.listingQualityIncident.findFirst({
    where: hostCaseWhere(actor.id, disputeId),
    include: { booking: { select: { id: true, listing: { select: { title: true } } } } },
  });
  if (!incident) throw AppError.notFound("Dispute case not found");
  assertOpenForInvestigation(incident);
  const metadata = (incident.metadata as Record<string, any>) || {};
  const infoRequests = Array.isArray(metadata.infoRequests) ? metadata.infoRequests : [];
  const requestIndex = infoRequests.findIndex((request: any) => request?.target === "HOST" && request?.status === "PENDING_RESPONSE");
  if (requestIndex < 0) throw AppError.conflict("There is no pending response request for this host.");

  const savedEvidence: any[] = [];
  try {
    for (const file of evidenceFiles) {
      const validated = validateEvidence(file);
      const originalBase = path.basename(file.fileName, path.extname(file.fileName)).replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 80) || "evidence";
      const stored = await savePrivateMedia({
        kind: "dispute-evidence",
        fileName: `dispute_${incident.id}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}${validated.extension}`,
        body: file.buffer,
        contentType: validated.mimeType,
      });
      savedEvidence.push({ id: nanoid(10), fileName: `${originalBase}${validated.extension}`, mimeType: validated.mimeType, storagePath: stored.storagePath, uploadedById: actor.id, createdAt: new Date().toISOString(), visibleTo: ["HOST", "ADMIN"] });
    }
  } catch (error) {
    await Promise.all(savedEvidence.map((evidence) => deletePrivateMedia({ kind: "dispute-evidence", fileName: evidence.storagePath }).catch(() => undefined)));
    throw error;
  }

  const now = new Date();
  const response = { id: nanoid(10), requestId: infoRequests[requestIndex].id, submittedById: actor.id, content: content || null, evidenceIds: savedEvidence.map((evidence) => evidence.id), audience: "ADMIN_ONLY", createdAt: now.toISOString() };
  const updatedRequests = infoRequests.map((request: any, index: number) => index === requestIndex ? { ...request, status: "RESPONDED", respondedAt: now.toISOString(), responseId: response.id } : request);
  const timeline = [...(Array.isArray(metadata.timeline) ? metadata.timeline : []), {
    id: nanoid(8), event: "HOST_RESPONSE_SUBMITTED", title: "Host Response Submitted", description: "The host submitted the requested information.", timestamp: now.toISOString(),
  }];
  const mutation = await prisma.listingQualityIncident.updateMany({
    where: {
      id: incident.id,
      status: { in: OPEN_INCIDENT_STATUSES },
      metadata: {
        path: ["infoRequests"],
        array_contains: [{ id: infoRequests[requestIndex].id, target: "HOST", status: "PENDING_RESPONSE" }],
      },
    } as any,
    data: { metadata: { ...metadata, disputeStatus: "UNDER_INVESTIGATION", infoRequests: updatedRequests, partyResponses: [...(Array.isArray(metadata.partyResponses) ? metadata.partyResponses : []), response], evidence: [...(Array.isArray(metadata.evidence) ? metadata.evidence : []), ...savedEvidence], timeline } },
  });
  if (mutation.count !== 1) {
    await Promise.all(savedEvidence.map((evidence) => deletePrivateMedia({ kind: "dispute-evidence", fileName: evidence.storagePath }).catch(() => undefined)));
    throw AppError.conflict("This response request is no longer pending.");
  }
  const updated = await prisma.listingQualityIncident.findUniqueOrThrow({ where: { id: incident.id }, select: { updatedAt: true } });

  await auditService.record({ actorId: actor.id, actorEmail: actor.email, action: "DISPUTE_HOST_RESPONSE_SUBMITTED", resourceType: "BOOKING", resourceId: incident.bookingId || incident.listingId, description: `Host response submitted for dispute ${incident.id}.`, status: "SUCCESS", metadata: { disputeId: incident.id, responseId: response.id, evidenceCount: savedEvidence.length } });
  const assignedId = metadata.assignedAdmin?.id;
  const admins = assignedId ? [{ id: assignedId }] : await prisma.user.findMany({ where: { role: Role.ADMIN }, select: { id: true }, take: 50 });
  await Promise.all(admins.map(async (admin: { id: string }) => {
    try {
      await notificationService.create({ userId: admin.id, type: NotificationType.BOOKING, title: "Host response received — Dispute", message: `A host submitted the requested information for ${metadata.caseReference || incident.id}.`, entityId: incident.id, entityType: `dispute-host-response-${response.id}`, link: disputeNotificationLink(incident.id, "ADMIN", incident.bookingId), metadata: { disputeId: incident.id, bookingId: incident.bookingId, responseId: response.id, recipientRole: "ADMIN" } });
    } catch (error) { console.warn("[dispute.service] Failed to notify admin about host response:", error); }
  }));
  return { response, evidence: savedEvidence.map(({ storagePath, ...evidence }) => evidence), updatedAt: updated.updatedAt };
}

/** Sends an official host-to-admin case reply. This is separate from an admin-request response. */
export async function sendHostDisputeReply(
  actor: AuthUser,
  disputeId: string,
  input: { content: string; evidenceFiles?: UploadedEvidenceInput[] },
) {
  assertRole(actor, [Role.HOST]);
  const content = input.content?.trim();
  const evidenceFiles = input.evidenceFiles || [];
  if (!content) throw AppError.badRequest("A reply cannot be empty.");
  if (content.length > 4_000) throw AppError.badRequest("Replies must be 4,000 characters or fewer.");
  if (evidenceFiles.length > 5) throw AppError.badRequest("You can attach up to five evidence files.");

  const incident = await prisma.listingQualityIncident.findFirst({
    where: hostCaseWhere(actor.id, disputeId),
    select: { id: true, bookingId: true, listingId: true, status: true, metadata: true },
  });
  if (!incident) throw AppError.notFound("Dispute case not found");
  assertOpenForInvestigation(incident);
  if (!OPEN_INCIDENT_STATUSES.includes(incident.status)) throw AppError.conflict("Replies can only be sent while a case is open or under review.");

  const evidence: any[] = [];
  try {
    for (const file of evidenceFiles) {
      const validated = validateEvidence(file);
      const baseName = path.basename(file.fileName, path.extname(file.fileName)).replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 80) || "evidence";
      const stored = await savePrivateMedia({
        kind: "dispute-evidence",
        fileName: `dispute_${incident.id}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}${validated.extension}`,
        body: file.buffer,
        contentType: validated.mimeType,
      });
      evidence.push({ id: nanoid(10), fileName: `${baseName}${validated.extension}`, mimeType: validated.mimeType, storagePath: stored.storagePath, uploadedById: actor.id, createdAt: new Date().toISOString(), visibleTo: ["HOST", "ADMIN"] });
    }
  } catch (error) {
    await Promise.all(evidence.map((item) => deletePrivateMedia({ kind: "dispute-evidence", fileName: item.storagePath }).catch(() => undefined)));
    throw error;
  }

  const metadata = (incident.metadata as Record<string, any>) || {};
  const now = new Date();
  const reply = {
    id: nanoid(10), submittedById: actor.id, content, evidenceIds: evidence.map((item) => item.id),
    audience: "ADMIN_ONLY", createdAt: now.toISOString(),
  };
  const timeline = [...(Array.isArray(metadata.timeline) ? metadata.timeline : []), {
    id: nanoid(8), event: "HOST_REPLY_SENT", title: "Host Reply Sent", description: "The host sent a reply to Homyz Support.", timestamp: now.toISOString(),
  }];
  const updated = await prisma.listingQualityIncident.update({
    where: { id: incident.id },
    data: { metadata: { ...metadata, partyResponses: [...(Array.isArray(metadata.partyResponses) ? metadata.partyResponses : []), reply], evidence: [...(Array.isArray(metadata.evidence) ? metadata.evidence : []), ...evidence], timeline } },
    select: { updatedAt: true },
  });

  const adminIds = metadata.assignedAdmin?.id
    ? [{ id: metadata.assignedAdmin.id }]
    : await prisma.user.findMany({ where: { role: Role.ADMIN }, select: { id: true }, take: 50 });
  await Promise.all(adminIds.map(async (admin: { id: string }) => {
    try {
      await notificationService.create({
        userId: admin.id,
        type: NotificationType.BOOKING,
        title: "Host reply received — Dispute",
        message: `A host replied to ${metadata.caseReference || incident.id}.`,
        entityId: incident.id,
        entityType: `dispute-host-reply-${reply.id}`,
        link: disputeNotificationLink(incident.id, "ADMIN", incident.bookingId),
        metadata: { disputeId: incident.id, bookingId: incident.bookingId, replyId: reply.id, audience: "ADMIN_ONLY", recipientRole: "ADMIN" },
      });
    } catch (error) { console.warn("[dispute.service] Failed to notify admin about host reply:", error); }
  }));
  return { reply, evidence: evidence.map(({ storagePath, ...item }) => item), updatedAt: updated.updatedAt };
}

async function getHostCaseForPrivateNotes(actor: AuthUser, disputeId: string) {
  assertRole(actor, [Role.HOST]);
  const incident = await prisma.listingQualityIncident.findFirst({
    where: hostCaseWhere(actor.id, disputeId),
    select: { id: true, metadata: true },
  });
  if (!incident) throw AppError.notFound("Dispute case not found");
  return incident;
}

export async function addHostDisputePrivateNote(actor: AuthUser, disputeId: string, content: string) {
  const incident = await getHostCaseForPrivateNotes(actor, disputeId);
  const trimmed = content?.trim();
  if (!trimmed) throw AppError.badRequest("A private note cannot be empty.");
  if (trimmed.length > 4_000) throw AppError.badRequest("Private notes must be 4,000 characters or fewer.");
  const metadata = (incident.metadata as Record<string, any>) || {};
  const now = new Date().toISOString();
  const note: HostPrivateNote = { id: nanoid(10), hostId: actor.id, content: trimmed, createdAt: now, updatedAt: now };
  await prisma.listingQualityIncident.update({
    where: { id: incident.id },
    data: { metadata: { ...metadata, hostPrivateNotes: [...(Array.isArray(metadata.hostPrivateNotes) ? metadata.hostPrivateNotes : []), note] } },
  });
  return note;
}

export async function updateHostDisputePrivateNote(actor: AuthUser, disputeId: string, noteId: string, content: string) {
  const incident = await getHostCaseForPrivateNotes(actor, disputeId);
  const trimmed = content?.trim();
  if (!trimmed) throw AppError.badRequest("A private note cannot be empty.");
  if (trimmed.length > 4_000) throw AppError.badRequest("Private notes must be 4,000 characters or fewer.");
  const metadata = (incident.metadata as Record<string, any>) || {};
  const notes = Array.isArray(metadata.hostPrivateNotes) ? metadata.hostPrivateNotes : [];
  const index = notes.findIndex((note: HostPrivateNote) => note?.id === noteId && note?.hostId === actor.id);
  if (index < 0) throw AppError.notFound("Private note not found");
  const note = { ...notes[index], content: trimmed, updatedAt: new Date().toISOString() } as HostPrivateNote;
  const updatedNotes = notes.map((existing: HostPrivateNote, current: number) => current === index ? note : existing);
  await prisma.listingQualityIncident.update({ where: { id: incident.id }, data: { metadata: { ...metadata, hostPrivateNotes: updatedNotes } } });
  return note;
}

export async function deleteHostDisputePrivateNote(actor: AuthUser, disputeId: string, noteId: string) {
  const incident = await getHostCaseForPrivateNotes(actor, disputeId);
  const metadata = (incident.metadata as Record<string, any>) || {};
  const notes = Array.isArray(metadata.hostPrivateNotes) ? metadata.hostPrivateNotes : [];
  const retained = notes.filter((note: HostPrivateNote) => !(note?.id === noteId && note?.hostId === actor.id));
  if (retained.length === notes.length) throw AppError.notFound("Private note not found");
  await prisma.listingQualityIncident.update({ where: { id: incident.id }, data: { metadata: { ...metadata, hostPrivateNotes: retained } } });
}

export async function getDisputeEvidenceForParticipant(actor: AuthUser, disputeId: string, evidenceId: string) {
  if (actor.role !== Role.ADMIN && actor.role !== Role.HOST) {
    throw AppError.forbidden("You do not have permission to access dispute evidence.");
  }
  const incident = await prisma.listingQualityIncident.findFirst({
    where: actor.role === Role.ADMIN
      ? { id: disputeId }
      : hostCaseWhere(actor.id, disputeId),
    select: { metadata: true },
  });
  if (!incident) throw AppError.notFound("Evidence not found");
  const evidence = ((incident.metadata as Record<string, any>)?.evidence || []).find((item: any) => item?.id === evidenceId && item?.storagePath);
  if (!evidence) throw AppError.notFound("Evidence not found");
  if (actor.role === Role.HOST && evidence.uploadedById !== actor.id) throw AppError.forbidden("You cannot access this evidence.");
  let buffer: Buffer;
  try { buffer = await readPrivateMedia("dispute-evidence", evidence.storagePath); } catch { throw AppError.notFound("Evidence file not found"); }
  return { evidence, buffer };
}

/** Proposes a resolution outcome on an active dispute case. */
export async function proposeHostDisputeResolution(
  actor: AuthUser,
  disputeId: string,
  input: {
    proposalType: string;
    explanation: string;
    evidenceFiles?: UploadedEvidenceInput[];
  },
) {
  assertRole(actor, [Role.HOST]);
  const explanation = input.explanation?.trim();
  const proposalType = input.proposalType?.trim() || "OTHER";
  const evidenceFiles = input.evidenceFiles || [];

  if (!explanation) throw AppError.badRequest("Please provide a proposal explanation.");
  if (explanation.length > 4_000) throw AppError.badRequest("Explanations must be 4,000 characters or fewer.");
  if (evidenceFiles.length > 5) throw AppError.badRequest("You can attach up to 5 evidence files.");

  const incident = await prisma.listingQualityIncident.findFirst({
    where: hostCaseWhere(actor.id, disputeId),
    select: { id: true, bookingId: true, listingId: true, status: true, metadata: true },
  });
  if (!incident) throw AppError.notFound("Dispute case not found");
  assertOpenForInvestigation(incident);

  const evidence: any[] = [];
  try {
    for (const file of evidenceFiles) {
      const validated = validateEvidence(file);
      const baseName = path.basename(file.fileName, path.extname(file.fileName)).replace(/[^a-zA-Z0-9._ -]/g, "_").slice(0, 80) || "evidence";
      const stored = await savePrivateMedia({
        kind: "dispute-evidence",
        fileName: `dispute_${incident.id}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}${validated.extension}`,
        body: file.buffer,
        contentType: validated.mimeType,
      });
      evidence.push({ id: nanoid(10), fileName: `${baseName}${validated.extension}`, mimeType: validated.mimeType, storagePath: stored.storagePath, uploadedById: actor.id, createdAt: new Date().toISOString(), visibleTo: ["HOST", "ADMIN"] });
    }
  } catch (error) {
    await Promise.all(evidence.map((item) => deletePrivateMedia({ kind: "dispute-evidence", fileName: item.storagePath }).catch(() => undefined)));
    throw error;
  }

  const metadata = (incident.metadata as Record<string, any>) || {};
  const now = new Date();
  const proposal = {
    id: nanoid(10),
    hostId: actor.id,
    proposalType,
    explanation,
    evidenceIds: evidence.map((item) => item.id),
    status: "PROPOSED",
    createdAt: now.toISOString(),
  };

  const timeline = [...(Array.isArray(metadata.timeline) ? metadata.timeline : []), {
    id: nanoid(8),
    event: "HOST_RESOLUTION_PROPOSED",
    title: "Host Proposed Resolution",
    description: `Host proposed resolution (${proposalType.replace(/_/g, " ")}): "${explanation.slice(0, 120)}"`,
    timestamp: now.toISOString(),
  }];

  await prisma.listingQualityIncident.update({
    where: { id: incident.id },
    data: {
      metadata: {
        ...metadata,
        resolutionProposals: [...(Array.isArray(metadata.resolutionProposals) ? metadata.resolutionProposals : []), proposal],
        evidence: [...(Array.isArray(metadata.evidence) ? metadata.evidence : []), ...evidence],
        timeline,
      },
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "DISPUTE_HOST_RESOLUTION_PROPOSED",
    resourceType: "BOOKING",
    resourceId: incident.bookingId || incident.listingId,
    description: `Host proposed resolution for dispute ${incident.id}.`,
    status: "SUCCESS",
    metadata: { disputeId: incident.id, proposalId: proposal.id, proposalType },
  });

  const adminIds = metadata.assignedAdmin?.id
    ? [{ id: metadata.assignedAdmin.id }]
    : await prisma.user.findMany({ where: { role: Role.ADMIN }, select: { id: true }, take: 50 });
  await Promise.all(adminIds.map(async (admin: { id: string }) => {
    try {
      await notificationService.create({
        userId: admin.id,
        type: NotificationType.BOOKING,
        title: "Host proposed resolution — Dispute",
        message: `A host submitted a resolution proposal for ${metadata.caseReference || incident.id}.`,
        entityId: incident.id,
        entityType: `dispute-resolution-proposal-${proposal.id}`,
        link: disputeNotificationLink(incident.id, "ADMIN", incident.bookingId),
        metadata: { disputeId: incident.id, bookingId: incident.bookingId, proposalId: proposal.id, recipientRole: "ADMIN" },
      });
    } catch (error) { console.warn("[dispute.service] Failed to notify admin about host proposal:", error); }
  }));

  return { proposal, evidence: evidence.map(({ storagePath, ...item }) => item) };
}

/** Allows a Host to mark their own complaint as resolved or withdraw it. */
export async function resolveOwnDisputeAsHost(
  actor: AuthUser,
  disputeId: string,
  input: {
    action: "RESOLVE" | "WITHDRAW";
    notes?: string;
  },
) {
  assertRole(actor, [Role.HOST]);
  const { action, notes } = input;
  if (action !== "RESOLVE" && action !== "WITHDRAW") {
    throw AppError.badRequest("Action must be either RESOLVE or WITHDRAW.");
  }

  const incident = await prisma.listingQualityIncident.findFirst({
    where: hostCaseWhere(actor.id, disputeId),
    include: { booking: { select: { id: true, userId: true, listing: { select: { hostId: true, title: true } } } } },
  });
  if (!incident) throw AppError.notFound("Dispute case not found");

  const metadata = (incident.metadata as Record<string, any>) || {};
  const isReporter = incident.reportedById === actor.id || metadata.reporterRole === "HOST";
  if (!isReporter) {
    throw AppError.forbidden("You can only resolve or withdraw dispute complaints you originally created.");
  }
  assertOpenForInvestigation(incident);

  const now = new Date();
  const resolutionNotes = notes?.trim() || (action === "RESOLVE" ? "Host marked issue as resolved." : "Host withdrew complaint.");
  const event = action === "RESOLVE" ? "HOST_COMPLAINT_RESOLVED" : "HOST_COMPLAINT_WITHDRAWN";
  const title = action === "RESOLVE" ? "Host Resolved Own Complaint" : "Host Withdrew Complaint";

  const timeline = [...(Array.isArray(metadata.timeline) ? metadata.timeline : []), {
    id: nanoid(8),
    event,
    title,
    description: resolutionNotes,
    timestamp: now.toISOString(),
  }];

  const resolutionRecord = {
    decisionCategory: action === "RESOLVE" ? "RESOLVED_BY_HOST" : "WITHDRAWN_BY_HOST",
    explanation: resolutionNotes,
    resolvedById: actor.id,
    resolvedByEmail: actor.email,
    resolvedAt: now.toISOString(),
  };

  const updated = await prisma.listingQualityIncident.update({
    where: { id: incident.id },
    data: {
      status: QualityIncidentStatus.RESOLVED,
      resolutionNotes,
      resolvedAt: now,
      metadata: {
        ...metadata,
        disputeStatus: action === "RESOLVE" ? "RESOLVED" : "CLOSED",
        resolution: resolutionRecord,
        timeline,
      },
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: `DISPUTE_${event}`,
    resourceType: "BOOKING",
    resourceId: incident.bookingId || incident.listingId,
    description: `Dispute ${incident.id} ${action.toLowerCase()}d by host ${actor.email}.`,
    status: "SUCCESS",
    metadata: { disputeId: incident.id, action },
  });

  if (incident.booking) {
    try {
      await notificationService.create({
        userId: incident.booking.userId,
        type: NotificationType.BOOKING,
        title: action === "RESOLVE" ? "Host resolved dispute complaint" : "Host withdrew dispute complaint",
        message: `The host ${action === "RESOLVE" ? "resolved" : "withdrew"} their complaint regarding ${incident.booking.listing.title}.`,
        entityId: incident.id,
        entityType: `dispute-${event.toLowerCase()}`,
        link: disputeNotificationLink(incident.id, "GUEST", incident.booking.id),
        metadata: { disputeId: incident.id, bookingId: incident.booking.id, recipientRole: "GUEST" },
      });
    } catch (err) {
      console.warn("[dispute.service] Failed to notify guest about host resolution:", err);
    }
  }

  return updated;
}

export const disputeService = {
  getDisputeSummaryForAdmin,
  listDisputesForAdmin,
  createDispute,
  getDisputeDetailsForAdmin,
  assignDispute,
  addInvestigationNote,
  requestDisputeInfo,
  resolveDispute,
  closeDispute,
  listDisputesForHost,
  getDisputeDetailsForHost,
  submitHostDisputeResponse,
  sendHostDisputeReply,
  addHostDisputePrivateNote,
  updateHostDisputePrivateNote,
  deleteHostDisputePrivateNote,
  getDisputeEvidenceForParticipant,
  proposeHostDisputeResolution,
  resolveOwnDisputeAsHost,
};
