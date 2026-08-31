import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostRegistrationService } from "@/services/host-registration.service";

export const POST = apiHandler(async (req, ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.HOST_REGISTRATION_REOPEN);
  const { id } = await (ctx as any).params;
  const body = await req.json();

  const { reason } = body;

  if (!reason || !reason.trim()) {
    throw AppError.badRequest("Reopen reason is required");
  }

  const reopenedReq = await hostRegistrationService.reopenApplication(actor, id, reason.trim());
  return ok(reopenedReq);
});
