"use client";

import { useState } from "react";
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
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

  const filtered = logs.filter((l) => {
    const matchesSearch =
      !search ||
      l.description.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.actorEmail?.toLowerCase().includes(search.toLowerCase()) ||
      l.ip?.includes(search);

    const matchesStatus = statusFilter === "ALL" || l.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by action, email, IP, description..."
              className="w-full rounded-full border border-zinc-200 bg-white py-2 pl-9 pr-4 text-xs text-zinc-900 outline-none focus:border-zinc-500 "
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

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-full border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 outline-none "
          >
            <option value="ALL">All Outcomes</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILURE">Failure</option>
          </select>
        </div>

        <span className="text-xs text-zinc-400">
          Showing {filtered.length} of {pagination.total} events
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-2xs ">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-zinc-100 bg-zinc-50/50 text-zinc-400 font-semibold uppercase tracking-wider ">
            <tr>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">Actor</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Resource</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4">IP Address</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 ">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-zinc-400">
                  No activity logs matching the selected filters.
                </td>
              </tr>
            ) : (
              filtered.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50/50 :bg-zinc-900/30 transition-colors">
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
                  <td className="py-3.5 px-4 whitespace-nowrap font-medium text-zinc-800 ">
                    {log.actorEmail || "System"}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 text-zinc-800 ">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-zinc-500">{log.resourceType}</td>
                  <td className="py-3.5 px-4 text-zinc-700 max-w-xs truncate">
                    {log.description}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-400">
                    {log.ip || "—"}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        log.status === "FAILURE"
                          ? "bg-red-100 text-red-700 "
                          : "bg-emerald-100 text-emerald-800 "
                      }`}
                    >
                      {log.status}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => setSelectedLog(log)}
                      className="rounded-lg border border-zinc-200 px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50 :bg-zinc-900"
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

      {/* Metadata Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-zinc-200 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge>{selectedLog.action}</Badge>
                <span className="text-xs text-zinc-500">
                  {new Date(selectedLog.createdAt).toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="text-zinc-400 hover:text-zinc-600 text-sm"
              >
                ✕
              </button>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-zinc-900 ">
                {selectedLog.description}
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Resource: {selectedLog.resourceType} ({selectedLog.resourceId || "N/A"})
              </p>
            </div>

            <div className="rounded-xl bg-zinc-50 p-3 text-xs flex flex-col gap-1 text-zinc-600 font-mono">
              <div>Actor: {selectedLog.actorEmail || "System"} (ID: {selectedLog.actorId || "none"})</div>
              <div>IP Address: {selectedLog.ip || "Unknown"}</div>
              <div className="truncate">User Agent: {selectedLog.userAgent || "Unknown"}</div>
            </div>

            {Boolean(selectedLog.metadata) && (
              <div>
                <label className="text-xs font-semibold text-zinc-700 ">
                  Attached Metadata
                </label>
                <pre className="mt-1 max-h-48 overflow-auto rounded-xl bg-zinc-900 p-3 text-xs text-zinc-100 font-mono">
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedLog(null)}
                className="rounded-full bg-zinc-900 text-white hover:bg-zinc-800 px-4 py-1.5 text-xs font-medium "
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
