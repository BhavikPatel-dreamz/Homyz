import "server-only";

import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import {
  Role,
  QualityIncidentCategory,
  QualityIncidentSeverity,
  QualityIncidentStatus,
  NotificationType,
} from "@/generated/prisma/enums";
import type { AuthUser } from "@/lib/auth/types";
import { assertRole } from "@/lib/permissions/authorize";
import { auditService } from "@/services/audit.service";
import { notificationService } from "@/services/notification.service";
import { nanoid } from "nanoid";

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
    resolvedCases,
    rejectedCases,
    criticalOrHighCount,
  ] = await Promise.all([
    prisma.listingQualityIncident.count(),
    prisma.listingQualityIncident.count({ where: { status: QualityIncidentStatus.PENDING } }),
    prisma.listingQualityIncident.count({ where: { status: QualityIncidentStatus.RESOLVED } }),
    prisma.listingQualityIncident.count({ where: { status: QualityIncidentStatus.REJECTED } }),
    prisma.listingQualityIncident.count({
      where: {
        severity: { in: [QualityIncidentSeverity.HIGH, QualityIncidentSeverity.CRITICAL] },
        status: { in: [QualityIncidentStatus.PENDING, QualityIncidentStatus.CONFIRMED] },
      },
    }),
  ]);

  const openCases = await prisma.listingQualityIncident.count({
    where: { status: { in: [QualityIncidentStatus.PENDING, QualityIncidentStatus.CONFIRMED] } },
  });

  // Calculate sub-statuses from recent open incidents metadata
  const openIncidents = await prisma.listingQualityIncident.findMany({
    where: { status: { in: [QualityIncidentStatus.PENDING, QualityIncidentStatus.CONFIRMED] } },
    select: { metadata: true, createdAt: true },
    take: 500,
  });

  let underInvestigationCount = 0;
  let awaitingInfoCount = 0;
  let oldUnresolvedCount = 0;
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  for (const inc of openIncidents) {
    const meta = (inc.metadata as Record<string, any>) || {};
    if (meta.disputeStatus === "UNDER_INVESTIGATION") underInvestigationCount++;
    if (meta.disputeStatus === "AWAITING_INFO") awaitingInfoCount++;
    if (inc.createdAt < sevenDaysAgo) oldUnresolvedCount++;
  }

  return {
    totalCases,
    newCases,
    openCases,
    underInvestigationCount,
    awaitingInfoCount,
    resolvedCases,
    closedCases: rejectedCases,
    attentionCases: criticalOrHighCount + oldUnresolvedCount,
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

  // Status Tab filtering
  if (query.tab && query.tab !== "all") {
    switch (query.tab) {
      case "new":
        where.status = QualityIncidentStatus.PENDING;
        break;
      case "open":
        where.status = { in: [QualityIncidentStatus.PENDING, QualityIncidentStatus.CONFIRMED] };
        break;
      case "resolved":
        where.status = QualityIncidentStatus.RESOLVED;
        break;
      case "closed":
        where.status = QualityIncidentStatus.REJECTED;
        break;
      case "attention":
        where.OR = [
          { severity: { in: [QualityIncidentSeverity.HIGH, QualityIncidentSeverity.CRITICAL] } },
          {
            status: { in: [QualityIncidentStatus.PENDING, QualityIncidentStatus.CONFIRMED] },
            createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        ];
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

  // Date range filter
  if (query.startDate || query.endDate) {
    where.createdAt = {};
    if (query.startDate) where.createdAt.gte = new Date(query.startDate);
    if (query.endDate) where.createdAt.lte = new Date(query.endDate);
  }

  // Search filter
  if (query.search?.trim()) {
    const term = query.search.trim();
    where.OR = [
      { id: { contains: term, mode: "insensitive" } },
      { bookingId: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
      { listing: { title: { contains: term, mode: "insensitive" } } },
      { reportedBy: { name: { contains: term, mode: "insensitive" } } },
      { reportedBy: { email: { contains: term, mode: "insensitive" } } },
      { booking: { user: { name: { contains: term, mode: "insensitive" } } } },
      { booking: { listing: { host: { name: { contains: term, mode: "insensitive" } } } } },
    ];
  }

  const orderBy: any = {};
  const sortField = query.sortBy || "createdAt";
  const sortDir = query.sortOrder || "desc";
  orderBy[sortField] = sortDir;

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
      evidence: Array.isArray(meta.evidence) ? meta.evidence : [],
      infoRequests: Array.isArray(meta.infoRequests) ? meta.infoRequests : [],
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
  assignedToId: string,
  assignedToEmail: string,
): Promise<any> {
  assertRole(actor, [Role.ADMIN]);

  const incident = await prisma.listingQualityIncident.findUnique({
    where: { id: disputeId },
  });
  if (!incident) throw AppError.notFound("Dispute case not found");

  const meta = (incident.metadata as Record<string, any>) || {};
  const now = new Date();

  const assignedAdmin = {
    id: assignedToId,
    email: assignedToEmail,
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
      description: `Dispute assigned to ${assignedToEmail} by ${actor.email}.`,
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
    description: `Dispute ${incident.id} assigned to ${assignedToEmail}.`,
    status: "SUCCESS",
    metadata: { disputeId, assignedToId, assignedToEmail },
  });

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

  const updated = await prisma.listingQualityIncident.update({
    where: { id: disputeId },
    data: {
      metadata: {
        ...meta,
        internalNotes,
      },
    },
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

  if (!message?.trim()) throw AppError.badRequest("Request message cannot be empty.");

  const incident = await prisma.listingQualityIncident.findUnique({
    where: { id: disputeId },
    include: {
      booking: { select: { id: true, userId: true, listing: { select: { hostId: true, title: true } } } },
    },
  });
  if (!incident) throw AppError.notFound("Dispute case not found");

  const meta = (incident.metadata as Record<string, any>) || {};
  const now = new Date();

  const newRequest = {
    id: nanoid(8),
    target,
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
        title: `Information Requested: Dispute Case`,
        message: `Homyz Support has requested details regarding your reservation at ${incident.booking.listing.title}: "${message.trim().slice(0, 120)}"`,
        entityId: incident.booking.id,
        entityType: "booking",
        link: "/profile/tab/past",
      });
    } catch (err) {
      console.warn("[dispute.service] Failed to send info request notification:", err);
    }
  }

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

  const incident = await prisma.listingQualityIncident.findUnique({
    where: { id: disputeId },
    include: { booking: { select: { id: true, userId: true, listing: { select: { hostId: true, title: true } } } } },
  });
  if (!incident) throw AppError.notFound("Dispute case not found");

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
  });
  if (!incident) throw AppError.notFound("Dispute case not found");

  const meta = (incident.metadata as Record<string, any>) || {};
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
};

