"use client";

import React, { useState, useMemo } from "react";
import { AdminPagination } from "./admin-pagination";

export interface AuditLogItem {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  description: string;
  status: string;
  ip: string | null;
  userAgent: string | null;
  metadata: unknown;
  createdAt: Date | string;
}

export function ActivityLogViewer({
  initialLogs,
  pagination,
}: {
  initialLogs: AuditLogItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}) {
  const [logs] = useState<AuditLogItem[]>(initialLogs);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("ALL");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const uniqueModules = useMemo(() => {
    const set = new Set(logs.map((l) => l.resourceType).filter(Boolean));
    return Array.from(set);
  }, [logs]);

  const uniqueActions = useMemo(() => {
    const set = new Set(logs.map((l) => l.action).filter(Boolean));
    return Array.from(set);
  }, [logs]);

  const hasActiveFilters = Boolean(
    search.trim() ||
    moduleFilter !== "ALL" ||
    actionFilter !== "ALL" ||
    statusFilter !== "ALL" ||
    startDate ||
    endDate
  );

  const clearFilters = () => {
    setSearch("");
    setModuleFilter("ALL");
    setActionFilter("ALL");
    setStatusFilter("ALL");
    setStartDate("");
    setEndDate("");
  };

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchDesc = l.description?.toLowerCase().includes(q);
        const matchAction = l.action?.toLowerCase().includes(q);
        const matchEmail = l.actorEmail?.toLowerCase().includes(q);
        const matchIp = l.ip?.includes(q);
        const matchResource = l.resourceType?.toLowerCase().includes(q);
        if (!matchDesc && !matchAction && !matchEmail && !matchIp && !matchResource) return false;
      }

      if (moduleFilter !== "ALL" && l.resourceType !== moduleFilter) return false;
      if (actionFilter !== "ALL" && l.action !== actionFilter) return false;
      if (statusFilter !== "ALL" && l.status !== statusFilter) return false;

      if (startDate) {
        const logDate = new Date(l.createdAt);
        const start = new Date(startDate);
        if (logDate < start) return false;
      }

      if (endDate) {
        const logDate = new Date(l.createdAt);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (logDate > end) return false;
      }

      return true;
    });
  }, [logs, search, moduleFilter, actionFilter, statusFilter, startDate, endDate]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedLogs = useMemo(() => {
    return filtered.slice((activePage - 1) * pageSize, activePage * pageSize);
  }, [filtered, activePage, pageSize]);

  function exportCSV() {
    if (filtered.length === 0) return;

    const headers = ["Timestamp", "Actor Email", "Action", "Resource Type", "Resource ID", "Description", "IP Address", "Status"];
    const rows = filtered.map((l) => [
      `"${new Date(l.createdAt).toISOString()}"`,
      `"${l.actorEmail || "System"}"`,
      `"${l.action}"`,
      `"${l.resourceType}"`,
      `"${l.resourceId || ""}"`,
      `"${(l.description || "").replace(/"/g, '""')}"`,
      `"${l.ip || ""}"`,
      `"${l.status}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `homyz_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="flex flex-col gap-6 font-sans text-[var(--foreground)]">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
            Activity & Audit Logs
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Comprehensive, immutable audit trail of logins, administrative modifications, and security events.
          </p>
        </div>

        {/* Top Right Export CSV Button */}
        <button
          type="button"
          onClick={exportCSV}
          disabled={filtered.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-[var(--accent-foreground)] px-4 py-2 text-xs font-bold transition-all shadow-2xs shrink-0 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV ({filtered.length})
        </button>
      </div>

      {/* Immutability Banner */}
      <div className="rounded-2xl border border-[var(--card-highlight-border)] bg-[var(--card-highlight)] p-4 text-xs text-[var(--foreground)] flex items-center gap-3">
        <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <span className="font-bold">Immutable Audit Trail:</span>
          <span>Audit entries are read-only, tamper-proof, and append-only for security and regulatory compliance.</span>
        </div>
      </div>

      {/* Audit Log Filters Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">

          {/* Search Input */}
          <div className="relative flex-1 lg:max-w-[45%] min-w-[240px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actor, action, IP, description..."
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] py-2 pl-9 pr-4 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--muted-foreground)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Dropdown Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none"
            >
              <option value="ALL">Module: All</option>
              {uniqueModules.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none max-w-[160px]"
            >
              <option value="ALL">Action: All</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--foreground)] outline-none"
            >
              <option value="ALL">Status: All</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILURE">Failure</option>
            </select>

            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              title="From date"
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--foreground)] outline-none"
            />

            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              title="To date"
              className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--foreground)] outline-none"
            />

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 px-3 py-1 text-xs font-semibold transition-colors dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300"
              >
                Clear Filters
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-subtle)] text-[11px] text-[var(--muted-foreground)]">
          <span>Displaying <strong>{filtered.length}</strong> of <strong>{pagination.total}</strong> total audit records</span>
          {hasActiveFilters && <span>Active Filters Applied</span>}
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden sm:block rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 whitespace-nowrap">Timestamp</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Actor</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Action</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Module / Target</th>
                <th className="py-3.5 px-4">Description</th>
                <th className="py-3.5 px-4 whitespace-nowrap">IP Address</th>
                <th className="py-3.5 px-4 whitespace-nowrap">Status</th>
                <th className="py-3.5 px-4 text-right whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-[var(--muted-foreground)]">
                    No activity logs match the selected filters.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className="hover:bg-[var(--surface-secondary)] transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-4 whitespace-nowrap text-[var(--muted-foreground)] font-mono text-[11px]" suppressHydrationWarning>
                      {new Date(log.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      {new Date(log.createdAt).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap font-medium text-[var(--foreground)]">
                      {log.actorEmail || "System"}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--surface-secondary)] text-[var(--foreground)] border border-[var(--border)]">
                        {log.action}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap text-[var(--muted-foreground)] font-medium">
                      {log.resourceType} {log.resourceId ? `(#${log.resourceId.slice(-6)})` : ""}
                    </td>

                    <td className="py-3.5 px-4 text-[var(--foreground)] max-w-xs truncate" title={log.description}>
                      {log.description}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap font-mono text-[11px] text-[var(--muted-foreground)]">
                      {log.ip || "—"}
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${log.status === "FAILURE"
                            ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50"
                          }`}
                      >
                        {log.status}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                        }}
                        className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-[11px] font-bold text-[var(--foreground)] hover:bg-[var(--surface-secondary)] transition-all"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Card List */}
      <div className="sm:hidden flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-xs text-[var(--muted-foreground)]">
            No audit records found.
          </div>
        ) : (
          paginatedLogs.map((log) => (
            <div
              key={log.id}
              onClick={() => setSelectedLog(log)}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col gap-2.5 active:bg-[var(--surface-secondary)]"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--surface-secondary)] text-[var(--foreground)] border border-[var(--border)]">
                  {log.action}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${log.status === "FAILURE"
                      ? "bg-rose-50 text-rose-700 border-rose-200"
                      : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    }`}
                >
                  {log.status}
                </span>
              </div>

              <p className="text-xs font-semibold text-[var(--foreground)] leading-snug">
                {log.description}
              </p>

              <div className="flex items-center justify-between text-[11px] text-[var(--muted-foreground)] border-t border-[var(--border-subtle)] pt-2 font-mono">
                <span>{log.actorEmail || "System"}</span>
                <span suppressHydrationWarning>{new Date(log.createdAt).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Footer */}
      <AdminPagination
        currentPage={activePage}
        totalPages={totalPages}
        totalItems={filtered.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
        itemLabel="activity logs"
        pageSizeOptions={[15, 30, 50]}
      />

      {/* Audit Event Details Drawer / Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-2xl bg-[var(--surface)] text-[var(--foreground)] p-6 shadow-2xl border border-[var(--border)] flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-[var(--accent)] text-[var(--accent-foreground)]">
                  {selectedLog.action}
                </span>
                <span className="text-xs text-[var(--muted-foreground)] font-mono">
                  ID: {selectedLog.id.slice(-12)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-[var(--surface-secondary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1">
                Event Description
              </label>
              <p className="text-sm font-semibold text-[var(--foreground)] leading-relaxed">
                {selectedLog.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-xl bg-[var(--surface-secondary)] p-3.5 text-xs text-[var(--foreground)] border border-[var(--border-subtle)]">
              <div>
                <span className="text-[var(--muted-foreground)] text-[11px] block">Timestamp</span>
                <span className="font-mono text-[var(--foreground)] font-medium" suppressHydrationWarning>
                  {new Date(selectedLog.createdAt).toLocaleString("en-US")}
                </span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] text-[11px] block">Actor Email</span>
                <span className="font-medium text-[var(--foreground)] truncate block">
                  {selectedLog.actorEmail || "System"}
                </span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] text-[11px] block">Module / Target</span>
                <span className="font-medium text-[var(--foreground)]">
                  {selectedLog.resourceType} ({selectedLog.resourceId || "N/A"})
                </span>
              </div>
              <div>
                <span className="text-[var(--muted-foreground)] text-[11px] block">IP Address</span>
                <span className="font-mono text-[var(--foreground)]">
                  {selectedLog.ip || "Unknown"}
                </span>
              </div>
            </div>

            {Boolean(selectedLog.metadata) && (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] block mb-1.5">
                  Metadata & Event Payload
                </label>
                <pre className="max-h-52 overflow-auto rounded-xl bg-zinc-950 p-3.5 text-xs text-emerald-400 font-mono leading-relaxed shadow-inner">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            <div className="rounded-xl bg-blue-50/70 border border-blue-200/80 p-3 text-[11px] text-blue-950 dark:bg-blue-950/40 dark:border-blue-900/50 dark:text-blue-200 flex items-center gap-2.5">
              <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Audit record is immutable, signed, and cannot be modified or deleted.</span>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-full bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 px-5 py-2 text-xs font-bold shadow-2xs transition-colors"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
