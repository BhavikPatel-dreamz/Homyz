import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { auditService } from "@/services/audit.service";
import { sendHostComplianceStatusEmail } from "@/lib/services/email";
import type { AuthUser } from "@/lib/auth/types";
import { UserStatus } from "@/generated/prisma/enums";
import { deleteCache, getOrSetCache } from "@/lib/redis/cache";
import { keys } from "@/lib/redis/keys";

export interface HostComplianceSummaryMetrics {
  totalActiveHosts: number;
  compliantHosts: number;
  compliancePending: number;
  actionRequired: number;
  nonCompliant: number;
  documentsExpiringSoon: number;
  documentsExpired: number;
  suspendedForCompliance: number;
}

export interface DocumentExpiryDetail {
  id: string;
  documentType: string;
  fileName: string;
  fileUrl: string;
  status: string;
  uploadedAt: Date;
  expiryDate: Date | null;
  daysRemaining: number | null;
  expiryStatus: "VALID" | "EXPIRING_SOON" | "EXPIRED" | "NO_EXPIRY";
}

export interface ComplianceIssueDetail {
  id: string;
  issueType: string;
  description: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  status: "OPEN" | "UNDER_REVIEW" | "ACTION_REQUIRED" | "RESOLVED" | "ESCALATED";
  createdById: string;
  createdAt: Date;
  resolvedById?: string | null;
  resolvedAt?: Date | null;
  resolutionNotes?: string | null;
}

export interface HostComplianceItem {
  id: string; // HostRegistrationRequest id
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  businessName: string | null;
  location: string | null;
  hostUser: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    status: UserStatus;
  } | null;
  overallStatus: string; // APPROVED, etc.
  complianceStatus: string; // COMPLIANT, PENDING, ACTION_REQUIRED, NON_COMPLIANT, SUSPENDED
  highestRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  documents: DocumentExpiryDetail[];
  issues: ComplianceIssueDetail[];
  openIssuesCount: number;
  criticalIssuesCount: number;
  expiringDocsCount: number;
  expiredDocsCount: number;
  assignedReviewer: {
    id: string;
    name: string | null;
    email: string | null;
  } | null;
  lastReviewedAt: Date | null;
  updatedAt: Date;
}

export interface ListHostComplianceOptions {
  page?: number;
  pageSize?: number;
  search?: string;
  complianceStatus?: string;
  documentStatus?: string;
  riskLevel?: string;
  issueStatus?: string;
  reviewerId?: string;
  hostStatus?: string;
}

/**
 * Helper to compute days remaining from current date to target expiry date.
 */
