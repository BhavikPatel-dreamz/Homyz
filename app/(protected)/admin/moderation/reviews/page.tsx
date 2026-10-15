import { ReviewDirection, ReviewStatus } from "@/generated/prisma/enums";
import { requirePagePermission } from "@/lib/permissions/page-guards";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { reviewService } from "@/services/review.service";
import { AdminReviewsClient } from "./admin-reviews-client";
import type { AdminReviewItem } from "./admin-review-detail-modal";

export const dynamic = "force-dynamic";

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requirePagePermission(PERMISSIONS.REVIEWS_VIEW);
  const sp = await searchParams;

  const rawDirection = sp.direction;
  const rawStatus = sp.status;
  const rawRating = sp.rating;

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
    page: Number(sp.page) || 1,
    pageSize: Number(sp.pageSize || sp.limit) || 20,
    direction,
    status,
    rating: Number.isFinite(rating) ? rating : undefined,
    search: sp.search,
    flagged: sp.flagged === "true" || sp.flagged === "1",
    dateFrom: sp.dateFrom,
    dateTo: sp.dateTo,
  });

  const reviews: AdminReviewItem[] = result.reviews.map((r: any) => ({
    id: r.id,
    direction: r.direction as "GUEST_TO_PROPERTY" | "HOST_TO_GUEST",
    status: r.status as AdminReviewItem["status"],
    rating: r.rating,
    cleanlinessRating: r.cleanlinessRating,
    accuracyRating: r.accuracyRating,
    checkInRating: r.checkInRating,
    communicationRating: r.communicationRating,
    locationRating: r.locationRating,
    valueRating: r.valueRating,
    houseRulesRating: r.houseRulesRating,
    comment: r.comment,
    privateNoteToHost: r.privateNoteToHost,
    privateNoteToGuest: r.privateNoteToGuest,
    recommendGuest: r.recommendGuest,
    submittedAt: r.submittedAt.toISOString(),
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null,
    reviewDeadline: r.reviewDeadline ? r.reviewDeadline.toISOString() : null,
    editDeadline: r.editDeadline ? r.editDeadline.toISOString() : null,
    moderatedAt: r.moderatedAt ? r.moderatedAt.toISOString() : null,
    rejectionReason: r.rejectionReason,
    moderationNotes: r.moderationNotes,
    author: {
      id: r.author.id,
      name: r.author.name,
      email: r.author.email,
      image: r.author.image,
      role: r.author.role,
    },
    targetUser: r.targetUser
      ? {
          id: r.targetUser.id,
          name: r.targetUser.name,
          email: r.targetUser.email,
          image: r.targetUser.image,
          role: r.targetUser.role,
        }
      : null,
    listing: r.listing
      ? {
          id: r.listing.id,
          title: r.listing.title,
          city: r.listing.city,
          country: r.listing.country,
        }
      : null,
    booking: r.booking
      ? {
          id: r.booking.id,
          startDate: r.booking.startDate.toISOString(),
          endDate: r.booking.endDate.toISOString(),
          status: r.booking.status,
        }
      : null,
    response: r.response
      ? {
          id: r.response.id,
          comment: r.response.comment,
          createdAt: r.response.createdAt.toISOString(),
          author: {
            name: r.response.author.name,
            image: r.response.author.image,
          },
        }
      : null,
    moderationCase: r.moderationCase
      ? {
          id: r.moderationCase.id,
          caseReference: r.moderationCase.caseReference,
          status: r.moderationCase.status,
          severity: r.moderationCase.severity,
        }
      : null,
  }));

  return (
    <main className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <AdminReviewsClient
        initialReviews={reviews}
        initialPagination={{
          page: result.page,
          limit: result.pageSize,
          total: result.total,
          totalPages: result.totalPages,
        }}
        initialFilters={{
          direction: sp.direction,
          status: sp.status,
          rating: sp.rating,
          search: sp.search,
          flagged: sp.flagged,
          dateFrom: sp.dateFrom,
          dateTo: sp.dateTo,
        }}
      />
    </main>
  );
}

