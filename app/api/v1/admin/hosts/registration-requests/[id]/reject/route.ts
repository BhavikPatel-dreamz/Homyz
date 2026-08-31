import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostRegistrationService } from "@/services/host-registration.service";

export const POST = apiHandler(async (req, ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.HOST_REGISTRATION_REJECT);
  const { id } = await (ctx as any).params;
  const body = await req.json();

  const { reason, explanation } = body;

  if (!reason || !reason.trim()) {
    throw AppError.badRequest("Rejection reason is required");
  }

  const rejectedReq = await hostRegistrationService.rejectApplication(
    actor,
    id,
    reason.trim(),
    explanation ? explanation.trim() : undefined
  );

  return ok(rejectedReq);
});
