import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { reviewService } from "@/services/review.service";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/listings/[id]/reviews/stats
// Get review statistics (average rating, count, breakdown)
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const stats = await reviewService.getReviewStats(id);
  return ok(stats);
});
