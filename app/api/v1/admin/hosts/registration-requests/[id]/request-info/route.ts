import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostRegistrationService } from "@/services/host-registration.service";

export const POST = apiHandler(async (req, ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.HOST_REGISTRATION_REQUEST_INFO);
  const { id } = await (ctx as any).params;
  const body = await req.json();

  const { informationRequired, reason, deadline } = body;

  if (!informationRequired || !reason) {
    throw AppError.badRequest("Information required and reason are mandatory fields");
  }

  const infoReq = await hostRegistrationService.requestAdditionalInformation(
    actor,
    id,
    informationRequired.trim(),
    reason.trim(),
    deadline
  );

  return ok(infoReq);
});
