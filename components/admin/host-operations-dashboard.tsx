"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type {
  OperationsDashboardMetrics,
  FunnelStageMetric,
  OperationalKPIs,
  BottleneckStage,
  ActionQueueItem,
  ReviewerWorkloadItem,
  GeographicMetric,
  TrendDataPoint,
  DateRangePreset,
} from "@/services/host-operations.service";

export function HostOperationsDashboard() {
  const [dateRange, setDateRange] = useState<DateRangePreset>("30_DAYS");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [savedView, setSavedView] = useState<string>("ALL");

  // State data
  const [metrics, setMetrics] = useState<OperationsDashboardMetrics | null>(null);
  const [funnel, setFunnel] = useState<FunnelStageMetric[]>([]);
  const [kpis, setKpis] = useState<OperationalKPIs | null>(null);
  const [bottlenecks, setBottlenecks] = useState<BottleneckStage[]>([]);
  const [actionQueue, setActionQueue] = useState<ActionQueueItem[]>([]);
  const [workloadData, setWorkloadData] = useState<{ reviewers: ReviewerWorkloadItem[]; recommendation: string } | null>(null);
  const [geoMetrics, setGeoMetrics] = useState<GeographicMetric[]>([]);
  const [trends, setTrends] = useState<TrendDataPoint[]>([]);

  // Queue Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("ALL");
  const [selectedType, setSelectedType] = useState("ALL");

  async function loadAllData() {
    setLoading(true);
    try {
      const [
        metricsRes,
        funnelRes,
        kpisRes,
        bottlenecksRes,
        queueRes,
        workloadRes,
        geoRes,
        trendsRes,
      ] = await Promise.all([
        fetch(`/api/v1/admin/hosts/operations/dashboard?range=${dateRange}`).then((r) => r.json()),
        fetch(`/api/v1/admin/hosts/operations/funnel`).then((r) => r.json()),
        fetch(`/api/v1/admin/hosts/operations/kpis`).then((r) => r.json()),
        fetch(`/api/v1/admin/hosts/operations/bottlenecks`).then((r) => r.json()),
        fetch(`/api/v1/admin/hosts/operations/action-queue`).then((r) => r.json()),
        fetch(`/api/v1/admin/hosts/operations/reviewer-workload`).then((r) => r.json()),
        fetch(`/api/v1/admin/hosts/operations/geographic`).then((r) => r.json()),
        fetch(`/api/v1/admin/hosts/operations/trends?range=${dateRange}`).then((r) => r.json()),
      ]);

      if (metricsRes.success) setMetrics(metricsRes.data);
      if (funnelRes.success) setFunnel(funnelRes.data);
      if (kpisRes.success) setKpis(kpisRes.data);
      if (bottlenecksRes.success) setBottlenecks(bottlenecksRes.data);
      if (queueRes.success) setActionQueue(queueRes.data);
      if (workloadRes.success) setWorkloadData(workloadRes.data);
      if (geoRes.success) setGeoMetrics(geoRes.data);
      if (trendsRes.success) setTrends(trendsRes.data);
    } catch (err) {
      console.error("Failed to load operations data:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAllData();
  }, [dateRange]);

  // Saved operational views preset handler
  function applySavedView(viewKey: string) {
    setSavedView(viewKey);
    switch (viewKey) {
      case "MY_PENDING":
        setSelectedPriority("ALL");
        setSelectedType("Overdue Application");
        setSearchQuery("");
        break;
      case "OVERDUE_APPS":
        setSelectedPriority("HIGH");
        setSelectedType("Overdue Application");
        setSearchQuery("");
        break;
      case "EXPIRING_DOCS":
        setSelectedPriority("ALL");
        setSelectedType("Expired Document");
        setSearchQuery("");
        break;
      case "CRITICAL_ISSUES":
        setSelectedPriority("CRITICAL");
        setSelectedType("Compliance Issue");
        setSearchQuery("");
        break;
      case "UNASSIGNED":
        setSelectedPriority("ALL");
        setSelectedType("ALL");
        setSearchQuery("");
        break;
      default:
        setSelectedPriority("ALL");
        setSelectedType("ALL");
        setSearchQuery("");
        break;
    }
  }

  async function handleExportCSV() {
    setExporting(true);
    try {
      const res = await fetch("/api/v1/admin/hosts/operations/export", { method: "POST" });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `host_operations_report_${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      alert("Failed to export operational data CSV.");
    } finally {
      setExporting(false);
    }
  }

  // Filtered action queue
  const filteredQueue = actionQueue.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        item.hostName.toLowerCase().includes(q) ||
        item.applicationId.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);
      if (!match) return false;
    }
    if (selectedPriority !== "ALL" && item.priority !== selectedPriority) return false;
    if (selectedType !== "ALL" && !item.issueType.toLowerCase().includes(selectedType.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Host Operations Dashboard</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
              Phase 6 Operational Intelligence
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Centralized monitoring, lifecycle funnel metrics, SLAs, reviewer workloads, and unified action queues.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRangePreset)}
            className="rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2 text-sm font-medium text-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="TODAY">Today</option>
            <option value="7_DAYS">Last 7 Days</option>
            <option value="30_DAYS">Last 30 Days</option>
            <option value="90_DAYS">Last 90 Days</option>
          </select>

          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 focus:ring-2 focus:ring-amber-500/30 transition-all shadow-xs disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {exporting ? "Exporting..." : "Export CSV Report"}
          </button>
        </div>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: "Total Hosts", val: metrics?.totalHosts, color: "text-zinc-900", bg: "bg-zinc-50" },
          { label: "New Applications", val: metrics?.newApplications, color: "text-indigo-600", bg: "bg-indigo-50/40" },
          { label: "Pending Reviews", val: metrics?.pendingReviews, color: "text-amber-600", bg: "bg-amber-50/40" },
          { label: "Documents Pending", val: metrics?.documentsPending, color: "text-blue-600", bg: "bg-blue-50/40" },
          { label: "Compliance Pending", val: metrics?.compliancePending, color: "text-violet-600", bg: "bg-violet-50/40" },
          { label: "Action Required", val: metrics?.actionRequired, color: "text-red-600", bg: "bg-red-50/40" },
          { label: "Ready for Approval", val: metrics?.readyForApproval, color: "text-emerald-600", bg: "bg-emerald-50/40" },
          { label: "Approved Hosts", val: metrics?.approved, color: "text-emerald-700", bg: "bg-emerald-100/50" },
          { label: "Rejected Applications", val: metrics?.rejected, color: "text-zinc-600", bg: "bg-zinc-100/60" },
          { label: "Suspended Hosts", val: metrics?.suspended, color: "text-rose-700", bg: "bg-rose-100/50" },
        ].map((item, idx) => (
          <div key={idx} className={`p-4 rounded-xl border border-zinc-200/80 ${item.bg} flex flex-col justify-between shadow-2xs`}>
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">{item.label}</span>
            <span className={`text-2xl font-black mt-2 ${item.color}`}>
              {loading ? "..." : item.val ?? 0}
            </span>
          </div>
        ))}
      </div>

      {/* Host Lifecycle Funnel Section */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Host Lifecycle Conversion Funnel</h2>
            <p className="text-xs text-zinc-500 mt-0.5">End-to-end progression from intake registration to active host status</p>
          </div>
          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            Overall Conversion: {funnel.length > 0 ? `${funnel[funnel.length - 1]?.conversionRate}%` : "0%"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {funnel.map((st, i) => (
            <div key={st.stageKey} className="relative p-4 rounded-xl bg-gradient-to-br from-zinc-50 to-white border border-zinc-200/70 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400">0{i + 1}</span>
                <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                  ~{st.avgTimeHours}h avg
                </span>
              </div>
              <div className="my-3">
                <div className="text-sm font-bold text-zinc-900">{st.stageName}</div>
                <div className="text-2xl font-black text-amber-600 mt-1">{st.count}</div>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-100 text-zinc-500">
                <span>Conv: <strong className="text-zinc-800">{st.conversionRate}%</strong></span>
                {i > 0 && <span className="text-rose-600">Drop: <strong>-{st.dropOffRate}%</strong></span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Operational KPIs & Bottleneck Detection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* KPIs */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-xs space-y-4">
          <h2 className="text-lg font-bold text-zinc-900 border-b border-zinc-100 pb-3">Operational KPIs & Efficiency Rates</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/60">
              <div className="text-xs text-zinc-500">Approval Rate</div>
              <div className="text-xl font-bold text-emerald-600 mt-1">{kpis?.approvalRate ?? 0}%</div>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/60">
              <div className="text-xs text-zinc-500">Rejection Rate</div>
              <div className="text-xl font-bold text-rose-600 mt-1">{kpis?.rejectionRate ?? 0}%</div>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/60">
              <div className="text-xs text-zinc-500">Doc Rejection Rate</div>
              <div className="text-xl font-bold text-amber-600 mt-1">{kpis?.documentRejectionRate ?? 0}%</div>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/60">
              <div className="text-xs text-zinc-500">Compliance Failure Rate</div>
              <div className="text-xl font-bold text-violet-600 mt-1">{kpis?.complianceFailureRate ?? 0}%</div>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/60">
              <div className="text-xs text-zinc-500">Re-Verification Rate</div>
              <div className="text-xl font-bold text-blue-600 mt-1">{kpis?.reVerificationRate ?? 0}%</div>
            </div>
            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/60">
              <div className="text-xs text-zinc-500">Suspension Rate</div>
              <div className="text-xl font-bold text-red-600 mt-1">{kpis?.suspensionRate ?? 0}%</div>
            </div>
          </div>
        </div>

        {/* Bottleneck Detection */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
            <h2 className="text-lg font-bold text-zinc-900">Bottleneck & SLA Detection</h2>
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-md">Live SLA Monitor</span>
          </div>

          <div className="space-y-3">
            {bottlenecks.map((b) => (
              <div key={b.stageKey} className="p-4 rounded-xl border border-zinc-200/80 bg-zinc-50/50 flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-zinc-900">{b.stageName}</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    Applications Waiting: <span className="font-bold text-zinc-800">{b.stuckCount}</span> | Avg Wait: <span className="font-bold text-amber-700">{b.avgWaitDays} days</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-bold ${
                    b.status === "EXCEEDED" ? "bg-rose-100 text-rose-800 border border-rose-300" :
                    b.status === "WARNING" ? "bg-amber-100 text-amber-800 border border-amber-300" :
                    "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  }`}>
                    {b.status === "EXCEEDED" ? "SLA EXCEEDED" : b.status === "WARNING" ? "SLA WARNING" : "WITHIN SLA"}
                  </span>
                  <div className="text-[11px] text-zinc-400 mt-1">Target SLA: ≤ {b.slaDays}d</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Unified Action Required Queue */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Unified Action Required Queue</h2>
            <p className="text-xs text-zinc-500">Centralized queue consolidating pending reviews, compliance issues, expired docs & re-verifications</p>
          </div>

          {/* Saved Views Presets */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-1">
            {[
              { key: "ALL", label: "All Items" },
              { key: "OVERDUE_APPS", label: "Overdue Apps" },
              { key: "EXPIRING_DOCS", label: "Expiring Docs" },
              { key: "CRITICAL_ISSUES", label: "Critical Compliance" },
            ].map((preset) => (
              <button
                key={preset.key}
                onClick={() => applySavedView(preset.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  savedView === preset.key
                    ? "bg-zinc-900 text-white shadow-xs"
                    : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Search host, app ID, description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
          />

          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2 text-sm text-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="ALL">All Priorities</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full rounded-xl border border-zinc-200 bg-zinc-50/50 px-3.5 py-2 text-sm text-zinc-700 focus:outline-hidden focus:ring-2 focus:ring-amber-500/20"
          >
            <option value="ALL">All Issue Types</option>
            <option value="Compliance Issue">Compliance Issues</option>
            <option value="Expired Document">Expired Documents</option>
            <option value="Overdue Application">Overdue Applications</option>
            <option value="Re-Verification Pending">Re-Verifications</option>
          </select>
        </div>

        {/* Action Table */}
        <div className="overflow-x-auto rounded-xl border border-zinc-200/80">
          <table className="w-full text-left text-sm text-zinc-600">
            <thead className="bg-zinc-50 text-xs font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-200">
              <tr>
                <th className="px-4 py-3">Host & App ID</th>
                <th className="px-4 py-3">Issue / Task</th>
                <th className="px-4 py-3">Current Stage</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Assigned Admin</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/80 bg-white">
              {filteredQueue.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                    No active action required items matching filters.
                  </td>
                </tr>
              ) : (
                filteredQueue.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-zinc-900">{item.hostName}</div>
                      <div className="text-xs text-zinc-400 font-mono">{item.applicationId}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-zinc-800">{item.issueType}</span>
                      <div className="text-xs text-zinc-500 max-w-xs truncate">{item.description}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2.5 py-0.5 rounded-md text-xs font-semibold bg-zinc-100 text-zinc-700">
                        {item.currentStage}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        item.priority === "CRITICAL" ? "bg-rose-100 text-rose-800 border border-rose-200" :
                        item.priority === "HIGH" ? "bg-amber-100 text-amber-800 border border-amber-200" :
                        item.priority === "MEDIUM" ? "bg-blue-100 text-blue-800 border border-blue-200" :
                        "bg-zinc-100 text-zinc-700"
                      }`}>
                        {item.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-600">
                      {item.assignedAdmin?.name || item.assignedAdmin?.email || "Unassigned"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={item.targetUrl}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 hover:underline"
                      >
                        Open Workflow →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reviewer Workload Dashboard & Workload Balancing */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-zinc-900">Reviewer Workload & Balancing</h2>
            <p className="text-xs text-zinc-500">Monitor individual admin workload, pending items, and SLA adherence</p>
          </div>
        </div>

        {/* Balancing Recommendation Banner */}
        {workloadData?.recommendation && (
          <div className="p-4 rounded-xl bg-amber-50/80 border border-amber-200 flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <div className="text-xs font-bold text-amber-900 uppercase tracking-wider">Workload Balancing Recommendation</div>
              <div className="text-sm text-amber-800 mt-0.5">{workloadData.recommendation}</div>
            </div>
          </div>
        )}

        {/* Workload Table */}
        <div className="overflow-x-auto rounded-xl border border-zinc-200/80">
          <table className="w-full text-left text-sm text-zinc-600">
            <thead className="bg-zinc-50 text-xs font-semibold text-zinc-500 uppercase tracking-wider border-b border-zinc-200">
              <tr>
                <th className="px-4 py-3">Reviewer Name</th>
                <th className="px-4 py-3">Assigned Total</th>
                <th className="px-4 py-3">Pending</th>
                <th className="px-4 py-3">Overdue (&gt;3d)</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Avg Review Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200/80 bg-white">
              {workloadData?.reviewers.map((rev) => (
                <tr key={rev.reviewerId} className="hover:bg-zinc-50/70 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-semibold text-zinc-900">{rev.name}</div>
                    <div className="text-xs text-zinc-400">{rev.email}</div>
                  </td>
                  <td className="px-4 py-3 font-bold text-zinc-900">{rev.assigned}</td>
                  <td className="px-4 py-3 font-bold text-amber-600">{rev.pending}</td>
                  <td className="px-4 py-3 font-bold text-rose-600">{rev.overdue}</td>
                  <td className="px-4 py-3 font-bold text-emerald-600">{rev.completed}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">~{rev.avgReviewTimeHours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Regional & Geographic Analytics */}
      <div className="bg-white p-6 rounded-2xl border border-zinc-200/80 shadow-xs space-y-4">
        <h2 className="text-lg font-bold text-zinc-900 border-b border-zinc-100 pb-3">Geographic / Regional Performance Analytics</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {geoMetrics.map((g) => (
            <div key={g.region} className="p-4 rounded-xl border border-zinc-200/80 bg-zinc-50/40 flex flex-col justify-between">
              <div>
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{g.region}</div>
                <div className="text-xl font-bold text-zinc-900 mt-1">{g.totalApplications} Applications</div>
              </div>
              <div className="flex items-center justify-between text-xs border-t border-zinc-200/60 pt-3 mt-3">
                <span className="text-emerald-700 font-semibold">Approval Rate: {g.approvalRate}%</span>
                <span className="text-rose-600 font-semibold">Compliance Issues: {g.complianceIssuesCount}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
