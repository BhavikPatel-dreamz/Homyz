import { NextRequest } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { revenueAnalyticsService } from "@/services/admin-analytics/revenue.service";
import type { AnalyticsFilterInput } from "@/services/admin-analytics/analytics-contracts";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  await requireApiRole(req, [Role.ADMIN]);

  const { searchParams } = new URL(req.url);
  const input: AnalyticsFilterInput = {
    period: (searchParams.get("period") as any) || undefined,
    startDate: searchParams.get("startDate") || undefined,
    endDate: searchParams.get("endDate") || undefined,
    comparisonMode: (searchParams.get("comparisonMode") as any) || undefined,
    listingId: searchParams.get("listingId") || undefined,
    hostId: searchParams.get("hostId") || undefined,
    city: searchParams.get("city") || undefined,
    country: searchParams.get("country") || undefined,
    currency: searchParams.get("currency") || undefined,
  };

  const response = await revenueAnalyticsService.getRevenueAnalytics(input);
  return ok(response);
});