function getDaysRemaining(expiryDate: Date | null): number | null {
  if (!expiryDate) return null;
  const diffMs = new Date(expiryDate).getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Get summary cards metrics for host compliance.
 */
export async function getComplianceDashboardMetrics(): Promise<HostComplianceSummaryMetrics> {
  return getOrSetCache(
    keys.hostComplianceMetrics(),
    async () => {
      const activeHosts = await prisma.user.findMany({
        where: { role: "HOST" },
        select: { id: true, status: true },
      });

      const activeHostIds = activeHosts.map((h: any) => h.id);

      const requests = await prisma.hostRegistrationRequest.findMany({
        where: {
          OR: [
            { status: "APPROVED" },
            { hostId: { in: activeHostIds } },
          ],
        },
        select: {
          id: true,
          complianceStatus: true,
          hostId: true,
          status: true,
          host: { select: { status: true } },
        },
      });

      let totalActiveHosts = activeHosts.length || requests.length;
      let compliantHosts = 0;
      let compliancePending = 0;
      let actionRequired = 0;
      let nonCompliant = 0;
      let suspendedForCompliance = activeHosts.filter((h: any) => h.status === "SUSPENDED").length;

      requests.forEach((req: any) => {
        const isHostSuspended = req.host?.status === "SUSPENDED";
        if (isHostSuspended) {
          nonCompliant++;
          return;
        }

        switch (req.complianceStatus) {
          case "COMPLIANT":
            compliantHosts++;
            break;
          case "PENDING":
          case "UNDER_REVIEW":
            compliancePending++;
            break;
          case "ACTION_REQUIRED":
            actionRequired++;
            break;
          case "NON_COMPLIANT":
            nonCompliant++;
            break;
          default:
            compliancePending++;
            break;
        }
      });

      // Calculate document expiry metrics
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const documents = await prisma.hostRegistrationDocument.findMany({
        where: {
          expiryDate: { not: null },
          request: {
            OR: [
              { status: "APPROVED" },
              { hostId: { in: activeHostIds } },
            ],
          },
        },
        select: {
          id: true,
          status: true,
          expiryDate: true,
        },
      });

      let documentsExpiringSoon = 0;
      let documentsExpired = 0;

      documents.forEach((doc: any) => {
        if (!doc.expiryDate) return;
        const exp = new Date(doc.expiryDate);
        if (exp < now || doc.status === "EXPIRED") {
          documentsExpired++;
        } else if (exp <= thirtyDaysFromNow) {
          documentsExpiringSoon++;
        }
      });

      return {
        totalActiveHosts,
        compliantHosts,
        compliancePending,
        actionRequired,
        nonCompliant,
        documentsExpiringSoon,
        documentsExpired,
        suspendedForCompliance,
      };
    },
    { ttl: 60 }
  );
}

/**
 * List paginated host compliance records with filters & search.
 */
export async function listHostComplianceRecords(options: ListHostComplianceOptions = {}) {
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize || 10));
  const skip = (page - 1) * pageSize;

  const where: any = {
    OR: [
      { status: "APPROVED" },
      { hostId: { not: null } },
    ],
  };

  if (options.search?.trim()) {
    const q = options.search.trim();
    where.AND = [
      {
        OR: [
          { applicantName: { contains: q, mode: "insensitive" } },
          { applicantEmail: { contains: q, mode: "insensitive" } },
          { applicationId: { contains: q, mode: "insensitive" } },
          { businessName: { contains: q, mode: "insensitive" } },
          { host: { name: { contains: q, mode: "insensitive" } } },
          { host: { email: { contains: q, mode: "insensitive" } } },
        ],
      },
    ];
  }

  if (options.complianceStatus && options.complianceStatus !== "ALL") {
    if (options.complianceStatus === "SUSPENDED") {
      where.host = { status: "SUSPENDED" };
    } else {
      where.complianceStatus = options.complianceStatus;
    }
  }

  if (options.reviewerId && options.reviewerId !== "ALL") {
    if (options.reviewerId === "UNASSIGNED") {
      where.assignedReviewerId = null;
    } else {
      where.assignedReviewerId = options.reviewerId;
    }
  }

  if (options.hostStatus && options.hostStatus !== "ALL") {
    where.host = { ...where.host, status: options.hostStatus };
  }

  const [total, requests] = await Promise.all([
    prisma.hostRegistrationRequest.count({ where }),
    prisma.hostRegistrationRequest.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { updatedAt: "desc" },
      include: {
        host: {
          select: { id: true, name: true, email: true, phone: true, status: true },
        },
        assignedReviewer: {
          select: { id: true, name: true, email: true },
        },
        documents: true,
        complianceIssues: {
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
            resolvedBy: { select: { id: true, name: true, email: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
  ]);

  const items: HostComplianceItem[] = requests.map((req: any) => {
    const isSuspended = req.host?.status === "SUSPENDED";
    const effectiveComplianceStatus = isSuspended ? "SUSPENDED" : req.complianceStatus;

    // Process documents
    const processedDocs: DocumentExpiryDetail[] = req.documents.map((doc: any) => {
      const daysRemaining = getDaysRemaining(doc.expiryDate);
      let expiryStatus: "VALID" | "EXPIRING_SOON" | "EXPIRED" | "NO_EXPIRY" = "NO_EXPIRY";

      if (doc.expiryDate) {
        if (daysRemaining !== null && daysRemaining <= 0) {
          expiryStatus = "EXPIRED";
        } else if (daysRemaining !== null && daysRemaining <= 30) {
          expiryStatus = "EXPIRING_SOON";
        } else {
          expiryStatus = "VALID";
        }
      }

      return {
        id: doc.id,
        documentType: doc.documentType,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        status: doc.status,
        uploadedAt: doc.uploadedAt,
        expiryDate: doc.expiryDate,
        daysRemaining,
        expiryStatus,
      };
    });

    // Filter document status if requested
    const expiringDocsCount = processedDocs.filter((d: any) => d.expiryStatus === "EXPIRING_SOON").length;
    const expiredDocsCount = processedDocs.filter((d: any) => d.expiryStatus === "EXPIRED").length;

    // Process issues
    const processedIssues: ComplianceIssueDetail[] = req.complianceIssues.map((iss: any) => ({
      id: iss.id,
      issueType: iss.issueType,
      description: iss.description,
      severity: iss.severity as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      status: iss.status as "OPEN" | "UNDER_REVIEW" | "ACTION_REQUIRED" | "RESOLVED" | "ESCALATED",
      createdById: iss.createdById,
      createdAt: iss.createdAt,
      resolvedById: iss.resolvedById,
      resolvedAt: iss.resolvedAt,
      resolutionNotes: iss.resolutionNotes,
    }));

    const openIssues = processedIssues.filter((i: any) => i.status !== "RESOLVED");
    const openIssuesCount = openIssues.length;
    const criticalIssuesCount = openIssues.filter((i: any) => i.severity === "CRITICAL" || i.severity === "HIGH").length;

    let highestRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
    if (openIssues.some((i: any) => i.severity === "CRITICAL")) highestRisk = "CRITICAL";
    else if (openIssues.some((i: any) => i.severity === "HIGH")) highestRisk = "HIGH";
    else if (openIssues.some((i: any) => i.severity === "MEDIUM")) highestRisk = "MEDIUM";

    return {
      id: req.id,
      applicationId: req.applicationId,
      applicantName: req.applicantName,
      applicantEmail: req.applicantEmail,
      applicantPhone: req.applicantPhone,
      businessName: req.businessName,
      location: req.location,
      hostUser: req.host,
      overallStatus: req.status,
      complianceStatus: effectiveComplianceStatus,
      highestRisk,
      documents: processedDocs,
      issues: processedIssues,
      openIssuesCount,
      criticalIssuesCount,
      expiringDocsCount,
      expiredDocsCount,
      assignedReviewer: req.assignedReviewer,
      lastReviewedAt: req.complianceReviewedAt || req.updatedAt,
      updatedAt: req.updatedAt,
    };
  });

  // Client-level filtering for riskLevel / documentStatus if requested
  let filteredItems = items;
  if (options.riskLevel && options.riskLevel !== "ALL") {
    filteredItems = filteredItems.filter((it: any) => it.highestRisk === options.riskLevel);
  }
  if (options.documentStatus === "EXPIRING_SOON") {
    filteredItems = filteredItems.filter((it: any) => it.expiringDocsCount > 0);
  } else if (options.documentStatus === "EXPIRED") {
    filteredItems = filteredItems.filter((it: any) => it.expiredDocsCount > 0);
  }

  return {
    items: filteredItems,
    pagination: {
      page,
      limit: pageSize,
      total: filteredItems.length !== items.length ? filteredItems.length : total,
      totalPages: Math.ceil((filteredItems.length !== items.length ? filteredItems.length : total) / pageSize),
    },
  };
}

/**
 * Idempotently check document expirations across all active host documents.
 */
export async function checkDocumentExpirations(actor?: AuthUser) {
  const now = new Date();

  const documents = await prisma.hostRegistrationDocument.findMany({
    where: {
      expiryDate: { not: null },
      request: {
        OR: [
          { status: "APPROVED" },
          { host: { isNot: null } },
        ],
      },
    },
    include: {
      request: {
        include: {
          host: true,
        },
      },
    },
  });

  let expiredCount = 0;
  let warningCount = 0;

  for (const doc of documents) {
    if (!doc.expiryDate) continue;

    const daysRemaining = getDaysRemaining(doc.expiryDate);
    const hostEmail = doc.request.applicantEmail || doc.request.host?.email;
    const hostName = doc.request.applicantName || doc.request.host?.name || "Host";

    if (daysRemaining !== null && daysRemaining <= 0) {
      if (doc.status !== "EXPIRED") {
        await prisma.hostRegistrationDocument.update({
          where: { id: doc.id },
          data: { status: "EXPIRED" },
        });

        await prisma.hostRegistrationRequest.update({
          where: { id: doc.requestId },
          data: { complianceStatus: "ACTION_REQUIRED" },
        });

        expiredCount++;

        // Log audit
        await auditService.record({
          actorId: actor?.id || null,
          actorEmail: actor?.email || "system@homyz.internal",
          action: "DOCUMENT_EXPIRED",
          resourceType: "HostRegistrationDocument",
          resourceId: doc.id,
          description: `Document ${doc.documentType} expired for ${hostName} (${doc.request.applicationId}). Compliance status set to ACTION_REQUIRED.`,
        });

        // Notify Host
        if (hostEmail) {
          await sendHostComplianceStatusEmail({
            to: hostEmail,
            applicantName: hostName,
            type: "EXPIRED",
            title: `Expired Document: ${doc.documentType}`,
            details: `Your uploaded ${doc.documentType} expired on ${new Date(doc.expiryDate).toLocaleDateString()}. Re-verification is required.`,
            daysRemaining: 0,
          });
        }
      }
    } else if (daysRemaining !== null && daysRemaining <= 30 && daysRemaining > 0) {
      warningCount++;
      // Trigger warning notification on threshold days (30, 15, 7)
      if ([30, 15, 7, 1].includes(daysRemaining) && hostEmail) {
        await sendHostComplianceStatusEmail({
          to: hostEmail,
          applicantName: hostName,
          type: "EXPIRING_SOON",
          title: `Document Expiring Soon: ${doc.documentType}`,
          details: `Your ${doc.documentType} document will expire in ${daysRemaining} day(s). Please submit a renewed copy to maintain full host compliance.`,
          daysRemaining,
        });
      }
    }
  }

  return {
    totalChecked: documents.length,
    expiredCount,
    warningCount,
    checkedAt: now,
  };
}

/**
 * Request re-verification for an active host.
 */
export async function requestHostReVerification(
  actor: AuthUser,
  requestId: string,
  reason: string
) {
  const req = await prisma.hostRegistrationRequest.findUnique({
    where: { id: requestId },
    include: { host: true },
  });

  if (!req) {
    throw AppError.notFound("Host registration request not found");
  }

  const updated = await prisma.hostRegistrationRequest.update({
    where: { id: requestId },
    data: {
      complianceStatus: "ACTION_REQUIRED",
      complianceNotes: `Re-verification requested by ${actor.name || actor.email}: ${reason}`,
    },
  });

  await deleteCache(keys.hostComplianceMetrics());

  // Record audit log
  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "HOST_REVERIFICATION_REQUESTED",
    resourceType: "HOST_REGISTRATION",
    resourceId: req.id,
    description: `Re-verification requested for ${req.applicantName} (${req.applicationId}). Reason: ${reason}`,
  });

  // Send Email Notification
  const hostEmail = req.applicantEmail || req.host?.email;
  const hostName = req.applicantName || req.host?.name || "Host";

  if (hostEmail) {
    await sendHostComplianceStatusEmail({
      to: hostEmail,
      applicantName: hostName,
      type: "RE_VERIFICATION_REQUESTED",
      title: "Action Required: Host Re-Verification Requested",
      details: "Our compliance team requires an updated document or re-verification for your host account.",
      reason,
    });
  }

  return updated;
}

/**
 * Resolve a compliance issue.
 */
export async function resolveComplianceIssue(
  actor: AuthUser,
  issueId: string,
  resolutionNotes: string
) {
  const issue = await prisma.hostComplianceIssue.findUnique({
    where: { id: issueId },
    include: {
      request: {
        include: {
          host: true,
          complianceIssues: true,
        },
      },
    },
  });

  if (!issue) {
    throw AppError.notFound("Compliance issue not found");
  }

  const updatedIssue = await prisma.hostComplianceIssue.update({
    where: { id: issueId },
    data: {
      status: "RESOLVED",
      resolvedById: actor.id,
      resolvedAt: new Date(),
      resolutionNotes: resolutionNotes.trim(),
    },
  });

  // Check remaining open issues
  const remainingOpen = issue.request.complianceIssues.filter(
    (i: any) => i.id !== issueId && i.status !== "RESOLVED"
  );

  if (remainingOpen.length === 0) {
    await prisma.hostRegistrationRequest.update({
      where: { id: issue.requestId },
      data: {
        complianceStatus: "COMPLIANT",
        complianceNotes: `Compliance issue "${issue.issueType}" resolved by ${actor.name || actor.email}. Compliance restored.`,
      },
    });
  }

  // Audit Log
  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "COMPLIANCE_ISSUE_RESOLVED",
    resourceType: "HostComplianceIssue",
    resourceId: issue.id,
    description: `Resolved compliance issue "${issue.issueType}" for host ${issue.request.applicantName}. Notes: ${resolutionNotes}`,
  });

  // Host notification
  const hostEmail = issue.request.applicantEmail || issue.request.host?.email;
  const hostName = issue.request.applicantName || issue.request.host?.name || "Host";

  if (hostEmail) {
    await sendHostComplianceStatusEmail({
      to: hostEmail,
      applicantName: hostName,
      type: "ISSUE_RESOLVED",
      title: `Compliance Issue Resolved: ${issue.issueType}`,
      details: `Your compliance issue regarding "${issue.issueType}" has been verified and resolved. Thank you for your cooperation.`,
      reason: resolutionNotes,
    });
  }

  return updatedIssue;
}

