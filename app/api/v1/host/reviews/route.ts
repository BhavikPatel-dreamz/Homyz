import { z } from "zod";
import { ReviewDirection } from "@/generated/prisma/enums";
import { apiHandler } from "@/lib/api/handler";
import { created, ok } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/permissions/guards";
import { prisma } from "@/lib/db/prisma";
import { evaluateHostReviewEligibility } from "@/lib/booking/review-eligibility";
import { reviewService } from "@/services/review.service";

const createHostReviewSchema = z.object({
  bookingId: z.string().min(1, "Booking ID is required"),
  rating: z.number().int().min(1).max(5).optional(),
  cleanlinessRating: z.number().int().min(1).max(5).optional(),
  communicationRating: z.number().int().min(1).max(5).optional(),
  houseRulesRating: z.number().int().min(1).max(5).optional(),
  comment: z.string().trim().max(5000).optional(),
  publicReview: z.string().trim().max(5000).optional(),
  privateNoteToGuest: z.string().trim().max(5000).optional(),
  privateNote: z.string().trim().max(5000).optional(),
  recommendGuest: z.boolean().default(true),
});

// GET /api/v1/host/reviews?bookingId=... — check host review eligibility
export const GET = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const bookingId = req.nextUrl.searchParams.get("bookingId");
  if (!bookingId) {
    return ok({ error: "bookingId query param required" }, 400);
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      listing: { select: { hostId: true, checkOutTime: true } },
    },
  });

  if (!booking) {
    return ok({ error: "Booking not found" }, 404);
  }

  const existingReview = await prisma.review.findFirst({
    where: { bookingId, direction: ReviewDirection.HOST_TO_GUEST },
  });

  const guestReview = await prisma.review.findFirst({
    where: { bookingId, direction: ReviewDirection.GUEST_TO_PROPERTY },
  });

  const isHost = booking.listing?.hostId === actor.id;
  const eligibility = evaluateHostReviewEligibility({
    isHost,
    bookingStatus: booking.status,
    endDate: booking.endDate,
    checkOutTime: booking.listing?.checkOutTime,
    hasHostReview: Boolean(existingReview),
    hasGuestReview: Boolean(guestReview),
  });

  return ok({
    ...eligibility,
    existingReview: existingReview
      ? {
          id: existingReview.id,
          rating: existingReview.rating,
          status: existingReview.status,
          submittedAt: existingReview.submittedAt,
          publishedAt: existingReview.publishedAt,
          comment: existingReview.comment,
        }
      : null,
  });
});

// POST /api/v1/host/reviews — submit host review for guest
export const POST = apiHandler(async (req) => {
  const actor = await requireApiAuth(req);
  const input = createHostReviewSchema.parse(await req.json());

  const categoryRatings: Record<string, number> = {};
  if (input.cleanlinessRating) categoryRatings.cleanliness = input.cleanlinessRating;
  if (input.communicationRating) categoryRatings.communication = input.communicationRating;

  const subRatings = [
    input.cleanlinessRating,
    input.houseRulesRating,
    input.communicationRating,
  ].filter((r): r is number => typeof r === "number" && r >= 1 && r <= 5);

  const finalRating =
    input.rating ??
    (subRatings.length > 0
      ? Math.round(subRatings.reduce((a, b) => a + b, 0) / subRatings.length)
      : 5);

  const comment = input.comment ?? input.publicReview ?? "";
  const privateNoteToGuest = input.privateNoteToGuest ?? input.privateNote ?? "";

  const review = await reviewService.createReview({
    bookingId: input.bookingId,
    authorId: actor.id,
    direction: ReviewDirection.HOST_TO_GUEST,
    rating: finalRating,
    houseRulesRating: input.houseRulesRating,
    comment,
    privateNoteToGuest,
    recommendGuest: input.recommendGuest,
    categoryRatings,
  });

  return created(review);
});
