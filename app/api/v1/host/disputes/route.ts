import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { disputeService } from "@/services/dispute.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req) => {
  const actor = await requireApiRole(req, [Role.HOST]);
  const params = req.nextUrl.searchParams;
  return ok(await disputeService.listDisputesForHost(actor, {
    page: Number(params.get("page")) || 1,
    limit: Number(params.get("limit")) || 20,
    tab: (params.get("tab") as "all" | "response_required" | "open" | "resolved" | null) || undefined,
    search: params.get("search") || undefined,
    propertyId: params.get("propertyId") || undefined,
    status: params.get("status") || undefined,
    startDate: params.get("startDate") || undefined,
    endDate: params.get("endDate") || undefined,
    bookingId: params.get("bookingId") || undefined,
  }));
});
