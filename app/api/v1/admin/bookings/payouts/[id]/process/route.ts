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

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // body optional
  }

  const result = await payoutService.processPayoutSettlement(actor, bookingId, {
    idempotencyKey: body.idempotencyKey,
    settlementReference: body.settlementReference,
    channel: body.channel,
  });

  return ok(result);
});

