import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostRegistrationService } from "@/services/host-registration.service";

export const GET = apiHandler(async (req, ctx) => {
  await requireApiPermission(req, PERMISSIONS.HOST_REGISTRATION_VIEW);
  const { id } = await (ctx as any).params;

  const eligibility = await hostRegistrationService.validateApprovalEligibility(id);
  return ok(eligibility);
});
