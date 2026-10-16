"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ModerationAnalyticsPayload, AnalyticsPeriod } from "@/services/moderation-analytics.service";

interface AdminModerationDashboardClientProps {
  initialAnalytics: ModerationAnalyticsPayload;
  initialFilters: {
    period?: AnalyticsPeriod;
    startDate?: string;
    endDate?: string;
    targetType?: string;
    status?: string;
  };
}

const PERIOD_OPTIONS: Array<{ id: AnalyticsPeriod; label: string }> = [
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 Days" },
  { id: "30d", label: "Last 30 Days" },
  { id: "90d", label: "Last 90 Days" },
  { id: "all", label: "All Time" },
  { id: "custom", label: "Custom" },
];

type DashboardTab = "overview" | "content" | "enforcement" | "workload" | "health";
const DASHBOARD_TABS: Array<{ id: DashboardTab; label: string }> = [
  { id: "overview", label: "Overview & Trends" },
  { id: "content", label: "Content Moderation Breakdown" },
  { id: "enforcement", label: "Enforcement & Appeals" },
  { id: "workload", label: "Moderator Workload & SLA" },
  { id: "health", label: "System Automation Health" },
];

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });
function formatDate(value: string | Date) {
  try {
    return dateFormat.format(new Date(value));
  } catch {
    return String(value);
  }
}

