import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { payoutService } from "@/services/payout.service";

export const dynamic = "force-dynamic";

// Generating this file marks payout distributions as EXPORTED. Keep it a POST
// action so navigation, crawlers, and browser prefetching cannot mutate
// settlement state.
export const POST = apiHandler(async (req: NextRequest) => {
  // Exporting creates settlement records, so it is a payout mutation rather
  // than a view-only report download.
  const actor = await requireApiPermission(req, PERMISSIONS.PAYOUTS_MANAGE);

  let bookingIds: string[] | undefined;
  try {
    const body = await req.json();
    if (Array.isArray(body.bookingIds)) {
      bookingIds = body.bookingIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0);
    }
  } catch {
    // An empty request body exports all eligible distributions.
  }

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
