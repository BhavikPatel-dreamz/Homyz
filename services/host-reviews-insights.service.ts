import "server-only";

import { prisma } from "@/lib/db/prisma";
import { ReviewDirection, ReviewStatus } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import { AppError } from "@/lib/api/errors";
import { reviewService } from "@/services/review.service";
import { resolveReportingPeriod, type DateRangePreset } from "@/lib/dashboard/reporting-filter";

export interface HostReviewsFilterOptions {
  listingId?: string | null;
  period?: DateRangePreset;
  startDate?: string;
  endDate?: string;
  rating?: number;
  repliedStatus?: "all" | "replied" | "unreplied";
  category?: "cleanliness" | "accuracy" | "checkIn" | "communication" | "location" | "value";
  search?: string;
  sort?: "recent" | "oldest" | "highest" | "lowest";
  page?: number;
  limit?: number;
}

export interface HostReviewItemDTO {
  id: string;
  listingId: string;
  listingTitle: string;
  bookingId: string | null;
  rating: number;
  cleanlinessRating: number | null;
  accuracyRating: number | null;
  checkInRating: number | null;
  communicationRating: number | null;
  locationRating: number | null;
  valueRating: number | null;
  comment: string;
  privateNoteToHost?: string;
  topics: string[];
  status: ReviewStatus;
  createdAt: string;
  author: {
    id: string;
    name: string;
    image: string | null;
  };
  booking?: {
    id: string;
    startDate: string;
    endDate: string;
    guests: number;
  } | null;
  response: {
    id: string;
    comment: string;
    createdAt: string;
    author: {
      id: string;
      name: string;
      image: string | null;
    };
  } | null;
}

export interface HostReviewsOverviewData {
  overallRating: number | null;
  totalReviewsCount: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  categoryRatings: {
    cleanliness: { average: number | null; count: number };
    accuracy: { average: number | null; count: number };
    checkIn: { average: number | null; count: number };
    communication: { average: number | null; count: number };
    location: { average: number | null; count: number };
    value: { average: number | null; count: number };
  };
  trends: Array<{
    monthKey: string;
    label: string;
    averageRating: number | null;
    reviewCount: number;
  }>;
  qualitySummary: {
    strengths: string[];
    areasForImprovement: string[];
    unansweredCount: number;
    lowRatingsCount: number;
  };
}

