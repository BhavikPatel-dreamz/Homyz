import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminResetPasswordSchema } from "@/lib/validation/admin";
import { adminService } from "@/services/admin.service";

// POST /api/v1/admin/users/:id/reset-password — admin reset user password
export const POST = apiHandler(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireApiPermission(req, PERMISSIONS.ADMINS_EDIT);
    const { id } = await ctx.params;
    const body = await req.json();
    const { newPassword } = adminResetPasswordSchema.parse(body);

    const res = await adminService.resetAdminPassword(actor, id, newPassword);
    return ok(res);
  },
);
