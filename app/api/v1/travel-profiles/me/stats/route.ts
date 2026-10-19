import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiAuth } from "@/lib/permissions/guards";
import { travelStatsService } from "@/services/travel-stats.service";
import { travelBookingSyncService } from "@/services/travel-booking-sync.service";

export const dynamic = "force-dynamic";

/** Returns accurate travel statistics for the authenticated owner. */
export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  await travelBookingSyncService.syncUserAllBookings(actor.id);
  const stats = await travelStatsService.getTravelStats(actor.id);
  return NextResponse.json({ stats }, {
    headers: { "Cache-Control": "private, no-store" },
  });
});
