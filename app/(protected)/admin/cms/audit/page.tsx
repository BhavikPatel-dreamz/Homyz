"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";

export default function CmsAuditHistoryPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/admin/cms/audit?page=${page}&limit=25`);
      if (res.ok) {
        const json = await res.json();
        const data = json.data || json;
        setLogs(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (err) {
      console.warn("Failed to fetch audit logs", err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchAuditLogs();
  }, [fetchAuditLogs]);

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--border)] pb-5">
        <h1 className="text-xl font-bold text-[var(--foreground)]">
          CMS Audit History
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
          Chronological trail of administrative actions across content, versions, media, and scheduling.
        </p>
      </div>
        <div className="flex items-center justify-between">
          <Link
            href="/admin/cms"
            className="text-xs font-semibold text-zinc-600 hover:text-zinc-900"
          >
            ← Back to Content List
          </Link>
          <span className="text-xs text-zinc-500">
            Total {total} audit records
          </span>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 border-b border-zinc-200 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Timestamp</th>
                  <th className="px-5 py-3.5">Action</th>
                  <th className="px-5 py-3.5">Resource</th>
                  <th className="px-5 py-3.5">Actor</th>
                  <th className="px-5 py-3.5">Description</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-zinc-400">
                      Loading audit history...
                    </td>
                  </tr>
                ) : logs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-5 py-12 text-center text-zinc-400">
                      No CMS audit logs recorded yet.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-zinc-50/60 transition">
                      <td className="px-5 py-3.5 text-xs text-zinc-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs font-bold text-zinc-800">
                        {log.action}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-zinc-600">
                        {log.resourceType}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-zinc-700">
                        {log.actor?.name || log.actorEmail || "System"}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-zinc-800">
                        {log.description}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            log.status === "SUCCESS"
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-rose-100 text-rose-800"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between px-5 py-3.5 border-t border-zinc-200 bg-zinc-50 text-xs text-zinc-500">
            <div>Page {page} of {totalPages}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 border border-zinc-200 rounded-lg bg-white disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 border border-zinc-200 rounded-lg bg-white disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </div>
    </div>
  );
}

