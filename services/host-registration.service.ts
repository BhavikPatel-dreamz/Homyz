import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import type { AuthUser } from "@/lib/auth/types";
import { auditService } from "./audit.service";
import { Role } from "@/generated/prisma/enums";
import {
  sendHostDocumentActionEmail,
  sendHostActionInfoRequestEmail,
  sendHostApplicationApprovalEmail,
  sendHostApplicationRejectionEmail,
} from "@/lib/services/email";
import { invalidateAdminDashboardCache, invalidateUserCache } from "@/lib/redis/invalidation";


export type HostRegistrationStatusType =
  | "PENDING"
  | "IN_REVIEW"
  | "WAITING_FOR_DOCUMENTS"
  | "DOCUMENTS_UNDER_REVIEW"
  | "APPROVED"
  | "REJECTED";

export type HostDocumentStatusType = "PENDING" | "VERIFIED" | "REJECTED" | "EXPIRED";

export interface ListHostRegistrationRequestsInput {
  search?: string;
  status?: HostRegistrationStatusType | "ALL";
  reviewerId?: string | "ALL" | "UNASSIGNED";
  onboardingStage?: string | "ALL";
  dateRange?: "LAST_7_DAYS" | "LAST_30_DAYS" | "LAST_90_DAYS" | "THIS_YEAR" | "ALL";
  sortBy?: "createdAt" | "updatedAt" | "applicantName" | "applicationId";
  sortOrder?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

export interface HostRegistrationItem {
  id: string;
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  registrationType: string;
  businessName: string | null;
  propertyCount: number;
  location: string | null;
  notes: string | null;
  status: HostRegistrationStatusType;
  onboardingStage: string;
  assignedReviewer: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  assignedAt: Date | string | null;
  reviewedBy: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  reviewStartedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface HostDocumentItem {
  id: string;
  requestId: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  mimeType: string | null;
  fileSize: number | null;
  status: HostDocumentStatusType;
  uploadedAt: Date | string;
  expiryDate: Date | string | null;
  verifiedBy: { id: string; name: string | null; email: string | null } | null;
  verifiedAt: Date | string | null;
  rejectedBy: { id: string; name: string | null; email: string | null } | null;
  rejectedAt: Date | string | null;
  rejectionReason: string | null;
  resubmissionRequested: boolean;
  resubmissionInstructions: string | null;
  resubmissionRequestedAt: Date | string | null;
  version: number;
}

export interface ReviewNoteItem {
  id: string;
  requestId: string;
  authorId: string;
  authorEmail: string;
  authorName: string | null;
  content: string;
  isInternal: boolean;
  createdAt: Date | string;
}

export interface DocumentSummary {
  required: number;
  verified: number;
  pending: number;
  rejected: number;
  missing: number;
}

export interface HostRegistrationDetailsData extends HostRegistrationItem {
  hostUser?: {
    id: string;
    name: string | null;
    email: string | null;
    createdAt: Date | string;
  } | null;
  documents: HostDocumentItem[];
  reviewNotes: ReviewNoteItem[];
  documentSummary: DocumentSummary;
  activityLogs: Array<{
    id: string;
    action: string;
    description: string;
    createdAt: Date | string;
    actorEmail: string | null;
  }>;
}

export interface HostComplianceCheckItem {
  id: string;
  requestId: string;
  checkKey: string;
  checkName: string;
  description: string | null;
  status: "PENDING" | "PASSED" | "FAILED";
  isRequired: boolean;
  notes: string | null;
  completedAt: Date | string | null;
  reviewer: { id: string; name: string | null; email: string | null } | null;
}

export interface HostComplianceIssueItem {
  id: string;
  requestId: string;
  issueType: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";
  createdAt: Date | string;
  createdBy: { id: string; name: string | null; email: string | null };
  resolvedAt: Date | string | null;
  resolvedBy?: { id: string; name: string | null; email: string | null } | null;
  resolutionNotes: string | null;
}

export interface HostInfoRequestItem {
  id: string;
  requestId: string;
  informationRequired: string;
  reason: string;
  deadline: Date | string | null;
  requestedAt: Date | string;
  requestedBy: { id: string; name: string | null; email: string | null };
  status: "PENDING" | "SUBMITTED" | "CLOSED";
}

export interface ApprovalEligibilityResult {
  eligible: boolean;
  reasons: string[];
  details: {
    applicationInfoComplete: boolean;
    documentsVerified: boolean;
    complianceChecksPassed: boolean;
    noOpenCriticalIssues: boolean;
  };
}

const db = prisma as any;

export const STANDARD_REQUIRED_DOCUMENTS = [
  "GOVERNMENT_ID",
  "PROOF_OF_ADDRESS",
  "BUSINESS_LICENSE",
  "PROPERTY_DEED",
];

export const STANDARD_REJECTION_REASONS = [
  "Invalid document",
  "Unreadable document",
  "Information mismatch",
  "Expired document",
  "Wrong document type",
];

export const STANDARD_APPLICATION_REJECTION_REASONS = [
  "Failed identity verification",
  "Invalid/incomplete information",
  "Compliance failure",
  "Required documents not provided",
  "Policy violation",
  "Other",
];

export const STANDARD_COMPLIANCE_CHECKS = [
  { key: "IDENTITY_VERIFIED", name: "Identity Verified" },
  { key: "ADDRESS_VERIFIED", name: "Address Verified" },
  { key: "REQUIRED_DOCUMENTS_VERIFIED", name: "Required Documents Verified" },
  { key: "PROPERTY_INFO_COMPLETED", name: "Property Information Completed" },
  { key: "BUSINESS_VERIFICATION", name: "Business Verification" },
  { key: "ADDITIONAL_REVIEW", name: "Additional Review" },
];

export type HostComplianceStatusType =
  | "PENDING"
  | "UNDER_REVIEW"
  | "ACTION_REQUIRED"
  | "COMPLIANT"
  | "NON_COMPLIANT";

export type ComplianceCheckStatusType = "PENDING" | "PASSED" | "FAILED";
export type ComplianceIssueSeverityType = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type ComplianceIssueStatusType = "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "REJECTED";


/**
 * Calculates summary metrics for host onboarding documents.
 */

function calculateDocumentSummary(documents: HostDocumentItem[]): DocumentSummary {
  const totalRequired = STANDARD_REQUIRED_DOCUMENTS.length;
  let verified = 0;
  let pending = 0;
  let rejected = 0;

  const presentTypes = new Set<string>();

  for (const doc of documents) {
    presentTypes.add(doc.documentType);
    if (doc.status === "VERIFIED") verified++;
    else if (doc.status === "REJECTED") rejected++;
    else if (doc.status === "PENDING") pending++;
  }

  let missing = 0;
  for (const reqType of STANDARD_REQUIRED_DOCUMENTS) {
    if (!presentTypes.has(reqType)) {
      missing++;
    }
  }

  return {
    required: totalRequired,
    verified,
    pending,
    rejected,
    missing,
  };
}

/**
 * Ensures sample registration data and documents exist for demonstration.
 */
async function ensureSampleData() {
  try {
    const count = await db.hostRegistrationRequest.count();
    if (count > 0) return;

    const samples = [
      {
        applicationId: "HR-2026-0801",
        applicantName: "Alexander Wright",
        applicantEmail: "alexander.wright@luxurystays.co",
        applicantPhone: "+1 (555) 234-5678",
        registrationType: "PROPERTY_MANAGER",
        businessName: "Wright Hospitality Group",
        propertyCount: 12,
        location: "Miami, FL, USA",
        notes: "Managing boutique luxury villas in South Beach area.",
        status: "DOCUMENTS_UNDER_REVIEW" as const,
        onboardingStage: "DOCUMENT_VERIFICATION",
      },
      {
        applicationId: "HR-2026-0802",
        applicantName: "Sophia Martinez",
        applicantEmail: "sophia.m@urbanloft.io",
        applicantPhone: "+1 (555) 876-5432",
        registrationType: "INDIVIDUAL",
        businessName: "Martinez Urban Suites",
        propertyCount: 2,
        location: "Austin, TX, USA",
        notes: "Individual host offering 2 downtown modern lofts.",
        status: "IN_REVIEW" as const,
        onboardingStage: "IN_REVIEW",
      },
      {
        applicationId: "HR-2026-0803",
        applicantName: "Marcus Vance",
        applicantEmail: "marcus.vance@alpinevillas.com",
        applicantPhone: "+1 (555) 345-6789",
        registrationType: "BUSINESS",
        businessName: "Alpine Escapes LLC",
        propertyCount: 5,
        location: "Aspen, CO, USA",
        notes: "High-end ski chalets in Aspen mountain region.",
        status: "WAITING_FOR_DOCUMENTS" as const,
        onboardingStage: "DOCUMENT_VERIFICATION",
      },
      {
        applicationId: "HR-2026-0804",
        applicantName: "Elena Rostova",
        applicantEmail: "elena.rostova@coastalliving.net",
        applicantPhone: "+1 (555) 987-6543",
        registrationType: "INDIVIDUAL",
        businessName: "Rostova Seaside Haven",
        propertyCount: 1,
        location: "Malibu, CA, USA",
        notes: "Beachfront bungalow with private ocean access.",
        status: "APPROVED" as const,
        onboardingStage: "COMPLETED",
      },
      {
        applicationId: "HR-2026-0805",
        applicantName: "David Sterling",
        applicantEmail: "david@sterlingestates.com",
        applicantPhone: "+1 (555) 456-7890",
        registrationType: "PROPERTY_MANAGER",
        businessName: "Sterling Commercial Properties",
        propertyCount: 25,
        location: "New York, NY, USA",
        notes: "Corporate executive apartment provider.",
        status: "REJECTED" as const,
        onboardingStage: "DISQUALIFIED",
      },
    ];

    for (const s of samples) {
      const created = await db.hostRegistrationRequest.create({ data: s });

      // Seed sample verification documents for the application
      const sampleDocs = [
        {
          requestId: created.id,
          documentType: "GOVERNMENT_ID",
          fileName: "passport_alexander_wright.pdf",
          fileUrl: "/sample-documents/passport.pdf",
          mimeType: "application/pdf",
          fileSize: 2450000,
          status: "VERIFIED" as const,
          uploadedAt: new Date(Date.now() - 3 * 86400000),
          expiryDate: new Date("2029-12-31"),
          verifiedAt: new Date(Date.now() - 1 * 86400000),
        },
        {
          requestId: created.id,
          documentType: "PROOF_OF_ADDRESS",
          fileName: "utility_bill_miami.pdf",
          fileUrl: "/sample-documents/utility_bill.pdf",
          mimeType: "application/pdf",
          fileSize: 1120000,
          status: "PENDING" as const,
          uploadedAt: new Date(Date.now() - 2 * 86400000),
        },
        {
          requestId: created.id,
          documentType: "BUSINESS_LICENSE",
          fileName: "florida_business_registration.pdf",
          fileUrl: "/sample-documents/business_license.pdf",
          mimeType: "application/pdf",
          fileSize: 3400000,
          status: "REJECTED" as const,
          uploadedAt: new Date(Date.now() - 4 * 86400000),
          rejectedAt: new Date(Date.now() - 1 * 86400000),
          rejectionReason: "Unreadable document",
          resubmissionRequested: true,
          resubmissionInstructions: "Please upload a high-resolution scan of Florida LLC registration.",
        },
        {
          requestId: created.id,
          documentType: "PROPERTY_DEED",
          fileName: "miami_villa_deed_ownership.pdf",
          fileUrl: "/sample-documents/property_deed.pdf",
          mimeType: "application/pdf",
          fileSize: 4500000,
          status: "PENDING" as const,
          uploadedAt: new Date(Date.now() - 1 * 86400000),
        },
      ];

      for (const doc of sampleDocs) {
        await db.hostRegistrationDocument.create({ data: doc });
      }

      // Seed initial sample review note using an existing admin user if available
      const adminUser = await db.user.findFirst({ where: { role: "ADMIN" } }) || await db.user.findFirst();
      if (adminUser) {
        await db.hostRegistrationNote.create({
          data: {
            requestId: created.id,
            authorId: adminUser.id,
            authorEmail: adminUser.email || "admin@homyz.com",
            authorName: adminUser.name || "Senior Admin Reviewer",
            content: "Initial intake completed. Verification documents uploaded and queued for review.",
            isInternal: true,
          },
        });
      }
    }
  } catch (err) {
    console.error("[HostRegistration] Error seeding sample data:", err);
  }
}

async function listRegistrationRequests(input: ListHostRegistrationRequestsInput = {}) {
  await ensureSampleData();

  const {
    search,
    status,
    reviewerId,
    onboardingStage,
    dateRange,
    sortBy = "createdAt",
    sortOrder = "desc",
    page = 1,
    pageSize = 10,
  } = input;

  const skip = (page - 1) * pageSize;
  const where: any = {};

  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { applicantName: { contains: q, mode: "insensitive" } },
      { applicantEmail: { contains: q, mode: "insensitive" } },
      { applicantPhone: { contains: q, mode: "insensitive" } },
      { applicationId: { contains: q, mode: "insensitive" } },
      { businessName: { contains: q, mode: "insensitive" } },
    ];
  }

