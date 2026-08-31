import { AdminUserTable } from "@/components/admin/admin-user-table";
import { AdminManagementTabs } from "@/components/admin/admin-management-tabs";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminService } from "@/services/admin.service";

export default async function AdminUsersPage() {
  await requirePagePermission(PERMISSIONS.ADMINS_VIEW);

  const [adminsRes, roles] = await Promise.all([
    adminService.listAdmins({ skip: 0, take: 100 }),
    adminService.listRoles(),
  ]);

  const roleOptions = roles.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
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
      />
    </div>
  );
}

