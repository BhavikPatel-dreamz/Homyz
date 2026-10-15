import { ReviewDirection, ReviewStatus } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { paginated } from "@/lib/api/response";
import { requireApiPermission } from "@/lib/permissions/guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { reviewService } from "@/services/review.service";

// GET /api/v1/admin/reviews — admin review moderation queue & management
export const GET = apiHandler(async (req) => {
  await requireApiPermission(req, PERMISSIONS.REVIEWS_VIEW);
  const sp = req.nextUrl.searchParams;

  const rawDirection = sp.get("direction");
  const rawStatus = sp.get("status");
  const rawRating = sp.get("rating");

  const direction =
    rawDirection && Object.values(ReviewDirection).includes(rawDirection as ReviewDirection)
      ? (rawDirection as ReviewDirection)
      : undefined;

  const status =
    rawStatus && Object.values(ReviewStatus).includes(rawStatus as ReviewStatus)
      ? (rawStatus as ReviewStatus)
      : undefined;

  const rating = rawRating ? parseInt(rawRating, 10) : undefined;

  const result = await reviewService.adminGetReviews({
    page: Number(sp.get("page")) || 1,
    pageSize: Number(sp.get("pageSize") || sp.get("limit")) || 20,
    direction,
    status,
    rating: Number.isFinite(rating) ? rating : undefined,
    search: sp.get("search") || undefined,
    flagged: sp.get("flagged") === "true" || sp.get("flagged") === "1",
    dateFrom: sp.get("dateFrom") || undefined,
    dateTo: sp.get("dateTo") || undefined,
  });

  return paginated(result.reviews, {
    page: result.page,
    limit: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  });
});

