import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { auditService } from "@/services/audit.service";

// GET /api/v1/admin/security/stats — 24h & 7d security metrics
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.SECURITY_LOGS_VIEW);
  const stats = await auditService.getSecurityStats();
  return ok(stats);
});
