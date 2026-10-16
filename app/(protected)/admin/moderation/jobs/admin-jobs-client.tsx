"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { BackgroundJobDTO, BackgroundJobStatus, BackgroundJobType } from "@/services/job-queue.service";

interface QueueStats {
  pending: number;
  running: number;
  retryScheduled: number;
  failed: number;
  completed: number;
  totalBacklog: number;
  oldestPendingJobAgeSeconds: number;
  health: "HEALTHY" | "DEGRADED" | "BACKLOGGED";
}

interface AdminJobsClientProps {
  initialJobs: BackgroundJobDTO[];
  initialTotal: number;
  initialPage: number;
  initialLimit: number;
  initialTotalPages: number;
  initialStats: QueueStats;
  initialFilters: {
    status?: BackgroundJobStatus | "ALL";
    type?: BackgroundJobType | "ALL";
  };
  canManage: boolean;
}

export function AdminJobsClient({
  initialJobs,
  initialTotal,
  initialPage,
  initialLimit,
  initialTotalPages,
  initialStats,
  initialFilters,
  canManage,
}: AdminJobsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [jobs, setJobs] = useState<BackgroundJobDTO[]>(initialJobs);
  const [stats, setStats] = useState<QueueStats>(initialStats);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(initialPage);
  const [statusFilter, setStatusFilter] = useState<string>(initialFilters.status || "ALL");
  const [typeFilter, setTypeFilter] = useState<string>(initialFilters.type || "ALL");

  const [selectedJob, setSelectedJob] = useState<BackgroundJobDTO | null>(null);
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchJobs = async (targetPage = page, status = statusFilter, type = typeFilter) => {
    setActionLoading("refresh");
    try {
      const params = new URLSearchParams();
      if (status !== "ALL") params.set("status", status);
      if (type !== "ALL") params.set("type", type);
      params.set("page", String(targetPage));
      params.set("limit", String(initialLimit));

      const res = await fetch(`/api/v1/admin/jobs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load background jobs");
      const data = await res.json();

      setJobs(data.jobs || []);
      setTotal(data.total || 0);
      setPage(data.page || 1);
      if (data.stats) setStats(data.stats);
    } catch (err: any) {
      showToast("error", err.message || "Failed to load jobs");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunBatch = async () => {
    setActionLoading("batch");
    try {
      const res = await fetch("/api/v1/admin/jobs/run", { method: "POST" });
      if (!res.ok) throw new Error("Failed to execute background job batch");
      const data = await res.json();
      showToast(
        "success",
        `Batch finished: ${data.processed} processed (${data.completed} completed, ${data.failed} failed, ${data.retried} retried) in ${data.durationMs}ms`
      );
      await fetchJobs();
    } catch (err: any) {
      showToast("error", err.message || "Batch execution error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleTriggerJob = async (type: BackgroundJobType) => {
    setActionLoading(type);
    try {
      const res = await fetch("/api/v1/admin/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, priority: 7 }),
      });
      if (!res.ok) throw new Error("Failed to trigger job");
      const data = await res.json();
      showToast("success", `Queued job ${data.job?.id} (${type})`);
      await fetchJobs();
    } catch (err: any) {
      showToast("error", err.message || "Trigger failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    setActionLoading(`retry_${jobId}`);
    try {
      const res = await fetch(`/api/v1/admin/jobs/${jobId}/retry`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to retry job");
      const data = await res.json();
      showToast("success", `Job ${jobId} reset to PENDING for immediate execution`);
      if (selectedJob && selectedJob.id === jobId) {
        setSelectedJob(data.job);
      }
      await fetchJobs();
    } catch (err: any) {
      showToast("error", err.message || "Retry failed");
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadge = (st: BackgroundJobStatus) => {
    switch (st) {
      case "COMPLETED":
        return <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200">Completed</span>;
      case "RUNNING":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700 border border-sky-200">
            <span className="size-1.5 rounded-full bg-sky-600 animate-pulse" />
            Running
          </span>
        );
      case "PENDING":
        return <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 border border-slate-300">Pending</span>;
      case "RETRY_SCHEDULED":
        return <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">Retry Scheduled</span>;
      case "FAILED":
        return <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700 border border-rose-200">Failed / Dead-Letter</span>;
      default:
        return <span className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">{st}</span>;
    }
  };

  const healthBadge = (h: "HEALTHY" | "DEGRADED" | "BACKLOGGED") => {
    switch (h) {
      case "HEALTHY":
        return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">● Operational / Healthy</span>;
      case "DEGRADED":
        return <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">▲ Degraded / Elevated Failures</span>;
      case "BACKLOGGED":
        return <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-800">■ Backlogged / High Queued Volume</span>;
    }
  };

  const formatDateTime = (val: string | null) => {
    if (!val) return "—";
    try {
      return new Date(val).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return val;
    }
  };

  return (
    <main className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            toastMessage.type === "success"
              ? "bg-slate-900 text-white border border-slate-700"
              : "bg-rose-900 text-white border border-rose-700"
          }`}
        >
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header & Breadcrumb */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <nav className="flex items-center gap-2 text-sm text-slate-500">
            <Link href="/admin/moderation" className="hover:text-slate-800">
              Moderation Overview
            </Link>
            <span>/</span>
            <span className="font-medium text-slate-800">Background Operations &amp; Automation</span>
          </nav>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Background Jobs &amp; Queue</h1>
            {healthBadge(stats.health)}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Durable database-backed asynchronous task workers, reciprocal review publishing, restriction expiry, and reliable notification delivery.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <>
              <button
                type="button"
                onClick={handleRunBatch}
                disabled={actionLoading === "batch"}
                className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-50"
              >
                {actionLoading === "batch" ? "Processing…" : "Run Queue Batch Now"}
              </button>
              <button
                type="button"
                onClick={() => handleTriggerJob("REVIEW_EXPIRY_PUBLISH")}
                disabled={actionLoading === "REVIEW_EXPIRY_PUBLISH"}
                className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                Publish Expired Reviews
              </button>
              <button
                type="button"
                onClick={() => handleTriggerJob("ACCOUNT_RESTRICTION_EXPIRY")}
                disabled={actionLoading === "ACCOUNT_RESTRICTION_EXPIRY"}
                className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
              >
                Expire Restrictions
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => fetchJobs()}
            disabled={actionLoading === "refresh"}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Queue Metrics Summary */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pending Backlog</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{stats.pending}</p>
          <span className="text-xs text-slate-500">Ready to execute</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Active Workers</p>
          <p className="mt-1 text-2xl font-bold text-sky-600">{stats.running}</p>
          <span className="text-xs text-slate-500">Currently executing</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Retry Scheduled</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{stats.retryScheduled}</p>
          <span className="text-xs text-slate-500">Exponential backoff</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Failed / Dead-Letter</p>
          <p className="mt-1 text-2xl font-bold text-rose-600">{stats.failed}</p>
          <span className="text-xs text-slate-500">Requires investigation</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Completed</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{stats.completed}</p>
          <span className="text-xs text-slate-500">Successfully handled</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Oldest Pending</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {stats.oldestPendingJobAgeSeconds > 0
              ? `${Math.floor(stats.oldestPendingJobAgeSeconds / 60)}m`
              : "0m"}
          </p>
          <span className="text-xs text-slate-500">Latency metric</span>
        </div>
      </section>

      {/* Filters Toolbar */}
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm font-medium text-slate-700">Status:</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              const val = e.target.value;
              setStatusFilter(val);
              fetchJobs(1, val, typeFilter);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="RUNNING">Running</option>
            <option value="RETRY_SCHEDULED">Retry Scheduled</option>
            <option value="FAILED">Failed / Dead-Letter</option>
            <option value="COMPLETED">Completed</option>
          </select>

          <label className="ml-2 text-sm font-medium text-slate-700">Type:</label>
          <select
            value={typeFilter}
            onChange={(e) => {
              const val = e.target.value;
              setTypeFilter(val);
              fetchJobs(1, statusFilter, val);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 shadow-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="ALL">All Job Types</option>
            <option value="REVIEW_EXPIRY_PUBLISH">Review Expiry Publish</option>
            <option value="ACCOUNT_RESTRICTION_EXPIRY">Account Restriction Expiry</option>
            <option value="MODERATION_NOTIFICATION_DELIVERY">Notification Delivery</option>
            <option value="SYSTEM_MAINTENANCE">System Maintenance</option>
            <option value="AUDIT_LOG_ARCHIVE">Audit Log Archive</option>
          </select>
        </div>

        <p className="text-xs text-slate-500">
          Showing <span className="font-medium text-slate-900">{jobs.length}</span> of{" "}
          <span className="font-medium text-slate-900">{total}</span> total jobs
        </p>
      </section>

      {/* Jobs Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3">Job ID &amp; Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Run Schedule</th>
                <th className="px-4 py-3">Last Result / Error</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs font-semibold text-slate-900">{job.id}</p>
                    <p className="text-xs font-medium text-indigo-600">{job.type}</p>
                    {job.idempotencyKey && (
                      <p className="text-[11px] text-slate-500 font-mono truncate max-w-xs" title={job.idempotencyKey}>
                        key: {job.idempotencyKey}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {statusBadge(job.status)}
                    {job.priority > 0 && (
                      <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                        P{job.priority}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">
                    <span className="font-medium text-slate-900">{job.attempts}</span> / {job.maxAttempts}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">
                    <p>Run at: {formatDateTime(job.runAt)}</p>
                    {job.completedAt && <p className="text-[11px] text-emerald-600">Done: {formatDateTime(job.completedAt)}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs max-w-sm">
                    {job.lastError ? (
                      <p className="text-rose-600 font-mono text-[11px] line-clamp-2" title={job.lastError}>
                        {job.lastError}
                      </p>
                    ) : job.status === "COMPLETED" ? (
                      <span className="text-slate-500">Finished cleanly</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedJob(job);
                          setInspectModalOpen(true);
                        }}
                        className="rounded border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                      >
                        Inspect
                      </button>
                      {canManage && (job.status === "FAILED" || job.status === "RETRY_SCHEDULED") && (
                        <button
                          type="button"
                          onClick={() => handleRetryJob(job.id)}
                          disabled={actionLoading === `retry_${job.id}`}
                          className="rounded bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                        >
                          {actionLoading === `retry_${job.id}` ? "Retrying…" : "Retry Now"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!jobs.length && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                    No background jobs found matching the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {initialTotalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 bg-slate-50 sm:px-6">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => fetchJobs(page - 1)}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-xs text-slate-600">
              Page {page} of {initialTotalPages}
            </span>
            <button
              type="button"
              disabled={page >= initialTotalPages}
              onClick={() => fetchJobs(page + 1)}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </section>

      {/* Inspect & Error Modal using ModalOverlay (strictly follows scroll-lock rule) */}
      {inspectModalOpen && selectedJob && (
        <ModalOverlay
          role="dialog"
          aria-modal="true"
          onClick={() => setInspectModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl rounded-xl bg-white p-6 shadow-2xl border border-slate-200 overflow-hidden my-8"
          >
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Background Job Details</h3>
                <p className="font-mono text-xs text-slate-500">{selectedJob.id}</p>
              </div>
              <div className="flex items-center gap-2">
                {statusBadge(selectedJob.status)}
                <button
                  type="button"
                  onClick={() => setInspectModalOpen(false)}
                  className="rounded p-1 text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="font-medium text-slate-500">Type:</span>
                  <p className="font-semibold text-slate-800">{selectedJob.type}</p>
                </div>
                <div>
                  <span className="font-medium text-slate-500">Priority:</span>
                  <p className="font-semibold text-slate-800">{selectedJob.priority}</p>
                </div>
                <div>
                  <span className="font-medium text-slate-500">Attempts:</span>
                  <p className="font-semibold text-slate-800">
                    {selectedJob.attempts} of {selectedJob.maxAttempts} (Backoff: {selectedJob.backoffSeconds}s)
                  </p>
                </div>
                <div>
                  <span className="font-medium text-slate-500">Run Schedule:</span>
                  <p className="font-semibold text-slate-800">{formatDateTime(selectedJob.runAt)}</p>
                </div>
                {selectedJob.lockedBy && (
                  <div className="col-span-2">
                    <span className="font-medium text-slate-500">Worker Lock:</span>
                    <p className="font-mono text-slate-800">
                      {selectedJob.lockedBy} (since {formatDateTime(selectedJob.lockedAt)})
                    </p>
                  </div>
                )}
                {selectedJob.idempotencyKey && (
                  <div className="col-span-2">
                    <span className="font-medium text-slate-500">Idempotency Key:</span>
                    <p className="font-mono text-slate-800 break-all">{selectedJob.idempotencyKey}</p>
                  </div>
                )}
              </div>

              {/* Error Details */}
              {selectedJob.lastError && (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                  <h4 className="text-xs font-semibold text-rose-800 uppercase tracking-wide">Last Error</h4>
                  <p className="mt-1 font-mono text-xs text-rose-900 break-words">{selectedJob.lastError}</p>
                  {selectedJob.errorStack && (
                    <details className="mt-2 text-[11px] text-rose-700">
                      <summary className="cursor-pointer font-medium hover:underline">View Stack Trace</summary>
                      <pre className="mt-2 overflow-x-auto rounded bg-rose-100/70 p-2 font-mono text-[10px] text-rose-950">
                        {selectedJob.errorStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Payload Viewer */}
              <div>
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-1">Payload</h4>
                <pre className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-slate-900 p-3 font-mono text-xs text-slate-100">
                  {JSON.stringify(selectedJob.payload || {}, null, 2)}
                </pre>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
              {canManage && (selectedJob.status === "FAILED" || selectedJob.status === "RETRY_SCHEDULED") && (
                <button
                  type="button"
                  onClick={() => handleRetryJob(selectedJob.id)}
                  disabled={actionLoading === `retry_${selectedJob.id}`}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {actionLoading === `retry_${selectedJob.id}` ? "Retrying…" : "Retry Job Now"}
                </button>
              )}
              <button
                type="button"
                onClick={() => setInspectModalOpen(false)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </main>
  );
}