/**
 * Suspend host account for compliance non-compliance.
 */
export async function suspendHostForCompliance(
  actor: AuthUser,
  requestId: string,
  reason: string
) {
  const req = await prisma.hostRegistrationRequest.findUnique({
    where: { id: requestId },
    include: { host: true },
  });

  if (!req) {
    throw AppError.notFound("Host registration request not found");
  }

  if (req.hostId) {
    await prisma.user.update({
      where: { id: req.hostId },
      data: { status: "SUSPENDED" },
    });
  }

  const updatedReq = await prisma.hostRegistrationRequest.update({
    where: { id: requestId },
    data: {
      complianceStatus: "NON_COMPLIANT",
      complianceNotes: `HOST SUSPENDED FOR NON-COMPLIANCE by ${actor.name || actor.email}. Reason: ${reason}`,
    },
  });

  // Audit Log
  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "HOST_SUSPENDED_FOR_COMPLIANCE",
    resourceType: "HOST_REGISTRATION",
    resourceId: req.id,
    description: `Suspended host ${req.applicantName} (${req.applicationId}) for non-compliance. Reason: ${reason}`,
  });

  // Host Notification
  const hostEmail = req.applicantEmail || req.host?.email;
  const hostName = req.applicantName || req.host?.name || "Host";

  if (hostEmail) {
    await sendHostComplianceStatusEmail({
      to: hostEmail,
      applicantName: hostName,
      type: "SUSPENDED",
      title: "Host Account Suspended for Compliance Violations",
      details: "Your Homyz Host account has been temporarily suspended due to compliance non-compliance.",
      reason,
    });
  }

  return updatedReq;
}

