import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { userService } from "@/services/user.service";
import { Role } from "@/generated/prisma/enums";

// GET /api/v1/users/[id] — fetch any user (ADMIN only).
export const GET = apiHandler(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    await requireApiRole(req, [Role.ADMIN]);
    const { id } = await ctx.params;
    const user = await userService.getById(id);
    return ok(user);
  },
);
