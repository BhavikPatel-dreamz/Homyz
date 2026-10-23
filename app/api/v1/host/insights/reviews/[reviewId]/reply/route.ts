import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { requireApiRole } from "@/lib/permissions/guards";
import { Role } from "@/generated/prisma/enums";
import { hostReviewsInsightsService } from "@/services/host-reviews-insights.service";

export const dynamic = "force-dynamic";

const replySchema = z.object({
  comment: z
    .string()
    .trim()
    .min(2, "Response must be at least 2 characters")
    .max(2000, "Response cannot exceed 2000 characters"),
});

export const POST = apiHandler(
  async (req: NextRequest, ctx: { params: Promise<{ reviewId: string }> }) => {
    const actor = await requireApiRole(req, [Role.HOST, Role.ADMIN]);
    const { reviewId } = await ctx.params;
    const body = replySchema.parse(await req.json());

    const result = await hostReviewsInsightsService.replyToReview(actor.id, reviewId, body.comment);

    return NextResponse.json({
      success: true,
      data: result,
    });
  },
);

