import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostOnboardingService } from "@/services/host-onboarding.service";

export const POST = apiHandler(async (req, ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.HOST_ONBOARDING_MANAGE);
  const { id } = await (ctx as any).params;
  const body = await req.json();

  const { stage, reason } = body;

  if (!stage) {
    throw AppError.badRequest("Target stage is required");
  }

  const updated = await hostOnboardingService.updateOnboardingStage(actor, id, stage, reason);
  return ok(updated);
});
