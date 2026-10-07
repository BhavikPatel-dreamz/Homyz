import { Role } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { getHostWorkspace } from "@/services/host-workspace.service";

// GET /api/v1/host/workspace — refresh the authenticated host's dashboard data.
export const GET = apiHandler(async (request) => {
  const actor = await requireApiRole(request, [Role.HOST, Role.ADMIN]);
  const includeCancelled = request.nextUrl.searchParams.get("includeCancelled") === "1";
  const workspace = await getHostWorkspace(actor, { includeCancelled });
  return ok(workspace);
});
