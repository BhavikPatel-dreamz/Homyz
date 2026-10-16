import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostRegistrationService } from "@/services/host-registration.service";

export const GET = apiHandler(async (req, ctx) => {
  await requireApiPermission(req, PERMISSIONS.HOST_REGISTRATION_VIEW_COMPLIANCE);
  const { id } = await (ctx as any).params;
  const data = await hostRegistrationService.getComplianceDetails(id);
  return ok(data);
});
