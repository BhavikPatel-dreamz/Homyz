import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getLoyaltyDeliveryDiagnostics } from "@/services/admin-loyalty-delivery.service";
export const GET = apiHandler(async (req) => { await requireApiPermission(req, [PERMISSIONS.LOYALTY_ANALYTICS_VIEW, PERMISSIONS.BACKGROUND_JOBS_VIEW]); const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50); return ok(await getLoyaltyDeliveryDiagnostics(limit)); });
