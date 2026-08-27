import Link from "next/link";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { adminService } from "@/services/admin.service";
import { auditService } from "@/services/audit.service";
import { Role } from "@/generated/prisma/enums";

function MetricCard({
  label,
  value,
  subtitle,
  highlight = false,
}: {
  label: string;
  value: number | string;
  subtitle?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-2xs transition-all ${
        highlight
          ? "border-amber-300 bg-amber-50/20"
          : "border-zinc-200"
      }`}
    >
      <p className="text-xs font-semibold text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-zinc-400">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function ShortcutCard({
  href,
  title,
  desc,
  icon,
}: {
  href: string;
  title: string;
  desc: string;
  icon: string;
}) {
  return (
    <Link href={href} className="group block">
      <div className="h-full rounded-2xl border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-400 hover:shadow-xs">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-900 font-bold text-xs">
            {icon}
          </div>
          <h2 className="text-sm font-semibold text-zinc-900 group-hover:text-amber-800 transition-colors">
            {title}
          </h2>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed">
          {desc}
        </p>
      </div>
    </Link>
  );
}

export default async function AdminPage() {
  await requirePageRole([Role.ADMIN]);

  const [stats, securityStats, recentLogs] = await Promise.all([
    adminService.stats(),
    auditService.getSecurityStats(),
    auditService.list({ limit: 6 }),
  ]);

  return (
    <div className="flex flex-col gap-8 text-zinc-900">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">
            System Overview
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Platform monitoring, administrative controls, and security posture.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/admins"
            className="inline-flex items-center justify-center rounded-full bg-[#FBDE9B] hover:bg-[#F3D382] px-4 py-2 text-xs font-semibold text-zinc-900 transition-colors shadow-2xs"
          >
            + Add Admin
          </Link>
          <Link
            href="/admin/security"
            className="inline-flex items-center justify-center rounded-full border border-zinc-200 bg-white hover:bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-800 transition-colors"
          >
            Security Center
          </Link>
        </div>
      </div>

      {/* Platform Metric Grid */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
          Platform Metrics
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="Registered Users" value={stats.users} subtitle="Total accounts" />
          <MetricCard label="Property Hosts" value={stats.hosts} subtitle="Listing creators" />
          <MetricCard label="Administrators" value={stats.admins} subtitle="Privileged staff" />
          <MetricCard label="Published Listings" value={stats.listings} subtitle="Active inventory" />
          <MetricCard label="Total Bookings" value={stats.bookings} subtitle="Stays reserved" />
          <MetricCard
            label="Active Sessions"
            value={stats.activeSessions}
            subtitle="Web & mobile"
            highlight
          />
        </div>
      </div>

      {/* Security Health Metrics */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
          Security & Access (24h)
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">Successful Logins</span>
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-zinc-900">
              {securityStats.successfulLogins24h}
            </p>
            <p className="mt-1 text-xs text-zinc-400">Authenticated sessions</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">Failed Login Attempts</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  securityStats.failedLogins24h > 5 ? "bg-red-500" : "bg-amber-400"
                }`}
              />
            </div>
            <p className="mt-2 text-2xl font-bold text-zinc-900">
              {securityStats.failedLogins24h}
            </p>
            <p className="mt-1 text-xs text-zinc-400">Throttled / rejected</p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">Privilege & Role Changes</span>
              <span className="h-2 w-2 rounded-full bg-blue-500" />
            </div>
            <p className="mt-2 text-2xl font-bold text-zinc-900">
              {securityStats.privilegeChanges7d}
            </p>
            <p className="mt-1 text-xs text-zinc-400">In last 7 days</p>
          </div>
        </div>
      </div>

      {/* Quick Navigation Modules */}
      <div>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
          Administrative Modules
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ShortcutCard
            href="/admin/admins"
            title="Admin Users"
            desc="Manage administrative staff, assign roles, activate/suspend access, and reset credentials."
            icon="A"
          />
          <ShortcutCard
            href="/admin/users"
            title="User Directory"
            desc="Search and inspect all customer & host accounts, enforce status, and view booking activity."
            icon="U"
          />
          <ShortcutCard
            href="/admin/roles"
            title="Roles & Permissions"
            desc="Configure custom roles and maintain granular module permission matrices."
            icon="R"
          />
          <ShortcutCard
            href="/admin/activity-logs"
            title="Activity Logs"
            desc="Audit all security actions, role changes, administrative mutations, and session invalidations."
            icon="L"
          />
        </div>
      </div>

      {/* Recent Activity Log Stream */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Recent Audit Events
          </h2>
          <Link
            href="/admin/activity-logs"
            className="text-xs font-medium text-amber-800 hover:underline"
          >
            View all logs →
          </Link>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden shadow-2xs">
          <div className="divide-y divide-zinc-100">
            {recentLogs.items.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500">
                No activity logs recorded yet.
              </div>
            ) : (
              recentLogs.items.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-2 hover:bg-zinc-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        log.status === "FAILURE"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {log.action}
                    </span>
                    <p className="text-xs text-zinc-900 font-medium">
                      {log.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-400 self-start sm:self-auto">
                    <span>{log.actorEmail || "System"}</span>
                    <span>{new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
