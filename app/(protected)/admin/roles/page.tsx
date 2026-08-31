import { RoleMatrixManager } from "@/components/admin/role-matrix-manager";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminService } from "@/services/admin.service";

export default async function AdminRolesPage() {
  await requirePagePermission(PERMISSIONS.ROLES_VIEW);

  const [roles, allPermissions] = await Promise.all([
    adminService.listRoles(),
    adminService.listPermissions(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--foreground)]">
          Roles & Permissions Matrix
        </h1>
        <p className="mt-1 text-xs sm:text-sm text-[var(--muted-foreground)]">
          Configure administrative roles and define granular permission boundaries for each module.
        </p>
      </div>

      <RoleMatrixManager
        initialRoles={roles}
        allPermissions={allPermissions}
      />
    </div>
  );
}
