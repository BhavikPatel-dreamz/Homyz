import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { auditService } from "./audit.service";
import type { AuthUser } from "@/lib/auth/types";

const db = prisma as any;

export const ONBOARDING_STAGES = [
  { key: "REGISTRATION", label: "Registration Submitted", order: 1 },
  { key: "PROFILE_COMPLETION", label: "Profile Completion", order: 2 },
  { key: "APPLICATION_REVIEW", label: "Application Review", order: 3 },
  { key: "DOCUMENT_VERIFICATION", label: "Document Verification", order: 4 },
  { key: "COMPLIANCE_REVIEW", label: "Compliance Review", order: 5 },
  { key: "APPROVAL", label: "Approval Review", order: 6 },
  { key: "HOST_ACTIVATION", label: "Host Activation", order: 7 },
  { key: "ONBOARDING_COMPLETE", label: "Onboarding Complete", order: 8 },
] as const;

export type OnboardingStageKey = (typeof ONBOARDING_STAGES)[number]["key"];

// Default SLA thresholds in days per stage
export const DEFAULT_STAGE_SLA_DAYS: Record<OnboardingStageKey, number> = {
  REGISTRATION: 1,
  PROFILE_COMPLETION: 2,
  APPLICATION_REVIEW: 2,
  DOCUMENT_VERIFICATION: 3,
  COMPLIANCE_REVIEW: 3,
  APPROVAL: 2,
  HOST_ACTIVATION: 1,
  ONBOARDING_COMPLETE: 0,
};

export interface OnboardingActionRequiredItem {
  type: "MISSING_DOCUMENT" | "REJECTED_DOCUMENT" | "INFO_REQUESTED" | "COMPLIANCE_ISSUE" | "UNASSIGNED_REVIEWER";
  title: string;
  description: string;
  assignedTo: "HOST" | "ADMIN";
  createdAt: Date | string;
  ageInDays: number;
  isOverdue: boolean;
  resolveUrl?: string;
}

export interface StageProgressDetail {
  stageKey: OnboardingStageKey;
  label: string;
  order: number;
  status: "COMPLETED" | "IN_PROGRESS" | "PENDING" | "ACTION_REQUIRED" | "FAILED";
  completedAt: Date | string | null;
  reviewer: { id: string; name: string | null; email: string | null } | null;
  actionRequired: string | null;
}

export interface HostOnboardingOverview {
  id: string;
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  overallStatus: string;
  currentStage: OnboardingStageKey;
  currentStageLabel: string;
  progressPercent: number;
  completedStagesCount: number;
  totalStagesCount: number;
  reviewer: { id: string; name: string | null; email: string | null } | null;
  submittedAt: Date | string;
  updatedAt: Date | string;
  daysInCurrentStage: number;
  isOverdue: boolean;
  actionRequired: OnboardingActionRequiredItem[];
}

export interface ListOnboardingOptions {
  search?: string;
  stage?: string | "ALL";
  overallStatus?: string | "ALL";
  reviewerId?: string | "ALL" | "UNASSIGNED";
  actionRequiredOnly?: boolean;
  overdueOnly?: boolean;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "updatedAt" | "daysInStage";
  sortOrder?: "asc" | "desc";
}

