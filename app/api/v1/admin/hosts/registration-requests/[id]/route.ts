import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostRegistrationService } from "@/services/host-registration.service";

// GET /api/v1/admin/hosts/registration-requests/[id]
export const GET = apiHandler(async (req, ctx) => {
  await requireApiPermission(req, PERMISSIONS.HOST_REGISTRATION_VIEW);
  const { id } = await (ctx as any).params;
  const result = await hostRegistrationService.getRegistrationRequestById(id);
  return ok(result);
});

// PATCH /api/v1/admin/hosts/registration-requests/[id]
export const PATCH = apiHandler(async (req, ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.HOST_REGISTRATION_EDIT);
  const { id } = await (ctx as any).params;
  const body = await req.json();

  const updated = await hostRegistrationService.updateRegistrationRequest(actor, id, body);
  return ok(updated);
});
