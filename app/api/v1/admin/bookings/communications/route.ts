import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { communicationAdminService } from "@/services/communication-admin.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.COMMUNICATIONS_VIEW,
    PERMISSIONS.BOOKINGS_VIEW,
  ]);

  const { searchParams } = new URL(req.url);
  const result = await communicationAdminService.listBookingConversationsForAdmin(actor, {
    page: Number(searchParams.get("page")) || 1,
    limit: Number(searchParams.get("limit")) || 20,
    search: searchParams.get("search") || undefined,
    type: searchParams.get("type") || undefined,
    status: searchParams.get("status") || undefined,
    listingId: searchParams.get("listingId") || undefined,
    hostId: searchParams.get("hostId") || undefined,
    guestId: searchParams.get("guestId") || undefined,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    sortBy: (searchParams.get("sortBy") as any) || "lastMessageAt",
    sortOrder: (searchParams.get("sortOrder") as any) || "desc",
  });

  return ok(result);
});

