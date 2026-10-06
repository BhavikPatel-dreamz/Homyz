import { z } from "zod";
import { apiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { buildPagination, parsePagination } from "@/lib/api/pagination";
import { created, paginated } from "@/lib/api/response";
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

// GET /api/v1/listings/[id]/reviews?page=1&limit=6&topic=Location
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const { id } = await ctx.params;
  const { page, limit } = parsePagination(req.nextUrl.searchParams, {
    defaultLimit: 6,
    maxLimit: 24,
  });
  const topic = req.nextUrl.searchParams.get("topic")?.trim() || undefined;
  if (topic && topic.length > 80) throw AppError.badRequest("Invalid review topic");

  const result = await reviewService.getListingReviews(id, page, limit, topic);
  return paginated(result.reviews, buildPagination(result.page, limit, result.total));
});

// POST /api/v1/listings/[id]/reviews
// A guest can submit one review for each confirmed stay that has ended.
// Supports Idempotency-Key header for duplicate detection on client retry.
export const POST = apiHandler(async (req, ctx: Ctx) => {
  const actor = await getSessionUser();
  if (!actor) throw AppError.unauthorized();

  const { id } = await ctx.params;
  const idempotencyKey = req.headers.get("idempotency-key");

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
      if (error.statusCode === 409) {
        // Duplicate review
        return created(
          { code: "DUPLICATE", message: "Review already submitted" },
          { statusCode: 409 }
        );
      }
      if (error.statusCode === 403) {
        // Booking not eligible
        return created(
          { code: "BOOKING_NOT_COMPLETED", message: error.message },
          { statusCode: 403 }
        );
      }
      if (error.statusCode === 400) {
        // Validation error
        return created(
          { code: "VALIDATION_ERROR", message: error.message },
          { statusCode: 400 }
        );
      }
    }
    throw error;
  }
});
