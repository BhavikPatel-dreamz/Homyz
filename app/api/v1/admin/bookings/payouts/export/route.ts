import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { payoutService } from "@/services/payout.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiPermission(req, [
    PERMISSIONS.PAYOUTS_VIEW,
    PERMISSIONS.BOOKINGS_VIEW,
  ]);

  const { searchParams } = new URL(req.url);
  const idsParam = searchParams.get("ids");
  const bookingIds = idsParam ? idsParam.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  const csvContent = await payoutService.exportBatchSettlementCSV(actor, bookingIds);

  const filename = `SARIE_Host_Payouts_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});

