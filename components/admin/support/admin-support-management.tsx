"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminSupportCaseDetail } from "./admin-support-case-detail";

type Status =
  | "OPEN"
  | "IN_REVIEW"
  | "WAITING_FOR_GUEST"
  | "WAITING_FOR_HOST"
  | "WAITING_FOR_ADMIN"
  | "RESOLVED"
  | "CLOSED"
  | "REOPENED"
  | "ESCALATED";

type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

type SupportCase = {
  id: string;
  caseNumber: string;
  subject: string;
  description?: string | null;
  category: string;
  issueType?: string | null;
  status: Status;
  priority: Priority;
  version: number;
  createdAt: string;
  updatedAt: string;
  slaDueAt?: string | null;
  firstResponseDueAt?: string | null;
  nextResponseDueAt?: string | null;
  escalationLevel?: number | null;
  reporterRole?: string | null;
  reporter?: { id: string; name: string | null; email?: string | null } | null;
  assignedAdmin?: { id: string; name: string | null; email: string | null } | null;
  booking?: { id: string; submissionId?: string | null; user?: { id: string; name: string | null; email?: string | null } | null } | null;
  listing?: { id: string; title: string | null; city?: string | null } | null;
};

type Agent = { id: string; name: string | null; email: string | null };

type Metrics = {
  total: number;
  open: number;
  inReview: number;
  waitingForGuest: number;
  waitingForHost: number;
  waitingForAdmin: number;
  unassigned: number;
  escalated: number;
  resolved: number;
  closed: number;
  slaBreaches: number;
  immediateAttention: number;
  averageResolutionMinutes: number | null;
};

const statusLabels: Record<Status, string> = {
  OPEN: "Open",
  IN_REVIEW: "In Review",
  WAITING_FOR_GUEST: "Waiting for Guest",
  WAITING_FOR_HOST: "Waiting for Host",
  WAITING_FOR_ADMIN: "Waiting for Support",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  ESCALATED: "Escalated",
};

const statusBadges: Record<Status, { bg: string; text: string; dot: string }> = {
  OPEN: { bg: "bg-blue-50 border-blue-200", text: "text-blue-700", dot: "bg-blue-500" },
  IN_REVIEW: { bg: "bg-indigo-50 border-indigo-200", text: "text-indigo-700", dot: "bg-indigo-500" },
  WAITING_FOR_GUEST: { bg: "bg-amber-50 border-amber-200", text: "text-amber-800", dot: "bg-amber-500" },
  WAITING_FOR_HOST: { bg: "bg-orange-50 border-orange-200", text: "text-orange-800", dot: "bg-orange-500" },
  WAITING_FOR_ADMIN: { bg: "bg-purple-50 border-purple-200", text: "text-purple-700", dot: "bg-purple-500" },
  RESOLVED: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" },
  CLOSED: { bg: "bg-zinc-100 border-zinc-200", text: "text-zinc-600", dot: "bg-zinc-400" },
  REOPENED: { bg: "bg-sky-50 border-sky-200", text: "text-sky-700", dot: "bg-sky-500" },
  ESCALATED: { bg: "bg-rose-50 border-rose-200", text: "text-rose-700", dot: "bg-rose-500" },
};

