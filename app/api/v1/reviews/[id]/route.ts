import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiAuth } from "@/lib/permissions/guards";
import { reviewService } from "@/services/review.service";

const editReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().max(5000).optional(),
  privateNoteToHost: z.string().max(5000).optional(),
  privateNoteToGuest: z.string().max(5000).optional(),
  recommendGuest: z.boolean().optional(),
  houseRulesRating: z.number().int().min(1).max(5).optional(),
  categoryRatings: z
    .record(z.string(), z.number().int().min(1).max(5))
    .optional(),
});

// GET /api/v1/reviews/[id]
export const GET = apiHandler(
  async (_req, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const review = await reviewService.getReviewById(id);
    if (!review) throw AppError.notFound("Review not found");
    return ok(review);
  },
);

// PATCH /api/v1/reviews/[id] — edit review within blind review window
export const PATCH = apiHandler(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    const actor = await requireApiAuth(req);
    const { id } = await ctx.params;
    const body = editReviewSchema.parse(await req.json());

    const updated = await reviewService.updateReview(id, actor.id, body);
    return ok(updated);
  },
);

