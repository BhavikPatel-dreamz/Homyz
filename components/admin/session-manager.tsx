"use client";

import { useState, useTransition } from "react";
import { Alert } from "../ui";
import { AdminPagination } from "./admin-pagination";
import type { UnifiedSessionDTO } from "@/services/session.service";

export function SessionManager({
  initialSessions,
}: {
  initialSessions: UnifiedSessionDTO[];
}) {
  const [sessions, setSessions] = useState<UnifiedSessionDTO[]>(initialSessions);
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<{ tone: "error" | "success"; msg: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = sessions.filter((s) => {
    return (
      !search ||
      s.userEmail?.toLowerCase().includes(search.toLowerCase()) ||
      s.userName?.toLowerCase().includes(search.toLowerCase()) ||
      s.ip?.includes(search) ||
      s.deviceInfo.toLowerCase().includes(search.toLowerCase())
    );
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const activePage = Math.min(currentPage, totalPages);
  const paginatedSessions = filtered.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize
  );

  async function handleRevokeOne(session: UnifiedSessionDTO) {
    if (!confirm(`Revoke session from ${session.deviceInfo} (${session.ip || "Unknown IP"})?`)) {
      return;
    }
    setFeedback(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/v1/admin/sessions/${session.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!data.success) {
          setFeedback({ tone: "error", msg: data.error?.message || "Failed to revoke session" });
          return;
        }
        setSessions(sessions.filter((s) => s.id !== session.id));
        setFeedback({ tone: "success", msg: "Session revoked successfully." });
      } catch {
        setFeedback({ tone: "error", msg: "Error contacting session API." });
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {feedback && (
        <Alert tone={feedback.tone}>
          <div className="flex items-center justify-between">
            <span>{feedback.msg}</span>
            <button onClick={() => setFeedback(null)} className="text-xs underline ml-4">
              Dismiss
            </button>
          </div>
        </Alert>
      )}

      {/* Search & Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user, device, IP..."
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

        <span className="text-xs text-zinc-500">
          Total active sessions: <strong>{sessions.length}</strong>
        </span>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-2xs ">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-zinc-100 bg-zinc-50/50 text-zinc-400 font-semibold uppercase tracking-wider ">
            <tr>
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Surface / Type</th>
              <th className="py-3 px-4">Device & OS</th>
              <th className="py-3 px-4">IP Address</th>
              <th className="py-3 px-4">Last Activity</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 ">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-zinc-400">
                  No active sessions found.
                </td>
              </tr>
            ) : (
              paginatedSessions.map((s) => (
                <tr key={s.id} className="hover:bg-zinc-50/50 :bg-zinc-900/30 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-zinc-900 ">
                      {s.userName || "User"}
                    </div>
                    <div className="text-[11px] text-zinc-500">{s.userEmail || s.userId}</div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.type === "web"
                          ? "bg-sky-100 text-sky-800 "
                          : "bg-purple-100 text-purple-800 "
                        }`}
                    >
                      {s.type === "web" ? "Web Cookie" : "Mobile Bearer"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-medium text-zinc-800 ">
                    {s.deviceInfo}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-[11px] text-zinc-500">
                    {s.ip || "—"}
                  </td>
                  <td className="py-3.5 px-4 text-zinc-500">
                    {new Date(s.lastActiveAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleRevokeOne(s)}
                      disabled={pending}
                      className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 hover:bg-red-50 :bg-red-950/40 transition-colors"
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
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
        itemLabel="sessions"
        pageSizeOptions={[10, 20, 50]}
      />
    </div>
  );
}
