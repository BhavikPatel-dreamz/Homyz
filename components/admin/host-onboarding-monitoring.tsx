"use client";

import React, { useState, useEffect, useCallback, useTransition } from "react";
import Link from "next/link";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import { Alert } from "../ui";
import { AdminPagination } from "./admin-pagination";

export interface OnboardingMetricSummary {
  totalOnboarding: number;
  pendingReview: number;
  documentsPending: number;
  compliancePending: number;
  actionRequired: number;
  approved: number;
  completed: number;
  rejected: number;
  overdue: number;
}

export interface PipelineStageItem {
  stageKey: string;
  label: string;
  order: number;
  count: number;
}

export interface ActionRequiredItem {
  type: string;
  title: string;
  description: string;
  assignedTo: "HOST" | "ADMIN";
  createdAt: string;
  ageInDays: number;
  isOverdue: boolean;
}

export interface OnboardingRecordItem {
  id: string;
  applicationId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string | null;
  overallStatus: string;
  currentStage: string;
  currentStageLabel: string;
  progressPercent: number;
  completedStagesCount: number;
  totalStagesCount: number;
  reviewer: { id: string; name: string | null; email: string | null } | null;
  submittedAt: string;
  updatedAt: string;
  daysInCurrentStage: number;
  isOverdue: boolean;
  actionRequired: ActionRequiredItem[];
}

export interface ReviewerWorkloadItem {
  reviewer: { id: string; name: string | null; email: string | null };
  assignedCount: number;
  pendingCount: number;
  actionRequiredCount: number;
  completedCount: number;
}

export interface AnalyticsData {
  funnel: Array<{ stage: string; rate: number; count: number }>;
  summary: {
    totalRegistered: number;
    totalSubmitted: number;
    totalVerified: number;
    totalApproved: number;
    totalCompleted: number;
    totalRejected: number;
    avgCompletionDays: number;
  };
}

