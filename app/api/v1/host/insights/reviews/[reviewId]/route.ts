import { NextRequest, NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { hostReviewsInsightsService } from "@/services/host-reviews-insights.service";

export const dynamic = "force-dynamic";

export const GET = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ reviewId: string }> }) => {
    const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
    const { reviewId } = await ctx.params;

    const review = await hostReviewsInsightsService.getHostReviewDetails(actor, reviewId);

    return NextResponse.json({
      success: true,
      data: review,
    });
  },
);
