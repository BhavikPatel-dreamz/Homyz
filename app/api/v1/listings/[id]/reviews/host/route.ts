import { apiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import { ok } from "@/lib/api/response";
import { getSessionUser } from "@/lib/auth/session";
import { reviewService } from "@/services/review.service";
import { prisma } from "@/lib/db/prisma";
import { ListingCoHostStatus } from "@/generated/prisma/enums";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/v1/listings/[id]/reviews/host?page=1&limit=6
// Host or accepted co-host can view reviews for their listings including private notes
export const GET = apiHandler(async (req, ctx: Ctx) => {
  const actor = await getSessionUser();
  if (!actor) throw AppError.unauthorized();

  const { id } = await ctx.params;
  const bookingId = req.nextUrl.searchParams.get("bookingId")?.trim();

  // Verify the user owns this listing OR is an accepted co-host
  const listing = await prisma.listing.findFirst({
    where: { id },
    select: { id: true, hostId: true },
  });
  if (!listing) throw AppError.notFound("Listing not found");

  const isOwner = listing.hostId === actor.id;
  const isCoHost = !isOwner
    ? await prisma.listingCoHost.findFirst({
        where: {
          listingId: id,
          userId: actor.id,
          status: ListingCoHostStatus.ACCEPTED,
        },
        select: { id: true },
      }).then(Boolean)
    : false;

  if (bookingId) {
    if (bookingId.length > 128) throw AppError.badRequest("Invalid booking ID");
    const booking = await prisma.booking.findFirst({
      where: { id: bookingId, listingId: id },
      select: { id: true, userId: true },
    });
    if (!booking) throw AppError.notFound("Booking not found");

    // The private note is visible only to a listing owner/accepted co-host or
    // the guest who authored the booking review. Public listing APIs never use
    // this branch and never return privateNoteToHost.
    const isReviewAuthor = booking.userId === actor.id;
    if (!isOwner && !isCoHost && !isReviewAuthor) {
      throw AppError.forbidden("You do not have access to this review");
    }

    const review = await prisma.review.findFirst({
      where: {
        bookingId: booking.id,
        listingId: id,
        authorId: booking.userId,
        status: "PUBLISHED",
      },
      select: {
        id: true,
        rating: true,
        cleanlinessRating: true,
        accuracyRating: true,
        checkInRating: true,
        communicationRating: true,
        locationRating: true,
        valueRating: true,
        comment: true,
        privateNoteToHost: true,
        topics: true,
        createdAt: true,
        author: { select: { id: true, name: true, image: true } },
      },
    });
    if (!review) throw AppError.notFound("Review not found");
    return ok({ review });
  }

  if (!isOwner && !isCoHost) {
    throw AppError.forbidden("You do not have access to this listing");
  }

  const { page, limit } = parsePagination(req.nextUrl.searchParams, {
    defaultLimit: 6,
    maxLimit: 24,
  });

  const result = await reviewService.getListingReviewsForHost(id, page, limit);
  return ok(result);
});
