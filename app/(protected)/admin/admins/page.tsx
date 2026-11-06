import Link from "next/link";
import { AdminUserTable } from "@/components/admin/admin-user-table";
import { AdminManagementTabs } from "@/components/admin/admin-management-tabs";
import { AdminPageHeader } from "@/components/admin/ui/admin-page-header";
import { AdminStatCard } from "@/components/admin/ui/admin-stat-card";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminService } from "@/services/admin.service";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await requirePagePermission(PERMISSIONS.ADMINS_VIEW);

  const searchParams = props.searchParams ? await props.searchParams : {};
  const search = typeof searchParams.search === "string" ? searchParams.search : "";
  const status = typeof searchParams.status === "string" ? searchParams.status : "ALL";
  const role = typeof searchParams.role === "string" ? searchParams.role : "ALL";
  const page = typeof searchParams.page === "string" ? Math.max(1, parseInt(searchParams.page, 10) || 1) : 1;
  const pageSize = typeof searchParams.pageSize === "string" ? Math.max(1, parseInt(searchParams.pageSize, 10) || 10) : 10;

  const [adminsRes, roles] = await Promise.all([
    adminService.listAdmins({ skip: 0, take: 200 }),
    adminService.listRoles(),
  ]);

  const roleOptions = roles.map((r: any) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
  }));

  const totalAdmins = adminsRes.items.length;
  const activeAdmins = adminsRes.items.filter((u: any) => u.status === "ACTIVE").length;
  const suspendedAdmins = adminsRes.items.filter((u: any) => u.status === "SUSPENDED").length;
  const totalRoles = roles.length;

  return (
    <div className="flex flex-col gap-6 font-sans">
      <AdminPageHeader
        title="Administrator Accounts"
        description="Manage administrative personnel, assign granular RBAC roles, and oversee platform security posture."
        badge={{
          label: `${totalAdmins} Staff Accounts`,
          variant: "neutral",
        }}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/admin/roles"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-[var(--surface-secondary)] transition-all shadow-2xs"
            >
              <svg className="h-3.5 w-3.5 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Manage Roles
            </Link>
            <Link
              href="/admin/activity-logs"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-medium text-muted-foreground hover:bg-[var(--surface-secondary)] transition-all shadow-2xs"
            >
              <svg className="h-3.5 w-3.5 text-[var(--muted-foreground)]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Audit Trail
            </Link>
          </div>
        }
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          label="Total Administrators"
          value={totalAdmins}
          comparisonText="Registered accounts"
          accentColor="amber"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <AdminStatCard
          label="Active Accounts"
          value={activeAdmins}
          comparisonText="Full portal access"
          accentColor="emerald"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <AdminStatCard
          label="Suspended Accounts"
          value={suspendedAdmins}
          comparisonText="Revoked permissions"
          accentColor={suspendedAdmins > 0 ? "rose" : "zinc"}
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
          }
        />
        <AdminStatCard
          label="Security Roles"
          value={totalRoles}
          comparisonText="Configured matrices"
          accentColor="sky"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          }
        />
      </div>

      <AdminManagementTabs />

      <AdminUserTable
        initialUsers={adminsRes.items}
        availableRoles={roleOptions}
        initialSearch={search}
        initialStatus={status}
        initialRole={role}
        initialPage={page}
        initialPageSize={pageSize}
      />
    </div>
  );
}
