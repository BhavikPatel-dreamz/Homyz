import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { payoutService, HoldType } from "@/services/payout.service";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.PAYOUTS_VIEW,
    PERMISSIONS.BOOKINGS_VIEW,
  ]);

  const { id } = await params;
  const bookingId = id.startsWith("po_") ? id.replace("po_", "") : id;

  const body = await req.json();
  const holdType: HoldType = body.holdType || "MANUAL_ADMIN_HOLD";
  const reason: string = body.reason;

  const result = await payoutService.holdPayout(actor, bookingId, { holdType, reason });
  return ok(result);
});

