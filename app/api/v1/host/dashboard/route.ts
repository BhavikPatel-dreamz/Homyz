import { Role } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { getHostDashboardData } from "@/services/host-dashboard.service";

// GET /api/v1/host/dashboard — Authoritative Host Dashboard analytics, earnings, Superhost & Guest Favorite signals
export const GET = apiHandler(async (request) => {
  const actor = await requireApiRole(request, [Role.HOST, Role.ADMIN]);
  const url = new URL(request.url);
  const listingId = url.searchParams.get("listingId") || undefined;
  const dashboardData = await getHostDashboardData(actor, { listingId });
  return ok(dashboardData);
});