export class HostOnboardingService {
  /**
   * Derives current onboarding stage and actions required from request entity
   */
  private deriveOnboardingDetails(req: any) {
    const documents = req.documents || [];
    const complianceChecks = req.complianceChecks || [];
    const complianceIssues = req.complianceIssues || [];
    const infoRequests = req.infoRequests || [];

    const actions: OnboardingActionRequiredItem[] = [];
    const now = new Date();

    // 1. Check document actions
    const unverifiedOrMissing = documents.filter((d: any) => d.status === "REJECTED" || d.status === "PENDING");
    for (const doc of unverifiedOrMissing) {
      const docAge = Math.floor((now.getTime() - new Date(doc.createdAt).getTime()) / (1000 * 3600 * 24));
      if (doc.status === "REJECTED") {
        actions.push({
          type: "REJECTED_DOCUMENT",
          title: `Rejected Document: ${doc.documentType.replace(/_/g, " ")}`,
          description: doc.rejectionReason || "Document rejected during review. Awaiting host re-submission.",
          assignedTo: "HOST",
          createdAt: doc.rejectedAt || doc.createdAt,
          ageInDays: docAge,
          isOverdue: docAge > 3,
        });
      } else if (doc.status === "PENDING") {
        actions.push({
          type: "MISSING_DOCUMENT",
          title: `Document Pending Verification: ${doc.documentType.replace(/_/g, " ")}`,
          description: "Document submitted and awaiting admin verification.",
          assignedTo: "ADMIN",
          createdAt: doc.createdAt,
          ageInDays: docAge,
          isOverdue: docAge > 2,
        });
      }
    }

    // 2. Check info requests
    const pendingInfoReqs = infoRequests.filter((r: any) => r.status === "PENDING");
    for (const infoReq of pendingInfoReqs) {
      const infoAge = Math.floor((now.getTime() - new Date(infoReq.requestedAt).getTime()) / (1000 * 3600 * 24));
      actions.push({
        type: "INFO_REQUESTED",
        title: "Additional Information Requested",
        description: infoReq.informationRequired,
        assignedTo: "HOST",
        createdAt: infoReq.requestedAt,
        ageInDays: infoAge,
        isOverdue: infoReq.deadline ? new Date(infoReq.deadline) < now : infoAge > 5,
      });
    }

    // 3. Check compliance issues
    const openIssues = complianceIssues.filter((i: any) => i.status === "OPEN" || i.status === "UNDER_REVIEW");
    for (const issue of openIssues) {
      const issueAge = Math.floor((now.getTime() - new Date(issue.createdAt).getTime()) / (1000 * 3600 * 24));
      actions.push({
        type: "COMPLIANCE_ISSUE",
        title: `Compliance Issue: ${issue.issueType}`,
        description: issue.description,
        assignedTo: "ADMIN",
        createdAt: issue.createdAt,
        ageInDays: issueAge,
        isOverdue: issue.severity === "HIGH" || issue.severity === "CRITICAL" ? issueAge > 1 : issueAge > 3,
      });
    }

    // 4. Check unassigned reviewer
    if (!req.assignedReviewerId && req.status !== "APPROVED" && req.status !== "REJECTED") {
      const reqAge = Math.floor((now.getTime() - new Date(req.createdAt).getTime()) / (1000 * 3600 * 24));
      actions.push({
        type: "UNASSIGNED_REVIEWER",
        title: "Reviewer Assignment Required",
        description: "Application is unassigned. Assign a reviewer to begin processing.",
        assignedTo: "ADMIN",
        createdAt: req.createdAt,
        ageInDays: reqAge,
        isOverdue: reqAge > 1,
      });
    }

    // Determine current stage & stages progress
    let currentStage: OnboardingStageKey = "REGISTRATION";

    if (req.status === "APPROVED") {
      currentStage = (req.host?.status === "ACTIVE" || req.hostUser?.status === "ACTIVE") ? "ONBOARDING_COMPLETE" : "HOST_ACTIVATION";
    } else if (req.status === "REJECTED") {
      currentStage = "APPROVAL";
    } else if (req.complianceStatus === "COMPLIANT") {
      currentStage = "APPROVAL";
    } else if (req.complianceStatus === "UNDER_REVIEW" || req.complianceStatus === "ACTION_REQUIRED" || complianceChecks.length > 0) {
      currentStage = "COMPLIANCE_REVIEW";
    } else if (documents.length > 0) {
      currentStage = "DOCUMENT_VERIFICATION";
    } else if (req.status === "IN_REVIEW") {
      currentStage = "APPLICATION_REVIEW";
    } else if (req.applicantName && req.applicantEmail) {
      currentStage = "PROFILE_COMPLETION";
    }

    const stageMap: Record<OnboardingStageKey, StageProgressDetail> = {
      REGISTRATION: {
        stageKey: "REGISTRATION",
        label: "Registration Submitted",
        order: 1,
        status: "COMPLETED",
        completedAt: req.createdAt,
        reviewer: null,
        actionRequired: null,
      },
      PROFILE_COMPLETION: {
        stageKey: "PROFILE_COMPLETION",
        label: "Profile Completion",
        order: 2,
        status: req.applicantName && req.applicantEmail ? "COMPLETED" : "PENDING",
        completedAt: req.applicantName ? req.createdAt : null,
        reviewer: null,
        actionRequired: req.applicantName ? null : "Complete profile details",
      },
      APPLICATION_REVIEW: {
        stageKey: "APPLICATION_REVIEW",
        label: "Application Review",
        order: 3,
        status:
          req.status === "APPROVED" || req.complianceStatus === "COMPLIANT" || documents.length > 0
            ? "COMPLETED"
            : req.status === "IN_REVIEW"
            ? "IN_PROGRESS"
            : "PENDING",
        completedAt: req.reviewedAt || null,
        reviewer: req.assignedReviewer,
        actionRequired: !req.assignedReviewerId ? "Assign reviewer" : null,
      },
      DOCUMENT_VERIFICATION: {
        stageKey: "DOCUMENT_VERIFICATION",
        label: "Document Verification",
        order: 4,
        status:
          documents.length > 0 && documents.every((d: any) => d.status === "VERIFIED")
            ? "COMPLETED"
            : actions.some((a) => a.type === "REJECTED_DOCUMENT" || a.type === "MISSING_DOCUMENT")
            ? "ACTION_REQUIRED"
            : documents.length > 0
            ? "IN_PROGRESS"
            : "PENDING",
        completedAt: documents.length > 0 && documents.every((d: any) => d.status === "VERIFIED") ? req.updatedAt : null,
        reviewer: req.assignedReviewer,
        actionRequired: actions.find((a) => a.type === "REJECTED_DOCUMENT" || a.type === "MISSING_DOCUMENT")?.title || null,
      },
      COMPLIANCE_REVIEW: {
        stageKey: "COMPLIANCE_REVIEW",
        label: "Compliance Review",
        order: 5,
        status:
          req.complianceStatus === "COMPLIANT"
            ? "COMPLETED"
            : req.complianceStatus === "NON_COMPLIANT"
            ? "FAILED"
            : actions.some((a) => a.type === "COMPLIANCE_ISSUE" || a.type === "INFO_REQUESTED")
            ? "ACTION_REQUIRED"
            : req.complianceStatus === "UNDER_REVIEW"
            ? "IN_PROGRESS"
            : "PENDING",
        completedAt: req.complianceReviewedAt || null,
        reviewer: req.complianceReviewedBy || req.assignedReviewer,
        actionRequired: actions.find((a) => a.type === "COMPLIANCE_ISSUE" || a.type === "INFO_REQUESTED")?.title || null,
      },
      APPROVAL: {
        stageKey: "APPROVAL",
        label: "Approval Review",
        order: 6,
        status:
          req.status === "APPROVED"
            ? "COMPLETED"
            : req.status === "REJECTED"
            ? "FAILED"
            : req.complianceStatus === "COMPLIANT"
            ? "IN_PROGRESS"
            : "PENDING",
        completedAt: req.approvedAt || null,
        reviewer: req.approvedBy || req.assignedReviewer,
        actionRequired: req.status === "REJECTED" ? `Rejected: ${req.rejectionReason}` : null,
      },
      HOST_ACTIVATION: {
        stageKey: "HOST_ACTIVATION",
        label: "Host Activation",
        order: 7,
        status:
          req.status === "APPROVED" && (req.host?.status === "ACTIVE" || req.hostUser?.status === "ACTIVE" || req.hostId)
            ? "COMPLETED"
            : req.status === "APPROVED"
            ? "IN_PROGRESS"
            : "PENDING",
        completedAt: req.approvedAt || null,
        reviewer: req.approvedBy,
        actionRequired: null,
      },
      ONBOARDING_COMPLETE: {
        stageKey: "ONBOARDING_COMPLETE",
        label: "Onboarding Complete",
        order: 8,
        status: req.status === "APPROVED" && (req.host?.status === "ACTIVE" || req.hostUser?.status === "ACTIVE") ? "COMPLETED" : "PENDING",
        completedAt: req.approvedAt || null,
        reviewer: req.approvedBy,
        actionRequired: null,
      },
    };

    const completedStagesCount = Object.values(stageMap).filter((s) => s.status === "COMPLETED").length;
    const progressPercent = Math.round((completedStagesCount / 8) * 100);

    const daysInCurrentStage = Math.floor((now.getTime() - new Date(req.updatedAt).getTime()) / (1000 * 3600 * 24));
    const stageSLA = DEFAULT_STAGE_SLA_DAYS[currentStage] || 3;
    const isOverdue = daysInCurrentStage > stageSLA && req.status !== "APPROVED" && req.status !== "REJECTED";

    return {
      currentStage,
      stageMap,
      actions,
      completedStagesCount,
      progressPercent,
      daysInCurrentStage,
      isOverdue,
    };
  }

