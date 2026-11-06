import { RoleMatrixManager } from "@/components/admin/role-matrix-manager";
import { AdminPageHeader } from "@/components/admin/ui/admin-page-header";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminService } from "@/services/admin.service";

export const dynamic = "force-dynamic";

export default async function AdminRolesPage() {
  await requirePagePermission(PERMISSIONS.ROLES_VIEW);

  const [roles, allPermissions] = await Promise.all([
    adminService.listRoles(),
    adminService.listPermissions(),
  ]);

  return (
    <div className="flex flex-col gap-6 font-sans">
      <AdminPageHeader
        title="Roles & Permissions Matrix"
        description="Configure administrative roles and define granular permission boundaries for each module."
        badge={{
          label: `${roles.length} Configured Roles`,
          variant: "neutral",
        }}
      />

      <RoleMatrixManager
        initialRoles={roles}
        allPermissions={allPermissions}
      />
    </div>
  );
}
