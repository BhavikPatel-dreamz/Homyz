import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostRegistrationService } from "@/services/host-registration.service";

// GET /api/v1/admin/hosts/registration-requests
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.HOST_REGISTRATION_VIEW);

  const sp = req.nextUrl.searchParams;
  const search = sp.get("search") || undefined;
  const status = (sp.get("status") as any) || undefined;
  const reviewerId = sp.get("reviewerId") || undefined;
  const onboardingStage = sp.get("onboardingStage") || undefined;
  const dateRange = (sp.get("dateRange") as any) || undefined;
  const sortBy = (sp.get("sortBy") as any) || undefined;
  const sortOrder = (sp.get("sortOrder") as any) || undefined;
  const page = parseInt(sp.get("page") || "1", 10);
  const pageSize = parseInt(sp.get("pageSize") || "10", 10);

  const result = await hostRegistrationService.listRegistrationRequests({
    search,
    status,
    reviewerId,
    onboardingStage,
    dateRange,
    sortBy,
    sortOrder,
    page,
    pageSize,
  });

  return ok(result);
});
