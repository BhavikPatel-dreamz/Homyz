import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostOnboardingService } from "@/services/host-onboarding.service";

export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.HOST_ONBOARDING_VIEW_ANALYTICS);

  const analytics = await hostOnboardingService.getOnboardingAnalytics();
  return ok(analytics);
});
