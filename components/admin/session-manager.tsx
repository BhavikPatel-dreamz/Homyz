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
            className="w-full rounded-full border border-[var(--border)] bg-[var(--surface-secondary)] py-2 pl-9 pr-9 text-xs text-[var(--foreground)] outline-none focus:border-[var(--accent)] transition-all shadow-2xs"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted-foreground)] pointer-events-none"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface)] transition-colors"
              title="Clear search"
              aria-label="Clear search"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <span className="text-xs text-[var(--muted-foreground)]">
          Total active sessions: <strong className="text-[var(--foreground)]">{sessions.length}</strong>
        </span>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] text-[var(--muted-foreground)] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Surface / Type</th>
                <th className="py-3 px-4">Device & OS</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Last Activity</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--muted-foreground)]">
                    No active sessions found.
                  </td>
                </tr>
              ) : (
                paginatedSessions.map((s) => (
                  <tr key={s.id} className="hover:bg-[var(--surface-secondary)] transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-[var(--foreground)]">
                        {s.userName || "User"}
                      </div>
                      <div className="text-[11px] text-[var(--muted-foreground)] font-mono">{s.userEmail || s.userId}</div>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${s.type === "web"
                            ? "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50"
                            : "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50"
                          }`}
                      >
                        {s.type === "web" ? "Web Cookie" : "Mobile Bearer"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-medium text-[var(--foreground)]">
                      {s.deviceInfo}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-[var(--muted-foreground)]">
                      {s.ip || "—"}
                    </td>
                    <td className="py-3.5 px-4 text-[var(--muted-foreground)] font-mono text-[11px]">
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
                        className="rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50 px-2.5 py-1 text-[11px] font-bold transition-all shadow-2xs disabled:opacity-50"
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
      </div>

      {/* Mobile Card List View */}
      <div className="md:hidden flex flex-col gap-3">
        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center text-xs text-[var(--muted-foreground)]">
            No active sessions found.
          </div>
        ) : (
          paginatedSessions.map((s) => (
            <div
              key={s.id}
              className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-xs text-[var(--foreground)]">
                    {s.userName || "User"}
                  </h3>
                  <p className="text-[11px] text-[var(--muted-foreground)] font-mono">{s.userEmail || s.userId}</p>
                </div>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    s.type === "web"
                      ? "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300 border border-sky-200 dark:border-sky-800/50"
                      : "bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50"
                  }`}
                >
                  {s.type === "web" ? "Web Cookie" : "Mobile Bearer"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-[var(--border-subtle)]">
                <div>
                  <span className="text-[var(--muted-foreground)] block text-[10px] uppercase font-semibold">Device & OS</span>
                  <span className="font-medium text-[var(--foreground)] truncate block">{s.deviceInfo}</span>
                </div>
                <div>
                  <span className="text-[var(--muted-foreground)] block text-[10px] uppercase font-semibold">IP Address</span>
                  <span className="font-mono text-[var(--muted-foreground)]">{s.ip || "—"}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-[var(--muted-foreground)] block text-[10px] uppercase font-semibold">Last Active</span>
                  <span className="text-[var(--muted-foreground)] font-mono">
                    {new Date(s.lastActiveAt).toLocaleString([], {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-[var(--border-subtle)] flex justify-end">
                <button
                  type="button"
                  onClick={() => handleRevokeOne(s)}
                  disabled={pending}
                  className="rounded-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50 px-3.5 py-1.5 text-xs font-bold transition-all shadow-2xs disabled:opacity-50"
                >
                  Revoke Session
                </button>
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
        itemLabel="sessions"
        pageSizeOptions={[10, 20, 50]}
      />
    </div>
  );
}
