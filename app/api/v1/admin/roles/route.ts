import { apiHandler } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { createRoleSchema } from "@/lib/validation/admin";
import { adminService } from "@/services/admin.service";

// GET /api/v1/admin/roles — list roles with user/perm counts
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.ROLES_VIEW);
  const roles = await adminService.listRoles();
  return ok(roles);
});

// POST /api/v1/admin/roles — create new role
export const POST = apiHandler(async (req) => {
  const actor = await requireApiPermission(req, PERMISSIONS.ROLES_CREATE);
  const body = await req.json();
  const input = createRoleSchema.parse(body);

  const role = await adminService.createRole(actor, input);
  return created(role);
});
