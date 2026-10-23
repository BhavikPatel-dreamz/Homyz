import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { hostReportingService } from "@/services/host-reporting.service";
import { AppError } from "@/lib/api/errors";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const url = new URL(req.url);

  const rawYear = url.searchParams.get("year");
  const rawMonth = url.searchParams.get("month");
  const year = rawYear ? parseInt(rawYear, 10) : new Date().getUTCFullYear();
  const month = rawMonth ? parseInt(rawMonth, 10) : new Date().getUTCMonth() + 1;

  if (month < 1 || month > 12) {
    throw AppError.badRequest("Month must be between 1 and 12.");
  }

  const listingId = url.searchParams.get("propertyId") || url.searchParams.get("listingId") || undefined;
  const currency = url.searchParams.get("currency") || undefined;

  const data = await hostReportingService.getMonthlyReport(actor.id, year, month, {
    listingId,
    currency,
  });

  return NextResponse.json({ success: true, data });
});
