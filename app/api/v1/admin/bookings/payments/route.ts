import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { paymentAdminService } from "@/services/payment-admin.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.BOOKINGS_VIEW,
  ]);

  const { searchParams } = new URL(req.url);
  const result = await paymentAdminService.listPaymentsForAdmin(actor, {
    page: Number(searchParams.get("page")) || 1,
    limit: Number(searchParams.get("limit")) || 20,
    tab: searchParams.get("tab") || undefined,
    search: searchParams.get("search") || undefined,
    status: searchParams.get("status") || undefined,
    provider: searchParams.get("provider") || undefined,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    sortBy: (searchParams.get("sortBy") as any) || "createdAt",
    sortOrder: (searchParams.get("sortOrder") as any) || "desc",
  });

  return ok(result);
});