/**
 * Unsuspend host account and restore compliance.
 */
export async function unsuspendHostForCompliance(
  actor: AuthUser,
  requestId: string,
  reason: string
) {
  const req = await prisma.hostRegistrationRequest.findUnique({
    where: { id: requestId },
    include: { host: true },
  });

  if (!req) {
    throw AppError.notFound("Host registration request not found");
  }

  if (req.hostId) {
    await prisma.user.update({
      where: { id: req.hostId },
      data: { status: "ACTIVE" },
    });
  }

  const updatedReq = await prisma.hostRegistrationRequest.update({
    where: { id: requestId },
    data: {
      complianceStatus: "COMPLIANT",
      complianceNotes: `Host reactivated by ${actor.name || actor.email}. Reason: ${reason}`,
    },
  });

  // Audit Log
  await auditService.record({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "HOST_UNSUSPENDED_COMPLIANCE",
    resourceType: "HOST_REGISTRATION",
    resourceId: req.id,
    description: `Reactivated host ${req.applicantName} (${req.applicationId}). Reason: ${reason}`,
  });

  return updatedReq;
}

export const hostComplianceService = {
  getComplianceDashboardMetrics,
  listHostComplianceRecords,
  checkDocumentExpirations,
  requestHostReVerification,
  resolveComplianceIssue,
  suspendHostForCompliance,
  unsuspendHostForCompliance,
};
