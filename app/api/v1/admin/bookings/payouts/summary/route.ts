import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { paymentAdminService } from "@/services/payment-admin.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.PAYOUTS_VIEW,
    PERMISSIONS.PAYMENTS_VIEW,
    PERMISSIONS.BOOKINGS_VIEW,
  ]);

  const summary = await paymentAdminService.getPayoutSummaryForAdmin(actor);
  return ok(summary);
});
