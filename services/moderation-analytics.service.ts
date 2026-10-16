import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import type { AuthUser } from "@/lib/auth/types";
import { Role, ModerationTargetType, ModerationCaseStatus, ReviewDirection } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { jobQueueService } from "@/services/job-queue.service";

export type AnalyticsPeriod = "today" | "7d" | "30d" | "90d" | "all" | "custom";

export interface ModerationAnalyticsQuery {
  period?: AnalyticsPeriod;
  startDate?: string;
  endDate?: string;
  targetType?: string;
  status?: string;
  moderatorId?: string;
}

export interface ModerationKpis {
  totalReports: number;
  totalCases: number;
  openCases: number;
  pendingReview: number;
  underInvestigation: number;
  assignedCases: number;
  resolvedCases: number;
  closedCases: number;
  overdueCases: number;
  avgResolutionTimeHours: number;
  enforcementActions: number;
  pendingAppeals: number;
}

export interface ModerationAnalyticsPayload {
  dateRange: {
    period: AnalyticsPeriod;
    start: string | null;
    end: string | null;
  };
  kpis: ModerationKpis;
  reportAnalytics: {
    total: number;
    byTargetType: Array<{ targetType: string; count: number }>;
    byUserRole: { guest: number; host: number; adminOrOther: number };
    topCategories: Array<{ category: string; count: number }>;
    duplicateReportsLinked: number;
    trends: Array<{ date: string; reports: number; cases: number; resolved: number }>;
  };
  targetTypeAnalytics: {
    listings: {
      totalReports: number;
      distinctListings: number;
      activeCases: number;
      resolvedCases: number;
      enforcements: number;
      avgResolutionHours: number;
    };
    reviews: {
      totalReports: number;
      distinctReviews: number;
      activeCases: number;
      resolvedCases: number;
      guestToProperty: number;
      hostToGuest: number;
      hiddenOrRemoved: number;
    };
    media: {
      totalReports: number;
      distinctMedia: number;
      activeCases: number;
      resolvedCases: number;
      removedOrHidden: number;
    };
    usersAndMessages: {
      userReports: number;
      distinctUsers: number;
      messageReports: number;
      distinctMessages: number;
      warnings: number;
      restrictions: number;
      suspensions: number;
    };
  };
  enforcementAnalytics: {
    totalEnforcements: number;
    warnings: number;
    restrictions: number;
    suspensions: number;
    reinstatements: number;
    contentRemovals: number;
    recentActions: Array<{
      id: string;
      action: string;
      caseReference: string;
      createdAt: string;
      actorName: string;
    }>;
  };
  appealsAnalytics: {
    total: number;
    pending: number;
    underReview: number;
    approved: number;
    rejected: number;
    withdrawn: number;
    approvalRate: number;
    avgResolutionHours: number;
  };
  moderatorWorkload: Array<{
    moderatorId: string;
    name: string;
    email: string;
    assignedCases: number;
    activeCases: number;
    resolvedCases: number;
    overdueCases: number;
    avgResolutionHours: number;
    workloadStatus: "NORMAL" | "HIGH" | "CRITICAL";
  }>;
  slaMetrics: {
    standardSlaHours: number;
    highPrioritySlaHours: number;
    onTimeResolutionRate: number | null;
    overdueCount: number;
    breachedCount: number;
  };
  evidenceAndRfi: {
    totalRfis: number;
    pendingResponse: number;
    completed: number;
    overdue: number;
    totalEvidenceItems: number;
  };
  operational: {
    highPriorityOpenCases: number;
    unassignedOpenCases: number;
    recentActivity: Array<{
      id: string;
      action: string;
      createdAt: string;
      actor: { name: string | null; email: string | null } | null;
      case: { id: string; caseReference: string };
    }>;
  };
  jobHealth: {
    phase8AiStatus: "DEFERRED_NOT_ACTIVE";
    queueStats: any;
  };
}

function parseAnalyticsDate(value: string, boundary: "start" | "end"): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, boundary === "end" ? 23 : 0, boundary === "end" ? 59 : 0, boundary === "end" ? 59 : 0, boundary === "end" ? 999 : 0));
  }

  return new Date(value);
}