const priorityStyles: Record<Priority, { bg: string; text: string; border: string }> = {
  URGENT: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  HIGH: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
  MEDIUM: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-200" },
  LOW: { bg: "bg-zinc-100", text: "text-zinc-600", border: "border-zinc-200" },
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatRelativeTime(value?: string | null) {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isSlaOverdue(slaDueAt?: string | null, status?: Status): boolean {
  if (!slaDueAt) return false;
  if (status === "RESOLVED" || status === "CLOSED") return false;
  return new Date(slaDueAt).getTime() < Date.now();
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.success) {
    throw new Error(json?.error?.message || "The support service is temporarily unavailable.");
  }
  return json.data as T;
}

export function AdminSupportManagement({ caseId }: { caseId?: string }) {
  // If specific caseId is provided, render the comprehensive case detail screen directly
  if (caseId) {
    return <AdminSupportCaseDetail caseId={caseId} />;
  }

  return <AdminSupportDashboardView />;
}

function AdminSupportDashboardView() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [activeQueueTab, setActiveQueueTab] = useState<string>("all");

  const [filters, setFilters] = useState({
    search: "",
    status: "",
    priority: "",
    assignedAdminId: "",
    sortBy: "updatedAt",
    dateFrom: "",
    dateTo: "",
    slaState: "",
  });

  const [page, setPage] = useState(1);
  const [pages, setPages] = useState({ page: 1, totalPages: 1, total: 0 });

  const loadMetricsAndAgents = useCallback(async () => {
    try {
      const [nextMetrics, nextAgents] = await Promise.all([
        api<Metrics>("/api/v1/admin/support/dashboard"),
        api<Agent[]>("/api/v1/admin/support/agents"),
      ]);
      setMetrics(nextMetrics);
      setAgents(nextAgents);
    } catch {
      // Non-fatal metric fetch failure
    }
  }, []);

  const loadList = useCallback(
    async (targetPage = page) => {
      setLoading(true);
      setNotice(null);
      try {
        const query = new URLSearchParams({
          page: String(targetPage),
          limit: "25",
          sortBy: filters.sortBy,
          sortOrder: "desc",
        });

        if (filters.search.trim()) query.set("search", filters.search.trim());
        if (filters.status) query.set("status", filters.status);
        if (filters.priority) query.set("priority", filters.priority);
        if (filters.assignedAdminId) query.set("assignedAdminId", filters.assignedAdminId);
        if (filters.dateFrom) query.set("dateFrom", filters.dateFrom);
        if (filters.dateTo) query.set("dateTo", `${filters.dateTo}T23:59:59.999Z`);
        if (filters.slaState) query.set("slaState", filters.slaState);

        const data = await api<{
          cases: SupportCase[];
          pagination: { page: number; totalPages: number; total?: number };
        }>(`/api/v1/support/cases?${query}`);

        setCases(data.cases);
        setPages({
          page: data.pagination.page,
          totalPages: data.pagination.totalPages,
          total: data.pagination.total ?? data.cases.length,
        });
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Unable to load support cases.");
      } finally {
        setLoading(false);
      }
    },
    [filters, page]
  );

  useEffect(() => {
    void loadMetricsAndAgents();
  }, [loadMetricsAndAgents]);

  useEffect(() => {
    void loadList(page);
  }, [loadList, page]);

  const handleQueueTabChange = (tab: string) => {
    setActiveQueueTab(tab);
    setPage(1);

    if (tab === "all") {
      setFilters((prev) => ({ ...prev, status: "", assignedAdminId: "", slaState: "" }));
    } else if (tab === "unassigned") {
      setFilters((prev) => ({ ...prev, status: "", assignedAdminId: "unassigned", slaState: "" }));
    } else if (tab === "waiting_guest") {
      setFilters((prev) => ({ ...prev, status: "WAITING_FOR_GUEST", assignedAdminId: "", slaState: "" }));
    } else if (tab === "waiting_host") {
      setFilters((prev) => ({ ...prev, status: "WAITING_FOR_HOST", assignedAdminId: "", slaState: "" }));
    } else if (tab === "escalated") {
      setFilters((prev) => ({ ...prev, status: "ESCALATED", assignedAdminId: "", slaState: "" }));
    } else if (tab === "sla_breached") {
      setFilters((prev) => ({ ...prev, status: "", assignedAdminId: "", slaState: "BREACHED" }));
    } else if (tab === "resolved") {
      setFilters((prev) => ({ ...prev, status: "RESOLVED", assignedAdminId: "", slaState: "" }));
    } else if (tab === "closed") {
      setFilters((prev) => ({ ...prev, status: "CLOSED", assignedAdminId: "", slaState: "" }));
    }
  };

  const handleResetFilters = () => {
    setActiveQueueTab("all");
    setFilters({
      search: "",
      status: "",
      priority: "",
      assignedAdminId: "",
      sortBy: "updatedAt",
      dateFrom: "",
      dateTo: "",
      slaState: "",
    });
    setPage(1);
  };

  const openCasesCount = (metrics?.open || 0) + (metrics?.inReview || 0);
  const waitingCount =
    (metrics?.waitingForGuest || 0) +
    (metrics?.waitingForHost || 0) +
    (metrics?.waitingForAdmin || 0);

  return (
    <div className="space-y-6 text-zinc-900">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 font-normal">
            <span>Administration</span>
            <span>/</span>
            <span className="text-zinc-800 font-medium">Support Operations</span>
          </div>
          <h1 className="mt-1.5 text-2xl sm:text-3xl font-medium tracking-tight text-zinc-950">
            Support Case Management
          </h1>
          <p className="mt-1 text-sm font-normal text-zinc-500 max-w-2xl">
            Triage, monitor, and resolve Guest and Host support cases with automated SLA tracking and audit trails.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              void loadMetricsAndAgents();
              void loadList(page);
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 transition-colors disabled:opacity-50"
          >
            <svg
              className={`size-4 ${loading ? "animate-spin text-zinc-400" : "text-zinc-600"}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
              <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
              <path d="M16 21h5v-5" />
            </svg>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-normal text-red-800"
        >
          <div className="flex items-center gap-2.5">
            <svg className="size-4 shrink-0 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{notice}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotice(null)}
            className="text-xs text-red-700 hover:text-red-900 underline font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Scorecard (6 Cards) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Card 1: Open / In Review */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-normal text-zinc-500">Open &amp; Review</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-6l-2 3h-4l-2-3H2" />
                <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
              </svg>
            </span>
          </div>
          <p className="mt-2 text-2xl font-medium tracking-tight text-zinc-950">
            {metrics ? openCasesCount : "—"}
          </p>
          <p className="mt-1 text-[11px] font-normal text-zinc-500">Active investigations</p>
        </div>

        {/* Card 2: Needs Response */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-normal text-zinc-500">Needs Response</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </span>
          </div>
          <p className="mt-2 text-2xl font-medium tracking-tight text-zinc-950">
            {metrics ? waitingCount : "—"}
          </p>
          <p className="mt-1 text-[11px] font-normal text-zinc-500">Waiting on party</p>
        </div>

        {/* Card 3: Unassigned */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-normal text-zinc-500">Unassigned</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <line x1="17" y1="11" x2="23" y2="11" />
              </svg>
            </span>
          </div>
          <p className="mt-2 text-2xl font-medium tracking-tight text-zinc-950">
            {metrics?.unassigned ?? "—"}
          </p>
          <p className="mt-1 text-[11px] font-normal text-zinc-500">Require triage</p>
        </div>

        {/* Card 4: Escalations */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-normal text-zinc-500">Escalated</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600">
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </span>
          </div>
          <p className="mt-2 text-2xl font-medium tracking-tight text-zinc-950">
            {metrics?.escalated ?? "—"}
          </p>
          <p className="mt-1 text-[11px] font-normal text-zinc-500">Level 1–4 management</p>
        </div>

        {/* Card 5: SLA Breaches */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-normal text-zinc-500">SLA Breached</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2v20" />
                <path d="m17 5-5-3-5 3" />
                <path d="m17 19-5 3-5-3" />
              </svg>
            </span>
          </div>
          <p className={`mt-2 text-2xl font-medium tracking-tight ${metrics?.slaBreaches ? "text-rose-600" : "text-zinc-950"}`}>
            {metrics?.slaBreaches ?? "—"}
          </p>
          <p className="mt-1 text-[11px] font-normal text-zinc-500">Exceeded policy deadline</p>
        </div>

        {/* Card 6: Resolved */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-normal text-zinc-500">Resolved</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </span>
          </div>
          <p className="mt-2 text-2xl font-medium tracking-tight text-zinc-950">
            {metrics?.resolved ?? "—"}
          </p>
          <p className="mt-1 text-[11px] font-normal text-zinc-500">Successfully concluded</p>
        </div>
      </div>

      {/* Queue Tabs */}
      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex space-x-2 overflow-x-auto pb-1 text-sm font-medium">
          {[
            { id: "all", label: "All Cases", count: metrics?.total },
            { id: "unassigned", label: "Unassigned", count: metrics?.unassigned },
            { id: "waiting_guest", label: "Waiting for Guest", count: metrics?.waitingForGuest },
            { id: "waiting_host", label: "Waiting for Host", count: metrics?.waitingForHost },
            { id: "escalated", label: "Escalated", count: metrics?.escalated },
            { id: "sla_breached", label: "SLA Breached", count: metrics?.slaBreaches },
            { id: "resolved", label: "Resolved", count: metrics?.resolved },
            { id: "closed", label: "Closed", count: metrics?.closed },
          ].map((tab) => {
            const active = activeQueueTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleQueueTabChange(tab.id)}
                className={`whitespace-nowrap px-3.5 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  active
                    ? "border-zinc-900 text-zinc-950"
                    : "border-transparent text-zinc-500 hover:text-zinc-800 hover:border-zinc-300"
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-normal ${
                      active ? "bg-zinc-100 text-zinc-900" : "bg-zinc-100 text-zinc-500"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-2xs space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search Input */}
          <div className="relative sm:col-span-2">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
              <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  setPage(1);
                  void loadList(1);
                }
              }}
              placeholder="Search case #, subject, guest, or host..."
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 py-2 pl-9 pr-3 text-xs sm:text-sm font-normal text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* Status Dropdown */}
          <div>
            <select
              value={filters.status}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, status: e.target.value }));
                setActiveQueueTab("custom");
                setPage(1);
              }}
              className="w-full rounded-xl border border-zinc-200 bg-white py-2 px-3 text-xs sm:text-sm font-normal text-zinc-800 focus:border-zinc-400 focus:outline-hidden"
            >
              <option value="">All Statuses</option>
              {Object.entries(statusLabels).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Dropdown */}
          <div>
            <select
              value={filters.priority}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, priority: e.target.value }));
                setPage(1);
              }}
              className="w-full rounded-xl border border-zinc-200 bg-white py-2 px-3 text-xs sm:text-sm font-normal text-zinc-800 focus:border-zinc-400 focus:outline-hidden"
            >
              <option value="">All Priorities</option>
              <option value="URGENT">Urgent Priority</option>
              <option value="HIGH">High Priority</option>
              <option value="MEDIUM">Medium Priority</option>
              <option value="LOW">Low Priority</option>
            </select>
          </div>

          {/* Assignee Dropdown */}
          <div>
            <select
              value={filters.assignedAdminId}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, assignedAdminId: e.target.value }));
                setPage(1);
              }}
              className="w-full rounded-xl border border-zinc-200 bg-white py-2 px-3 text-xs sm:text-sm font-normal text-zinc-800 focus:border-zinc-400 focus:outline-hidden"
            >
              <option value="">All Assignees</option>
              <option value="unassigned">Unassigned Only</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name || agent.email}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Secondary Row: Dates and Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-zinc-100 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-zinc-500 font-normal">Date Created:</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, dateFrom: e.target.value }));
                setPage(1);
              }}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-normal text-zinc-700"
            />
            <span className="text-zinc-400">to</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => {
                setFilters((prev) => ({ ...prev, dateTo: e.target.value }));
                setPage(1);
              }}
              className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-normal text-zinc-700"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 transition-colors"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={() => {
                setPage(1);
                void loadList(1);
              }}
              className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition-colors shadow-2xs"
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {/* Case Table */}
      {loading ? (
        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-zinc-100" />
          ))}
        </div>
      ) : cases.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-12 text-center shadow-2xs">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500">
            <svg className="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <h3 className="mt-4 text-base font-medium text-zinc-900">No support cases found</h3>
          <p className="mt-1 text-sm font-normal text-zinc-500 max-w-sm mx-auto">
            No support cases match the active filter criteria. Try adjusting your search query or queue filters.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-4 rounded-xl border border-zinc-200 bg-white px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50/75 text-[11px] uppercase tracking-wider text-zinc-500 font-medium">
                <tr>
                  <th className="py-3 px-4">Case # &amp; Subject</th>
                  <th className="py-3 px-4">Reporter &amp; Context</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">SLA Due</th>
                  <th className="py-3 px-4">Assignee</th>
                  <th className="py-3 px-4">Activity</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {cases.map((item) => {
                  const overdue = isSlaOverdue(item.slaDueAt, item.status);
                  const badgeStyle = statusBadges[item.status] || {
                    bg: "bg-zinc-100 border-zinc-200",
                    text: "text-zinc-700",
                    dot: "bg-zinc-400",
                  };
                  const prio = priorityStyles[item.priority] || priorityStyles.MEDIUM;

                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/80 transition-colors">
                      {/* Case & Subject */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-medium text-zinc-500">
                            {item.caseNumber}
                          </span>
                          {item.escalationLevel && item.escalationLevel > 0 && (
                            <span className="rounded-md bg-rose-100 border border-rose-200 px-1.5 py-0.2 text-[10px] font-medium text-rose-800">
                              L{item.escalationLevel}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 font-medium text-zinc-900 truncate" title={item.subject}>
                          {item.subject}
                        </p>
                        <p className="mt-0.5 text-[11px] font-normal text-zinc-500">
                          {item.category.replaceAll("_", " ")}
                          {item.issueType ? ` · ${item.issueType.replaceAll("_", " ")}` : ""}
                        </p>
                      </td>

                      {/* Reporter & Context */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-zinc-900 truncate">
                            {item.reporter?.name || item.booking?.user?.name || "Participant"}
                          </span>
                          <span className="rounded bg-zinc-100 px-1.5 py-0.2 text-[10px] font-normal text-zinc-600">
                            {item.reporterRole || "Reporter"}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-normal text-zinc-500 truncate max-w-[180px]">
                          {item.listing?.title || item.booking?.submissionId || item.booking?.id || "Direct Request"}
                        </p>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${badgeStyle.bg} ${badgeStyle.text}`}
                        >
                          <span className={`size-1.5 rounded-full ${badgeStyle.dot}`} />
                          {statusLabels[item.status]}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-lg border px-2 py-0.5 text-xs font-medium ${prio.bg} ${prio.text} ${prio.border}`}
                        >
                          {item.priority}
                        </span>
                      </td>

                      {/* SLA Due */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.status === "RESOLVED" || item.status === "CLOSED" ? (
                          <span className="text-xs text-zinc-400 font-normal">Completed</span>
                        ) : overdue ? (
                          <div className="flex items-center gap-1 text-rose-600 font-medium text-xs">
                            <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="8" x2="12" y2="12" />
                              <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                            <span>Breached</span>
                          </div>
                        ) : item.slaDueAt ? (
                          <span className="text-xs font-normal text-zinc-700">
                            {formatDate(item.slaDueAt)}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400 font-normal">—</span>
                        )}
                      </td>

                      {/* Assignee */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.assignedAdmin ? (
                          <div className="flex items-center gap-2">
                            <div className="flex size-6 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-medium text-indigo-700">
                              {(item.assignedAdmin.name || item.assignedAdmin.email || "A").slice(0, 1).toUpperCase()}
                            </div>
                            <span className="font-normal text-zinc-800 text-xs truncate max-w-[120px]">
                              {item.assignedAdmin.name || item.assignedAdmin.email}
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex rounded-md bg-zinc-100 px-2 py-0.5 text-[11px] font-normal text-zinc-500">
                            Unassigned
                          </span>
                        )}
                      </td>

                      {/* Activity */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-xs text-zinc-500 font-normal">
                        {formatRelativeTime(item.updatedAt)}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <Link
                          href={`/admin/support/${item.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-900 shadow-2xs hover:bg-zinc-50 transition-colors"
                        >
                          <span>Open</span>
                          <svg className="size-3 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-zinc-200 px-4 py-3 bg-zinc-50/50 text-xs text-zinc-600 font-normal">
            <div>
              Showing{" "}
              <span className="font-medium text-zinc-900">
                {cases.length > 0 ? (page - 1) * 25 + 1 : 0}
              </span>{" "}
              to{" "}
              <span className="font-medium text-zinc-900">
                {Math.min(page * 25, pages.total || (page - 1) * 25 + cases.length)}
              </span>{" "}
              of <span className="font-medium text-zinc-900">{pages.total || cases.length}</span> support cases
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 disabled:opacity-40 transition-colors"
              >
                Previous
              </button>
              <span className="px-2 font-normal text-zinc-500">
                Page {pages.page} of {pages.totalPages || 1}
              </span>
              <button
                type="button"
                disabled={page >= pages.totalPages}
                onClick={() => setPage(page + 1)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-2xs hover:bg-zinc-50 disabled:opacity-40 transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
