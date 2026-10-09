import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { buildPagination, parsePagination } from "@/lib/api/pagination";
import { created, ok, paginated } from "@/lib/api/response";
import { getSessionUser } from "@/lib/auth/session";
import { reviewService } from "@/services/review.service";

type Ctx = { params: Promise<{ id: string }> };

const categoryRatingSchema = z.object({
  cleanliness: z.number().int().min(1).max(5).optional(),
  accuracy: z.number().int().min(1).max(5).optional(),
  checkIn: z.number().int().min(1).max(5).optional(),
  communication: z.number().int().min(1).max(5).optional(),
  location: z.number().int().min(1).max(5).optional(),
  value: z.number().int().min(1).max(5).optional(),
});

const createReviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(5000).default(""),
  privateNoteToHost: z.string().trim().max(5000).default(""),
  categoryRatings: categoryRatingSchema.optional(),
});

// GET /api/v1/listings/[id]/reviews?page=1&limit=6&topic=Location&mention=Pool&search=quiet&sort=recent
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { page, limit } = parsePagination(req.nextUrl.searchParams, {
    defaultLimit: 6,
    maxLimit: 24,
  });
  const topic = req.nextUrl.searchParams.get("topic")?.trim() || undefined;
  const mention = req.nextUrl.searchParams.get("mention")?.trim() || undefined;
  const search = req.nextUrl.searchParams.get("search")?.trim() || undefined;
  const sortParam = req.nextUrl.searchParams.get("sort")?.trim() || undefined;
  const ratingParam = req.nextUrl.searchParams.get("rating")?.trim() || undefined;

  const validSorts = ["relevant", "recent", "highest", "lowest"] as const;
  const allValidSorts = [...validSorts, "oldest"] as const;
  type ValidSort = (typeof allValidSorts)[number];
  const isSortValid = (val: string | undefined): val is ValidSort =>
    Boolean(val && (allValidSorts as readonly string[]).includes(val));
  const sort: ValidSort = isSortValid(sortParam) ? sortParam : "recent";

  let rating: number | undefined;
  if (ratingParam) {
    const parsed = Number.parseInt(ratingParam, 10);
    if (!Number.isNaN(parsed) && parsed >= 1 && parsed <= 5) {
      rating = parsed;
    } else {
      throw AppError.badRequest("Invalid rating filter");
    }
  }

  if (topic && topic.length > 80) throw AppError.badRequest("Invalid review topic");
  if (mention && mention.length > 80) throw AppError.badRequest("Invalid review mention");
  if (search && search.length > 200) throw AppError.badRequest("Search query is too long");

  const result = await reviewService.getListingReviews(id, {
    page,
    pageSize: limit,
    topic,
    mention,
    search,
    sort,
    rating,
  });
  return paginated(result.reviews, buildPagination(result.page, limit, result.total));
});

// POST /api/v1/listings/[id]/reviews
// A guest can submit one review for each confirmed stay that has ended.
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await getSessionUser();
  if (!actor) throw AppError.unauthorized();

  const { id } = await ctx.params;
  const input = createReviewSchema.parse(await req.json());
  try {
    const review = await reviewService.createReview({
      listingId: id,
      authorId: actor.id,
      ...input,
    });
    return created(review);
  } catch (error) {
    // Provide more specific error codes for frontend error categorization
    if (error instanceof AppError) {
      if (error.status === 409) {
        // Duplicate review
        return ok(
          { code: "DUPLICATE", message: "Review already submitted" },
          409,
        );
      }
      if (error.status === 403) {
        // Booking not eligible
        return ok(
          { code: "BOOKING_NOT_COMPLETED", message: error.message },
          403,
        );
      }
      if (error.status === 400) {
        // Validation error
        return ok(
          { code: "VALIDATION_ERROR", message: error.message },
          400,
        );
      }
    }
    throw error;
  }
});
