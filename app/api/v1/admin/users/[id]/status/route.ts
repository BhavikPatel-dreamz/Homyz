import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { toggleUserStatusSchema } from "@/lib/validation/admin";
import { adminService } from "@/services/admin.service";
import { UserStatus } from "@/generated/prisma/enums";

// PATCH /api/v1/admin/users/:id/status — activate or suspend user
export const PATCH = apiHandler(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireApiPermission(req, PERMISSIONS.USERS_EDIT);
    const { id } = await ctx.params;
    const body = await req.json();
    const { status } = toggleUserStatusSchema.parse(body);

    const updated = await adminService.toggleUserStatus(
      actor,
      id,
      status as UserStatus,
    );
    return ok(updated);
  },
);