  /**
   * Paginated & Searchable List of Onboarding Records
   */
  async listOnboardingRecords(options: ListOnboardingOptions) {
    const page = options.page || 1;
    const pageSize = options.pageSize || 10;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (options.search && options.search.trim()) {
      const query = options.search.trim();
      where.OR = [
        { applicantName: { contains: query, mode: "insensitive" } },
        { applicantEmail: { contains: query, mode: "insensitive" } },
        { applicationId: { contains: query, mode: "insensitive" } },
      ];
    }

    if (options.overallStatus && options.overallStatus !== "ALL") {
      where.status = options.overallStatus;
    }

    if (options.reviewerId && options.reviewerId !== "ALL") {
      if (options.reviewerId === "UNASSIGNED") {
        where.assignedReviewerId = null;
      } else {
        where.assignedReviewerId = options.reviewerId;
      }
    }

    const [total, requests] = await Promise.all([
      db.hostRegistrationRequest.count({ where }),
      db.hostRegistrationRequest.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { updatedAt: options.sortOrder || "desc" },
        include: {
          assignedReviewer: { select: { id: true, name: true, email: true } },
          approvedBy: { select: { id: true, name: true, email: true } },
          complianceReviewedBy: { select: { id: true, name: true, email: true } },
          documents: true,
          complianceChecks: true,
          complianceIssues: true,
          infoRequests: true,
          host: { select: { id: true, name: true, email: true, status: true } },
        },
      }),
    ]);

    let items: HostOnboardingOverview[] = requests.map((req: any) => {
      const derived = this.deriveOnboardingDetails(req);
      const stageConfig = ONBOARDING_STAGES.find((s) => s.key === derived.currentStage);

      return {
        id: req.id,
        applicationId: req.applicationId,
        applicantName: req.applicantName,
        applicantEmail: req.applicantEmail,
        applicantPhone: req.applicantPhone,
        overallStatus: req.status,
        currentStage: derived.currentStage,
        currentStageLabel: stageConfig ? stageConfig.label : derived.currentStage,
        progressPercent: derived.progressPercent,
        completedStagesCount: derived.completedStagesCount,
        totalStagesCount: 8,
        reviewer: req.assignedReviewer,
        submittedAt: req.createdAt,
        updatedAt: req.updatedAt,
        daysInCurrentStage: derived.daysInCurrentStage,
        isOverdue: derived.isOverdue,
        actionRequired: derived.actions,
      };
    });

    // Post-filter by derived stage or overdue if requested
    if (options.stage && options.stage !== "ALL") {
      items = items.filter((item) => item.currentStage === options.stage);
    }

    if (options.actionRequiredOnly) {
      items = items.filter((item) => item.actionRequired.length > 0);
    }

    if (options.overdueOnly) {
      items = items.filter((item) => item.isOverdue);
    }

    return {
      items,
      pagination: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * Detailed Onboarding View for a single Host Application
   */
  async getHostOnboardingDetail(requestId: string) {
    const req = await db.hostRegistrationRequest.findUnique({
      where: { id: requestId },
      include: {
        assignedReviewer: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        complianceReviewedBy: { select: { id: true, name: true, email: true } },
        documents: true,
        complianceChecks: { include: { reviewer: { select: { id: true, name: true, email: true } } } },
        complianceIssues: {
          include: {
            createdBy: { select: { id: true, name: true, email: true } },
            resolvedBy: { select: { id: true, name: true, email: true } },
          },
        },
        infoRequests: { include: { requestedBy: { select: { id: true, name: true, email: true } } } },
        host: { select: { id: true, name: true, email: true, status: true, createdAt: true } },
      },
    });

    if (!req) throw AppError.notFound("Host registration request not found");

    const derived = this.deriveOnboardingDetails(req);
    const stageConfig = ONBOARDING_STAGES.find((s) => s.key === derived.currentStage);

    // Fetch timeline from audit logs
    const activityLogs = await auditService.list({
      resourceType: "HOST_REGISTRATION",
      limit: 50,
    });

    const filteredLogs = activityLogs.items.filter((l: any) => !l.resourceId || l.resourceId === requestId);

    return {
      id: req.id,
      applicationId: req.applicationId,
      applicantName: req.applicantName,
      applicantEmail: req.applicantEmail,
      applicantPhone: req.applicantPhone,
      registrationType: req.registrationType,
      businessName: req.businessName,
      location: req.location,
      overallStatus: req.status,
      currentStage: derived.currentStage,
      currentStageLabel: stageConfig ? stageConfig.label : derived.currentStage,
      progressPercent: derived.progressPercent,
      completedStagesCount: derived.completedStagesCount,
      totalStagesCount: 8,
      daysInCurrentStage: derived.daysInCurrentStage,
      isOverdue: derived.isOverdue,
      slaDaysThreshold: DEFAULT_STAGE_SLA_DAYS[derived.currentStage] || 3,
      assignedReviewer: req.assignedReviewer,
      submittedAt: req.createdAt,
      updatedAt: req.updatedAt,
      stageMap: derived.stageMap,
      stageList: ONBOARDING_STAGES.map((st) => ({
        ...st,
        ...derived.stageMap[st.key],
      })),
      actionsRequired: derived.actions,
      hostUser: req.host || req.hostUser,
      timeline: filteredLogs.map((log: any) => ({
        id: log.id,
        action: log.action,
        description: log.description,
        timestamp: log.createdAt,
        actorEmail: log.actorEmail,
      })),
    };
  }

  /**
   * Dashboard Summary Metrics & Pipeline Kanban Breakdown
   */
  async getDashboardAndPipeline() {
    const allRequests = await db.hostRegistrationRequest.findMany({
      include: {
        assignedReviewer: { select: { id: true, name: true, email: true } },
        documents: true,
        complianceChecks: true,
        complianceIssues: true,
        infoRequests: true,
        host: { select: { id: true, status: true } },
      },
    });

    const pipelineCounts: Record<OnboardingStageKey, number> = {
      REGISTRATION: 0,
      PROFILE_COMPLETION: 0,
      APPLICATION_REVIEW: 0,
      DOCUMENT_VERIFICATION: 0,
      COMPLIANCE_REVIEW: 0,
      APPROVAL: 0,
      HOST_ACTIVATION: 0,
      ONBOARDING_COMPLETE: 0,
    };

    let totalOnboarding = allRequests.length;
    let pendingReview = 0;
    let documentsPending = 0;
    let compliancePending = 0;
    let actionRequired = 0;
    let approved = 0;
    let completed = 0;
    let rejected = 0;
    let overdue = 0;

    for (const req of allRequests) {
      const derived = this.deriveOnboardingDetails(req);
      pipelineCounts[derived.currentStage] = (pipelineCounts[derived.currentStage] || 0) + 1;

      if (req.status === "PENDING" || req.status === "IN_REVIEW") pendingReview++;
      if (req.status === "WAITING_FOR_DOCUMENTS" || req.documents.some((d: any) => d.status === "PENDING")) documentsPending++;
      if (req.complianceStatus === "PENDING" || req.complianceStatus === "UNDER_REVIEW") compliancePending++;
      if (derived.actions.length > 0 || req.complianceStatus === "ACTION_REQUIRED") actionRequired++;
      if (req.status === "APPROVED") approved++;
      if (req.status === "APPROVED" && (req.host?.status === "ACTIVE" || req.hostUser?.status === "ACTIVE")) completed++;
      if (req.status === "REJECTED") rejected++;
      if (derived.isOverdue) overdue++;
    }

    return {
      metrics: {
        totalOnboarding,
        pendingReview,
        documentsPending,
        compliancePending,
        actionRequired,
        approved,
        completed,
        rejected,
        overdue,
      },
      pipeline: ONBOARDING_STAGES.map((st) => ({
        stageKey: st.key,
        label: st.label,
        order: st.order,
        count: pipelineCounts[st.key] || 0,
      })),
    };
  }

  /**
   * Reviewer Workload Breakdown
   */
  async getReviewerWorkload() {
    const reviewers = await db.user.findMany({
      where: {
        role: "ADMIN",
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    const requests = await db.hostRegistrationRequest.findMany({
      include: {
        documents: true,
        complianceIssues: true,
        infoRequests: true,
      },
    });

    const workloadMap: Record<
      string,
      {
        reviewer: { id: string; name: string | null; email: string | null };
        assignedCount: number;
        pendingCount: number;
        actionRequiredCount: number;
        completedCount: number;
      }
    > = {};

    for (const rev of reviewers) {
      workloadMap[rev.id] = {
        reviewer: rev,
        assignedCount: 0,
        pendingCount: 0,
        actionRequiredCount: 0,
        completedCount: 0,
      };
    }

    for (const req of requests) {
      if (req.assignedReviewerId && workloadMap[req.assignedReviewerId]) {
        const entry = workloadMap[req.assignedReviewerId];
        entry.assignedCount++;

        if (req.status === "IN_REVIEW" || req.status === "PENDING") {
          entry.pendingCount++;
        }
        const derived = this.deriveOnboardingDetails(req);
        if (derived.actions.length > 0) {
          entry.actionRequiredCount++;
        }
        if (req.status === "APPROVED" || req.status === "REJECTED") {
          entry.completedCount++;
        }
      }
    }

    return Object.values(workloadMap);
  }

  /**
   * Onboarding Analytics & Stage Funnel Conversion Rates
   */
  async getOnboardingAnalytics() {
    const requests = await db.hostRegistrationRequest.findMany({
      include: {
        documents: true,
        host: { select: { id: true, status: true } },
      },
    });

    const totalRegistered = requests.length;
    const totalSubmitted = requests.filter((r: any) => r.applicantName && r.applicantEmail).length;
    const totalVerified = requests.filter((r: any) => r.documents.length > 0 && r.documents.every((d: any) => d.status === "VERIFIED")).length;
    const totalApproved = requests.filter((r: any) => r.status === "APPROVED").length;
    const totalCompleted = requests.filter((r: any) => r.status === "APPROVED" && (r.host?.status === "ACTIVE" || r.hostUser?.status === "ACTIVE")).length;
    const totalRejected = requests.filter((r: any) => r.status === "REJECTED").length;

    // Calculate conversion rates
    const regToSubmittedRate = totalRegistered > 0 ? Math.round((totalSubmitted / totalRegistered) * 100) : 0;
    const submittedToVerifiedRate = totalSubmitted > 0 ? Math.round((totalVerified / totalSubmitted) * 100) : 0;
    const verifiedToApprovedRate = totalVerified > 0 ? Math.round((totalApproved / totalVerified) * 100) : 0;
    const approvedToCompletedRate = totalApproved > 0 ? Math.round((totalCompleted / totalApproved) * 100) : 0;

    // Calculate completion times for approved requests
    const approvedReqs = requests.filter((r: any) => r.approvedAt);
    let avgCompletionDays = 0;
    if (approvedReqs.length > 0) {
      const totalDays = approvedReqs.reduce((acc: number, r: any) => {
        const diffMs = new Date(r.approvedAt).getTime() - new Date(r.createdAt).getTime();
        return acc + diffMs / (1000 * 3600 * 24);
      }, 0);
      avgCompletionDays = Math.round((totalDays / approvedReqs.length) * 10) / 10;
    }

    return {
      funnel: [
        { stage: "Registered → Submitted", rate: regToSubmittedRate, count: totalSubmitted },
        { stage: "Submitted → Verified", rate: submittedToVerifiedRate, count: totalVerified },
        { stage: "Verified → Approved", rate: verifiedToApprovedRate, count: totalApproved },
        { stage: "Approved → Completed", rate: approvedToCompletedRate, count: totalCompleted },
      ],
      summary: {
        totalRegistered,
        totalSubmitted,
        totalVerified,
        totalApproved,
        totalCompleted,
        totalRejected,
        avgCompletionDays,
      },
    };
  }

  /**
   * Enforces backend workflow state transition & logs audit trail
   */
  async updateOnboardingStage(
    actor: AuthUser,
    requestId: string,
    targetStage: OnboardingStageKey,
    reason?: string
  ) {
    const req = await db.hostRegistrationRequest.findUnique({
      where: { id: requestId },
      include: { documents: true, complianceChecks: true, complianceIssues: true },
    });

    if (!req) throw AppError.notFound("Host registration request not found");

    // Workflow business rules validation
    if (targetStage === "APPROVAL" || targetStage === "HOST_ACTIVATION" || targetStage === "ONBOARDING_COMPLETE") {
      const unverified = req.documents.filter((d: any) => d.status !== "VERIFIED");
      if (unverified.length > 0) {
        throw AppError.badRequest("Cannot advance stage: Documents are not fully verified.");
      }
      if (req.complianceStatus !== "COMPLIANT") {
        throw AppError.badRequest("Cannot advance stage: Compliance status is not COMPLIANT.");
      }
    }

    const previousStage = req.onboardingStage || "REGISTRATION";

    const updated = await db.hostRegistrationRequest.update({
      where: { id: requestId },
      data: {
        onboardingStage: targetStage,
        updatedAt: new Date(),
      },
    });

    await auditService.record({
      actorId: actor.id,
      actorEmail: actor.email,
      action: "ONBOARDING_STAGE_CHANGED",
      resourceType: "HOST_REGISTRATION",
      resourceId: requestId,
      description: `Transitioned onboarding stage from ${previousStage} to ${targetStage}${reason ? `. Reason: ${reason}` : ""}`,
    });

    return updated;
  }
}

export const hostOnboardingService = new HostOnboardingService();
