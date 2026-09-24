import { Prisma } from "@/generated/prisma/client";
import { BookingStatus } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { incrCounter } from "@/lib/redis/cache";
import { keys } from "@/lib/redis/keys";
import { toPublicReviewDTO, toReviewDTO, type PublicReviewDTO, type ReviewDTO } from "./mappers";

const REVIEWS_PAGE_SIZE = 6;

export const REVIEW_CATEGORY_KEYS = [
  "cleanliness",
  "accuracy",
  "checkIn",
  "communication",
  "location",
  "value",
] as const;

export type ReviewCategoryKey = (typeof REVIEW_CATEGORY_KEYS)[number];
export type ReviewCategoryRatings = Partial<Record<ReviewCategoryKey, number>>;
export type ReviewMention = { topic: string; count: number };

export type CreateReviewInput = {
  listingId: string;
  authorId: string;
  bookingId: string;
  rating: number;
  comment: string;
  categoryRatings?: ReviewCategoryRatings;
};

const TOPIC_KEYWORDS: Record<string, readonly string[]> = {
  Pool: ["pool", "swimming"],
  View: ["view", "views", "balcony", "scenery"],
  Location: ["location", "located", "neighborhood", "neighbourhood", "nearby"],
  Cleanliness: ["clean", "cleanliness", "spotless", "tidy"],
  Hospitality: ["hospitality", "welcoming", "welcome", "host"],
  Comfort: ["comfortable", "comfort", "cozy", "cosy"],
  "Indoor spaces": ["living room", "indoor", "spacious", "space"],
  Kitchen: ["kitchen", "cook", "cooking"],
  Parking: ["parking", "parked", "garage"],
  "Wi-Fi": ["wi-fi", "wifi", "internet"],
  Bed: ["bed", "beds", "mattress"],
  "Check-in": ["check-in", "check in", "arrival"],
  Communication: ["communication", "responsive", "response", "communicate"],
  Value: ["value", "worth", "price"],
  Amenities: ["amenities", "amenity", "facilities"],
};

function roundedAverage(value: number | null): number | undefined {
  return value === null ? undefined : Math.round(value * 100) / 100;
}

function extractTopics(comment: string): string[] {
  const normalized = comment.toLocaleLowerCase();
  if (!normalized) return [];

  return Object.entries(TOPIC_KEYWORDS)
    .filter(([, keywords]) => keywords.some((keyword) => normalized.includes(keyword)))
    .map(([topic]) => topic);
}

function categoryData(categoryRatings?: ReviewCategoryRatings) {
  return {
    cleanlinessRating: categoryRatings?.cleanliness,
    accuracyRating: categoryRatings?.accuracy,
    checkInRating: categoryRatings?.checkIn,
    communicationRating: categoryRatings?.communication,
    locationRating: categoryRatings?.location,
    valueRating: categoryRatings?.value,
  };
}