export function HostOnboardingMonitoring() {
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const tabParam = (searchParams.get("tab") || "").toLowerCase() as "pipeline" | "table" | "workload";
  const activeTab = ["pipeline", "table", "workload"].includes(tabParam) ? tabParam : "pipeline";

  function getTabHref(tabId: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "pipeline") {
      params.delete("tab");
    } else {
      params.set("tab", tabId);
    }
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  // Metrics & Dashboard State
  const [metrics, setMetrics] = useState<OnboardingMetricSummary | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStageItem[]>([]);
  const [workload, setWorkload] = useState<ReviewerWorkloadItem[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  // List & Filter State
  const [records, setRecords] = useState<OnboardingRecordItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [reviewerFilter, setReviewerFilter] = useState("ALL");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [actionRequiredOnly, setActionRequiredOnly] = useState(false);

  // UI State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; msg: string } | null>(null);
  const [pendingTransition, startTransition] = useTransition();

  // Drawer / Detail Modal
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [recordDetail, setRecordDetail] = useState<any | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Reviewers list for dropdowns
  const [reviewers, setReviewers] = useState<Array<{ id: string; name: string | null; email: string | null }>>([]);

  const fetchDashboardData = useCallback(async () => {
    try {
      const [dashRes, workRes, analyticsRes] = await Promise.all([
        fetch("/api/v1/admin/hosts/onboarding/dashboard"),
        fetch("/api/v1/admin/hosts/onboarding/reviewers"),
        fetch("/api/v1/admin/hosts/onboarding/analytics"),
      ]);

      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setMetrics(dashData.data.metrics);
        setPipeline(dashData.data.pipeline);
      }

      if (workRes.ok) {
        const workData = await workRes.json();
        setWorkload(workData.data || []);
        setReviewers(workData.data.map((w: any) => w.reviewer));
      }

      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setAnalytics(analyticsData.data);
      }
    } catch (err: any) {
      console.error("Error fetching onboarding dashboard data:", err);
    }
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy: "updatedAt",
        sortOrder: "desc",
      });

      if (search.trim()) params.set("search", search.trim());
      if (stageFilter !== "ALL") params.set("stage", stageFilter);
      if (statusFilter !== "ALL") params.set("overallStatus", statusFilter);
      if (reviewerFilter !== "ALL") params.set("reviewerId", reviewerFilter);
      if (overdueOnly) params.set("overdueOnly", "true");
      if (actionRequiredOnly) params.set("actionRequiredOnly", "true");

      const res = await fetch(`/api/v1/admin/hosts/onboarding?${params.toString()}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error?.message || "Failed to fetch onboarding records");
      }

      const json = await res.json();
      const itemsList = Array.isArray(json.data) ? json.data : json.data?.items || [];
      const paginationMeta = json.pagination || json.data?.pagination || { total: 0, totalPages: 1 };
      setRecords(itemsList);
      setTotal(paginationMeta.total || 0);
      setTotalPages(paginationMeta.totalPages || 1);
    } catch (err: any) {
      setError(err.message || "Failed to load records");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, stageFilter, statusFilter, reviewerFilter, overdueOnly, actionRequiredOnly]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const fetchRecordDetail = async (id: string) => {
    setDetailLoading(true);
    setSelectedRecordId(id);
    setDrawerOpen(true);
    try {
      const res = await fetch(`/api/v1/admin/hosts/onboarding/${id}`);
      if (!res.ok) throw new Error("Failed to fetch onboarding detail");
      const json = await res.json();
      setRecordDetail(json.data);
    } catch (err: any) {
      setFeedback({ tone: "error", msg: err.message || "Could not load host onboarding detail" });
    } finally {
      setDetailLoading(false);
    }
  };

  const router = useRouter();

  const handleStageClick = (stageKey: string) => {
    setStageFilter(stageKey);
    router.push(getTabHref("table"));
  };

  return (
    <div className="space-y-6">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 dark:bg-zinc-900/80 p-6 rounded-2xl border border-[var(--border)] shadow-xs backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
            <h1>Host Onboarding Monitoring & Progress</h1>
          </div>
          <p className="text-xs text-[var(--muted-foreground)] mt-1 font-medium">
            Centralized pipeline tracking, bottleneck detection, reviewer workload, and SLA compliance monitoring.
          </p>
        </div>

        {/* TAB TOGGLE BUTTONS */}
        <div className="flex items-center gap-1.5 p-1 bg-[var(--surface-secondary)] rounded-xl border border-[var(--border)] self-start md:self-auto">
          <Link
            href={getTabHref("pipeline")}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
              activeTab === "pipeline"
                ? "bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            Pipeline View
          </Link>
          <Link
            href={getTabHref("table")}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
              activeTab === "table"
                ? "bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            All Applications ({total})
          </Link>
          <Link
            href={getTabHref("workload")}
            className={`px-4 py-2 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
              activeTab === "workload"
                ? "bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            Reviewer Workload
          </Link>
        </div>
      </div>

      {feedback && (
        <Alert tone={feedback.tone}>
          {feedback.msg}
        </Alert>
      )}

      {/* DASHBOARD METRICS CARDS */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
            <span className="text-[11px] font-bold text-[var(--muted-foreground)] uppercase tracking-wider block">Total In Onboarding</span>
            <div className="text-2xl font-black text-[var(--foreground)] mt-1">{metrics.totalOnboarding}</div>
            <span className="text-[10px] text-[var(--muted-foreground)]">Across all active stages</span>
          </div>

          <div className="rounded-2xl border border-amber-300 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20 p-4 shadow-2xs">
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">Pending Review</span>
            <div className="text-2xl font-black text-amber-900 dark:text-amber-300 mt-1">{metrics.pendingReview}</div>
            <span className="text-[10px] text-amber-700/80 dark:text-amber-400/80">Awaiting admin review</span>
          </div>

          <div className="rounded-2xl border border-blue-300 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-4 shadow-2xs">
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block">Docs / Compliance</span>
            <div className="text-2xl font-black text-blue-900 dark:text-blue-300 mt-1">
              {metrics.documentsPending + metrics.compliancePending}
            </div>
            <span className="text-[10px] text-blue-700/80 dark:text-blue-400/80">Verification in progress</span>
          </div>

          <div className="rounded-2xl border border-rose-300 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 p-4 shadow-2xs">
            <span className="text-[11px] font-bold text-rose-700 dark:text-rose-400 uppercase tracking-wider block">Action Required</span>
            <div className="text-2xl font-black text-rose-900 dark:text-rose-300 mt-1">{metrics.actionRequired}</div>
            <span className="text-[10px] text-rose-700/80 dark:text-rose-400/80">Host / Admin action needed</span>
          </div>

          <div className="rounded-2xl border border-purple-300 dark:border-purple-900 bg-purple-50/50 dark:bg-purple-950/20 p-4 shadow-2xs relative overflow-hidden">
            {metrics.overdue > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>}
            <span className="text-[11px] font-bold text-purple-700 dark:text-purple-400 uppercase tracking-wider block">Overdue SLA</span>
            <div className="text-2xl font-black text-purple-900 dark:text-purple-300 mt-1">{metrics.overdue}</div>
            <span className="text-[10px] text-purple-700/80 dark:text-purple-400/80">Exceeding stage threshold</span>
          </div>

          <div className="rounded-2xl border border-emerald-300 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 shadow-2xs">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">Approved / Complete</span>
            <div className="text-2xl font-black text-emerald-900 dark:text-emerald-300 mt-1">{metrics.approved}</div>
            <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80">{metrics.completed} active hosts</span>
          </div>
        </div>
      )}

      {/* TAB CONTENT 1: PIPELINE KANBAN VIEW */}
      {activeTab === "pipeline" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-[var(--foreground)] uppercase tracking-wide">
              Onboarding Pipeline Stages
            </h2>
            <span className="text-xs text-[var(--muted-foreground)]">Click any stage column header to view filtered applications list</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            {pipeline.map((st) => (
              <button
                type="button"
                key={st.stageKey}
                onClick={() => handleStageClick(st.stageKey)}
                className={`p-4 rounded-2xl border text-left transition-all hover:scale-[1.02] cursor-pointer flex flex-col justify-between h-32 ${
                  stageFilter === st.stageKey
                    ? "border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20"
                    : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)]"
                }`}
              >
                <div>
                  <span className="text-[10px] font-bold text-[var(--muted-foreground)] uppercase block">Stage {st.order}</span>
                  <span className="text-xs font-extrabold text-[var(--foreground)] line-clamp-2 mt-0.5">{st.label}</span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] w-full">
                  <span className="text-xs text-[var(--muted-foreground)] font-medium">Count</span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-200">
                    {st.count}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Quick List Preview for Selected Pipeline */}
          <div className="pt-4 border-t border-[var(--border)]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-[var(--muted-foreground)] uppercase">
                Preview: {stageFilter === "ALL" ? "All Onboarding Applications" : `Stage: ${stageFilter}`}
              </h3>
              {stageFilter !== "ALL" && (
                <button
                  type="button"
                  onClick={() => setStageFilter("ALL")}
                  className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
                >
                  Clear Stage Filter
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {records.slice(0, 6).map((rec) => (
                <div
                  key={rec.id}
                  onClick={() => fetchRecordDetail(rec.id)}
                  className="p-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] hover:border-indigo-400 transition-all cursor-pointer space-y-3 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-extrabold text-xs text-[var(--foreground)] block">{rec.applicantName}</span>
                      <span className="text-[11px] font-mono text-[var(--muted-foreground)] block">{rec.applicationId}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        rec.overallStatus === "APPROVED"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : rec.overallStatus === "REJECTED"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {rec.overallStatus}
                    </span>
                  </div>

                  <div>
                    <div className="flex justify-between text-[10px] font-bold text-[var(--muted-foreground)] mb-1">
                      <span>{rec.currentStageLabel}</span>
                      <span>{rec.progressPercent}% ({rec.completedStagesCount}/8)</span>
                    </div>
                    <div className="w-full bg-[var(--surface-secondary)] h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-600 h-full transition-all duration-300"
                        style={{ width: `${rec.progressPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-2 border-t border-[var(--border-subtle)]">
                    <span className="text-[var(--muted-foreground)]">
                      Reviewer: <strong className="text-[var(--foreground)]">{rec.reviewer ? rec.reviewer.name || rec.reviewer.email : "Unassigned"}</strong>
                    </span>
                    {rec.isOverdue && (
                      <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-extrabold text-[10px] flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span> Overdue ({rec.daysInCurrentStage}d)
                      </span>
                    )}
                  </div>

                  {rec.actionRequired.length > 0 && (
                    <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[10px] text-rose-800 dark:text-rose-300 font-medium">
                      ⚠️ Action Required: {rec.actionRequired[0].title}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: ALL APPLICATIONS TABLE */}
      {activeTab === "table" && (
        <div className="space-y-4">
          {/* SEARCH & FILTERS TOOLBAR */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-bold text-[var(--muted-foreground)] block mb-1">Search Applications</label>
                <input
                  type="text"
                  placeholder="Search name, email, ID..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--muted-foreground)] block mb-1">Filter by Stage</label>
                <select
                  value={stageFilter}
                  onChange={(e) => {
                    setStageFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Stages</option>
                  <option value="REGISTRATION">1. Registration Submitted</option>
                  <option value="PROFILE_COMPLETION">2. Profile Completion</option>
                  <option value="APPLICATION_REVIEW">3. Application Review</option>
                  <option value="DOCUMENT_VERIFICATION">4. Document Verification</option>
                  <option value="COMPLIANCE_REVIEW">5. Compliance Review</option>
                  <option value="APPROVAL">6. Approval Review</option>
                  <option value="HOST_ACTIVATION">7. Host Activation</option>
                  <option value="ONBOARDING_COMPLETE">8. Onboarding Complete</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--muted-foreground)] block mb-1">Overall Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="IN_REVIEW">In Review</option>
                  <option value="WAITING_FOR_DOCUMENTS">Waiting for Documents</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-[var(--muted-foreground)] block mb-1">Assigned Reviewer</label>
                <select
                  value={reviewerFilter}
                  onChange={(e) => {
                    setReviewerFilter(e.target.value);
                    setPage(1);
                  }}
                  className="w-full text-xs rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Reviewers</option>
                  <option value="UNASSIGNED">Unassigned Only</option>
                  {reviewers.map((rev) => (
                    <option key={rev.id} value={rev.id}>
                      {rev.name || rev.email}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--border-subtle)] text-xs font-semibold">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-[var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={actionRequiredOnly}
                    onChange={(e) => {
                      setActionRequiredOnly(e.target.checked);
                      setPage(1);
                    }}
                    className="rounded border-[var(--border)] text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Action Required Only</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-[var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={overdueOnly}
                    onChange={(e) => {
                      setOverdueOnly(e.target.checked);
                      setPage(1);
                    }}
                    className="rounded border-[var(--border)] text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>Overdue SLA Only</span>
                </label>
              </div>

              {(search || stageFilter !== "ALL" || statusFilter !== "ALL" || reviewerFilter !== "ALL" || overdueOnly || actionRequiredOnly) && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStageFilter("ALL");
                    setStatusFilter("ALL");
                    setReviewerFilter("ALL");
                    setOverdueOnly(false);
                    setActionRequiredOnly(false);
                    setPage(1);
                  }}
                  className="text-xs font-extrabold text-rose-600 hover:underline cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* TABLE CONTAINER */}
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-extrabold uppercase tracking-wider">
                    <th className="py-3.5 px-4">Application ID</th>
                    <th className="py-3.5 px-4">Applicant</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Stage & Progress</th>
                    <th className="py-3.5 px-4">Action Required</th>
                    <th className="py-3.5 px-4">Reviewer</th>
                    <th className="py-3.5 px-4">SLA / Age</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] font-medium">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[var(--muted-foreground)]">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 rounded-full border-2 border-indigo-600 border-t-transparent animate-spin"></div>
                          <span>Loading onboarding records...</span>
                        </div>
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-[var(--muted-foreground)]">
                        No matching onboarding applications found.
                      </td>
                    </tr>
                  ) : (
                    records.map((item) => (
                      <tr key={item.id} className="hover:bg-[var(--surface-secondary)]/50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[var(--foreground)]">{item.applicationId}</td>
                        <td className="py-3.5 px-4">
                          <div className="font-extrabold text-[var(--foreground)]">{item.applicantName}</div>
                          <div className="text-[11px] text-[var(--muted-foreground)] font-mono">{item.applicantEmail}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                              item.overallStatus === "APPROVED"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                : item.overallStatus === "REJECTED"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            }`}
                          >
                            {item.overallStatus}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 min-w-[180px]">
                          <div className="flex justify-between text-[10px] font-bold text-[var(--foreground)] mb-1">
                            <span>{item.currentStageLabel}</span>
                            <span>{item.progressPercent}%</span>
                          </div>
                          <div className="w-full bg-[var(--surface-secondary)] h-2 rounded-full overflow-hidden border border-[var(--border-subtle)]">
                            <div
                              className="bg-indigo-600 h-full transition-all duration-300"
                              style={{ width: `${item.progressPercent}%` }}
                            ></div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 max-w-[200px]">
                          {item.actionRequired.length > 0 ? (
                            <span className="px-2 py-1 rounded-lg bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900 text-[10px] font-bold block truncate">
                              ⚠️ {item.actionRequired[0].title}
                            </span>
                          ) : (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">✓ Clear</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {item.reviewer ? (
                            <span className="font-bold text-[var(--foreground)]">{item.reviewer.name || item.reviewer.email}</span>
                          ) : (
                            <span className="text-[var(--muted-foreground)] italic">Unassigned</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          {item.isOverdue ? (
                            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 font-black text-[10px]">
                              🚨 {item.daysInCurrentStage}d in stage (Overdue)
                            </span>
                          ) : (
                            <span className="text-[var(--muted-foreground)] text-[11px] font-medium">{item.daysInCurrentStage}d in stage</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => fetchRecordDetail(item.id)}
                            className="rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:hover:bg-indigo-900 dark:text-indigo-300 px-3.5 py-1.5 text-xs font-black cursor-pointer transition-colors"
                          >
                            View Progress & Tracker
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <AdminPagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(sz) => {
                setPageSize(sz);
                setPage(1);
              }}
            />
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: REVIEWER WORKLOAD */}
      {activeTab === "workload" && (
        <div className="space-y-4">
          <h2 className="text-sm font-extrabold text-[var(--foreground)] uppercase tracking-wide">
            Reviewer Workload & Capacity Breakdown
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {workload.map((w) => (
              <div
                key={w.reviewer.id}
                className="p-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs space-y-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 flex items-center justify-center font-black text-sm">
                    {(w.reviewer.name || w.reviewer.email || "A")[0].toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-sm text-[var(--foreground)]">{w.reviewer.name || "Admin Reviewer"}</h3>
                    <p className="text-xs text-[var(--muted-foreground)] font-mono">{w.reviewer.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--border-subtle)] text-xs">
                  <div className="p-3 bg-[var(--surface-secondary)] rounded-xl">
                    <span className="text-[10px] text-[var(--muted-foreground)] font-bold block uppercase">Assigned Total</span>
                    <span className="text-lg font-black text-[var(--foreground)]">{w.assignedCount}</span>
                  </div>
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-xl">
                    <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold block uppercase">Pending Review</span>
                    <span className="text-lg font-black text-amber-900 dark:text-amber-300">{w.pendingCount}</span>
                  </div>
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/30 rounded-xl">
                    <span className="text-[10px] text-rose-700 dark:text-rose-400 font-bold block uppercase">Action Required</span>
                    <span className="text-lg font-black text-rose-900 dark:text-rose-300">{w.actionRequiredCount}</span>
                  </div>
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-xl">
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold block uppercase">Completed</span>
                    <span className="text-lg font-black text-emerald-900 dark:text-emerald-300">{w.completedCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      {/* DRAWER MODAL: SINGLE HOST ONBOARDING PROGRESS & TRACKER */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-3xl bg-[var(--surface)] h-full overflow-y-auto p-6 space-y-6 border-l border-[var(--border)] shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-[var(--border)]">
              <div>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 block uppercase">Host Onboarding Tracker</span>
                <h2 className="text-xl font-black text-[var(--foreground)]">{recordDetail?.applicantName || "Loading..."}</h2>
                <span className="text-xs font-mono text-[var(--muted-foreground)]">{recordDetail?.applicationId}</span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-full hover:bg-[var(--surface-secondary)] text-[var(--muted-foreground)] cursor-pointer"
              >
                ✕
              </button>
            </div>

            {detailLoading || !recordDetail ? (
              <div className="py-20 text-center text-xs text-[var(--muted-foreground)]">Loading host onboarding details...</div>
            ) : (
              <div className="space-y-6 text-xs">
                {/* OVERVIEW SUMMARY BADGES */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border)]">
                  <div>
                    <span className="text-[10px] text-[var(--muted-foreground)] font-bold block uppercase">Overall Status</span>
                    <span className="font-black text-sm text-[var(--foreground)]">{recordDetail.overallStatus}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--muted-foreground)] font-bold block uppercase">Current Stage</span>
                    <span className="font-black text-sm text-indigo-600 dark:text-indigo-400">{recordDetail.currentStageLabel}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--muted-foreground)] font-bold block uppercase">Progress</span>
                    <span className="font-black text-sm text-[var(--foreground)]">{recordDetail.progressPercent}% ({recordDetail.completedStagesCount}/8)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--muted-foreground)] font-bold block uppercase">Days in Stage</span>
                    <span className={`font-black text-sm ${recordDetail.isOverdue ? "text-rose-600" : "text-[var(--foreground)]"}`}>
                      {recordDetail.daysInCurrentStage}d {recordDetail.isOverdue ? "(Overdue SLA)" : ""}
                    </span>
                  </div>
                </div>

                {/* VISUAL ONBOARDING PROGRESS TRACKER (8 STAGES) */}
                <div className="space-y-3">
                  <h3 className="font-extrabold text-xs text-[var(--foreground)] uppercase tracking-wider">
                    Stage Progress Tracker
                  </h3>

                  <div className="space-y-2">
                    {recordDetail.stageList.map((st: any) => (
                      <div
                        key={st.stageKey}
                        className={`p-3.5 rounded-xl border flex items-center justify-between transition-colors ${
                          st.status === "COMPLETED"
                            ? "border-emerald-300 bg-emerald-50/60 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200"
                            : st.status === "IN_PROGRESS"
                            ? "border-indigo-300 bg-indigo-50/60 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 ring-2 ring-indigo-500/20"
                            : st.status === "ACTION_REQUIRED"
                            ? "border-rose-300 bg-rose-50/60 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200"
                            : "border-[var(--border)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${
                              st.status === "COMPLETED"
                                ? "bg-emerald-600 text-white"
                                : st.status === "IN_PROGRESS"
                                ? "bg-indigo-600 text-white animate-pulse"
                                : st.status === "ACTION_REQUIRED"
                                ? "bg-rose-600 text-white"
                                : "bg-[var(--border)] text-[var(--muted-foreground)]"
                            }`}
                          >
                            {st.status === "COMPLETED" ? "✓" : st.order}
                          </span>
                          <div>
                            <span className="font-extrabold text-xs block">{st.label}</span>
                            {st.actionRequired && (
                              <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400 block mt-0.5">
                                ⚠️ Action Required: {st.actionRequired}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide block">
                            {st.status}
                          </span>
                          {st.completedAt && (
                            <span className="text-[10px] font-mono text-[var(--muted-foreground)] block">
                              {new Date(st.completedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ACTION REQUIRED ITEMS LIST */}
                {recordDetail.actionsRequired.length > 0 && (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/40 rounded-2xl border border-rose-300 dark:border-rose-900 space-y-3">
                    <h4 className="font-extrabold text-xs text-rose-900 dark:text-rose-200 uppercase tracking-wide flex items-center gap-2">
                      <span>⚠️ Action Required Items ({recordDetail.actionsRequired.length})</span>
                    </h4>
                    <div className="space-y-2">
                      {recordDetail.actionsRequired.map((act: any, idx: number) => (
                        <div key={idx} className="p-3 bg-white dark:bg-zinc-900 rounded-xl border border-rose-200 dark:border-rose-800 space-y-1">
                          <div className="flex justify-between items-start">
                            <span className="font-extrabold text-xs text-[var(--foreground)]">{act.title}</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                              Assigned to: {act.assignedTo}
                            </span>
                          </div>
                          <p className="text-[11px] text-[var(--muted-foreground)]">{act.description}</p>
                          <div className="flex justify-between text-[10px] font-mono text-[var(--muted-foreground)] pt-1">
                            <span>Created: {new Date(act.createdAt).toLocaleDateString()}</span>
                            <span>Age: {act.ageInDays} day(s)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* STAGE HISTORY / TIMELINE FROM AUDIT LOGS */}
                <div className="space-y-3">
                  <h3 className="font-extrabold text-xs text-[var(--foreground)] uppercase tracking-wider">
                    Onboarding Stage History & Timeline
                  </h3>

                  <div className="space-y-2 border-l-2 border-indigo-200 dark:border-indigo-900 pl-4 py-1">
                    {recordDetail.timeline.map((log: any) => (
                      <div key={log.id} className="relative space-y-0.5 text-xs">
                        <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-600"></span>
                        <div className="flex justify-between font-extrabold text-[var(--foreground)]">
                          <span>{log.action.replace(/_/g, " ")}</span>
                          <span className="font-mono text-[10px] text-[var(--muted-foreground)]">
                            {new Date(log.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--muted-foreground)]">{log.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
