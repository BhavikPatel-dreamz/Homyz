"use client";

import React, { useState, useMemo } from "react";
import { Badge } from "../ui";

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
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  // Extract unique module list for filter dropdown
  const uniqueModules = useMemo(() => {
    const set = new Set(logs.map((l) => l.resourceType).filter(Boolean));
    return Array.from(set);
  }, [logs]);

  // Extract unique actions list for filter dropdown
  const uniqueActions = useMemo(() => {
    const set = new Set(logs.map((l) => l.action).filter(Boolean));
    return Array.from(set);
  }, [logs]);

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

      return true;
    });
  }, [logs, search, moduleFilter, actionFilter, statusFilter]);

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
    <div className="flex flex-col gap-6 font-sans text-zinc-900">
      {/* Immutability Banner */}
      <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 text-xs text-blue-950 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <svg className="w-4 h-4 text-blue-600 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            <span className="font-bold block text-blue-900">Immutable Audit Trail</span>
            <span className="text-blue-700">Audit logs are tamper-proof historical records. Administrative modification or deletion is strictly disabled.</span>
          </div>
        </div>

        <button
          type="button"
          onClick={exportCSV}
          className="rounded-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 text-xs font-semibold shrink-0 transition-colors shadow-2xs"
        >
          Export CSV ({filtered.length})
        </button>
      </div>

      {/* Search & Multi-Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by action, email, IP, description..."
              className="w-full rounded-full border border-zinc-200 bg-white py-2 pl-9 pr-4 text-xs text-zinc-900 outline-none focus:border-zinc-500"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Module Filter */}
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-700 outline-none"
          >
            <option value="ALL">All Modules</option>
            {uniqueModules.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          {/* Action Filter */}
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-700 outline-none max-w-[180px]"
          >
            <option value="ALL">All Actions</option>
            {uniqueActions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-full border border-zinc-200 bg-white px-3.5 py-2 text-xs text-zinc-700 outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILURE">Failure</option>
          </select>
        </div>

        <span className="text-xs text-zinc-400 font-medium">
          Showing {filtered.length} of {pagination.total} events
        </span>
      </div>

      {/* Audit Log Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-2xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-zinc-100 bg-zinc-50/50 text-zinc-400 font-semibold uppercase tracking-wider">
            <tr>
              <th className="py-3.5 px-4">Timestamp</th>
              <th className="py-3.5 px-4">Actor</th>
              <th className="py-3.5 px-4">Action</th>
              <th className="py-3.5 px-4">Module / Target</th>
              <th className="py-3.5 px-4">Description</th>
              <th className="py-3.5 px-4">IP Address</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-zinc-400">
                  No audit activity recorded matching the selected filters.
                </td>
              </tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50/50 transition-colors">
                  {/* Timestamp */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-zinc-500 font-mono text-[11px]">
                    {new Date(log.createdAt).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    {new Date(log.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>

                  {/* Actor */}
                  <td className="py-3.5 px-4 whitespace-nowrap font-medium text-zinc-900">
                    {log.actorEmail || "System"}
                  </td>

                  {/* Action Badge */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-800 border border-zinc-200">
                      {log.action}
                    </span>
                  </td>

                  {/* Resource */}
                  <td className="py-3.5 px-4 text-zinc-600 font-medium">
                    {log.resourceType} {log.resourceId ? `(#${log.resourceId.slice(-6)})` : ""}
                  </td>

                  {/* Description */}
                  <td className="py-3.5 px-4 text-zinc-700 max-w-xs truncate">
                    {log.description}
                  </td>

                  {/* IP Address */}
                  <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-400">
                    {log.ip || "—"}
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                        log.status === "FAILURE"
                          ? "bg-rose-50 text-rose-700 border-rose-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>

                  {/* Inspect Details Button */}
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedLog(log)}
                      className="rounded-full border border-zinc-200 px-3 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors"
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

      {/* Metadata & Detailed Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-900 border border-zinc-200">
                  {selectedLog.action}
                </span>
                <span className="text-xs text-zinc-500 font-mono">
                  {new Date(selectedLog.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-zinc-400 hover:text-zinc-600 text-base"
              >
                ✕
              </button>
            </div>

            <div>
              <h3 className="text-sm font-bold text-zinc-900">
                {selectedLog.description}
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Resource: <strong className="text-zinc-800">{selectedLog.resourceType}</strong> (ID: {selectedLog.resourceId || "N/A"})
              </p>
            </div>

            <div className="rounded-xl bg-zinc-50 p-3 text-xs flex flex-col gap-1.5 text-zinc-700 font-mono border border-zinc-100">
              <div><strong className="text-zinc-500">Actor Email:</strong> {selectedLog.actorEmail || "System"}</div>
              <div><strong className="text-zinc-500">Actor ID:</strong> {selectedLog.actorId || "N/A"}</div>
              <div><strong className="text-zinc-500">IP Address:</strong> {selectedLog.ip || "Unknown"}</div>
              <div className="truncate"><strong className="text-zinc-500">User Agent:</strong> {selectedLog.userAgent || "Unknown"}</div>
            </div>

            {Boolean(selectedLog.metadata) && (
              <div>
                <label className="text-xs font-bold text-zinc-800 block mb-1">
                  Attached Metadata & Audit Payload
                </label>
                <pre className="max-h-48 overflow-auto rounded-xl bg-zinc-900 p-3 text-xs text-emerald-400 font-mono leading-relaxed">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-full bg-zinc-900 text-white hover:bg-zinc-800 px-5 py-2 text-xs font-semibold shadow-2xs"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
