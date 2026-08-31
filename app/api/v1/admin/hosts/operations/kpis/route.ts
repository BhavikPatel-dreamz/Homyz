import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostOperationsService } from "@/services/host-operations.service";

export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.HOST_OPERATIONS_VIEW_ANALYTICS);

  const kpis = await hostOperationsService.getOperationalKPIs();
  return ok(kpis);
});
