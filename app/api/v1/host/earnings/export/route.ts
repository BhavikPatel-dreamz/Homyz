import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { payoutService } from "@/services/payout.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const overview = await payoutService.getHostEarningsOverview(actor.id);

  const headers = [
    "Booking Reference",
    "Property Title",
    "Guest Name",
    "Check-In",
    "Check-Out",
    "Scheduled Payout Date",
    "Gross Earnings",
    "Platform Fee",
    "Net Payout",
    "Currency",
    "Status",
  ];

  const allPayouts = [...overview.upcomingPayouts, ...overview.completedPayouts];

  const rows = allPayouts.map((p) => [
    `"${p.bookingId}"`,
    `"${(p.listingTitle || "").replace(/"/g, '""')}"`,
    `"${p.guestName}"`,
    `"${new Date(p.startDate).toISOString().slice(0, 10)}"`,
    `"${new Date(p.endDate).toISOString().slice(0, 10)}"`,
    `"${new Date(p.scheduledPayoutDate).toISOString().slice(0, 10)}"`,
    `"${(p.grossEarnings / 100).toFixed(2)}"`,
    `"-${(p.platformFee / 100).toFixed(2)}"`,
    `"${(p.netPayout / 100).toFixed(2)}"`,
    `"${p.currency}"`,
    `"${p.status}"`,
  ]);

  const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const filename = `Host_Earnings_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
});

