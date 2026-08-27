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

export default async function AdminPage() {
  await requirePageRole([Role.ADMIN]);

  const [stats, securityStats, adminsRes, roles] = await Promise.all([
    adminService.stats(),
    auditService.getSecurityStats(),
    adminService.listAdmins({ skip: 0, take: 100 }),
    adminService.listRoles(),
  ]);

  const roleOptions = roles.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
  }));

  return (
    <div className="flex flex-col gap-8 text-zinc-900">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950">
          System Overview
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Platform monitoring, administrative controls, and security posture.
        </p>
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

      {/* Administrator Accounts Table Section */}
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-950">
            Administrator Accounts
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Manage administrative personnel, assign RBAC permissions, and oversee account security.
          </p>
        </div>

        <AdminUserTable
          initialUsers={adminsRes.items}
          availableRoles={roleOptions}
        />
      </div>
    </div>
  );
}
