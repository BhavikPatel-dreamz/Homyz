import { AdminUserTable } from "@/components/admin/admin-user-table";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminService } from "@/services/admin.service";

export default async function AdminAllUsersPage() {
  await requirePagePermission(PERMISSIONS.USERS_VIEW);

  const [usersRes, roles] = await Promise.all([
    adminService.listUsers({ skip: 0, take: 100 }),
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
        <h1>
          User Directory
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
          All registered guest, host, and staff accounts. Manage active status and credentials.
        </p>
      </div>

      <AdminUserTable
        initialUsers={usersRes.items}
        availableRoles={roleOptions}
      />
    </div>
  );
}