export function resolveModerationAnalyticsDateRange(query: ModerationAnalyticsQuery): {
  period: AnalyticsPeriod;
  start: Date | null;
  end: Date | null;
} {
  const period = query.period || (query.startDate || query.endDate ? "custom" : "30d");
  if (!(["today", "7d", "30d", "90d", "all", "custom"] as AnalyticsPeriod[]).includes(period)) {
    throw AppError.badRequest("Invalid analytics period.");
  }
  const now = new Date();

  if (period === "today") {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    return { period, start, end: now };
  }
  if (period === "7d") {
    const start = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    return { period, start, end: now };
  }
  if (period === "30d") {
    const start = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    return { period, start, end: now };
  }
  if (period === "90d") {
    const start = new Date(now.getTime() - 90 * 24 * 3600 * 1000);
    return { period, start, end: now };
  }
  if (period === "all") {
    return { period, start: null, end: null };
  }

  // Custom date range
  const start = query.startDate ? parseAnalyticsDate(query.startDate, "start") : null;
  const end = query.endDate ? parseAnalyticsDate(query.endDate, "end") : null;
  if (start && Number.isNaN(start.getTime())) throw AppError.badRequest("Invalid startDate format.");
  if (end && Number.isNaN(end.getTime())) throw AppError.badRequest("Invalid endDate format.");
  if (start && end && start > end) throw AppError.badRequest("startDate must be before or equal to endDate.");

  return { period: "custom", start, end };
}

const ACTIVE_STATUSES: ModerationCaseStatus[] = ["NEW", "IN_REVIEW", "NEEDS_INFORMATION", "REOPENED"];
const ENFORCEMENT_ACTIONS = [
  "CONTENT_WARNED",
  "ACCOUNT_WARNED",
  "ACCOUNT_RESTRICTED",
  "ACCOUNT_SUSPENDED",
  "REVIEW_HIDDEN",
  "REVIEW_DELETED",
  "LISTING_SUSPENDED",
  "LISTING_WARNED",
  "LISTING_MUTED",
  "MESSAGE_ENFORCEMENT",
];

let lastSuccessfulDbProbeAt = 0;

async function assertAnalyticsDatabaseAvailable(): Promise<void> {
  const now = Date.now();
  if (now - lastSuccessfulDbProbeAt < 60_000) {
    return;
  }

  try {
    if (!prisma || typeof (prisma as any).moderationCase === "undefined") {
      throw new Error("Moderation database model is unavailable");
    }
    await (prisma as any).moderationCase.count({ take: 1 });
    lastSuccessfulDbProbeAt = now;
  } catch {
    throw AppError.serviceUnavailable("Moderation analytics is temporarily unavailable. Please retry.");
  }
}

