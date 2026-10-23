import { Role } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { getHostDashboardData } from "@/services/host-dashboard.service";
import type { DateRangePreset } from "@/lib/dashboard/reporting-filter";

// GET /api/v1/host/dashboard — Authoritative Host Dashboard analytics, earnings, Superhost & Guest Favorite signals
export const GET = apiHandler(async (request) => {
  const actor = await requireApiRole(request, [Role.HOST, Role.ADMIN]);
  const url = new URL(request.url);
  const listingId = url.searchParams.get("propertyId") || url.searchParams.get("listingId") || undefined;
  const period = (url.searchParams.get("period") as DateRangePreset) || undefined;
  const startDate = url.searchParams.get("startDate") || undefined;
  const endDate = url.searchParams.get("endDate") || undefined;
  const currency = url.searchParams.get("currency") || undefined;

  const dashboardData = await getHostDashboardData(actor, {
    listingId,
    period,
    startDate,
    endDate,
    currency,
  });
  const response = ok(dashboardData);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
});
