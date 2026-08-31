"use client";

import React, { useState } from "react";
import { AdminPagination } from "./admin-pagination";
import type { SecurityStats } from "@/services/audit.service";

export function SecurityDashboard({
  stats,
  failedEvents,
}: {
  stats: SecurityStats;
  failedEvents: Array<{
    id: string;
    action: string;
    actorEmail: string | null;
    ip: string | null;
    createdAt: Date | string;
  }>;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);

  const totalPages = Math.max(1, Math.ceil(failedEvents.length / pageSize));
  const paginatedEvents = failedEvents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );
  return (
    <div className="flex flex-col gap-6 font-sans text-[var(--foreground)]">

      {/* Metric Overview Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">

        {/* Card 1 */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--muted-foreground)]">
            <span>24h Logins</span>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-[var(--foreground)]">
            {stats.successfulLogins24h}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Authenticated successfully
          </p>
        </div>

        {/* Card 2 */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--muted-foreground)]">
            <span>Failed Logins</span>
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                stats.failedLogins24h > 5 ? "bg-rose-500 animate-pulse ring-4 ring-rose-500/20" : "bg-amber-400 ring-4 ring-amber-400/20"
              }`}
            />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-[var(--foreground)]">
            {stats.failedLogins24h}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Throttled / invalid credentials
          </p>
        </div>

        {/* Card 3 */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--muted-foreground)]">
            <span>Privilege Changes (7d)</span>
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-[var(--foreground)]">
            {stats.privilegeChanges7d}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Role & status modifications
          </p>
        </div>

        {/* Card 4 */}
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <div className="flex items-center justify-between text-xs font-medium text-[var(--muted-foreground)]">
            <span>Active Sessions</span>
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/20" />
          </div>
          <p className="mt-3 text-3xl font-extrabold text-[var(--foreground)]">
            {stats.activeSessionsCount}
          </p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Active web & mobile tokens
          </p>
        </div>

      </div>

      {/* Security Policies Matrix */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs">
        <div className="flex items-center gap-2 mb-5">
          <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <h2 className="text-base font-bold text-[var(--foreground)]">
            Security Controls & Baseline Policies
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-[var(--foreground)]">
                Brute-Force & Rate Limiting
              </span>
              <span className="text-emerald-700 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold">
                Active
              </span>
            </div>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              Sliding-window login throttle caps failed attempts per identifier before temporary lockout (HTTP 429).
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-[var(--foreground)]">
                Password Complexity
              </span>
              <span className="text-emerald-700 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold">
                Enforced
              </span>
            </div>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              Bcrypt hash with minimum 8 characters, uppercase letter, and number requirement across all account types.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-[var(--foreground)]">
                Privilege Escalation Protection
              </span>
              <span className="text-emerald-700 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold">
                Enforced
              </span>
            </div>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              Public signup rejects ADMIN. Demoting the last active Super Admin is permanently rejected server-side.
            </p>
          </div>

          <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-bold text-[var(--foreground)]">
                Session Revocation on State Change
              </span>
              <span className="text-emerald-700 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-300 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold">
                Active
              </span>
            </div>
            <p className="text-[var(--muted-foreground)] leading-relaxed">
              When a password is reset or a user is suspended, all existing web cookies and mobile refresh tokens are immediately revoked.
            </p>
          </div>
        </div>
      </div>

      {/* Failed Logins & Suspicious Events */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-[var(--foreground)]">
              Authentication Failures & Security Alerts
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
              Live audit stream of failed authentication attempts and suspicious security transactions.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-950 dark:bg-amber-500/20 dark:text-amber-300">
            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            Live Monitor
          </span>
        </div>

        <div className="divide-y divide-[var(--border-subtle)]">
          {failedEvents.length === 0 ? (
            <div className="p-10 text-center text-xs text-[var(--muted-foreground)]">
              No failed logins or suspicious security events recorded.
            </div>
          ) : (
            paginatedEvents.map((event) => (
              <div
                key={event.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-2 hover:bg-[var(--surface-secondary)] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                  <span className="font-bold text-xs text-[var(--foreground)]">
                    {event.action}
                  </span>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    Target: {event.actorEmail || "Unknown"}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)] font-mono">
                  <span>{event.ip || "No IP captured"}</span>
                  <span suppressHydrationWarning>{new Date(event.createdAt).toLocaleString("en-US")}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Footer */}
        <div className="p-3 border-t border-[var(--border-subtle)]">
          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={failedEvents.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            itemLabel="security events"
            pageSizeOptions={[5, 10, 20]}
          />
        </div>
      </div>
    </div>
  );
}
