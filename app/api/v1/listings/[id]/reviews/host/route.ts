import { apiHandler } from "@/lib/api/handler";
import { AppError } from "@/lib/api/errors";
import { buildPagination, parsePagination } from "@/lib/api/pagination";
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

  // Verify the user owns this listing OR is an accepted co-host
  const listing = await prisma.listing.findFirst({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!listing) throw AppError.notFound("Listing not found");

  const isOwner = listing.userId === actor.id;
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
