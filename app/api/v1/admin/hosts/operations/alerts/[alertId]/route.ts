import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostOperationsService, AlertStatus } from "@/services/host-operations.service";

export const POST = apiHandler(async (req, ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.HOST_OPERATIONS_MANAGE_ALERTS);
  const { alertId } = await (ctx as any).params;
  const body = await req.json();

  if (!body.status) {
    throw AppError.badRequest("New alert status is required");
  }

  const updated = await hostOperationsService.updateAlertState(
    actor,
    alertId,
    body.status as AlertStatus,
    body.notes
  );

  return ok(updated);
});
