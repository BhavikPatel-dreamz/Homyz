import { AdminUserTable } from "@/components/admin/admin-user-table";
import { AdminManagementTabs } from "@/components/admin/admin-management-tabs";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminService } from "@/services/admin.service";

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-muted-foreground">
          Administrator Accounts
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
          Manage administrative personnel, assign RBAC permissions, and oversee account security.
        </p>
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
