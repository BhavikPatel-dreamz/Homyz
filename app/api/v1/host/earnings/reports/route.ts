import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { hostReportingService } from "@/services/host-reporting.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
  const url = new URL(req.url);

  const rawYear = url.searchParams.get("year");
  const year = rawYear ? parseInt(rawYear, 10) : undefined;
  const listingId = url.searchParams.get("propertyId") || url.searchParams.get("listingId") || undefined;
  const currency = url.searchParams.get("currency") || undefined;

  const data = await hostReportingService.getReportsLanding(actor.id, {
    year: Number.isInteger(year) ? year : undefined,
    listingId,
    currency,
  });

  return NextResponse.json({ success: true, data });
});