export const hostReviewsInsightsService = {
  /**
   * Calculates authoritative reviews overview, distributions, categories, and trends.
   */
  async getReviewsOverview(
    hostId: string,
    options: Pick<HostReviewsFilterOptions, "listingId" | "period" | "startDate" | "endDate"> = {},
  ): Promise<HostReviewsOverviewData> {
    const listings = await prisma.listing.findMany({
      where: { hostId },
      select: { id: true },
    });
    const hostListingIds = listings.map((l) => l.id);
    if (options.listingId && !hostListingIds.includes(options.listingId)) {
      throw AppError.forbidden("Listing not found or access denied for this host.");
    }
    const scopedListingIds = options.listingId ? [options.listingId] : hostListingIds;

    let dateWhere: { gte?: Date; lte?: Date } | undefined;
    if (options.period) {
      const resolved = resolveReportingPeriod({
        period: options.period,
        startDate: options.startDate,
        endDate: options.endDate,
      });
      dateWhere = {
        gte: resolved.startDate,
        lte: resolved.endDate,
      };
    }

    const baseWhere: Prisma.ReviewWhereInput = {
      listingId: { in: scopedListingIds },
      direction: ReviewDirection.GUEST_TO_PROPERTY,
      status: ReviewStatus.PUBLISHED,
    };
    const trendStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - 11, 1));
    const [reviews, trendReviews] = await Promise.all([
      prisma.review.findMany({
        where: { ...baseWhere, ...(dateWhere ? { createdAt: dateWhere } : {}) },
        select: {
          id: true,
          rating: true,
          cleanlinessRating: true,
          accuracyRating: true,
          checkInRating: true,
          communicationRating: true,
          locationRating: true,
          valueRating: true,
          createdAt: true,
          response: { select: { id: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.review.findMany({
        where: { ...baseWhere, createdAt: { gte: trendStart } },
        select: { rating: true, createdAt: true },
      }),
    ]);

    const totalReviewsCount = reviews.length;
    const ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let ratingSum = 0;

    const categorySums = {
      cleanliness: { sum: 0, count: 0 },
      accuracy: { sum: 0, count: 0 },
      checkIn: { sum: 0, count: 0 },
      communication: { sum: 0, count: 0 },
      location: { sum: 0, count: 0 },
      value: { sum: 0, count: 0 },
    };

    let unansweredCount = 0;
    let lowRatingsCount = 0;

    for (const r of reviews) {
      ratingSum += r.rating;
      if (r.rating >= 1 && r.rating <= 5) {
        ratingDistribution[r.rating as 1 | 2 | 3 | 4 | 5]++;
      }
      if (r.rating < 4) {
        lowRatingsCount++;
      }
      if (!r.response) {
        unansweredCount++;
      }

      if (r.cleanlinessRating) {
        categorySums.cleanliness.sum += r.cleanlinessRating;
        categorySums.cleanliness.count++;
      }
      if (r.accuracyRating) {
        categorySums.accuracy.sum += r.accuracyRating;
        categorySums.accuracy.count++;
      }
      if (r.checkInRating) {
        categorySums.checkIn.sum += r.checkInRating;
        categorySums.checkIn.count++;
      }
      if (r.communicationRating) {
        categorySums.communication.sum += r.communicationRating;
        categorySums.communication.count++;
      }
      if (r.locationRating) {
        categorySums.location.sum += r.locationRating;
        categorySums.location.count++;
      }
      if (r.valueRating) {
        categorySums.value.sum += r.valueRating;
        categorySums.value.count++;
      }
    }

    const overallRating = totalReviewsCount > 0
      ? Math.round((ratingSum / totalReviewsCount) * 100) / 100
      : null;

    const roundAvg = (cat: { sum: number; count: number }) =>
      cat.count > 0 ? Math.round((cat.sum / cat.count) * 10) / 10 : null;

    const categoryRatings = {
      cleanliness: { average: roundAvg(categorySums.cleanliness), count: categorySums.cleanliness.count },
      accuracy: { average: roundAvg(categorySums.accuracy), count: categorySums.accuracy.count },
      checkIn: { average: roundAvg(categorySums.checkIn), count: categorySums.checkIn.count },
      communication: { average: roundAvg(categorySums.communication), count: categorySums.communication.count },
      location: { average: roundAvg(categorySums.location), count: categorySums.location.count },
      value: { average: roundAvg(categorySums.value), count: categorySums.value.count },
    };

    // Calculate 12-month trends
    const now = new Date();
    const trends: HostReviewsOverviewData["trends"] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const mStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      const mEnd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
      const mKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const label = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric", timeZone: "UTC" }).format(mStart);

      const mReviews = trendReviews.filter((r) => r.createdAt >= mStart && r.createdAt <= mEnd);
      const mCount = mReviews.length;
      const mAvg = mCount > 0
        ? Math.round((mReviews.reduce((sum, r) => sum + r.rating, 0) / mCount) * 10) / 10
        : null;

      trends.push({
        monthKey: mKey,
        label,
        averageRating: mAvg,
        reviewCount: mCount,
      });
    }

    // Determine non-AI feedback strengths and areas for improvement
    const strengths: string[] = [];
    const areasForImprovement: string[] = [];

    const categoryLabels: Record<keyof typeof categoryRatings, string> = {
      cleanliness: "Cleanliness",
      accuracy: "Listing accuracy",
      checkIn: "Check-in experience",
      communication: "Host communication",
      location: "Property location",
      value: "Value for price",
    };

    (Object.keys(categoryRatings) as Array<keyof typeof categoryRatings>).forEach((key) => {
      const cat = categoryRatings[key];
      if (cat.average !== null && cat.count >= 2) {
        if (cat.average >= 4.8) {
          strengths.push(`${categoryLabels[key]} (${cat.average.toFixed(1)} ★)`);
        } else if (cat.average < 4.5) {
          areasForImprovement.push(`${categoryLabels[key]} (${cat.average.toFixed(1)} ★)`);
        }
      }
    });

    return {
      overallRating,
      totalReviewsCount,
      ratingDistribution,
      categoryRatings,
      trends,
      qualitySummary: {
        strengths,
        areasForImprovement,
        unansweredCount,
        lowRatingsCount,
      },
    };
  },

  /**
   * Retrieves paginated, sorted, and filtered review records for authorized host listings.
   */
  async listHostReviews(
    hostId: string,
    options: HostReviewsFilterOptions = {},
  ): Promise<{
    reviews: HostReviewItemDTO[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const page = Math.max(1, Number(options.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(options.limit) || 10));
    const skip = (page - 1) * limit;

    const listings = await prisma.listing.findMany({
      where: { hostId },
      select: { id: true, title: true },
    });
    const hostListingIds = listings.map((l) => l.id);
    if (options.listingId && !hostListingIds.includes(options.listingId)) {
      throw AppError.forbidden("Listing not found or access denied for this host.");
    }
    const scopedListingIds = options.listingId ? [options.listingId] : hostListingIds;

    const where: Prisma.ReviewWhereInput = {
      listingId: { in: scopedListingIds },
      direction: ReviewDirection.GUEST_TO_PROPERTY,
      status: ReviewStatus.PUBLISHED,
    };

    if (typeof options.rating === "number" && options.rating >= 1 && options.rating <= 5) {
      where.rating = options.rating;
    }

    if (options.repliedStatus === "replied") {
      where.response = { isNot: null };
    } else if (options.repliedStatus === "unreplied") {
      where.response = null;
    }

    const categoryColumns = {
      cleanliness: "cleanlinessRating",
      accuracy: "accuracyRating",
      checkIn: "checkInRating",
      communication: "communicationRating",
      location: "locationRating",
      value: "valueRating",
    } as const;
    if (options.category) {
      const column = categoryColumns[options.category];
      if (column) where[column] = { not: null };
    }

    if (options.search?.trim()) {
      const term = options.search.trim();
      where.OR = [
        { comment: { contains: term, mode: "insensitive" } },
        { author: { name: { contains: term, mode: "insensitive" } } },
        { listing: { title: { contains: term, mode: "insensitive" } } },
      ];
    }

    if (options.period) {
      const resolved = resolveReportingPeriod({
        period: options.period,
        startDate: options.startDate,
        endDate: options.endDate,
      });
      where.createdAt = {
        gte: resolved.startDate,
        lte: resolved.endDate,
      };
    }

    let orderBy: Prisma.ReviewOrderByWithRelationInput | Prisma.ReviewOrderByWithRelationInput[] = { createdAt: "desc" };
    if (options.sort === "oldest") {
      orderBy = { createdAt: "asc" };
    } else if (options.sort === "highest") {
      orderBy = [{ rating: "desc" }, { createdAt: "desc" }];
    } else if (options.sort === "lowest") {
      orderBy = [{ rating: "asc" }, { createdAt: "desc" }];
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          author: { select: { id: true, name: true, image: true } },
          listing: { select: { id: true, title: true } },
          booking: { select: { id: true, startDate: true, endDate: true, guests: true } },
          response: {
            include: {
              author: { select: { id: true, name: true, image: true } },
            },
          },
        },
      }),
      prisma.review.count({ where }),
    ]);

    const formattedReviews: HostReviewItemDTO[] = reviews.map((r) => ({
      id: r.id,
      listingId: r.listingId || "",
      listingTitle: r.listing?.title || "Property",
      bookingId: r.bookingId,
      rating: r.rating,
      cleanlinessRating: r.cleanlinessRating,
      accuracyRating: r.accuracyRating,
      checkInRating: r.checkInRating,
      communicationRating: r.communicationRating,
      locationRating: r.locationRating,
      valueRating: r.valueRating,
      comment: r.comment,
      privateNoteToHost: r.privateNoteToHost || undefined,
      topics: r.topics,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      author: {
        id: r.author.id,
        name: r.author.name || "Guest",
        image: r.author.image,
      },
      booking: r.booking
        ? {
            id: r.booking.id,
            startDate: r.booking.startDate.toISOString(),
            endDate: r.booking.endDate.toISOString(),
            guests: r.booking.guests,
          }
        : null,
      response: r.response
        ? {
            id: r.response.id,
            comment: r.response.comment,
            createdAt: r.response.createdAt.toISOString(),
            author: {
              id: r.response.author.id,
              name: r.response.author.name || "Host",
              image: r.response.author.image,
            },
          }
        : null,
    }));

    return {
      reviews: formattedReviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  },

  /**
   * Retrieves single review details with host authorization validation.
   */
  async getHostReviewDetails(hostId: string, reviewId: string): Promise<HostReviewItemDTO> {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        author: { select: { id: true, name: true, image: true } },
        listing: { select: { id: true, title: true, hostId: true } },
        booking: { select: { id: true, startDate: true, endDate: true, guests: true } },
        response: {
          include: {
            author: { select: { id: true, name: true, image: true } },
          },
        },
      },
    });

    if (!review) throw AppError.notFound("Review not found");
    if (review.listing?.hostId !== hostId) {
      throw AppError.forbidden("You do not have permission to view this review.");
    }

    return {
      id: review.id,
      listingId: review.listingId || "",
      listingTitle: review.listing?.title || "Property",
      bookingId: review.bookingId,
      rating: review.rating,
      cleanlinessRating: review.cleanlinessRating,
      accuracyRating: review.accuracyRating,
      checkInRating: review.checkInRating,
      communicationRating: review.communicationRating,
      locationRating: review.locationRating,
      valueRating: review.valueRating,
      comment: review.comment,
      privateNoteToHost: review.privateNoteToHost || undefined,
      topics: review.topics,
      status: review.status,
      createdAt: review.createdAt.toISOString(),
      author: {
        id: review.author.id,
        name: review.author.name || "Guest",
        image: review.author.image,
      },
      booking: review.booking
        ? {
            id: review.booking.id,
            startDate: review.booking.startDate.toISOString(),
            endDate: review.booking.endDate.toISOString(),
            guests: review.booking.guests,
          }
        : null,
      response: review.response
        ? {
            id: review.response.id,
            comment: review.response.comment,
            createdAt: review.response.createdAt.toISOString(),
            author: {
              id: review.response.author.id,
              name: review.response.author.name || "Host",
              image: review.response.author.image,
            },
          }
        : null,
    };
  },

  /**
   * Submits a host public response to a guest review.
   */
  async replyToReview(hostId: string, reviewId: string, comment: string) {
    const detail = await this.getHostReviewDetails(hostId, reviewId);
    if (detail.response) {
      throw AppError.conflict("A response has already been submitted for this review.");
    }

    return reviewService.createReviewResponse({
      reviewId,
      authorId: hostId,
      comment,
    });
  },
};
