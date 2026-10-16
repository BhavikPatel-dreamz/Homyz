import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { sessionService } from "@/services/session.service";

// GET /api/v1/admin/sessions — list active sessions across web and mobile
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.SESSIONS_VIEW);
  const sp = req.nextUrl.searchParams;
  const limit = sp.get("limit") ? parseInt(sp.get("limit")!, 10) : 100;
  const sessions = await sessionService.listAllActive(limit);
  return ok(sessions);
});