  if (status && status !== "ALL") {
    where.status = status;
  }

  if (onboardingStage && onboardingStage !== "ALL") {
    where.onboardingStage = onboardingStage;
  }

  if (reviewerId && reviewerId !== "ALL") {
    if (reviewerId === "UNASSIGNED") {
      where.assignedReviewerId = null;
    } else {
      where.assignedReviewerId = reviewerId;
    }
  }

  if (dateRange && dateRange !== "ALL") {
    const now = new Date();
    let startDate: Date | undefined;
    if (dateRange === "LAST_7_DAYS") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (dateRange === "LAST_30_DAYS") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else if (dateRange === "LAST_90_DAYS") {
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    } else if (dateRange === "THIS_YEAR") {
      startDate = new Date(now.getFullYear(), 0, 1);
    }
    if (startDate) {
      where.createdAt = { gte: startDate };
    }
  }

  const [total, items, pendingCount, inReviewCount, approvedCount, rejectedCount] =
    await Promise.all([
      db.hostRegistrationRequest.count({ where }),
      db.hostRegistrationRequest.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortBy]: sortOrder },
        include: {
          assignedReviewer: { select: { id: true, name: true, email: true } },
          reviewedBy: { select: { id: true, name: true, email: true } },
        },
      }),
      db.hostRegistrationRequest.count({ where: { status: "PENDING" } }),
      db.hostRegistrationRequest.count({ where: { status: "IN_REVIEW" } }),
      db.hostRegistrationRequest.count({ where: { status: "APPROVED" } }),
      db.hostRegistrationRequest.count({ where: { status: "REJECTED" } }),
    ]);

  const totalAll = pendingCount + inReviewCount + approvedCount + rejectedCount;

  return {
    items: items as HostRegistrationItem[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
    statusCounts: {
      total: totalAll,
      pending: pendingCount,
      inReview: inReviewCount,
      approved: approvedCount,
      rejected: rejectedCount,
    },
  };
}

