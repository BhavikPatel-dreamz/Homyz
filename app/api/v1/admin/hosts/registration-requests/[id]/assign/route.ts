import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostRegistrationService } from "@/services/host-registration.service";

// POST /api/v1/admin/hosts/registration-requests/[id]/assign
export const POST = apiHandler(async (req, ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.HOST_REGISTRATION_ASSIGN);
  const { id } = await (ctx as any).params;
  const body = await req.json();

  const reviewerId = body.reviewerId === undefined ? null : body.reviewerId;
  const updated = await hostRegistrationService.assignReviewer(actor, id, reviewerId);
  return ok(updated);
});
