import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { sessionService } from "@/services/session.service";

// DELETE /api/v1/admin/sessions/:id — revoke specific session
export const DELETE = apiHandler(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireApiPermission(req, PERMISSIONS.SESSIONS_REVOKE);
    const { id } = await ctx.params;

    await sessionService.revokeSession(id, actor.id, actor.email ?? undefined);
    return ok({ success: true, message: "Session revoked" });
  },
);
