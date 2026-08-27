import Link from "next/link";
import { requirePageRole } from "@/lib/permissions/page-guards";
import { adminService } from "@/services/admin.service";
import { auditService } from "@/services/audit.service";
import { Role } from "@/generated/prisma/enums";
import { AdminUserTable } from "@/components/admin/admin-user-table";

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
      className={`rounded-2xl border p-5 shadow-2xs transition-all ${
        highlight
          ? "border-[var(--card-highlight-border)] bg-[var(--card-highlight)]"
          : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <p className="text-xs font-semibold text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
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
      <div className="h-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 transition-all hover:border-[var(--accent)] hover:shadow-md">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--accent-foreground)] font-bold text-xs">
            {icon}
          </div>
          <h2 className="text-sm font-bold text-[var(--foreground)] group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
            {title}
          </h2>
        </div>
        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
          {desc}
        </p>
      </div>
    </Link>
  );
}

export default async function AdminPage() {
  await requirePageRole([Role.ADMIN]);

  const [stats, securityStats, adminsRes, roles, recentLogs] = await Promise.all([
    adminService.stats(),
    auditService.getSecurityStats(),
    adminService.listAdmins({ skip: 0, take: 100 }),
    adminService.listRoles(),
    auditService.list({ limit: 6 }),
  ]);

  const roleOptions = roles.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
  }));

  return (
    <div className="flex flex-col gap-8 font-sans text-[var(--foreground)]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
            System Overview
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
            Platform monitoring, administrative controls, and security posture.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/admins"
            className="inline-flex items-center justify-center rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] px-4 py-2 text-xs font-bold text-[var(--accent-foreground)] transition-all shadow-2xs"
          >
            + Add Admin
          </Link>
          <Link
            href="/admin/security"
            className="inline-flex items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-secondary)] px-4 py-2 text-xs font-bold text-[var(--foreground)] transition-all"
          >
            Security Center
          </Link>
        </div>
      </div>

      {/* Platform Metric Grid */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)] mb-3">
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
        <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)] mb-3">
          Security & Access (24h)
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--muted-foreground)]">Successful Logins</span>
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-[var(--foreground)]">
              {securityStats.successfulLogins24h}
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Authenticated sessions</p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--muted-foreground)]">Failed Login Attempts</span>
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  securityStats.failedLogins24h > 5 ? "bg-rose-500 animate-pulse" : "bg-amber-400"
                }`}
              />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-[var(--foreground)]">
              {securityStats.failedLogins24h}
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">Throttled / rejected</p>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-[var(--muted-foreground)]">Privilege & Role Changes</span>
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-[var(--foreground)]">
              {securityStats.privilegeChanges7d}
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">In last 7 days</p>
          </div>
        </div>
      </div>

      {/* Administrator Accounts Table Section */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">
            Administrator Accounts
          </h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Manage administrative personnel, assign RBAC permissions, and oversee account security.
          </p>
        </div>

        <AdminUserTable
          initialUsers={adminsRes.items}
          availableRoles={roleOptions}
        />
      </div>

      {/* Quick Navigation Modules */}
      <div>
        <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)] mb-3">
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
            href="/admin/hosts"
            title="Host Directory"
            desc="Search and inspect all property host accounts, verify listings, and manage host status."
            icon="H"
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
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted-foreground)]">
            Recent Audit Events
          </h2>
          <Link
            href="/admin/activity-logs"
            className="text-xs font-bold text-amber-600 hover:underline dark:text-amber-400"
          >
            View all logs →
          </Link>
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
          <div className="divide-y divide-[var(--border-subtle)]">
            {recentLogs.items.length === 0 ? (
              <div className="p-6 text-center text-xs text-[var(--muted-foreground)]">
                No activity logs recorded yet.
              </div>
            ) : (
              recentLogs.items.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-2 hover:bg-[var(--surface-secondary)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        log.status === "FAILURE"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                          : "bg-[var(--accent)] text-[var(--accent-foreground)]"
                      }`}
                    >
                      {log.action}
                    </span>
                    <p className="text-xs text-[var(--foreground)] font-semibold">
                      {log.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)] font-mono self-start sm:self-auto">
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
