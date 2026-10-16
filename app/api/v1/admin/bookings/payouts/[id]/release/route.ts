import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { payoutService } from "@/services/payout.service";

export const dynamic = "force-dynamic";

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.PAYOUTS_VIEW,
    PERMISSIONS.BOOKINGS_VIEW,
  ]);

  const { id } = await params;
  const bookingId = id.startsWith("po_") ? id.replace("po_", "") : id;

  const body = await req.json();
  const reason: string = body.reason;

  const result = await payoutService.releasePayout(actor, bookingId, { reason });
  return ok(result);
});

