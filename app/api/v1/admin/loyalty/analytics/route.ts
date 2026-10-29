import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getAdminLoyaltyAnalytics } from "@/services/admin-loyalty-analytics.service";
export const GET = apiHandler(async (req) => { await requireApiPermission(req, PERMISSIONS.LOYALTY_ANALYTICS_VIEW); const query = req.nextUrl.searchParams; return ok(await getAdminLoyaltyAnalytics({ from: query.get("from"), to: query.get("to") })); });
