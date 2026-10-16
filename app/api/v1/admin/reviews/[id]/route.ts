import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { ok } from "@/lib/api/response";
import { AppError } from "@/lib/api/errors";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { moderationService } from "@/services/moderation.service";
import { reviewService } from "@/services/review.service";

const moderateReviewSchema = z.object({
  action: z.enum(["HIDE", "RESTORE", "DELETE"]),
  reason: z.string().trim().max(1000).optional(),
  notes: z.string().trim().max(5000).optional(),
});

// GET /api/v1/admin/reviews/[id] — get review detail with relations
export const GET = apiHandler(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    await requireApiPermission(req, PERMISSIONS.REVIEWS_VIEW);
    const { id } = await ctx.params;
    const review = await reviewService.getReviewById(id);
    if (!review) throw AppError.notFound("Review not found");
    return ok(review);
  },
);

// PATCH /api/v1/admin/reviews/[id] — enforce through the canonical moderation case workflow.
export const PATCH = apiHandler(
  async (req, ctx: { params: Promise<{ id: string }> }) => {
    const { id } = await ctx.params;
    const input = moderateReviewSchema.parse(await req.json());

    const requiredPermission =
      input.action === "DELETE"
        ? PERMISSIONS.REVIEWS_DELETE
        : PERMISSIONS.REVIEWS_MODERATE;

    const actor = await requireApiPermission(req, requiredPermission);
    await requireApiPermission(req, PERMISSIONS.MODERATION_ENFORCEMENT_EXECUTE);

    const result = await moderationService.moderateReviewFromAdmin(actor, {
      reviewId: id,
      action: input.action,
      reason: input.reason,
      notes: input.notes,
    });

    return ok(result);
  },
);
