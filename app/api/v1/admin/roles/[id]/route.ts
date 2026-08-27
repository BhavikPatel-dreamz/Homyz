import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { editRoleSchema } from "@/lib/validation/admin";
import { adminService } from "@/services/admin.service";

// GET /api/v1/admin/roles/:id
export const GET = apiHandler(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    await requireApiPermission(req, PERMISSIONS.ROLES_VIEW);
    const { id } = await ctx.params;
    const role = await adminService.getRoleById(id);
    return ok(role);
  },
);

// PATCH /api/v1/admin/roles/:id
export const PATCH = apiHandler(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireApiPermission(req, PERMISSIONS.ROLES_EDIT);
    const { id } = await ctx.params;
    const body = await req.json();
    const input = editRoleSchema.parse(body);

    const updated = await adminService.updateRole(actor, id, input);
    return ok(updated);
  },
);

// DELETE /api/v1/admin/roles/:id
export const DELETE = apiHandler(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireApiPermission(req, PERMISSIONS.ROLES_DELETE);
    const { id } = await ctx.params;
    const res = await adminService.deleteRole(actor, id);
    return ok(res);
  },
);