async function getRegistrationRequestById(id: string): Promise<HostRegistrationDetailsData> {
  await ensureSampleData();

  const req = await db.hostRegistrationRequest.findFirst({
    where: {
      OR: [{ id }, { applicationId: id }],
    },
    include: {
      assignedReviewer: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
      host: { select: { id: true, name: true, email: true, createdAt: true } },
      documents: {
        include: {
          verifiedBy: { select: { id: true, name: true, email: true } },
          rejectedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      reviewNotes: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!req) {
    throw AppError.notFound("Host registration request not found");
  }

  // Fetch activity history audit logs for this application
  const activityLogs = await prisma.auditLog.findMany({
    where: {
      OR: [
        { resourceId: req.id },
        { resourceId: req.applicationId },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      action: true,
      description: true,
      createdAt: true,
      actorEmail: true,
    },
  });

  const docs = (req.documents || []) as HostDocumentItem[];
  const documentSummary = calculateDocumentSummary(docs);

  return {
    ...(req as any),
    hostUser: req.host,
    documents: docs,
    reviewNotes: (req.reviewNotes || []) as ReviewNoteItem[],
    documentSummary,
    activityLogs,
  };
}

async function assignReviewer(
  actor: AuthUser,
  requestId: string,
  reviewerId: string | null
): Promise<HostRegistrationItem> {
  const req = await db.hostRegistrationRequest.findUnique({
    where: { id: requestId },
  });
  if (!req) throw AppError.notFound("Registration request not found");

  let reviewerName: string | null = null;
  if (reviewerId) {
    const reviewer = await prisma.user.findUnique({ where: { id: reviewerId } });
    if (!reviewer || (reviewer.role !== Role.ADMIN && !reviewer.adminRoleId)) {
      throw AppError.badRequest("Selected reviewer must be an active administrator");
    }
    reviewerName = reviewer.name || reviewer.email;
  }

  const updated = await db.hostRegistrationRequest.update({
    where: { id: requestId },
    data: {
      assignedReviewerId: reviewerId,
      assignedAt: reviewerId ? new Date() : null,
    },
    include: {
      assignedReviewer: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  });

  const actionText = reviewerId
    ? `Assigned reviewer ${reviewerName || reviewerId} to registration request ${req.applicationId}`
    : `Unassigned reviewer from registration request ${req.applicationId}`;

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: reviewerId ? "REVIEWER_ASSIGNED" : "REVIEWER_UNASSIGNED",
    resourceType: "HostRegistrationRequest",
    resourceId: req.id,
    description: actionText,
  });

  return updated as HostRegistrationItem;
}

async function startReview(
  actor: AuthUser,
  requestId: string
): Promise<HostRegistrationItem> {
  const req = await db.hostRegistrationRequest.findUnique({
    where: { id: requestId },
  });
  if (!req) throw AppError.notFound("Registration request not found");

  const updated = await db.hostRegistrationRequest.update({
    where: { id: requestId },
    data: {
      status: "IN_REVIEW",
      onboardingStage: "IN_REVIEW",
      reviewedById: actor.id,
      reviewStartedAt: new Date(),
    },
    include: {
      assignedReviewer: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "HOST_REGISTRATION_REVIEW_STARTED",
    resourceType: "HostRegistrationRequest",
    resourceId: req.id,
    description: `Review started by ${actor.email} for host application ${req.applicationId}`,
  });

  return updated as HostRegistrationItem;
}

async function updateRegistrationRequest(
  actor: AuthUser,
  requestId: string,
  input: {
    applicantName?: string;
    applicantEmail?: string;
    applicantPhone?: string;
    businessName?: string;
    registrationType?: string;
    propertyCount?: number;
    location?: string;
    notes?: string;
    status?: HostRegistrationStatusType;
  }
): Promise<HostRegistrationItem> {
  const req = await db.hostRegistrationRequest.findUnique({
    where: { id: requestId },
  });
  if (!req) throw AppError.notFound("Registration request not found");

  const updated = await db.hostRegistrationRequest.update({
    where: { id: requestId },
    data: {
      ...(input.applicantName !== undefined && { applicantName: input.applicantName }),
      ...(input.applicantEmail !== undefined && { applicantEmail: input.applicantEmail }),
      ...(input.applicantPhone !== undefined && { applicantPhone: input.applicantPhone }),
      ...(input.businessName !== undefined && { businessName: input.businessName }),
      ...(input.registrationType !== undefined && { registrationType: input.registrationType }),
      ...(input.propertyCount !== undefined && { propertyCount: input.propertyCount }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.status !== undefined && { status: input.status }),
    },
    include: {
      assignedReviewer: { select: { id: true, name: true, email: true } },
      reviewedBy: { select: { id: true, name: true, email: true } },
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "HOST_REGISTRATION_UPDATED",
    resourceType: "HostRegistrationRequest",
    resourceId: req.id,
    description: `Updated application details for ${req.applicationId} (${req.applicantName})`,
  });

  return updated as HostRegistrationItem;
}

/**
 * Phase 2: Verify a host document
 */
async function verifyDocument(
  actor: AuthUser,
  documentId: string
): Promise<HostDocumentItem> {
  const doc = await db.hostRegistrationDocument.findUnique({
    where: { id: documentId },
    include: { request: true },
  });

  if (!doc) {
    throw AppError.notFound("Document not found");
  }

  const updated = await db.hostRegistrationDocument.update({
    where: { id: documentId },
    data: {
      status: "VERIFIED",
      verifiedById: actor.id,
      verifiedAt: new Date(),
      rejectedById: null,
      rejectedAt: null,
      rejectionReason: null,
      resubmissionRequested: false,
    },
    include: {
      verifiedBy: { select: { id: true, name: true, email: true } },
      rejectedBy: { select: { id: true, name: true, email: true } },
    },
  });

  // Check if all documents for this request are verified
  const allDocs = await db.hostRegistrationDocument.findMany({
    where: { requestId: doc.requestId },
  });
  const summary = calculateDocumentSummary(allDocs);

  if (summary.pending === 0 && summary.rejected === 0 && summary.missing === 0) {
    await db.hostRegistrationRequest.update({
      where: { id: doc.requestId },
      data: { status: "DOCUMENTS_UNDER_REVIEW", onboardingStage: "DOCUMENT_VERIFICATION_COMPLETE" },
    });
  }

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "DOCUMENT_VERIFIED",
    resourceType: "HostRegistrationDocument",
    resourceId: doc.id,
    description: `Verified document ${doc.documentType} (${doc.fileName}) for application ${doc.request?.applicationId || doc.requestId}`,
  });

  return updated as HostDocumentItem;
}

/**
 * Phase 2: Reject a host document with required reason & trigger email notification
 */
async function rejectDocument(
  actor: AuthUser,
  documentId: string,
  reason: string
): Promise<HostDocumentItem> {
  if (!reason || !reason.trim()) {
    throw AppError.badRequest("Rejection reason is required");
  }

  const doc = await db.hostRegistrationDocument.findUnique({
    where: { id: documentId },
    include: { request: true },
  });

  if (!doc) {
    throw AppError.notFound("Document not found");
  }

  const updated = await db.hostRegistrationDocument.update({
    where: { id: documentId },
    data: {
      status: "REJECTED",
      rejectedById: actor.id,
      rejectedAt: new Date(),
      rejectionReason: reason.trim(),
      verifiedById: null,
      verifiedAt: null,
    },
    include: {
      verifiedBy: { select: { id: true, name: true, email: true } },
      rejectedBy: { select: { id: true, name: true, email: true } },
    },
  });

  // Update application status to WAITING_FOR_DOCUMENTS
  await db.hostRegistrationRequest.update({
    where: { id: doc.requestId },
    data: { status: "WAITING_FOR_DOCUMENTS", onboardingStage: "ACTION_REQUIRED" },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "DOCUMENT_REJECTED",
    resourceType: "HostRegistrationDocument",
    resourceId: doc.id,
    description: `Rejected document ${doc.documentType} (${doc.fileName}) for application ${doc.request?.applicationId}. Reason: ${reason}`,
  });

  // Trigger host email notification
  if (doc.request?.applicantEmail) {
    await sendHostDocumentActionEmail({
      to: doc.request.applicantEmail,
      applicantName: doc.request.applicantName,
      applicationId: doc.request.applicationId,
      documentType: doc.documentType,
      actionType: "REJECTED",
      reason: reason.trim(),
    });
  }

  return updated as HostDocumentItem;
}

/**
 * Phase 2: Request document re-submission from host
 */
async function requestDocumentResubmission(
  actor: AuthUser,
  documentId: string,
  reason: string,
  instructions: string
): Promise<HostDocumentItem> {
  if (!reason || !reason.trim()) {
    throw AppError.badRequest("Rejection reason is required");
  }

  const doc = await db.hostRegistrationDocument.findUnique({
    where: { id: documentId },
    include: { request: true },
  });

  if (!doc) {
    throw AppError.notFound("Document not found");
  }

  const updated = await db.hostRegistrationDocument.update({
    where: { id: documentId },
    data: {
      status: "REJECTED",
      rejectedById: actor.id,
      rejectedAt: new Date(),
      rejectionReason: reason.trim(),
      resubmissionRequested: true,
      resubmissionInstructions: instructions ? instructions.trim() : null,
      resubmissionRequestedAt: new Date(),
    },
    include: {
      verifiedBy: { select: { id: true, name: true, email: true } },
      rejectedBy: { select: { id: true, name: true, email: true } },
    },
  });

  // Update application status to WAITING_FOR_DOCUMENTS
  await db.hostRegistrationRequest.update({
    where: { id: doc.requestId },
    data: { status: "WAITING_FOR_DOCUMENTS", onboardingStage: "ACTION_REQUIRED" },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "DOCUMENT_RESUBMISSION_REQUESTED",
    resourceType: "HostRegistrationDocument",
    resourceId: doc.id,
    description: `Requested re-submission of ${doc.documentType} for application ${doc.request?.applicationId}. Reason: ${reason}`,
  });

  // Trigger host email notification
  if (doc.request?.applicantEmail) {
    await sendHostDocumentActionEmail({
      to: doc.request.applicantEmail,
      applicantName: doc.request.applicantName,
      applicationId: doc.request.applicationId,
      documentType: doc.documentType,
      actionType: "RESUBMISSION_REQUESTED",
      reason: reason.trim(),
      instructions: instructions ? instructions.trim() : undefined,
    });
  }

  return updated as HostDocumentItem;
}

/**
 * Phase 2: Add internal reviewer note
 */
async function addReviewNote(
  actor: AuthUser,
  requestId: string,
  content: string
): Promise<ReviewNoteItem> {
  if (!content || !content.trim()) {
    throw AppError.badRequest("Note content cannot be empty");
  }

  const req = await db.hostRegistrationRequest.findUnique({
    where: { id: requestId },
  });
  if (!req) throw AppError.notFound("Registration request not found");

  const note = await db.hostRegistrationNote.create({
    data: {
      requestId,
      authorId: actor.id,
      authorEmail: actor.email,
      authorName: actor.name || actor.email,
      content: content.trim(),
      isInternal: true,
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "REVIEW_NOTE_ADDED",
    resourceType: "HostRegistrationRequest",
    resourceId: req.id,
    description: `Added internal reviewer note for application ${req.applicationId}`,
  });

  return note as ReviewNoteItem;
}

/**
 * Phase 2: Secure document access preview URL generator with audit log
 */
async function getSecureDocumentUrl(
  actor: AuthUser,
  documentId: string
): Promise<{ url: string; fileName: string; mimeType: string | null }> {
  const doc = await db.hostRegistrationDocument.findUnique({
    where: { id: documentId },
    include: { request: true },
  });

  if (!doc) {
    throw AppError.notFound("Document not found");
  }

  // Audit document viewing event
  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "DOCUMENT_VIEWED",
    resourceType: "HostRegistrationDocument",
    resourceId: doc.id,
    description: `Secure document preview accessed by ${actor.email} for ${doc.fileName} (${doc.documentType})`,
  });

  // Return secure proxy access endpoint with time-bound signature or placeholder
  return {
    url: doc.fileUrl || `/api/v1/admin/hosts/registration-requests/documents/${doc.id}/preview`,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
  };
}

async function listAvailableReviewers() {
  const reviewers = await prisma.user.findMany({
    where: {
      OR: [
        { role: Role.ADMIN },
        { adminRoleId: { not: null } },
      ],
      status: "ACTIVE",
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
    orderBy: { name: "asc" },
  });

  return reviewers;
}

async function ensureDefaultComplianceChecks(requestId: string) {
  const existingChecks = await prisma.hostComplianceCheck.findMany({
    where: { requestId },
  });

  const existingKeys = new Set(existingChecks.map((c: any) => c.checkKey));
  const toCreate = STANDARD_COMPLIANCE_CHECKS.filter((check) => !existingKeys.has(check.key));

  if (toCreate.length > 0) {
    await prisma.hostComplianceCheck.createMany({
      data: toCreate.map((c: any) => ({
        requestId,
        checkKey: c.key,
        checkName: c.name,
        status: "PENDING",
      })),
    });
  }
}

async function getComplianceDetails(requestId: string) {
  await ensureDefaultComplianceChecks(requestId);

  const req = await prisma.hostRegistrationRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      applicationId: true,
      applicantName: true,
      applicantEmail: true,
      applicantPhone: true,
      registrationType: true,
      businessName: true,
      propertyCount: true,
      location: true,
      notes: true,
      status: true,
      onboardingStage: true,
      complianceStatus: true,
      complianceReviewedAt: true,
      complianceNotes: true,
      rejectionReason: true,
      approvedAt: true,
      reopenedAt: true,
      reopenReason: true,
      complianceReviewedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true } },
      reopenedBy: { select: { id: true, name: true, email: true } },
      assignedReviewer: { select: { id: true, name: true, email: true } },
      assignedAt: true,
      documents: {
        select: { id: true, documentType: true, fileName: true, status: true, expiryDate: true },
      },
    },
  });

  if (!req) {
    throw AppError.notFound("Host registration request not found");
  }

  const checks = await prisma.hostComplianceCheck.findMany({
    where: { requestId },
    include: { reviewer: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  const issues = await prisma.hostComplianceIssue.findMany({
    where: { requestId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      resolvedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const infoRequests = await prisma.hostInfoRequest.findMany({
    where: { requestId },
    include: { requestedBy: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  const totalChecks = checks.length;
  const completedChecks = checks.filter((c: any) => c.status === "PASSED").length;
  const pendingChecks = checks.filter((c: any) => c.status === "PENDING").length;
  const failedChecks = checks.filter((c: any) => c.status === "FAILED").length;
  const openIssuesCount = issues.filter((i: any) => i.status === "OPEN" || i.status === "UNDER_REVIEW").length;

  const now = new Date();
  const documentExpiries = req.documents
    .filter((d: any) => d.expiryDate)
    .map((d: any) => {
      const exp = new Date(d.expiryDate!);
      const diffTime = exp.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      let expiryStatus: "VALID" | "EXPIRING_SOON" | "EXPIRED" = "VALID";
      if (diffDays < 0) {
        expiryStatus = "EXPIRED";
      } else if (diffDays <= 30) {
        expiryStatus = "EXPIRING_SOON";
      }

      return {
        documentId: d.id,
        documentType: d.documentType,
        fileName: d.fileName,
        expiryDate: d.expiryDate,
        expiryStatus,
        daysUntilExpiry: diffDays,
      };
    });

  return {
    requestInfo: req,
    complianceStatus: req.complianceStatus,
    complianceNotes: req.complianceNotes,
    complianceReviewedBy: req.complianceReviewedBy,
    complianceReviewedAt: req.complianceReviewedAt,
    checks,
    issues,
    infoRequests,
    documentExpiries,
    summary: {
      totalChecks,
      completedChecks,
      pendingChecks,
      failedChecks,
      openIssuesCount,
    },
  };
}

async function updateComplianceCheck(
  actor: AuthUser,
  checkId: string,
  status: "PENDING" | "PASSED" | "FAILED",
  notes?: string
) {
  const check = await prisma.hostComplianceCheck.findUnique({
    where: { id: checkId },
    include: { request: true },
  });

  if (!check) {
    throw AppError.notFound("Compliance check item not found");
  }

  const updatedCheck = await prisma.hostComplianceCheck.update({
    where: { id: checkId },
    data: {
      status,
      reviewerId: actor.id,
      completedAt: status !== "PENDING" ? new Date() : null,
      notes: notes !== undefined ? notes : check.notes,
    },
    include: { reviewer: { select: { id: true, name: true, email: true } } },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "COMPLIANCE_CHECK_COMPLETED",
    resourceType: "HOST_REGISTRATION",
    resourceId: check.requestId,
    description: `Updated compliance check '${check.checkName}' to status ${status}`,
  });

  const allChecks = await prisma.hostComplianceCheck.findMany({
    where: { requestId: check.requestId },
  });

  const anyFailed = allChecks.some((c: any) => c.status === "FAILED");
  const allPassed = allChecks.every((c: any) => c.status === "PASSED");

  let newComplianceStatus = check.request.complianceStatus;
  if (anyFailed) {
    newComplianceStatus = "NON_COMPLIANT";
  } else if (allPassed) {
    newComplianceStatus = "COMPLIANT";
  } else if (check.request.complianceStatus === "PENDING") {
    newComplianceStatus = "UNDER_REVIEW";
  }

  if (newComplianceStatus !== check.request.complianceStatus) {
    await prisma.hostRegistrationRequest.update({
      where: { id: check.requestId },
      data: {
        complianceStatus: newComplianceStatus,
        complianceReviewedById: actor.id,
        complianceReviewedAt: new Date(),
      },
    });
  }

  return updatedCheck;
}

async function createComplianceIssue(
  actor: AuthUser,
  requestId: string,
  issueType: string,
  description: string,
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
) {
  const req = await prisma.hostRegistrationRequest.findUnique({ where: { id: requestId } });
  if (!req) throw AppError.notFound("Host registration request not found");

  const issue = await prisma.hostComplianceIssue.create({
    data: {
      requestId,
      issueType,
      description,
      severity,
      status: "OPEN",
      createdById: actor.id,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      resolvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "COMPLIANCE_ISSUE_CREATED",
    resourceType: "HOST_REGISTRATION",
    resourceId: requestId,
    description: `Recorded ${severity} severity compliance issue: ${issueType}`,
  });

  if (severity === "HIGH" || severity === "CRITICAL") {
    await prisma.hostRegistrationRequest.update({
      where: { id: requestId },
      data: { complianceStatus: "ACTION_REQUIRED" },
    });
  }

  return issue;
}

async function resolveComplianceIssue(
  actor: AuthUser,
  issueId: string,
  status: "RESOLVED" | "REJECTED",
  resolutionNotes?: string
) {
  const issue = await prisma.hostComplianceIssue.findUnique({ where: { id: issueId } });
  if (!issue) throw AppError.notFound("Compliance issue not found");

  const updatedIssue = await prisma.hostComplianceIssue.update({
    where: { id: issueId },
    data: {
      status,
      resolvedById: actor.id,
      resolvedAt: new Date(),
      resolutionNotes: resolutionNotes || issue.resolutionNotes,
    },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      resolvedBy: { select: { id: true, name: true, email: true } },
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "COMPLIANCE_ISSUE_RESOLVED",
    resourceType: "HOST_REGISTRATION",
    resourceId: issue.requestId,
    description: `Marked compliance issue '${issue.issueType}' as ${status}`,
  });

  return updatedIssue;
}

async function requestAdditionalInformation(
  actor: AuthUser,
  requestId: string,
  informationRequired: string,
  reason: string,
  deadline?: Date | string | null
) {
  const req = await prisma.hostRegistrationRequest.findUnique({ where: { id: requestId } });
  if (!req) throw AppError.notFound("Host registration request not found");

  const parsedDeadline = deadline ? new Date(deadline) : null;

  const infoReq = await prisma.hostInfoRequest.create({
    data: {
      requestId,
      informationRequired,
      reason,
      deadline: parsedDeadline,
      requestedById: actor.id,
      status: "PENDING",
    },
    include: { requestedBy: { select: { id: true, name: true, email: true } } },
  });

  await prisma.hostRegistrationRequest.update({
    where: { id: requestId },
    data: {
      status: "WAITING_FOR_DOCUMENTS",
      onboardingStage: "ACTION_REQUIRED",
      complianceStatus: "ACTION_REQUIRED",
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "ADDITIONAL_INFO_REQUESTED",
    resourceType: "HOST_REGISTRATION",
    resourceId: requestId,
    description: `Requested additional information from applicant: ${informationRequired}`,
  });

  await sendHostActionInfoRequestEmail({
    to: req.applicantEmail,
    applicantName: req.applicantName,
    applicationId: req.applicationId,
    informationRequired,
    reason,
    deadline: parsedDeadline,
  });

  return infoReq;
}

async function updateComplianceDecision(
  actor: AuthUser,
  requestId: string,
  complianceStatus: "COMPLIANT" | "NON_COMPLIANT" | "ACTION_REQUIRED",
  notes?: string
) {
  const req = await prisma.hostRegistrationRequest.findUnique({ where: { id: requestId } });
  if (!req) throw AppError.notFound("Host registration request not found");

  if (complianceStatus === "COMPLIANT") {
    const openCriticalIssues = await prisma.hostComplianceIssue.count({
      where: {
        requestId,
        severity: { in: ["HIGH", "CRITICAL"] },
        status: { in: ["OPEN", "UNDER_REVIEW"] },
      },
    });

    if (openCriticalIssues > 0) {
      throw AppError.badRequest(
        "Cannot set compliance status to Compliant while open High or Critical compliance issues exist."
      );
    }
  }

  const updatedReq = await prisma.hostRegistrationRequest.update({
    where: { id: requestId },
    data: {
      complianceStatus,
      complianceReviewedById: actor.id,
      complianceReviewedAt: new Date(),
      complianceNotes: notes !== undefined ? notes : req.complianceNotes,
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "COMPLIANCE_STATUS_CHANGED",
    resourceType: "HOST_REGISTRATION",
    resourceId: requestId,
    description: `Changed compliance status to ${complianceStatus}`,
  });

  return updatedReq;
}

async function validateApprovalEligibility(requestId: string) {
  const req = await prisma.hostRegistrationRequest.findUnique({
    where: { id: requestId },
    include: {
      documents: true,
      complianceChecks: true,
      complianceIssues: true,
    },
  });

  if (!req) throw AppError.notFound("Host registration request not found");

  const reasons: string[] = [];

  const applicationInfoComplete = Boolean(req.applicantName && req.applicantEmail);
  if (!applicationInfoComplete) {
    reasons.push("Applicant profile information is incomplete");
  }

  const hasDocuments = req.documents.length > 0;
  const unverifiedDocs = req.documents.filter((d: any) => d.status !== "VERIFIED");
  const documentsVerified = hasDocuments && unverifiedDocs.length === 0;
  if (!hasDocuments) {
    reasons.push("No verification documents submitted");
  } else if (unverifiedDocs.length > 0) {
    reasons.push(`${unverifiedDocs.length} verification document(s) remain unverified or rejected`);
  }

  await ensureDefaultComplianceChecks(requestId);
  const updatedChecks = await prisma.hostComplianceCheck.findMany({ where: { requestId } });
  const unpassedChecks = updatedChecks.filter((c: any) => c.status !== "PASSED");
  const complianceChecksPassed = unpassedChecks.length === 0;
  if (unpassedChecks.length > 0) {
    reasons.push(`${unpassedChecks.length} required compliance check(s) are incomplete or failed`);
  }

  const openCriticalIssues = req.complianceIssues.filter(
    (i: any) => (i.severity === "HIGH" || i.severity === "CRITICAL") && (i.status === "OPEN" || i.status === "UNDER_REVIEW")
  );
  const noOpenCriticalIssues = openCriticalIssues.length === 0;
  if (openCriticalIssues.length > 0) {
    reasons.push(`${openCriticalIssues.length} unresolved High/Critical compliance issue(s) exist`);
  }

  const eligible = applicationInfoComplete && documentsVerified && complianceChecksPassed && noOpenCriticalIssues;

  return {
    eligible,
    reasons,
    details: {
      applicationInfoComplete,
      documentsVerified,
      complianceChecksPassed,
      noOpenCriticalIssues,
    },
  };
}

async function approveApplication(actor: AuthUser, requestId: string) {
  const eligibility = await validateApprovalEligibility(requestId);
  if (!eligibility.eligible) {
    throw AppError.badRequest(
      `Cannot approve host application. Reasons:\n- ${eligibility.reasons.join("\n- ")}`
    );
  }

  const req = await prisma.hostRegistrationRequest.findUnique({
    where: { id: requestId },
  });

  if (!req) throw AppError.notFound("Host registration request not found");

  if (req.status === "APPROVED") {
    throw AppError.badRequest("Application is already approved");
  }

  let targetUser = req.hostId
    ? await prisma.user.findUnique({ where: { id: req.hostId } })
    : await prisma.user.findUnique({ where: { email: req.applicantEmail } });

  if (targetUser) {
    await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        role: Role.HOST,
        status: "ACTIVE",
      },
    });
  } else {
    targetUser = await prisma.user.create({
      data: {
        email: req.applicantEmail,
        name: req.applicantName,
        phone: req.applicantPhone,
        role: Role.HOST,
        status: "ACTIVE",
      },
    });
  }

  const approvedReq = await prisma.hostRegistrationRequest.update({
    where: { id: requestId },
    data: {
      status: "APPROVED",
      onboardingStage: "COMPLETED",
      complianceStatus: "COMPLIANT",
      hostId: targetUser.id,
      approvedById: actor.id,
      approvedAt: new Date(),
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "HOST_ACCOUNT_ACTIVATED",
    resourceType: "HOST_REGISTRATION",
    resourceId: requestId,
    description: `Activated host user account ${targetUser.email} (${targetUser.id})`,
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "HOST_APPLICATION_APPROVED",
    resourceType: "HOST_REGISTRATION",
    resourceId: requestId,
    description: `Approved host application ${req.applicationId} for ${req.applicantName}`,
  });

  await sendHostApplicationApprovalEmail({
    to: req.applicantEmail,
    applicantName: req.applicantName,
    applicationId: req.applicationId,
  });

  await Promise.all([
    invalidateAdminDashboardCache(),
    invalidateUserCache(targetUser.id),
  ]);

  return approvedReq;
}

async function rejectApplication(
  actor: AuthUser,
  requestId: string,
  reason: string,
  explanation?: string
) {
  if (!reason || !reason.trim()) {
    throw AppError.badRequest("Rejection reason is required");
  }

  const req = await prisma.hostRegistrationRequest.findUnique({ where: { id: requestId } });
  if (!req) throw AppError.notFound("Host registration request not found");

  const combinedReason = explanation ? `${reason.trim()} - ${explanation.trim()}` : reason.trim();

  const rejectedReq = await prisma.hostRegistrationRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      onboardingStage: "DISQUALIFIED",
      complianceStatus: "NON_COMPLIANT",
      rejectionReason: combinedReason,
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "HOST_APPLICATION_REJECTED",
    resourceType: "HOST_REGISTRATION",
    resourceId: requestId,
    description: `Rejected application ${req.applicationId}. Reason: ${combinedReason}`,
  });

  await sendHostApplicationRejectionEmail({
    to: req.applicantEmail,
    applicantName: req.applicantName,
    applicationId: req.applicationId,
    reason,
    explanation,
  });

  return rejectedReq;
}

async function reopenApplication(actor: AuthUser, requestId: string, reason: string) {
  if (!reason || !reason.trim()) {
    throw AppError.badRequest("Reopen reason is required");
  }

  const req = await prisma.hostRegistrationRequest.findUnique({ where: { id: requestId } });
  if (!req) throw AppError.notFound("Host registration request not found");

  const reopenedReq = await prisma.hostRegistrationRequest.update({
    where: { id: requestId },
    data: {
      status: "IN_REVIEW",
      onboardingStage: "IN_REVIEW",
      complianceStatus: "UNDER_REVIEW",
      reopenedById: actor.id,
      reopenedAt: new Date(),
      reopenReason: reason.trim(),
    },
  });

  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "HOST_APPLICATION_REOPENED",
    resourceType: "HOST_REGISTRATION",
    resourceId: requestId,
    description: `Reopened application ${req.applicationId}. Reason: ${reason.trim()}`,
  });

  return reopenedReq;
}

async function getComplianceMetrics() {
  const [pending, actionRequired, compliant, nonCompliant, allRequests] = await Promise.all([
    prisma.hostRegistrationRequest.count({ where: { complianceStatus: "PENDING" } }),
    prisma.hostRegistrationRequest.count({ where: { complianceStatus: "ACTION_REQUIRED" } }),
    prisma.hostRegistrationRequest.count({ where: { complianceStatus: "COMPLIANT" } }),
    prisma.hostRegistrationRequest.count({ where: { complianceStatus: "NON_COMPLIANT" } }),
    prisma.hostRegistrationRequest.findMany({
      where: { status: { in: ["IN_REVIEW", "DOCUMENTS_UNDER_REVIEW"] } },
      select: { id: true },
    }),
  ]);

  let readyForDecision = 0;
  for (const r of allRequests) {
    const el = await validateApprovalEligibility(r.id);
    if (el.eligible) readyForDecision++;
  }

  return {
    compliancePending: pending,
    actionRequired,
    compliant,
    nonCompliant,
    readyForDecision,
  };
}

export const hostRegistrationService = {
  listRegistrationRequests,
  getRegistrationRequestById,
  assignReviewer,
  startReview,
  updateRegistrationRequest,
  verifyDocument,
  rejectDocument,
  requestDocumentResubmission,
  addReviewNote,
  getSecureDocumentUrl,
  listAvailableReviewers,
  getComplianceDetails,
  updateComplianceCheck,
  createComplianceIssue,
  resolveComplianceIssue,
  requestAdditionalInformation,
  updateComplianceDecision,
  validateApprovalEligibility,
  approveApplication,
  rejectApplication,
  reopenApplication,
  getComplianceMetrics,
};

