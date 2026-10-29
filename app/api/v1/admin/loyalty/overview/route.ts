import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getAdminLoyaltyOverview } from "@/services/admin-loyalty-overview.service";

export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.LOYALTY_OVERVIEW_VIEW);
  const query = req.nextUrl.searchParams;
  try { return ok(await getAdminLoyaltyOverview({ from: query.get("from"), to: query.get("to") })); }
  catch (error) { throw AppError.validation(error instanceof Error ? error.message : "Invalid date range."); }
});
