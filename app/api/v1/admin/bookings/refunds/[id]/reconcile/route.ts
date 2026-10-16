import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { refundService } from "@/services/refund.service";

type Ctx = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/admin/bookings/refunds/[id]/reconcile
 * Reconciles refund transaction consistency against provider and payment state.
 */
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await requireApiPermission(req, PERMISSIONS.PAYMENTS_VIEW);
  const { id } = await ctx.params;

  const result = await refundService.reconcileRefundForAdmin(actor, id);

  return ok(result);
});

