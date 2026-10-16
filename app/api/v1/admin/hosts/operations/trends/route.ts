import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostOperationsService, DateRangePreset } from "@/services/host-operations.service";

export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.HOST_OPERATIONS_VIEW_ANALYTICS);

  const url = new URL(req.url);
  const range = (url.searchParams.get("range") || "30_DAYS") as DateRangePreset;

  const trends = await hostOperationsService.getTrendAnalytics(range);
  return ok(trends);
});
