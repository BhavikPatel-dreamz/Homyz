import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostRegistrationService } from "@/services/host-registration.service";

export const POST = apiHandler(async (req, ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.HOST_REGISTRATION_APPROVE);
  const { id } = await (ctx as any).params;

  const approvedReq = await hostRegistrationService.approveApplication(actor, id);
  return ok(approvedReq);
});