export async function getModerationAnalytics(
  actor: AuthUser,
  query: ModerationAnalyticsQuery = {}
): Promise<ModerationAnalyticsPayload> {
  const { period, start, end } = resolveModerationAnalyticsDateRange(query);
  await assertAnalyticsDatabaseAvailable();

  const reportDateFilter: Prisma.ModerationReportWhereInput = {};
  const caseDateFilter: Prisma.ModerationCaseWhereInput = {};
  const activityDateFilter: Prisma.ModerationActivityWhereInput = {};

  if (start || end) {
    reportDateFilter.createdAt = {
      ...(start ? { gte: start } : {}),
      ...(end ? { lte: end } : {}),
    };
    caseDateFilter.createdAt = {
      ...(start ? { gte: start } : {}),
      ...(end ? { lte: end } : {}),
    };
    activityDateFilter.createdAt = {
      ...(start ? { gte: start } : {}),
      ...(end ? { lte: end } : {}),
    };
  }

  if (query.targetType && query.targetType !== "ALL") {
    reportDateFilter.targetType = query.targetType as ModerationTargetType;
    caseDateFilter.targetType = query.targetType as ModerationTargetType;
  }
  if (query.status && query.status !== "ALL") {
    caseDateFilter.status = query.status as ModerationCaseStatus;
  }
  if (query.moderatorId) {
    caseDateFilter.assignedModeratorId = query.moderatorId;
  }

  const now = new Date();
  const overdueThreshold72h = new Date(now.getTime() - 72 * 3600 * 1000);
  const overdueThreshold24h = new Date(now.getTime() - 24 * 3600 * 1000);

  // 1. Parallel Aggregation Queries (optimized with indexes)
  const [
    totalReports,
    totalCases,
    openCases,
    pendingReview,
    underInvestigation,
    assignedCases,
    resolvedCases,
    dismissedCases,
    overdueOpenCases,
    casesByTargetType,
    reportsByTargetType,
    reportsByCategory,
    resolvedCasesData,
    enforcementActivities,
    appealActivities,
    allModerators,
    rfiActivities,
    queueStats,
    reporterRolesData,
    highPriorityOpenCases,
    unassignedOpenCases,
    recentActivity,
  ] = await Promise.all([
    // Total Reports
    prisma.moderationReport.count({ where: reportDateFilter }),
    // Total Cases
    prisma.moderationCase.count({ where: caseDateFilter }),
    // Open Cases
    prisma.moderationCase.count({
      where: { ...caseDateFilter, status: { in: ACTIVE_STATUSES } },
    }),
    // Pending Review
    prisma.moderationCase.count({
      where: { ...caseDateFilter, status: "NEW" },
    }),
    // Under Investigation
    prisma.moderationCase.count({
      where: { ...caseDateFilter, status: "IN_REVIEW" },
    }),
    // Assigned Cases
    prisma.moderationCase.count({
      where: { ...caseDateFilter, assignedModeratorId: { not: null } },
    }),
    // Resolved Cases
    prisma.moderationCase.count({
      where: { ...caseDateFilter, status: "RESOLVED" },
    }),
    // Dismissed Cases
    prisma.moderationCase.count({
      where: { ...caseDateFilter, status: "DISMISSED" },
    }),
    // Overdue Cases (> 72 hours open)
    prisma.moderationCase.count({
      where: {
        ...caseDateFilter,
        status: { in: ACTIVE_STATUSES },
        createdAt: { lte: overdueThreshold72h },
      },
    }),
    // Cases by Target Type
    prisma.moderationCase.groupBy({
      by: ["targetType"],
      where: caseDateFilter,
      _count: { _all: true },
    }),
    // Reports by Target Type
    prisma.moderationReport.groupBy({
      by: ["targetType"],
      where: reportDateFilter,
      _count: { _all: true },
    }),
    // Reports by Category
    prisma.moderationReport.groupBy({
      by: ["category"],
      where: reportDateFilter,
      _count: { _all: true },
    }),
    // Resolved cases with createdAt and resolvedAt for SLA calculation
    prisma.moderationCase.findMany({
      where: {
        ...caseDateFilter,
        status: "RESOLVED",
        resolvedAt: { not: null },
      },
      select: {
        id: true,
        targetType: true,
        priority: true,
        createdAt: true,
        resolvedAt: true,
        assignedModeratorId: true,
      },
    }),
    // Enforcement activities in period
    prisma.moderationActivity.findMany({
      where: {
        ...activityDateFilter,
        action: {
          in: [
            ...ENFORCEMENT_ACTIONS,
            "ACCOUNT_RESTRICTION_LIFTED",
            "ACCOUNT_RESTRICTION_EXPIRED",
            "ACCOUNT_REINSTATED",
          ],
        },
      },
      select: {
        id: true,
        action: true,
        createdAt: true,
        metadata: true,
        actor: { select: { id: true, name: true, email: true } },
        case: { select: { id: true, caseReference: true, targetType: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Appeal activities
    prisma.moderationActivity.findMany({
      where: {
        ...activityDateFilter,
        action: {
          in: [
            "APPEAL_SUBMITTED",
            "APPEAL_REVIEWER_ASSIGNED",
            "APPEAL_DECISION_RECORDED",
            "APPEAL_WITHDRAWN",
          ],
        },
      },
      select: {
        id: true,
        action: true,
        createdAt: true,
        metadata: true,
      },
    }),
    // Active moderators with assigned case distribution
    prisma.user.findMany({
      where: {
        role: Role.ADMIN,
        status: "ACTIVE",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    }),
    // RFI activities
    prisma.moderationActivity.findMany({
      where: {
        ...activityDateFilter,
        action: { in: ["INFORMATION_REQUESTED", "INFORMATION_RESPONDED", "INFORMATION_REQUEST_CLOSED"] },
      },
      select: { id: true, action: true, createdAt: true, metadata: true },
    }),
    // Background Job Queue Health from Phase 7
    jobQueueService.getQueueStats().catch(() => null),
    // Reporter roles distribution
    prisma.moderationReport.findMany({
      where: reportDateFilter,
      select: {
        reporter: { select: { role: true } },
        caseId: true,
      },
    }),
    // Open cases that need the most immediate attention in the selected range.
    prisma.moderationCase.count({
      where: {
        ...caseDateFilter,
        status: { in: ACTIVE_STATUSES },
        OR: [{ severity: { in: ["HIGH", "CRITICAL"] } }, { priority: { gte: 1 } }],
      },
    }),
    // Open cases without an assigned moderator in the selected range.
    prisma.moderationCase.count({
      where: { ...caseDateFilter, status: { in: ACTIVE_STATUSES }, assignedModeratorId: null },
    }),
    prisma.moderationActivity.findMany({
      where: { case: { is: caseDateFilter } },
      take: 12,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        action: true,
        createdAt: true,
        actor: { select: { name: true, email: true } },
        case: { select: { id: true, caseReference: true } },
      },
    }),
  ]);

  // 2. Average Resolution Time Computation (Excluding unresolved cases per Task 11)
  let totalResolutionTimeMs = 0;
  for (const c of resolvedCasesData) {
    if (c.resolvedAt) {
      totalResolutionTimeMs += new Date(c.resolvedAt).getTime() - new Date(c.createdAt).getTime();
    }
  }
  const avgResolutionTimeHours =
    resolvedCasesData.length > 0
      ? Math.round((totalResolutionTimeMs / (resolvedCasesData.length * 3600 * 1000)) * 10) / 10
      : 0;

  // 3. User Roles Breakdown
  let guestReports = 0;
  let hostReports = 0;
  let adminOrOtherReports = 0;
  const linkedCaseIds = new Set<string>();
  let duplicateReportsLinked = 0;

  for (const r of reporterRolesData) {
    const role = r.reporter?.role;
    if (role === Role.USER) guestReports++;
    else if (role === Role.HOST) hostReports++;
    else adminOrOtherReports++;

    if (r.caseId) {
      if (linkedCaseIds.has(r.caseId)) {
        duplicateReportsLinked++;
      } else {
        linkedCaseIds.add(r.caseId);
      }
    }
  }

  // 4. Time-series Daily Trends (Last 14 days or in-range days)
  const trendBuckets = new Map<string, { reports: number; cases: number; resolved: number }>();
  const trendStart = start || new Date(now.getTime() - 14 * 24 * 3600 * 1000);
  const trendEnd = end || now;

  const cur = new Date(trendStart);
  while (cur <= trendEnd) {
    const dateKey = cur.toISOString().slice(0, 10);
    trendBuckets.set(dateKey, { reports: 0, cases: 0, resolved: 0 });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  // Aggregate trend counts
  const recentReports = await prisma.moderationReport.findMany({
    where: {
      ...reportDateFilter,
      createdAt: { gte: trendStart, lte: trendEnd },
    },
    select: { createdAt: true },
  });
  for (const r of recentReports) {
    const key = new Date(r.createdAt).toISOString().slice(0, 10);
    const bucket = trendBuckets.get(key);
    if (bucket) bucket.reports++;
  }

  const recentCases = await prisma.moderationCase.findMany({
    where: {
      ...caseDateFilter,
      createdAt: { gte: trendStart, lte: trendEnd },
    },
    select: { createdAt: true },
  });
  for (const c of recentCases) {
    const key = new Date(c.createdAt).toISOString().slice(0, 10);
    const bucket = trendBuckets.get(key);
    if (bucket) bucket.cases++;
  }

  for (const c of resolvedCasesData) {
    if (c.resolvedAt) {
      const key = new Date(c.resolvedAt).toISOString().slice(0, 10);
      const bucket = trendBuckets.get(key);
      if (bucket) bucket.resolved++;
    }
  }

  const trends = Array.from(trendBuckets.entries()).map(([date, counts]) => ({
    date,
    ...counts,
  }));

  // 5. Target Type Specific Analytics
  // Listings
  const listingReports: any[] = await prisma.moderationReport.findMany({
    where: { ...reportDateFilter, targetType: "LISTING" },
    select: { targetId: true },
  });
  const distinctListings = new Set(listingReports.map((r: any) => r.targetId)).size;
  const listingCases: any[] = await prisma.moderationCase.findMany({
    where: { ...caseDateFilter, targetType: "LISTING" },
    select: { id: true, status: true, createdAt: true, resolvedAt: true },
  });
  const activeListingCases = listingCases.filter((c: any) => ACTIVE_STATUSES.includes(c.status)).length;
  const resolvedListingCases = listingCases.filter((c: any) => c.status === "RESOLVED").length;
  let listingResolutionMs = 0;
  for (const c of listingCases) {
    if (c.resolvedAt) listingResolutionMs += new Date(c.resolvedAt).getTime() - new Date(c.createdAt).getTime();
  }
  const avgListingHours = resolvedListingCases > 0
    ? Math.round((listingResolutionMs / (resolvedListingCases * 3600 * 1000)) * 10) / 10
    : 0;

  // Reviews
  const reviewReports: any[] = await prisma.moderationReport.findMany({
    where: { ...reportDateFilter, targetType: "REVIEW" },
    select: { targetId: true },
  });
  const distinctReviews = new Set(reviewReports.map((r: any) => r.targetId)).size;
  const reviewIds = Array.from(new Set(reviewReports.map((r: any) => r.targetId)));
  const reportedReviewEntities: any[] = reviewIds.length > 0
    ? await prisma.review.findMany({
        where: { id: { in: reviewIds } },
        select: { id: true, direction: true, status: true },
      })
    : [];
  const guestToPropertyCount = reportedReviewEntities.filter((r: any) => r.direction === ReviewDirection.GUEST_TO_PROPERTY).length;
  const hostToGuestCount = reportedReviewEntities.filter((r: any) => r.direction === ReviewDirection.HOST_TO_GUEST).length;
  const hiddenOrRemovedCount = reportedReviewEntities.filter((r: any) => r.status === "REMOVED" || r.status === "HIDDEN").length;

  const reviewCases: any[] = await prisma.moderationCase.findMany({
    where: { ...caseDateFilter, targetType: "REVIEW" },
    select: { id: true, status: true },
  });
  const activeReviewCases = reviewCases.filter((c: any) => ACTIVE_STATUSES.includes(c.status)).length;
  const resolvedReviewCases = reviewCases.filter((c: any) => c.status === "RESOLVED").length;

  // Media
  const mediaReports: any[] = await prisma.moderationReport.findMany({
    where: { ...reportDateFilter, targetType: "LISTING_PHOTO" },
    select: { targetId: true },
  });
  const distinctMedia = new Set(mediaReports.map((r: any) => r.targetId)).size;
  const mediaCases: any[] = await prisma.moderationCase.findMany({
    where: { ...caseDateFilter, targetType: "LISTING_PHOTO" },
    select: { id: true, status: true },
  });
  const activeMediaCases = mediaCases.filter((c: any) => ACTIVE_STATUSES.includes(c.status)).length;
  const resolvedMediaCases = mediaCases.filter((c: any) => c.status === "RESOLVED").length;
  const mediaEnforcements = (enforcementActivities as any[]).filter(
    (a: any) => a.case?.targetType === "LISTING_PHOTO" && a.action.includes("PHOTO")
  ).length;

  // Users & Messages
  const userReports: any[] = await prisma.moderationReport.findMany({
    where: { ...reportDateFilter, targetType: "USER" },
    select: { targetId: true },
  });
  const distinctUsers = new Set(userReports.map((r: any) => r.targetId)).size;

  const messageReports: any[] = await prisma.moderationReport.findMany({
    where: { ...reportDateFilter, targetType: "MESSAGE" },
    select: { targetId: true },
  });
  const distinctMessages = new Set(messageReports.map((r: any) => r.targetId)).size;

  // 6. Enforcement Breakdowns
  let warningCount = 0;
  let restrictionCount = 0;
  let suspensionCount = 0;
  let reinstatementCount = 0;
  let removalCount = 0;

  for (const a of enforcementActivities) {
    if (a.action === "ACCOUNT_WARNED" || a.action === "CONTENT_WARNED" || a.action === "LISTING_WARNED") {
      warningCount++;
    } else if (a.action === "ACCOUNT_RESTRICTED") {
      restrictionCount++;
    } else if (a.action === "ACCOUNT_SUSPENDED") {
      suspensionCount++;
    } else if (a.action === "ACCOUNT_REINSTATED" || a.action === "ACCOUNT_RESTRICTION_LIFTED") {
      reinstatementCount++;
    } else if (
      a.action === "REVIEW_HIDDEN" ||
      a.action === "REVIEW_DELETED" ||
      a.action === "LISTING_SUSPENDED" ||
      a.action === "MESSAGE_ENFORCEMENT"
    ) {
      removalCount++;
    }
  }

  // 7. Appeals Breakdown
  let appealSubmittedCount = 0;
  let appealApprovedCount = 0;
  let appealRejectedCount = 0;
  let appealWithdrawnCount = 0;
  let totalAppealResolutionTimeMs = 0;

  for (const a of appealActivities) {
    if (a.action === "APPEAL_SUBMITTED") appealSubmittedCount++;
    else if (a.action === "APPEAL_DECISION_RECORDED") {
      const outcome = (a.metadata as any)?.outcome;
      if (outcome === "APPROVED") appealApprovedCount++;
      else if (outcome === "REJECTED") appealRejectedCount++;

      const submittedAt = (a.metadata as any)?.submittedAt;
      if (submittedAt) {
        totalAppealResolutionTimeMs += new Date(a.createdAt).getTime() - new Date(submittedAt).getTime();
      }
    } else if (a.action === "APPEAL_WITHDRAWN") {
      appealWithdrawnCount++;
    }
  }

  const decidedAppeals = appealApprovedCount + appealRejectedCount;
  const appealApprovalRate =
    decidedAppeals > 0 ? Math.round((appealApprovedCount / decidedAppeals) * 100) : 0;
  const avgAppealHours =
    decidedAppeals > 0
      ? Math.round((totalAppealResolutionTimeMs / (decidedAppeals * 3600 * 1000)) * 10) / 10
      : 0;

  // 8. Moderator Workload & Productivity
  const activeAssignedCases = await prisma.moderationCase.findMany({
    where: {
      status: { in: ACTIVE_STATUSES },
      assignedModeratorId: { not: null },
    },
    select: {
      id: true,
      assignedModeratorId: true,
      createdAt: true,
      priority: true,
    },
  });

  const moderatorWorkload = (allModerators as any[]).map((mod: any) => {
    const modActiveCases = (activeAssignedCases as any[]).filter((c: any) => c.assignedModeratorId === mod.id);
    const modResolvedCases = (resolvedCasesData as any[]).filter((c: any) => c.assignedModeratorId === mod.id);
    const modOverdueCases = modActiveCases.filter(
      (c: any) => new Date(c.createdAt) <= overdueThreshold72h
    ).length;

    let resTimeMs = 0;
    for (const c of modResolvedCases) {
      if (c.resolvedAt) {
        resTimeMs += new Date(c.resolvedAt).getTime() - new Date(c.createdAt).getTime();
      }
    }
    const avgModHours =
      modResolvedCases.length > 0
        ? Math.round((resTimeMs / (modResolvedCases.length * 3600 * 1000)) * 10) / 10
        : 0;

    let workloadStatus: "NORMAL" | "HIGH" | "CRITICAL" = "NORMAL";
    if (modActiveCases.length > 20 || modOverdueCases > 5) {
      workloadStatus = "CRITICAL";
    } else if (modActiveCases.length > 10 || modOverdueCases > 2) {
      workloadStatus = "HIGH";
    }

    return {
      moderatorId: mod.id,
      name: mod.name || "Moderator",
      email: mod.email || "",
      assignedCases: modActiveCases.length + modResolvedCases.length,
      activeCases: modActiveCases.length,
      resolvedCases: modResolvedCases.length,
      overdueCases: modOverdueCases,
      avgResolutionHours: avgModHours,
      workloadStatus,
    };
  });

  // 9. SLA Tracking
  const breachedCases = (resolvedCasesData as any[]).filter((c: any) => {
    if (!c.resolvedAt) return false;
    const durHours = (new Date(c.resolvedAt).getTime() - new Date(c.createdAt).getTime()) / (3600 * 1000);
    const limitHours = c.priority > 0 ? 24 : 72;
    return durHours > limitHours;
  }).length;
  const onTimeResolutionRate =
    resolvedCasesData.length > 0
      ? Math.round(((resolvedCasesData.length - breachedCases) / resolvedCasesData.length) * 100)
      : null;

  // 10. Information Requests / Evidence Metrics
  let rfiRequested = 0;
  let rfiResponded = 0;
  for (const a of rfiActivities) {
    if (a.action === "INFORMATION_REQUESTED") rfiRequested++;
    else if (a.action === "INFORMATION_RESPONDED") rfiResponded++;
  }
  const totalEvidenceItems = await prisma.moderationEvidence.count({
    where: start || end ? { createdAt: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {},
  });

  return {
    dateRange: {
      period,
      start: start ? start.toISOString() : null,
      end: end ? end.toISOString() : null,
    },
    kpis: {
      totalReports,
      totalCases,
      openCases,
      pendingReview,
      underInvestigation,
      assignedCases,
      resolvedCases,
      closedCases: resolvedCases + dismissedCases,
      overdueCases: overdueOpenCases,
      avgResolutionTimeHours,
      enforcementActions: enforcementActivities.length,
      pendingAppeals: Math.max(0, appealSubmittedCount - decidedAppeals - appealWithdrawnCount),
    },
    reportAnalytics: {
      total: totalReports,
      byTargetType: (reportsByTargetType as any[]).map((r: any) => ({
        targetType: r.targetType,
        count: (r as any)._count._all,
      })),
      byUserRole: {
        guest: guestReports,
        host: hostReports,
        adminOrOther: adminOrOtherReports,
      },
      topCategories: (reportsByCategory as any[]).map((c: any) => ({
        category: c.category,
        count: (c as any)._count._all,
      })),
      duplicateReportsLinked,
      trends,
    },
    targetTypeAnalytics: {
      listings: {
        totalReports: listingReports.length,
        distinctListings,
        activeCases: activeListingCases,
        resolvedCases: resolvedListingCases,
        enforcements: (enforcementActivities as any[]).filter((a: any) => a.case?.targetType === "LISTING").length,
        avgResolutionHours: avgListingHours,
      },
      reviews: {
        totalReports: reviewReports.length,
        distinctReviews,
        activeCases: activeReviewCases,
        resolvedCases: resolvedReviewCases,
        guestToProperty: guestToPropertyCount,
        hostToGuest: hostToGuestCount,
        hiddenOrRemoved: hiddenOrRemovedCount,
      },
      media: {
        totalReports: mediaReports.length,
        distinctMedia,
        activeCases: activeMediaCases,
        resolvedCases: resolvedMediaCases,
        removedOrHidden: mediaEnforcements,
      },
      usersAndMessages: {
        userReports: userReports.length,
        distinctUsers,
        messageReports: messageReports.length,
        distinctMessages,
        warnings: warningCount,
        restrictions: restrictionCount,
        suspensions: suspensionCount,
      },
    },
    enforcementAnalytics: {
      totalEnforcements: enforcementActivities.length,
      warnings: warningCount,
      restrictions: restrictionCount,
      suspensions: suspensionCount,
      reinstatements: reinstatementCount,
      contentRemovals: removalCount,
      recentActions: (enforcementActivities as any[]).slice(0, 10).map((a: any) => ({
        id: a.id,
        action: a.action,
        caseReference: a.case?.caseReference || "—",
        createdAt: a.createdAt.toISOString(),
        actorName: a.actor?.name || a.actor?.email || "System",
      })),
    },
    appealsAnalytics: {
      total: appealSubmittedCount,
      pending: Math.max(0, appealSubmittedCount - decidedAppeals - appealWithdrawnCount),
      underReview: Math.max(0, appealSubmittedCount - decidedAppeals - appealWithdrawnCount),
      approved: appealApprovedCount,
      rejected: appealRejectedCount,
      withdrawn: appealWithdrawnCount,
      approvalRate: appealApprovalRate,
      avgResolutionHours: avgAppealHours,
    },
    moderatorWorkload,
    slaMetrics: {
      standardSlaHours: 72,
      highPrioritySlaHours: 24,
      onTimeResolutionRate,
      overdueCount: overdueOpenCases,
      breachedCount: breachedCases,
    },
    evidenceAndRfi: {
      totalRfis: rfiRequested,
      pendingResponse: Math.max(0, rfiRequested - rfiResponded),
      completed: rfiResponded,
      overdue: 0,
      totalEvidenceItems,
    },
    operational: {
      highPriorityOpenCases,
      unassignedOpenCases,
      recentActivity: (recentActivity as Array<{
        id: string;
        action: string;
        createdAt: Date;
        actor: { name: string | null; email: string | null } | null;
        case: { id: string; caseReference: string };
      }>).map((activity) => ({
        id: activity.id,
        action: activity.action,
        createdAt: activity.createdAt.toISOString(),
        actor: activity.actor,
        case: activity.case,
      })),
    },
    jobHealth: {
      phase8AiStatus: "DEFERRED_NOT_ACTIVE",
      queueStats,
    },
  };
}

/**
 * Sanitizes CSV cell strings to protect against CSV formula injection (e.g. =, +, -, @).
 */
function sanitizeCsvCell(value: any): string {
  if (value === null || value === undefined) return '""';
  const str = String(value).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    return `"'${str.replace(/"/g, '""')}"`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Generates an auditable, sanitised CSV analytics summary.
 */
export async function exportModerationAnalyticsCsv(
  actor: AuthUser,
  query: ModerationAnalyticsQuery = {}
): Promise<string> {
  const data = await getModerationAnalytics(actor, query);
  const rows: string[] = [];

  rows.push(["MODERATION ANALYTICS SUMMARY", `Exported at: ${new Date().toISOString()}`].map(sanitizeCsvCell).join(","));
  rows.push(["Period", data.dateRange.period, "Start", data.dateRange.start || "All", "End", data.dateRange.end || "Now"].map(sanitizeCsvCell).join(","));
  rows.push("");

  // Section 1: Core KPIs
  rows.push(["CORE KEY PERFORMANCE INDICATORS"].map(sanitizeCsvCell).join(","));
  rows.push(["Metric", "Count"].map(sanitizeCsvCell).join(","));
  rows.push(["Total Reports", data.kpis.totalReports].map(sanitizeCsvCell).join(","));
  rows.push(["Total Moderation Cases", data.kpis.totalCases].map(sanitizeCsvCell).join(","));
  rows.push(["Open Cases", data.kpis.openCases].map(sanitizeCsvCell).join(","));
  rows.push(["Pending Review", data.kpis.pendingReview].map(sanitizeCsvCell).join(","));
  rows.push(["Under Investigation", data.kpis.underInvestigation].map(sanitizeCsvCell).join(","));
  rows.push(["Assigned Cases", data.kpis.assignedCases].map(sanitizeCsvCell).join(","));
  rows.push(["Resolved Cases", data.kpis.resolvedCases].map(sanitizeCsvCell).join(","));
  rows.push(["Closed Cases (Resolved + Dismissed)", data.kpis.closedCases].map(sanitizeCsvCell).join(","));
  rows.push(["Overdue Cases (>72h)", data.kpis.overdueCases].map(sanitizeCsvCell).join(","));
  rows.push(["Average Resolution Time (Hours)", data.kpis.avgResolutionTimeHours].map(sanitizeCsvCell).join(","));
  rows.push(["Total Enforcement Actions", data.kpis.enforcementActions].map(sanitizeCsvCell).join(","));
  rows.push(["Pending Appeals", data.kpis.pendingAppeals].map(sanitizeCsvCell).join(","));
  rows.push("");

  // Section 2: Reports by Target Type
  rows.push(["REPORTS BY TARGET TYPE"].map(sanitizeCsvCell).join(","));
  rows.push(["Target Type", "Report Count"].map(sanitizeCsvCell).join(","));
  for (const item of data.reportAnalytics.byTargetType) {
    rows.push([item.targetType, item.count].map(sanitizeCsvCell).join(","));
  }
  rows.push("");

  // Section 3: Moderator Workload & Productivity
  rows.push(["MODERATOR WORKLOAD & PRODUCTIVITY"].map(sanitizeCsvCell).join(","));
  rows.push(["Moderator", "Email", "Active Cases", "Resolved Cases", "Overdue (>72h)", "Avg Resolution (h)", "Workload Status"].map(sanitizeCsvCell).join(","));
  for (const mod of data.moderatorWorkload) {
    rows.push([mod.name, mod.email, mod.activeCases, mod.resolvedCases, mod.overdueCases, mod.avgResolutionHours, mod.workloadStatus].map(sanitizeCsvCell).join(","));
  }
  rows.push("");

  // Section 4: Operational Health & SLA
  rows.push(["OPERATIONAL SLA METRICS"].map(sanitizeCsvCell).join(","));
  rows.push(["Standard SLA (h)", data.slaMetrics.standardSlaHours].map(sanitizeCsvCell).join(","));
  rows.push(["High Priority SLA (h)", data.slaMetrics.highPrioritySlaHours].map(sanitizeCsvCell).join(","));
  rows.push(["On-Time Resolution Rate (%)", data.slaMetrics.onTimeResolutionRate === null ? "N/A" : `${data.slaMetrics.onTimeResolutionRate}%`].map(sanitizeCsvCell).join(","));
  rows.push(["SLA Breached Cases", data.slaMetrics.breachedCount].map(sanitizeCsvCell).join(","));
  rows.push(["Pending Overdue Open Cases", data.slaMetrics.overdueCount].map(sanitizeCsvCell).join(","));
  rows.push("");

  // Section 5: Automated Content Detection Status (Phase 8 Deferred)
  rows.push(["AUTOMATED CONTENT DETECTION (PHASE 8)"].map(sanitizeCsvCell).join(","));
  rows.push(["Status", "DEFERRED — NOT ACTIVE (Manual & User Reporting Active)"].map(sanitizeCsvCell).join(","));

  return rows.join("\r\n");
}

export const moderationAnalyticsService = {
  getModerationAnalytics,
  exportModerationAnalyticsCsv,
};
