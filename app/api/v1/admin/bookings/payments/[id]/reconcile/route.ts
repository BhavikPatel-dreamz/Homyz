import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { paymentAdminService } from "@/services/payment-admin.service";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.PAYMENTS_MANAGE,
  ]);

  const { id } = await params;
  const result = await paymentAdminService.reconcilePaymentForAdmin(actor, id);
  return ok(result);
});
