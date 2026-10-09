import { Role } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { getHostWorkspace } from "@/services/host-workspace.service";
import type { ReservationPeriod } from "@/lib/booking/host-reservation-events";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// GET /api/v1/host/workspace — refresh the authenticated host's dashboard data.
export const GET = apiHandler(async (request) => {
  const actor = await requireApiRole(request, [Role.HOST, Role.ADMIN]);
  const searchParams = request.nextUrl.searchParams;
  const includeCancelled = searchParams.get("includeCancelled") === "1" || searchParams.get("includeCancelled") === "true";
  const tab = (searchParams.get("tab") as ReservationPeriod) || undefined;
  const propertyId = searchParams.get("propertyId") || searchParams.get("listingId") || undefined;
  const page = searchParams.has("page") ? Math.max(1, parseInt(searchParams.get("page")!, 10) || 1) : undefined;
  const limit = searchParams.has("limit") ? Math.max(1, parseInt(searchParams.get("limit")!, 10) || 12) : undefined;

  const workspace = (tab !== undefined || page !== undefined || propertyId !== undefined || limit !== undefined)
    ? await getHostWorkspace(actor, {
        includeCancelled,
        tab,
        propertyId,
        page,
        limit,
      })
    : await getHostWorkspace(actor, { includeCancelled });

  return ok(workspace);
});
