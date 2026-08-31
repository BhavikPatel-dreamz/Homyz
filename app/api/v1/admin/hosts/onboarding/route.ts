import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { hostOnboardingService } from "@/services/host-onboarding.service";

export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.HOST_ONBOARDING_VIEW);

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || undefined;
  const stage = searchParams.get("stage") || undefined;
  const overallStatus = searchParams.get("overallStatus") || undefined;
  const reviewerId = searchParams.get("reviewerId") || undefined;
  const actionRequiredOnly = searchParams.get("actionRequiredOnly") === "true";
  const overdueOnly = searchParams.get("overdueOnly") === "true";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
  const sortBy = (searchParams.get("sortBy") as any) || "updatedAt";
  const sortOrder = (searchParams.get("sortOrder") as any) || "desc";

  const result = await hostOnboardingService.listOnboardingRecords({
    search,
    stage,
    overallStatus,
    reviewerId,
    actionRequiredOnly,
    overdueOnly,
    page,
    pageSize,
    sortBy,
    sortOrder,
  });

  return ok(result);
});
