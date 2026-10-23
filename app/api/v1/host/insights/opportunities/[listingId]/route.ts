import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { hostOpportunitiesService } from "@/services/host-opportunities.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ listingId: string }> }) => {
    const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
    const { listingId } = await ctx.params;

    const data = await hostOpportunitiesService.getOpportunitiesOverview(actor, {
      listingId,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  },
);

