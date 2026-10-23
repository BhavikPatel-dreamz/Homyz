import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { hostInsightsService } from "@/services/host-insights.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(async (req: NextRequest) => {
  const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);

  const data = await hostInsightsService.getInsights(actor, {
    tab: "superhost",
  });

  return NextResponse.json({
    success: true,
    data: {
      superhost: data.superhost,
      reportingPeriod: data.reportingPeriod,
    },
  });
});

