import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { reviewService } from "@/services/review.service";

const responseSchema = z.object({
  comment: z.string().trim().min(2, "Response must be at least 2 characters").max(2000, "Response cannot exceed 2000 characters"),
});

// POST /api/v1/reviews/[id]/response — post public response to a published review
export const POST = apiHandler(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireApiAuth(req);
    const { id } = await ctx.params;
    const body = responseSchema.parse(await req.json());

    const response = await reviewService.createReviewResponse({
      reviewId: id,
      authorId: actor.id,
      comment: body.comment,
    });

    return ok(response);
  },
);

