import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostRegistrationService } from "@/services/host-registration.service";

// POST /api/v1/admin/hosts/registration-requests/[id]/start-review
export const POST = apiHandler(async (req, ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.HOST_REGISTRATION_REVIEW);
  const { id } = await (ctx as any).params;

  const updated = await hostRegistrationService.startReview(actor, id);
  return ok(updated);
});
