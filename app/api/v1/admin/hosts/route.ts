import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { adminService } from "@/services/admin.service";

// GET /api/v1/admin/hosts
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.HOSTS_VIEW);

  const searchParams = req.nextUrl.searchParams;
  const search = searchParams.get("search") || undefined;
  const accountStatus = searchParams.get("accountStatus") || searchParams.get("status") || "ALL";
  const applicationStatus = searchParams.get("applicationStatus") || "ALL";
  const onboardingStage = searchParams.get("onboardingStage") || "ALL";
  const verificationStatus = searchParams.get("verificationStatus") || "ALL";
  const complianceStatus = searchParams.get("complianceStatus") || "ALL";
  const reviewerId = searchParams.get("reviewerId") || "ALL";
  const dateRange = searchParams.get("dateRange") || "ALL";
  const sortBy = (searchParams.get("sortBy") as any) || "createdAt";
  const sortOrder = (searchParams.get("sortOrder") as any) || "desc";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);

  const skip = (page - 1) * pageSize;

  const result = await adminService.listUnifiedHosts({
    search,
    accountStatus,
    applicationStatus,
    onboardingStage,
    verificationStatus,
    complianceStatus,
    reviewerId,
    dateRange,
    sortBy,
    sortOrder,
    skip,
    take: pageSize,
  });

  return ok({
    data: result.items,
    pagination: {
      page: result.page,
      pageSize,
      total: result.total,
      totalPages: result.totalPages,
    },
    analytics: result.analytics,
  });
});
