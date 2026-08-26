import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { updateRoleSchema } from "@/lib/validation/admin";
import { adminService } from "@/services/admin.service";
import { Role } from "@/generated/prisma/enums";

// PATCH /api/v1/admin/users/[id]/role — set a user's role (ADMIN only).
// This is the trusted path allowed to grant ADMIN.
export const PATCH = apiHandler(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    await requireApiRole(req, [Role.ADMIN]);
    const { id } = await ctx.params;
    const { role } = updateRoleSchema.parse(await req.json());
    const user = await adminService.setUserRole(id, role);
    return ok(user);
  },
);