/** Database operations for the public, property-specific review experience. */
export const reviewService = {
  async hasReviewForBooking(bookingId: string): Promise<boolean> {
    const review = await prisma.review.findUnique({
      where: { bookingId },
      select: { id: true },
    });
    return Boolean(review);
  },

  async getListingReviews(
    listingId: string,
    page = 1,
    pageSize = REVIEWS_PAGE_SIZE,
    topic?: string,
  ): Promise<{
    reviews: PublicReviewDTO[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const safePage = Math.max(1, Math.trunc(page));
    const safePageSize = Math.min(Math.max(1, Math.trunc(pageSize)), 24);
    const where = {
      listingId,
      status: "PUBLISHED" as const,
      ...(topic ? { topics: { has: topic } } : {}),
    };

    const [total, reviews] = await prisma.$transaction([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        include: { author: { select: { id: true, name: true, image: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
    ]);

    return {
      reviews: reviews.map(toPublicReviewDTO),
      total,
      page: safePage,
      totalPages: Math.ceil(total / safePageSize),
    };
  },

  async getReviewStats(listingId: string): Promise<{
    averageRating: number | null;
    totalCount: number;
    ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
    categoryRatings: ReviewCategoryRatings;
    mentions: ReviewMention[];
  }> {
    const where = { listingId, status: "PUBLISHED" as const };
    const [aggregates, ratingGroups, topicGroups] = await Promise.all([
      prisma.review.aggregate({
        where,
        _count: { _all: true },
        _avg: {
          rating: true,
          cleanlinessRating: true,
          accuracyRating: true,
          checkInRating: true,
          communicationRating: true,
          locationRating: true,
          valueRating: true,
        },
      }),
      prisma.review.groupBy({ by: ["rating"], where, _count: { _all: true } }),
      prisma.$queryRaw(Prisma.sql`
        SELECT topic, COUNT(*)::int AS count
        FROM "Review", unnest("topics") AS topic
        WHERE "listingId" = ${listingId} AND "status" = 'PUBLISHED'
        GROUP BY topic
        HAVING COUNT(*) > 0
        ORDER BY count DESC, topic ASC
        LIMIT 12
      `) as Promise<ReviewMention[]>,
    ]);

    const ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const group of ratingGroups) {
      ratingDistribution[group.rating as 1 | 2 | 3 | 4 | 5] = group._count._all;
    }

    const categoryRatings: ReviewCategoryRatings = {};
    const averages = aggregates._avg;
    const categoryAverageMap: Record<ReviewCategoryKey, number | null> = {
      cleanliness: averages.cleanlinessRating,
      accuracy: averages.accuracyRating,
      checkIn: averages.checkInRating,
      communication: averages.communicationRating,
      location: averages.locationRating,
      value: averages.valueRating,
    };
    for (const key of REVIEW_CATEGORY_KEYS) {
      const average = roundedAverage(categoryAverageMap[key]);
      if (average !== undefined) categoryRatings[key] = average;
    }

    return {
      averageRating: aggregates._count._all ? roundedAverage(aggregates._avg.rating) ?? null : null,
      totalCount: aggregates._count._all,
      ratingDistribution,
      categoryRatings,
      mentions: topicGroups.map((topic) => ({ topic: topic.topic, count: Number(topic.count) })),
    };
  },

  async createReview(input: CreateReviewInput): Promise<PublicReviewDTO> {
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw AppError.validation("Rating must be an integer between 1 and 5");
    }
    for (const value of Object.values(input.categoryRatings ?? {})) {
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        throw AppError.validation("Category ratings must be integers between 1 and 5");
      }
    }

    const booking = await prisma.booking.findFirst({
      where: {
        id: input.bookingId,
        listingId: input.listingId,
        userId: input.authorId,
        status: BookingStatus.CONFIRMED,
        endDate: { lt: new Date() },
      },
      select: { id: true },
    });
    if (!booking) throw AppError.forbidden("You can review this property after a completed stay");

    const existing = await prisma.review.findUnique({ where: { bookingId: input.bookingId } });
    if (existing) throw AppError.conflict("A review has already been submitted for this stay");

    const review = await prisma.review.create({
      data: {
        listingId: input.listingId,
        authorId: input.authorId,
        bookingId: input.bookingId,
        rating: input.rating,
        comment: input.comment.trim(),
        topics: extractTopics(input.comment),
        ...categoryData(input.categoryRatings),
        status: "PUBLISHED",
      },
      include: { author: { select: { id: true, name: true, image: true } } },
    });
    await incrCounter(keys.listingsPublicVersion());
    return toPublicReviewDTO(review);
  },

  async getReviewById(reviewId: string): Promise<ReviewDTO | null> {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: { author: true },
    });
    return review ? toReviewDTO(review) : null;
  },

  async deleteReview(reviewId: string): Promise<void> {
    await prisma.review.update({ where: { id: reviewId }, data: { status: "DELETED" } });
    await incrCounter(keys.listingsPublicVersion());
  },

  async getUserReviews(userId: string): Promise<PublicReviewDTO[]> {
    const reviews = await prisma.review.findMany({
      where: { authorId: userId, status: "PUBLISHED" },
      include: { author: { select: { id: true, name: true, image: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return reviews.map(toPublicReviewDTO);
  },

  async getGuestReviews(authorId: string) {
    const reviews = await prisma.review.findMany({
      where: { authorId, status: "PUBLISHED" },
      include: {
        listing: {
          select: {
            id: true,
            title: true,
            photos: true,
            city: true,
            country: true,
            customSlug: true,
          },
        },
        booking: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return (reviews as any[]).map((r: any) => ({
      id: r.id,
      listingId: r.listingId,
      bookingId: r.bookingId,
      rating: r.rating,
      comment: r.comment,
      topics: r.topics,
      createdAt: (r.createdAt instanceof Date ? r.createdAt : new Date(r.createdAt)).toISOString(),
      listing: r.listing,
      booking: r.booking
        ? {
            id: r.booking.id,
            startDate: (r.booking.startDate instanceof Date ? r.booking.startDate : new Date(r.booking.startDate)).toISOString(),
            endDate: (r.booking.endDate instanceof Date ? r.booking.endDate : new Date(r.booking.endDate)).toISOString(),
          }
        : null,
    }));
  },
};
