import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/api/errors";
import type { AuthUser } from "@/lib/auth/types";
import { Role, SupportCaseContentVisibility, SupportCasePriority, SupportCaseStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export type SupportAnalyticsPeriod = "7d" | "30d" | "90d" | "all" | "custom";
export type SupportTrendGranularity = "day" | "week" | "month";

export interface SupportAnalyticsQuery {
  period?: SupportAnalyticsPeriod;
  startDate?: string;
  endDate?: string;
  status?: string;
  category?: string;
  priority?: string;
  assignedAdminId?: string;
  reporterRole?: string;
  escalationState?: "ESCALATED" | "NOT_ESCALATED";
  granularity?: SupportTrendGranularity;
  search?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "createdAt" | "updatedAt" | "slaDueAt" | "priority";
  sortOrder?: "asc" | "desc";
}

const COMPLETED = new Set<SupportCaseStatus>([SupportCaseStatus.RESOLVED, SupportCaseStatus.CLOSED]);
const MAX_ANALYTICS_CASES = 2_500;
const MAX_PAGE_SIZE = 100;

function parseDate(value: string, boundary: "start" | "end") {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${boundary === "start" ? "00:00:00.000" : "23:59:59.999"}Z`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw AppError.badRequest(`Invalid ${boundary === "start" ? "startDate" : "endDate"}.`);
  return date;
}

export function resolveSupportAnalyticsRange(query: SupportAnalyticsQuery) {
  const period = query.period || (query.startDate || query.endDate ? "custom" : "30d");
  if (!(["7d", "30d", "90d", "all", "custom"] as string[]).includes(period)) throw AppError.badRequest("Invalid reporting period.");
  const now = new Date();
  if (period === "all") return { period, start: null as Date | null, end: null as Date | null };
  if (period !== "custom") return { period, start: new Date(now.getTime() - Number(period.slice(0, -1)) * 86_400_000), end: now };
  const start = query.startDate ? parseDate(query.startDate, "start") : null;
  const end = query.endDate ? parseDate(query.endDate, "end") : null;
  if (start && end && start > end) throw AppError.badRequest("startDate must not be after endDate.");
  return { period, start, end };
}

function enumValue<T extends Record<string, string>>(source: T, value: string | undefined, label: string): T[keyof T] | undefined {
  if (!value) return undefined;
  if (!Object.values(source).includes(value)) throw AppError.badRequest(`Invalid ${label}.`);
  return value as T[keyof T];
}

export function buildSupportAnalyticsWhere(query: SupportAnalyticsQuery): { where: Prisma.SupportCaseWhereInput; range: ReturnType<typeof resolveSupportAnalyticsRange> } {
  const range = resolveSupportAnalyticsRange(query);
  const status = enumValue(SupportCaseStatus, query.status, "status");
  const priority = enumValue(SupportCasePriority, query.priority, "priority");
  const reporterRole = query.reporterRole && ["REPORTER", "GUEST", "HOST", "ADMIN"].includes(query.reporterRole)
    ? query.reporterRole as "REPORTER" | "GUEST" | "HOST" | "ADMIN"
    : undefined;
  if (query.reporterRole && !reporterRole) throw AppError.badRequest("Invalid reporterRole.");
  const where: Prisma.SupportCaseWhereInput = {
    ...(range.start || range.end ? { createdAt: { ...(range.start ? { gte: range.start } : {}), ...(range.end ? { lte: range.end } : {}) } } : {}),
    ...(status ? { status } : {}),
    ...(priority ? { priority } : {}),
    ...(query.category?.trim() ? { category: query.category.trim() } : {}),
    ...(query.assignedAdminId === "unassigned" ? { assignedAdminId: null } : query.assignedAdminId ? { assignedAdminId: query.assignedAdminId } : {}),
    ...(reporterRole ? { reporterRole } : {}),
    ...(query.escalationState === "ESCALATED" ? { escalatedAt: { not: null } } : query.escalationState === "NOT_ESCALATED" ? { escalatedAt: null } : {}),
    ...(query.search?.trim() ? { OR: [
      { caseNumber: { contains: query.search.trim(), mode: "insensitive" } },
      { subject: { contains: query.search.trim(), mode: "insensitive" } },
      { category: { contains: query.search.trim(), mode: "insensitive" } },
    ] } : {}),
  };
  return { where, range };
}

const bucket = (date: Date, granularity: SupportTrendGranularity) => {
  const value = new Date(date);
  value.setUTCHours(0, 0, 0, 0);
  if (granularity === "month") value.setUTCDate(1);
  if (granularity === "week") value.setUTCDate(value.getUTCDate() - ((value.getUTCDay() + 6) % 7));
  return value.toISOString().slice(0, 10);
};
const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
};
const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
const countBy = <T>(items: T[], key: (item: T) => string) => [...items.reduce((map, item) => map.set(key(item), (map.get(key(item)) || 0) + 1), new Map<string, number>())]
  .map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
const minutes = (start: Date, end: Date) => Math.max(0, Math.round((end.getTime() - start.getTime()) / 60_000));

export async function getSupportAnalytics(actor: AuthUser, query: SupportAnalyticsQuery = {}) {
  if (actor.role !== Role.ADMIN) throw AppError.forbidden("Only administrators can view support analytics.");
  const { where, range } = buildSupportAnalyticsWhere(query);
  const granularity = query.granularity || "day";
  if (!(["day", "week", "month"] as string[]).includes(granularity)) throw AppError.badRequest("Invalid trend granularity.");
  const page = Math.max(1, Math.floor(query.page || 1));
  const pageSize = Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(query.pageSize || 25)));
  const sortBy = query.sortBy || "createdAt";
  const sortOrder = query.sortOrder || "desc";
  const [totalCases, cases, tableCases] = await Promise.all([
    prisma.supportCase.count({ where }),
    prisma.supportCase.findMany({
      where, take: MAX_ANALYTICS_CASES, orderBy: { createdAt: "desc" },
      select: {
        id: true, caseNumber: true, subject: true, category: true, priority: true, status: true, createdAt: true, updatedAt: true,
        resolvedAt: true, closedAt: true, escalatedAt: true, escalationLevel: true, escalationReason: true, slaDueAt: true,
        firstResponseDueAt: true, slaBreachedAt: true, assignedAdminId: true,
        assignedAdmin: { select: { id: true, name: true, email: true } },
        messages: { where: { visibility: SupportCaseContentVisibility.PARTICIPANTS }, orderBy: { createdAt: "asc" }, select: { createdAt: true, senderId: true, sender: { select: { role: true } } } },
        events: { orderBy: { createdAt: "asc" }, select: { eventType: true, createdAt: true } },
        resolutionOffers: { select: { status: true, parentOfferId: true, createdAt: true } },
        evidence: { select: { scanStatus: true, retentionUntil: true, legalHold: true, deletedAt: true } },
        refunds: { select: { status: true } },
      },
    }),
    prisma.supportCase.findMany({
      where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { [sortBy]: sortOrder },
      select: { id: true, caseNumber: true, subject: true, category: true, priority: true, status: true, createdAt: true, updatedAt: true, resolvedAt: true, slaDueAt: true, assignedAdmin: { select: { id: true, name: true, email: true } } },
    }),
  ]);
  const now = new Date();
  const scopedCaseIds = cases.map((item) => item.id);
  const notificationFailures = scopedCaseIds.length ? await prisma.notificationOutbox.count({ where: { entityType: "SUPPORT_CASE", entityId: { in: scopedCaseIds }, status: { in: ["DEAD_LETTER", "RETRY_PENDING"] } } }) : 0;
  const isCapped = totalCases > cases.length;
  const active = cases.filter((item) => !COMPLETED.has(item.status));
  const resolutionTimes = cases.filter((item) => item.resolvedAt).map((item) => minutes(item.createdAt, item.resolvedAt!));
  const firstResponses = cases.flatMap((item) => {
    const reply = item.messages.find((message) => message.sender.role === Role.ADMIN);
    return reply ? [minutes(item.createdAt, reply.createdAt)] : [];
  });
  const firstResponseSla = cases.flatMap((item) => {
    const reply = item.messages.find((message) => message.sender.role === Role.ADMIN);
    return item.firstResponseDueAt && reply ? [reply.createdAt <= item.firstResponseDueAt] : [];
  });
  const resolutionSla = cases.flatMap((item) => item.resolvedAt && item.slaDueAt ? [item.resolvedAt <= item.slaDueAt] : []);
  const overdue = active.filter((item) => item.slaDueAt && item.slaDueAt < now);
  const atRisk = active.filter((item) => item.slaDueAt && item.slaDueAt >= now && now.getTime() - item.createdAt.getTime() >= (item.slaDueAt.getTime() - item.createdAt.getTime()) * .8);
  const trend = new Map<string, { date: string; created: number; resolved: number; closed: number; reopened: number; resolutionMinutes: number[] }>();
  const point = (date: Date) => { const key = bucket(date, granularity); const current = trend.get(key) || { date: key, created: 0, resolved: 0, closed: 0, reopened: 0, resolutionMinutes: [] }; trend.set(key, current); return current; };
  for (const item of cases) {
    point(item.createdAt).created += 1;
    for (const event of item.events) {
      const inRange = (!range.start || event.createdAt >= range.start) && (!range.end || event.createdAt <= range.end);
      if (!inRange) continue;
      const current = point(event.createdAt);
      if (event.eventType === "STATUS_RESOLVED") { current.resolved += 1; if (item.resolvedAt) current.resolutionMinutes.push(minutes(item.createdAt, item.resolvedAt)); }
      if (event.eventType === "STATUS_CLOSED") current.closed += 1;
      if (event.eventType === "STATUS_REOPENED") current.reopened += 1;
    }
  }
  const statuses = countBy(cases, (item) => item.status);
  const agents = new Map<string, { id: string; name: string; email: string | null; assigned: number; active: number; resolved: number; overdue: number; reopened: number; resolution: number[]; firstResponse: number[]; sla: boolean[] }>();
  for (const item of cases) {
    if (!item.assignedAdmin) continue;
    const key = item.assignedAdmin.id;
    const metric = agents.get(key) || { id: key, name: item.assignedAdmin.name || "Unnamed agent", email: item.assignedAdmin.email, assigned: 0, active: 0, resolved: 0, overdue: 0, reopened: 0, resolution: [], firstResponse: [], sla: [] };
    metric.assigned++; if (!COMPLETED.has(item.status)) metric.active++; if (item.status === SupportCaseStatus.RESOLVED || item.status === SupportCaseStatus.CLOSED) metric.resolved++;
    if (item.slaDueAt && !COMPLETED.has(item.status) && item.slaDueAt < now) metric.overdue++;
    if (item.events.some((event) => event.eventType === "STATUS_REOPENED")) metric.reopened++;
    if (item.resolvedAt) metric.resolution.push(minutes(item.createdAt, item.resolvedAt));
    const reply = item.messages.find((message) => message.sender.role === Role.ADMIN); if (reply) metric.firstResponse.push(minutes(item.createdAt, reply.createdAt));
    if (item.resolvedAt && item.slaDueAt) metric.sla.push(item.resolvedAt <= item.slaDueAt);
    agents.set(key, metric);
  }
  const offers = cases.flatMap((item) => item.resolutionOffers);
  const evidence = cases.flatMap((item) => item.evidence);
  const messages = cases.flatMap((item) => item.messages);
  const refunds = cases.flatMap((item) => item.refunds);
  return {
    scope: { period: range.period, start: range.start?.toISOString() || null, end: range.end?.toISOString() || null, timezone: "UTC", dateField: "SupportCase.createdAt", sampledCases: cases.length, totalCases, truncated: isCapped },
    kpis: {
      totalCases, newCases: totalCases, open: cases.filter((item) => item.status === SupportCaseStatus.OPEN).length, inReview: cases.filter((item) => item.status === SupportCaseStatus.IN_REVIEW).length,
      waitingForGuest: cases.filter((item) => item.status === SupportCaseStatus.WAITING_FOR_GUEST).length, waitingForHost: cases.filter((item) => item.status === SupportCaseStatus.WAITING_FOR_HOST).length,
      escalated: cases.filter((item) => item.escalatedAt).length, resolved: cases.filter((item) => item.status === SupportCaseStatus.RESOLVED).length, closed: cases.filter((item) => item.status === SupportCaseStatus.CLOSED).length,
      reopened: cases.filter((item) => item.events.some((event) => event.eventType === "STATUS_REOPENED")).length, unassigned: cases.filter((item) => !item.assignedAdminId).length, overdue: overdue.length,
      averageResolutionMinutes: average(resolutionTimes), medianResolutionMinutes: median(resolutionTimes), averageFirstResponseMinutes: average(firstResponses),
      firstResponseSlaComplianceRate: firstResponseSla.length ? Math.round(firstResponseSla.filter(Boolean).length / firstResponseSla.length * 100) : null,
      resolutionSlaComplianceRate: resolutionSla.length ? Math.round(resolutionSla.filter(Boolean).length / resolutionSla.length * 100) : null,
      resolutionRate: cases.length ? Math.round(cases.filter((item) => COMPLETED.has(item.status)).length / cases.length * 100) : null,
    },
    trends: [...trend.values()].sort((a, b) => a.date.localeCompare(b.date)).map((item) => ({ ...item, averageResolutionMinutes: average(item.resolutionMinutes), resolutionMinutes: undefined })),
    distributions: { status: statuses, category: countBy(cases, (item) => item.category), priority: countBy(cases, (item) => item.priority) },
    sla: {
      breached: overdue.length, atRisk: atRisk.length, firstResponseObserved: firstResponseSla.length, resolutionObserved: resolutionSla.length,
      byPriority: Object.values(SupportCasePriority).map((priority) => { const subset = cases.filter((item) => item.priority === priority && item.resolvedAt && item.slaDueAt); return { label: priority, observed: subset.length, compliant: subset.filter((item) => item.resolvedAt! <= item.slaDueAt!).length }; }),
      byCategory: countBy(cases.filter((item) => item.resolvedAt && item.slaDueAt), (item) => item.category).map((row) => { const subset = cases.filter((item) => item.category === row.label && item.resolvedAt && item.slaDueAt); return { ...row, observed: subset.length, compliant: subset.filter((item) => item.resolvedAt! <= item.slaDueAt!).length }; }),
    },
    escalations: { total: cases.filter((item) => item.escalatedAt).length, unresolved: active.filter((item) => item.escalatedAt).length, byLevel: countBy(cases.filter((item) => item.escalatedAt), (item) => String(item.escalationLevel || "Unspecified")), byReason: countBy(cases.filter((item) => item.escalatedAt), (item) => item.escalationReason?.trim() || "Unspecified") },
    agents: [...agents.values()].map((item) => ({ id: item.id, name: item.name, email: item.email, assignedCases: item.assigned, activeCases: item.active, resolvedCases: item.resolved, overdueCases: item.overdue, reopenedCases: item.reopened, averageResolutionMinutes: average(item.resolution), averageFirstResponseMinutes: average(item.firstResponse), resolutionSlaComplianceRate: item.sla.length ? Math.round(item.sla.filter(Boolean).length / item.sla.length * 100) : null })).sort((a, b) => b.activeCases - a.activeCases || b.assignedCases - a.assignedCases),
    resolutionCenter: { requests: offers.length, accepted: offers.filter((item) => item.status === "ACCEPTED").length, rejected: offers.filter((item) => item.status === "REJECTED").length, counteroffers: offers.filter((item) => item.parentOfferId).length, withdrawn: offers.filter((item) => item.status === "WITHDRAWN").length, expired: offers.filter((item) => item.status === "EXPIRED").length, agreements: offers.filter((item) => item.status === "ACCEPTED").length, adminMediatedCases: cases.filter((item) => item.events.some((event) => event.eventType.includes("MEDIATION"))).length },
    communications: { messages: messages.length, messagesPerCase: cases.length ? Math.round(messages.length / cases.length * 10) / 10 : null, supportReplies: messages.filter((item) => item.sender.role === Role.ADMIN).length, guestOrHostReplies: messages.filter((item) => item.sender.role !== Role.ADMIN).length, waitingForReplies: cases.filter((item) => item.status === SupportCaseStatus.WAITING_FOR_GUEST || item.status === SupportCaseStatus.WAITING_FOR_HOST).length },
    evidence: { total: evidence.length, pendingScan: evidence.filter((item) => item.scanStatus === "QUARANTINED" || item.scanStatus === "SCANNING").length, clean: evidence.filter((item) => item.scanStatus === "CLEAN").length, rejected: evidence.filter((item) => item.scanStatus === "REJECTED" || item.scanStatus === "INFECTED").length, scanFailures: evidence.filter((item) => item.scanStatus === "SCAN_FAILED").length, retentionExpired: evidence.filter((item) => item.retentionUntil && item.retentionUntil < now && !item.deletedAt).length, activeLegalHolds: evidence.filter((item) => item.legalHold).length },
    financial: { recordedRefundRequests: refunds.length, refundStatuses: countBy(refunds, (item) => item.status), paymentRelatedCases: cases.filter((item) => /(payment|refund|payout|charge)/i.test(item.category)).length, limitation: "Read-only application records only. Gateway execution and payout reconciliation are outside this report." },
    operational: { notificationFailures },
    table: { rows: tableCases, page, pageSize, total: totalCases, totalPages: Math.max(1, Math.ceil(totalCases / pageSize)) },
    definitions: [
      "All global filters select SupportCase records by createdAt in UTC; event trends count status events occurring within the selected UTC range for that same filtered case cohort.",
      "First response is the first participant-visible message from a current ADMIN-role user. Internal notes and missing timestamps are excluded, never treated as compliant.",
      "Agent measures are attributed to the case's current assignee because historical resolution ownership is not persisted. They are workload indicators, not quality rankings.",
      "SLA compliance is calculated only where the relevant due timestamp and completed response/resolution timestamp exist. Historical policy and paused-clock data are not available.",
    ],
  };
}

function csvCell(value: unknown) { const text = String(value ?? ""); return `"${(/^[=+\-@\t\r]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`; }
export async function exportSupportAnalyticsCsv(actor: AuthUser, query: SupportAnalyticsQuery = {}) {
  const analytics = await getSupportAnalytics(actor, { ...query, page: 1, pageSize: MAX_PAGE_SIZE });
  const rows = [["SUPPORT ANALYTICS SUMMARY", `Exported at ${new Date().toISOString()}`], ["Scope", `${analytics.scope.start || "all"} to ${analytics.scope.end || "now"} (UTC)`], [], ["Metric", "Value"], ...Object.entries(analytics.kpis).map(([key, value]) => [key, value ?? "N/A"]), [], ["Case number", "Subject", "Category", "Priority", "Status", "Assignee", "Created at", "Resolution SLA due"]];
  for (const item of analytics.table.rows) rows.push([item.caseNumber, item.subject, item.category, item.priority, item.status, item.assignedAdmin?.name || item.assignedAdmin?.email || "Unassigned", item.createdAt.toISOString(), item.slaDueAt?.toISOString() || ""]);
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export const supportAnalyticsService = { getSupportAnalytics, exportSupportAnalyticsCsv, buildSupportAnalyticsWhere, resolveSupportAnalyticsRange };
