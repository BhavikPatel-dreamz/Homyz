import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminService } from "@/services/admin.service";

// GET /api/v1/admin/permissions — list all system permissions
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.ROLES_VIEW);
  const permissions = adminService.listPermissions();
  return ok(permissions);
});