export function AdminModerationDashboardClient({
  initialAnalytics,
  initialFilters,
}: AdminModerationDashboardClientProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [period, setPeriod] = useState<AnalyticsPeriod>(initialFilters.period || "30d");
  const [startDate, setStartDate] = useState(initialFilters.startDate ?? "");
  const [endDate, setEndDate] = useState(initialFilters.endDate ?? "");
  const [analytics, setAnalytics] = useState<ModerationAnalyticsPayload>(initialAnalytics);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);

  const applyFilters = useCallback(async (
    nextPeriod = period,
    nextStart = startDate,
    nextEnd = endDate,
    updateUrl = true,
  ) => {
    const requestId = ++requestSequence.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("period", nextPeriod);
      if (nextPeriod === "custom") {
        if (nextStart) params.set("startDate", nextStart);
        if (nextEnd) params.set("endDate", nextEnd);
      }
      if (initialFilters.targetType) params.set("targetType", initialFilters.targetType);
      if (initialFilters.status) params.set("status", initialFilters.status);

      if (updateUrl) {
        window.history.pushState(null, "", `/admin/moderation?${params.toString()}`);
      }

      const res = await fetch(`/api/v1/admin/moderation/analytics?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to load analytics.");
      if (requestId === requestSequence.current) {
        setAnalytics(json.data || json);
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      console.error("[moderation-dashboard] Failed to refresh analytics:", err);
      if (requestId === requestSequence.current) {
        setError(err instanceof Error ? err.message : "Failed to load analytics. Please retry.");
      }
    } finally {
      if (requestId === requestSequence.current) {
        setLoading(false);
      }
    }
  }, [initialFilters.status, initialFilters.targetType, period, startDate, endDate]);

  useEffect(() => {
    activeRequest.current?.abort();
    requestSequence.current += 1;
    setPeriod(initialFilters.period || "30d");
    setStartDate(initialFilters.startDate ?? "");
    setEndDate(initialFilters.endDate ?? "");
    setAnalytics(initialAnalytics);
    setLoading(false);
    setError(null);
  }, [initialAnalytics, initialFilters.endDate, initialFilters.period, initialFilters.startDate]);

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const nextPeriod = (params.get("period") || "30d") as AnalyticsPeriod;
      const nextStart = params.get("startDate") || "";
      const nextEnd = params.get("endDate") || "";
      setPeriod(nextPeriod);
      setStartDate(nextStart);
      setEndDate(nextEnd);
      void applyFilters(nextPeriod, nextStart, nextEnd, false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [applyFilters]);

  useEffect(() => () => activeRequest.current?.abort(), []);

  const handlePeriodChange = (nextPeriod: AnalyticsPeriod) => {
    setPeriod(nextPeriod);
    if (nextPeriod !== "custom") {
      applyFilters(nextPeriod, "", "");
    }
  };

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set("period", period);
    if (period === "custom") {
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
    }
    if (initialFilters.targetType) params.set("targetType", initialFilters.targetType);
    if (initialFilters.status) params.set("status", initialFilters.status);
    return `/api/v1/admin/moderation/analytics/export?${params.toString()}`;
  }, [initialFilters.status, initialFilters.targetType, period, startDate, endDate]);

  const kpis = analytics.kpis;
  const onTimeResolutionRate = analytics.slaMetrics.onTimeResolutionRate === null
    ? "N/A"
    : `${analytics.slaMetrics.onTimeResolutionRate}%`;
  const trendMax = useMemo(() => {
    return Math.max(1, ...analytics.reportAnalytics.trends.map((t) => t.reports + t.cases + t.resolved));
  }, [analytics.reportAnalytics.trends]);

  return (
    <main aria-busy={loading} className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header & Navigation */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-slate-200 pb-5">
        <div>
          <nav className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Support &amp; Operations</span>
            <span>/</span>
            <span className="text-indigo-600">Trust &amp; Safety Moderation</span>
          </nav>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Moderation Analytics &amp; Operations
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Centralized case resolution metrics, user report volume, enforcement outcomes, SLA tracking, and moderator workload.
          </p>
        </div>

        {/* Global Action Links */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/moderation/cases"
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
          >
            Cases Queue ({kpis.openCases} in range)
          </Link>

          <Link
            href="/admin/moderation/appeals"
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 shadow-sm"
          >
            Appeals Queue ({kpis.pendingAppeals})
          </Link>
          <Link
            href="/admin/moderation/jobs"
            className="rounded-md bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-800 shadow-sm"
          >
            Background Operations
          </Link>
          <a
            href={exportUrl}
            download
            className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 shadow-sm"
          >
            Export CSV
          </a>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          <span>{error}</span>
          <button type="button" onClick={() => void applyFilters()} className="rounded-md bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-800">
            Retry
          </button>
        </div>
      )}

      {/* Date Range Selector Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              disabled={loading}
              onClick={() => handlePeriodChange(opt.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:cursor-wait disabled:opacity-60 ${
                period === opt.id
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {period === "custom" && (
          <form
            className="flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              applyFilters("custom", startDate, endDate);
            }}
          >
            <label className="text-xs font-medium text-slate-600">
              From:{" "}
              <input
                type="date"
                value={startDate}
                disabled={loading}
                onChange={(e) => setStartDate(e.target.value)}
                className="ml-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              To:{" "}
              <input
                type="date"
                value={endDate}
                disabled={loading}
                onChange={(e) => setEndDate(e.target.value)}
                className="ml-1 rounded-md border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
            >
              Apply
            </button>
          </form>
        )}

        <div className="text-xs text-slate-500">
          Range: <span className="font-semibold text-slate-800">{analytics.dateRange.start ? formatDate(analytics.dateRange.start) : "All Time"}</span> to{" "}
          <span className="font-semibold text-slate-800">{analytics.dateRange.end ? formatDate(analytics.dateRange.end) : "Present"}</span>
        </div>
      </div>

      {/* Main KPI Cards Section (Task 2: Accurate separate counts for Reports vs Cases) */}
      <section aria-label="Core Moderation KPIs" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700">Total User Reports</span>
          <p className="mt-1 text-2xl font-black text-indigo-950">{kpis.totalReports}</p>
          <span className="text-3xs text-indigo-600">{analytics.reportAnalytics.duplicateReportsLinked} linked to shared cases</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Cases</span>
          <p className="mt-1 text-2xl font-black text-slate-900">{kpis.totalCases}</p>
          <span className="text-3xs text-slate-500">Canonical investigation cases</span>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3.5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">Open Cases (Range)</span>
          <p className="mt-1 text-2xl font-black text-sky-950">{kpis.openCases}</p>
          <span className="text-3xs text-sky-600">{kpis.pendingReview} new · {kpis.underInvestigation} active</span>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Resolved Cases</span>
          <p className="mt-1 text-2xl font-black text-emerald-950">{kpis.resolvedCases}</p>
          <span className="text-3xs text-emerald-600">{kpis.closedCases} total closed</span>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Overdue Cases (&gt;72h)</span>
          <p className="mt-1 text-2xl font-black text-amber-950">{kpis.overdueCases}</p>
          <span className="text-3xs text-amber-600">{onTimeResolutionRate} on-time SLA</span>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-3.5 shadow-sm">
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Avg Resolution</span>
          <p className="mt-1 text-2xl font-black text-purple-950">
            {kpis.avgResolutionTimeHours > 0 ? `${kpis.avgResolutionTimeHours}h` : "—"}
          </p>
          <span className="text-3xs text-purple-600">{kpis.enforcementActions} enforcements</span>
        </div>
      </section>

      {/* Tabs Header */}
      <nav aria-label="Moderation Analytics Navigation" className="flex border-b border-slate-200 gap-6 text-sm font-semibold">
        {DASHBOARD_TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`pb-3 transition-colors ${
              activeTab === id
                ? "border-b-2 border-indigo-600 text-indigo-600"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* TAB 1: OVERVIEW & TRENDS */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Phase 8 Deferred Notice */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                PHASE 8 STATUS
              </span>
              <span>
                <strong>Automated Content Detection:</strong> Postponed / Deferred. All analytics reflect verified database records from client and host reports.
              </span>
            </div>
            <span className="text-slate-400">Strictly 0 AI-generated statistics</span>
          </div>

          {/* Daily Trends Visualization (Task 15: Chart 1) */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Moderation Activity Trends</h2>
                <p className="text-xs text-slate-500">Daily reports submitted, cases initiated, and cases resolved.</p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-indigo-500" /> Reports</span>
                <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-sky-500" /> Cases</span>
                <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-emerald-500" /> Resolved</span>
              </div>
            </div>

            <div className="h-56 min-w-0 overflow-x-auto overflow-y-hidden border-b border-slate-200 pb-4">
              {!analytics.reportAnalytics.trends.length ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">No trend data in period.</div>
              ) : (
                <div className="flex h-full min-w-[700px] items-end gap-2 pt-4">
                  {analytics.reportAnalytics.trends.map((point) => {
                    const total = point.reports + point.cases + point.resolved;
                    const heightPct = Math.max(4, Math.round((total / trendMax) * 100));
                    return (
                      <div key={point.date} className="group relative flex h-full flex-1 flex-col items-center justify-end">
                        <div className="pointer-events-none absolute bottom-full mb-2 hidden w-36 rounded-lg bg-slate-900 p-2 text-3xs text-white shadow-lg group-hover:block z-20">
                          <strong className="block border-b border-slate-700 pb-1 mb-1">{point.date}</strong>
                          Reports: {point.reports}<br />
                          Cases: {point.cases}<br />
                          Resolved: {point.resolved}
                        </div>
                        <div style={{ height: `${heightPct}%` }} className="flex w-full max-w-6 flex-col overflow-hidden rounded-t-sm bg-slate-100">
                          {point.reports > 0 && <span style={{ flex: point.reports }} className="bg-indigo-500" />}
                          {point.cases > 0 && <span style={{ flex: point.cases }} className="bg-sky-500" />}
                          {point.resolved > 0 && <span style={{ flex: point.resolved }} className="bg-emerald-500" />}
                        </div>
                        <span className="mt-1 w-full truncate text-center text-3xs text-slate-400">{point.date.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Distribution & Urgent Attention Grid */}
          <section className="grid gap-5 xl:grid-cols-3">
            {/* Urgent Attention Card */}
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5">
              <h2 className="font-semibold text-slate-900">Urgent Operational Backlog</h2>
              <p className="mt-1 text-xs text-slate-600">Open cases created in the selected range that require prompt action or initial moderator assignment.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <Link href="/admin/moderation/cases?attention=1" className="rounded-lg bg-white p-3 shadow-xs hover:border-slate-300 border border-slate-200">
                  <span className="block text-xl font-bold text-slate-900">{analytics.operational.highPriorityOpenCases}</span>
                  <span className="text-xs text-slate-600 font-medium">High-Priority Open</span>
                </Link>
                <Link href="/admin/moderation/cases?assigned=unassigned" className="rounded-lg bg-white p-3 shadow-xs hover:border-slate-300 border border-slate-200">
                  <span className="block text-xl font-bold text-slate-900">{analytics.operational.unassignedOpenCases}</span>
                  <span className="text-xs text-slate-600 font-medium">Awaiting Assignment</span>
                </Link>
                <div className="rounded-lg bg-white p-3 shadow-xs border border-slate-200">
                  <span className="block text-xl font-bold text-rose-600">{kpis.overdueCases}</span>
                  <span className="text-xs text-slate-600 font-medium">Overdue (&gt;72h)</span>
                </div>
                <div className="rounded-lg bg-white p-3 shadow-xs border border-slate-200">
                  <span className="block text-xl font-bold text-indigo-600">{kpis.pendingAppeals}</span>
                  <span className="text-xs text-slate-600 font-medium">Active Appeals</span>
                </div>
              </div>
            </div>

            {/* Target Type Distribution (Task 3) */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">Reports by Target Type</h2>
              <div className="mt-4 space-y-3">
                {analytics.reportAnalytics.byTargetType.length ? (
                  analytics.reportAnalytics.byTargetType.map((entry) => {
                    const pct = Math.round((entry.count / Math.max(1, kpis.totalReports)) * 100);
                    return (
                      <div key={entry.targetType}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-slate-700">{entry.targetType.replace(/_/g, " ")}</span>
                          <span className="text-slate-500">{entry.count} ({pct}%)</span>
                        </div>
                        <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div style={{ width: `${pct}%` }} className="h-full bg-indigo-600 rounded-full" />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-500">No reports recorded in this period.</p>
                )}
              </div>
            </div>

            {/* Reporter Role Breakdown */}
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <h2 className="font-semibold text-slate-900">Reporter Demographics</h2>
              <p className="text-xs text-slate-500 mt-0.5">Distribution of reports by user account role.</p>
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <span className="text-xs font-semibold text-slate-700">Guest / Client Reports</span>
                  <span className="font-mono text-sm font-bold text-slate-900">{analytics.reportAnalytics.byUserRole.guest}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <span className="text-xs font-semibold text-slate-700">Host Reports</span>
                  <span className="font-mono text-sm font-bold text-slate-900">{analytics.reportAnalytics.byUserRole.host}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-3">
                  <span className="text-xs font-semibold text-slate-700">Admin / System Inquiries</span>
                  <span className="font-mono text-sm font-bold text-slate-900">{analytics.reportAnalytics.byUserRole.adminOrOther}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Recent Activity List */}
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-semibold text-slate-900">Recent Moderation Activity</h2>
              <Link href="/admin/moderation/cases" className="text-xs font-semibold text-indigo-600 hover:underline">
                View Full Queue →
              </Link>
            </div>
            <ol className="mt-3 divide-y divide-slate-100">
              {analytics.operational.recentActivity.length ? (
                analytics.operational.recentActivity.map((activity) => (
                  <li key={activity.id} className="flex flex-col gap-1 py-2.5 text-xs sm:flex-row sm:justify-between sm:items-center">
                    <span>
                      <Link className="font-semibold text-indigo-700 hover:underline" href={`/admin/moderation/cases/${activity.case.id}`}>
                        {activity.case.caseReference}
                      </Link>{" "}
                      · <span className="font-medium">{activity.action.replace(/_/g, " ")}</span>
                      <span className="text-slate-400"> by {activity.actor?.name || activity.actor?.email || "system"}</span>
                    </span>
                    <time className="text-slate-400 text-3xs">{formatDate(activity.createdAt)}</time>
                  </li>
                ))
              ) : (
                <li className="py-6 text-center text-xs text-slate-500">No moderation activity logged in this period.</li>
              )}
            </ol>
          </section>
        </div>
      )}

      {/* TAB 2: CONTENT MODERATION BREAKDOWN (Tasks 4, 5, 6, 7) */}
      {activeTab === "content" && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Reported Listings (Task 4) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900">Reported Listings Analytics</h3>
                <p className="text-xs text-slate-500">Property complaints, distinct listing counts, and resolution velocity.</p>
              </div>
              <Link href="/admin/moderation/reported-listings" className="text-xs font-semibold text-emerald-600 hover:underline">
                Queue →
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">Total Reports</span>
                <p className="mt-1 text-xl font-bold text-slate-900">{analytics.targetTypeAnalytics.listings.totalReports}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">Distinct Listings</span>
                <p className="mt-1 text-xl font-bold text-slate-900">{analytics.targetTypeAnalytics.listings.distinctListings}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">Active Cases</span>
                <p className="mt-1 text-xl font-bold text-sky-700">{analytics.targetTypeAnalytics.listings.activeCases}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">Resolved Cases</span>
                <p className="mt-1 text-xl font-bold text-emerald-700">{analytics.targetTypeAnalytics.listings.resolvedCases}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs border-t border-slate-100 pt-3">
              <span className="text-slate-600">Average Listing Resolution Time:</span>
              <strong className="font-mono text-slate-900">
                {analytics.targetTypeAnalytics.listings.avgResolutionHours > 0
                  ? `${analytics.targetTypeAnalytics.listings.avgResolutionHours} hours`
                  : "—"}
              </strong>
            </div>
          </div>

          {/* Review Moderation (Task 5: Preserves Guest->Property vs Host->Guest distinction) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900">Review Moderation Analytics</h3>
                <p className="text-xs text-slate-500">Reciprocal review reporting and rating integrity safeguarding.</p>
              </div>
              <Link href="/admin/moderation/reviews" className="text-xs font-semibold text-indigo-600 hover:underline">
                Queue →
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">Reported Reviews</span>
                <p className="mt-1 text-xl font-bold text-slate-900">{analytics.targetTypeAnalytics.reviews.totalReports}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">Unique Reviews</span>
                <p className="mt-1 text-xl font-bold text-slate-900">{analytics.targetTypeAnalytics.reviews.distinctReviews}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">Guest → Property</span>
                <p className="mt-1 text-xl font-bold text-slate-900">{analytics.targetTypeAnalytics.reviews.guestToProperty}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">Host → Guest</span>
                <p className="mt-1 text-xl font-bold text-slate-900">{analytics.targetTypeAnalytics.reviews.hostToGuest}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between text-xs border-t border-slate-100 pt-3">
              <span className="text-slate-600">Hidden / Deleted Violations:</span>
              <strong className="font-mono text-rose-600">{analytics.targetTypeAnalytics.reviews.hiddenOrRemoved} reviews</strong>
            </div>
          </div>

          {/* Media Moderation (Task 6) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900">Media Moderation Analytics</h3>
                <p className="text-xs text-slate-500">Listing photos and visual media reports.</p>
              </div>
              <Link href="/admin/moderation/media" className="text-xs font-semibold text-purple-600 hover:underline">
                Queue →
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">Total Media Reports</span>
                <p className="mt-1 text-xl font-bold text-slate-900">{analytics.targetTypeAnalytics.media.totalReports}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">Distinct Photos</span>
                <p className="mt-1 text-xl font-bold text-slate-900">{analytics.targetTypeAnalytics.media.distinctMedia}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">Active Investigations</span>
                <p className="mt-1 text-xl font-bold text-sky-700">{analytics.targetTypeAnalytics.media.activeCases}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">Resolved Cases</span>
                <p className="mt-1 text-xl font-bold text-emerald-700">{analytics.targetTypeAnalytics.media.resolvedCases}</p>
              </div>
            </div>
          </div>

          {/* User & Message Moderation (Task 7) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900">User &amp; Message Reports</h3>
                <p className="text-xs text-slate-500">Metadata-only counts safeguarding privacy.</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">User Reports</span>
                <p className="mt-1 text-xl font-bold text-slate-900">{analytics.targetTypeAnalytics.usersAndMessages.userReports}</p>
                <span className="text-3xs text-slate-500">{analytics.targetTypeAnalytics.usersAndMessages.distinctUsers} distinct users</span>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">Message Reports</span>
                <p className="mt-1 text-xl font-bold text-slate-900">{analytics.targetTypeAnalytics.usersAndMessages.messageReports}</p>
                <span className="text-3xs text-slate-500">{analytics.targetTypeAnalytics.usersAndMessages.distinctMessages} distinct messages</span>
              </div>
            </div>
            <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Account Warnings Issued:</span>
                <strong className="text-slate-900 font-mono">{analytics.targetTypeAnalytics.usersAndMessages.warnings}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Temporary Restrictions Applied:</span>
                <strong className="text-amber-700 font-mono">{analytics.targetTypeAnalytics.usersAndMessages.restrictions}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Account Suspensions Executed:</span>
                <strong className="text-rose-700 font-mono">{analytics.targetTypeAnalytics.usersAndMessages.suspensions}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ENFORCEMENT & APPEALS (Tasks 8, 9) */}
      {activeTab === "enforcement" && (
        <div className="space-y-6">
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-3xs font-bold uppercase text-slate-500">Warnings Issued</span>
              <p className="mt-1 text-2xl font-black text-slate-900">{analytics.enforcementAnalytics.warnings}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
              <span className="text-3xs font-bold uppercase text-amber-700">Active Restrictions</span>
              <p className="mt-1 text-2xl font-black text-amber-900">{analytics.enforcementAnalytics.restrictions}</p>
            </div>
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-sm">
              <span className="text-3xs font-bold uppercase text-rose-700">Account Suspensions</span>
              <p className="mt-1 text-2xl font-black text-rose-900">{analytics.enforcementAnalytics.suspensions}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
              <span className="text-3xs font-bold uppercase text-emerald-700">Reinstatements</span>
              <p className="mt-1 text-2xl font-black text-emerald-900">{analytics.enforcementAnalytics.reinstatements}</p>
            </div>
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 shadow-sm">
              <span className="text-3xs font-bold uppercase text-indigo-700">Content Removals</span>
              <p className="mt-1 text-2xl font-black text-indigo-900">{analytics.enforcementAnalytics.contentRemovals}</p>
            </div>
          </section>

          {/* Appeals Performance Card (Task 9) */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900">Appeals Lifecycle &amp; Reinstatement Analytics</h3>
                <p className="text-xs text-slate-500">Outcomes of client and host appeal investigations.</p>
              </div>
              <Link href="/admin/moderation/appeals" className="text-xs font-semibold text-amber-600 hover:underline">
                Appeals Queue →
              </Link>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">Total Appeals</span>
                <p className="mt-1 text-xl font-bold text-slate-900">{analytics.appealsAnalytics.total}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">Under Review</span>
                <p className="mt-1 text-xl font-bold text-sky-700">{analytics.appealsAnalytics.pending}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">Approval Rate</span>
                <p className="mt-1 text-xl font-bold text-emerald-700">{analytics.appealsAnalytics.approvalRate}%</p>
                <span className="text-3xs text-slate-500">{analytics.appealsAnalytics.approved} approved · {analytics.appealsAnalytics.rejected} rejected</span>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">Avg Resolution Time</span>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {analytics.appealsAnalytics.avgResolutionHours > 0 ? `${analytics.appealsAnalytics.avgResolutionHours}h` : "—"}
                </p>
              </div>
            </div>
          </section>

          {/* Recent Enforcement Action Log */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-3">Recent Enforcement Action History</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-left text-xs">
                <thead>
                  <tr className="text-slate-400 font-medium">
                    <th className="py-2">Case Reference</th>
                    <th className="py-2">Action</th>
                    <th className="py-2">Executed By</th>
                    <th className="py-2 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.enforcementAnalytics.recentActions.length ? (
                    analytics.enforcementAnalytics.recentActions.map((act) => (
                      <tr key={act.id} className="hover:bg-slate-50">
                        <td className="py-2 font-mono font-semibold text-indigo-700">{act.caseReference}</td>
                        <td className="py-2 font-medium text-slate-900">{act.action.replace(/_/g, " ")}</td>
                        <td className="py-2 text-slate-600">{act.actorName}</td>
                        <td className="py-2 text-right text-slate-400">{formatDate(act.createdAt)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-500">No enforcement actions executed in this period.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 4: MODERATOR WORKLOAD & SLA (Tasks 10, 11) */}
      {activeTab === "workload" && (
        <div className="space-y-6">
          {/* SLA Performance Summary Card */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-1">Operational SLA Performance</h3>
            <p className="text-xs text-slate-500 mb-4">Standard 72-hour operational deadline; 24-hour high-priority SLA.</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-lg bg-emerald-50/60 border border-emerald-200 p-3">
                <span className="text-3xs font-bold text-emerald-800 uppercase">On-Time Resolution Rate</span>
                <p className="mt-1 text-2xl font-black text-emerald-900">{onTimeResolutionRate}</p>
                <span className="text-3xs text-emerald-700">Resolved within SLA threshold</span>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">SLA Breached Cases</span>
                <p className="mt-1 text-2xl font-black text-slate-900">{analytics.slaMetrics.breachedCount}</p>
                <span className="text-3xs text-slate-500">Exceeded standard turnaround</span>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <span className="text-3xs font-bold text-amber-800 uppercase">Currently Overdue Open</span>
                <p className="mt-1 text-2xl font-black text-amber-900">{analytics.slaMetrics.overdueCount}</p>
                <span className="text-3xs text-amber-700">Open &gt; 72 hours</span>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <span className="text-3xs font-semibold text-slate-500 uppercase">Information Requests (RFI)</span>
                <p className="mt-1 text-2xl font-black text-slate-900">{analytics.evidenceAndRfi.totalRfis}</p>
                <span className="text-3xs text-slate-500">{analytics.evidenceAndRfi.pendingResponse} awaiting user response</span>
              </div>
            </div>
          </section>

          {/* Moderator Workload & Productivity Table (Task 10) */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50/50 p-4">
              <h3 className="font-bold text-slate-900">Moderator Team Workload &amp; Resolution Tracking</h3>
              <p className="text-xs text-slate-500">
                Staff caseload distribution and historical case resolution velocity.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Moderator</th>
                    <th className="px-4 py-3">Active Assigned</th>
                    <th className="px-4 py-3">Resolved (Period)</th>
                    <th className="px-4 py-3">Overdue (&gt;72h)</th>
                    <th className="px-4 py-3">Avg Resolution</th>
                    <th className="px-4 py-3 text-right">Workload Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.moderatorWorkload.length ? (
                    analytics.moderatorWorkload.map((mod) => (
                      <tr key={mod.moderatorId} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{mod.name}</p>
                          <p className="text-slate-400 font-mono text-3xs">{mod.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/moderation/cases?assignedModeratorId=${mod.moderatorId}`}
                            className="font-bold text-indigo-700 hover:underline"
                          >
                            {mod.activeCases} open
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">{mod.resolvedCases}</td>
                        <td className="px-4 py-3">
                          <span className={mod.overdueCases > 0 ? "font-bold text-rose-600" : "text-slate-500"}>
                            {mod.overdueCases}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-slate-700">
                          {mod.avgResolutionHours > 0 ? `${mod.avgResolutionHours}h` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-3xs font-bold ${
                              mod.workloadStatus === "NORMAL"
                                ? "bg-emerald-100 text-emerald-800"
                                : mod.workloadStatus === "HIGH"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {mod.workloadStatus}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        No active moderator caseload found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* TAB 5: AUTOMATION & HEALTH (Task 13) */}
      {activeTab === "health" && (
        <div className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900">Background Processing &amp; Automation Health</h3>
                <p className="text-xs text-slate-500">Worker reliability, reciprocal review publishing, and notification dispatch.</p>
              </div>
              <Link href="/admin/moderation/jobs" className="text-xs font-semibold text-cyan-700 hover:underline">
                Manage Job Queue →
              </Link>
            </div>

            {analytics.jobHealth.queueStats ? (
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg bg-slate-50 p-3">
                  <span className="text-3xs font-semibold text-slate-500 uppercase">Pending Queue Backlog</span>
                  <p className="mt-1 text-2xl font-black text-slate-900">{analytics.jobHealth.queueStats.pending}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <span className="text-3xs font-semibold text-slate-500 uppercase">Active Workers</span>
                  <p className="mt-1 text-2xl font-black text-sky-700">{analytics.jobHealth.queueStats.running}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <span className="text-3xs font-semibold text-slate-500 uppercase">Retry Scheduled</span>
                  <p className="mt-1 text-2xl font-black text-amber-700">{analytics.jobHealth.queueStats.retryScheduled}</p>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <span className="text-3xs font-semibold text-slate-500 uppercase">Failed / Dead-Letter</span>
                  <p className="mt-1 text-2xl font-black text-rose-700">{analytics.jobHealth.queueStats.failed}</p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-xs text-slate-500">Queue status is operational or offline fallback enabled.</p>
            )}

            <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs">
              <h4 className="font-semibold text-slate-900 mb-1">Architecture &amp; Safe Processing Notes</h4>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                <li>Automated reciprocal review publishing executes hourly through Phase 7 job queue.</li>
                <li>Temporary restriction expiry runs periodically with automatic user cache invalidation and notification.</li>
                <li>Phase 8 Automated Content Detection &amp; AI Scanning is intentionally deferred; all actions require human Trust &amp; Safety authorization.</li>
              </ul>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
