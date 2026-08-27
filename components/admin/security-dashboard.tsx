"use client";

import type { SecurityStats } from "@/services/audit.service";
import { Badge } from "../ui";

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
  return (
    <div className="flex flex-col gap-8">
      {/* Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs ">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>24h Logins</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-zinc-900 ">
            {stats.successfulLogins24h}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Authenticated successfully</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs ">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Failed Logins</span>
            <span
              className={`h-2 w-2 rounded-full ${
                stats.failedLogins24h > 5 ? "bg-red-500 animate-pulse" : "bg-amber-400"
              }`}
            />
          </div>
          <p className="mt-2 text-3xl font-bold text-zinc-900 ">
            {stats.failedLogins24h}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Throttled / bad credentials</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs ">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Privilege Changes (7d)</span>
            <span className="h-2 w-2 rounded-full bg-blue-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-zinc-900 ">
            {stats.privilegeChanges7d}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Role & status modifications</p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-2xs ">
          <div className="flex items-center justify-between text-xs text-zinc-500">
            <span>Active Sessions</span>
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-zinc-900 ">
            {stats.activeSessionsCount}
          </p>
          <p className="mt-1 text-xs text-zinc-400">Web cookies & mobile tokens</p>
        </div>
      </div>

      {/* Security Policies Matrix */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xs ">
        <h2 className="text-sm font-semibold text-zinc-900 mb-4">
          Security Controls & Baseline Policies
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 ">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-zinc-800 ">
                Brute-Force & Rate Limiting
              </span>
              <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-medium">
                Active
              </span>
            </div>
            <p className="text-zinc-500 mt-1">
              Sliding-window login throttle caps failed attempts per identifier before temporary lockout (HTTP 429).
            </p>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 ">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-zinc-800 ">
                Password Complexity
              </span>
              <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-medium">
                Enforced
              </span>
            </div>
            <p className="text-zinc-500 mt-1">
              Bcrypt hash with minimum 8 characters, uppercase letter, and number requirement across all account types.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 ">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-zinc-800 ">
                Privilege Escalation Protection
              </span>
              <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-medium">
                Enforced
              </span>
            </div>
            <p className="text-zinc-500 mt-1">
              Public signup rejects ADMIN. Demoting the last active Super Admin is permanently rejected server-side.
            </p>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 ">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-zinc-800 ">
                Session Revocation on State Change
              </span>
              <span className="text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full text-[10px] font-medium">
                Active
              </span>
            </div>
            <p className="text-zinc-500 mt-1">
              When a password is reset or a user is suspended, all existing web cookies and mobile refresh tokens are immediately revoked.
            </p>
          </div>
        </div>
      </div>

      {/* Failed Logins & Suspicious Events */}
      <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-2xs ">
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 ">
              Authentication Failures & Alerts
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Live audit of failed attempts and suspicious security transactions.
            </p>
          </div>
          <Badge>Live Monitor</Badge>
        </div>

        <div className="divide-y divide-zinc-100 ">
          {failedEvents.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-400">
              No failed logins or suspicious security events recorded.
            </div>
          ) : (
            failedEvents.map((event) => (
              <div
                key={event.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-2 hover:bg-zinc-50/50 :bg-zinc-900/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="font-semibold text-xs text-zinc-900 ">
                    {event.action}
                  </span>
                  <span className="text-xs text-zinc-600 ">
                    Target: {event.actorEmail || "Unknown"}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-zinc-400">
                  <span className="font-mono">{event.ip || "No IP captured"}</span>
                  <span>{new Date(event.createdAt).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
