import { Prisma } from "@/generated/prisma/client";
import { ReviewDirection, ReviewStatus } from "@/generated/prisma/enums";
import { AppError } from "@/lib/api/errors";
import { prisma } from "@/lib/db/prisma";
import { getCounter, getOrSetCache } from "@/lib/redis/cache";
import { CACHE_KEYS, hashFilters } from "@/lib/redis/keys";
import { getEffectiveDateTime } from "@/lib/booking/booking-status";
import {
  computeReviewDeadline,
  evaluateGuestReviewEligibility,
  evaluateHostReviewEligibility,
} from "@/lib/booking/review-eligibility";
import { invalidateListingCache } from "@/lib/redis/invalidation";
import { revivePublicReviewDTO, toPublicReviewDTO, toReviewDTO, type PublicReviewDTO, type ReviewDTO } from "./mappers";

const REVIEWS_PAGE_SIZE = 6;
const PUBLIC_REVIEW_PAGE_CACHE_TTL_SECONDS = 120;
const PUBLIC_REVIEW_STATS_CACHE_TTL_SECONDS = 300;

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
  listingId?: string;
  authorId: string;
  bookingId: string;
  direction?: ReviewDirection;
  rating: number;
  comment?: string;
  privateNoteToHost?: string;
  privateNoteToGuest?: string;
  recommendGuest?: boolean;
  categoryRatings?: ReviewCategoryRatings;
  houseRulesRating?: number;
};

export type UpdateReviewInput = {
  rating?: number;
  comment?: string;
  privateNoteToHost?: string;
  privateNoteToGuest?: string;
  recommendGuest?: boolean;
  categoryRatings?: ReviewCategoryRatings;
  houseRulesRating?: number;
};

export type AdminReviewFilters = {
  page?: number;
  pageSize?: number;
  direction?: ReviewDirection;
  status?: ReviewStatus;
  rating?: number;
  search?: string;
  flagged?: boolean;
  dateFrom?: string;
  dateTo?: string;
};

type GuestReviewWithRelations = {
  id: string;
  listingId: string;
  bookingId: string | null;
  rating: number;
  comment: string;
  topics: string[];
  createdAt: Date;
  listing: {
    id: string;
    title: string;
    photos: string[];
    city: string | null;
    country: string | null;
    customSlug: string | null;
  };
  booking: {
    id: string;
    startDate: Date;
    endDate: Date;
  } | null;
};

export type ReviewSortOption = "relevant" | "recent" | "oldest" | "highest" | "lowest";

export interface GetListingReviewsOptions {
  page?: number;
  pageSize?: number;
  topic?: string;
  mention?: string;
  search?: string;
  sort?: ReviewSortOption;
  rating?: number;
}

type PublicListingReviewRow = {
  id: string;
  listingId: string | null;
  bookingId: string | null;
  direction: ReviewDirection;
  rating: number;
  comment: string;
  topics: string[];
  createdAt: Date;
  publishedAt: Date | null;
  authorId: string | null;
  authorName: string | null;
  authorImage: string | null;
  authorCreatedAt: Date | null;
  responseComment: string | null;
  responseCreatedAt: Date | null;
  responseAuthorName: string | null;
  responseAuthorImage: string | null;
  total: bigint | number;
};

type PublicListingReviewPage = {
  reviews: PublicReviewDTO[];
  total: number;
  page: number;
  totalPages: number;
  hasMore: boolean;
};

function revivePublicListingReviewPage(page: PublicListingReviewPage): PublicListingReviewPage {
  return {
    ...page,
    reviews: page.reviews.map(revivePublicReviewDTO),
  };
}

function toPublicListingReviewRowDTO(review: PublicListingReviewRow): PublicReviewDTO {
  return {
    id: review.id,
    listingId: review.listingId,
    bookingId: review.bookingId,
    direction: review.direction,
    rating: review.rating,
    comment: review.comment,
    topics: review.topics,
    author: review.authorId
      ? {
          id: review.authorId,
          name: review.authorName,
          image: review.authorImage,
          createdAt: review.authorCreatedAt ?? undefined,
        }
      : null,
    createdAt: review.createdAt,
    publishedAt: review.publishedAt ?? review.createdAt,
    hostResponse: review.responseComment !== null && review.responseCreatedAt !== null
      ? {
          comment: review.responseComment,
          createdAt: review.responseCreatedAt,
          hostName: review.responseAuthorName,
          hostImage: review.responseAuthorImage,
        }
      : null,
  };
}

const TOPIC_KEYWORDS: Record<string, readonly string[]> = {
  Pool: ["pool", "swimming"],
  Hospitality: ["hospitality", "welcoming", "welcome", "host", "friendly", "helpful"],
  Cleanliness: ["clean", "cleanliness", "spotless", "tidy", "immaculate"],
  Condition: ["condition", "maintained", "maintenance", "renovated", "upkeep", "modern"],
  Comfort: ["comfortable", "comfort", "cozy", "cosy", "relaxing", "peaceful"],
  Family: ["family", "families", "kids", "children", "kid-friendly", "child"],
  Accuracy: ["accurate", "accuracy", "as described", "as pictured", "as advertised"],
  Location: ["location", "located", "neighborhood", "neighbourhood", "nearby"],
  View: ["view", "views", "balcony", "scenery"],
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

/**
 * Guest Favorite reads the listing's published guest reviews directly. Reuse
 * its existing listing-level evaluator after a review lifecycle change rather
 * than maintaining a second communication aggregate or qualification formula.
 * A review is already durable when this runs, so a transient evaluation error
 * is logged and reconciled by the daily evaluator without rejecting the review.
 */
async function triggerGuestFavoriteReevaluation(listingId: string): Promise<void> {
  try {
    const { evaluateListingGuestFavoriteDaily } = await import(
      "@/services/guest-favorite.service"
    );
    await evaluateListingGuestFavoriteDaily(listingId);
  } catch (error) {
    console.error("[Review] Immediate Guest Favorite recalculation failed", {
      listingId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/** Database operations for the two-directional, property and guest review experience. */
export const reviewService = {
  /** Check if a review already exists for a booking in the given direction. */
  async hasReviewForBooking(
    bookingId: string,
    direction: ReviewDirection = ReviewDirection.GUEST_TO_PROPERTY,
  ): Promise<boolean> {
    const review = await prisma.review.findFirst({
      where: { bookingId, direction },
      select: { id: true },
    });
    return Boolean(review);
  },

  /** Public listing reviews (strictly GUEST_TO_PROPERTY, PUBLISHED). */
  async getListingReviews(
    listingId: string,
    pageOrOptions?: number | GetListingReviewsOptions,
    pageSize = REVIEWS_PAGE_SIZE,
    topic?: string,
  ): Promise<{
    reviews: PublicReviewDTO[];
    total: number;
    page: number;
    totalPages: number;
    hasMore: boolean;
  }> {
    let page = 1;
    let safePageSize = REVIEWS_PAGE_SIZE;
    let filterTopic: string | undefined = topic;
    let search: string | undefined;
    let sort: ReviewSortOption = "recent";
    let rating: number | undefined;

    if (typeof pageOrOptions === "object" && pageOrOptions !== null) {
      page = pageOrOptions.page ?? 1;
      safePageSize = pageOrOptions.pageSize ?? REVIEWS_PAGE_SIZE;
      filterTopic = pageOrOptions.mention ?? pageOrOptions.topic;
      search = pageOrOptions.search;
      sort = pageOrOptions.sort ?? "recent";
      rating = pageOrOptions.rating;
    } else if (typeof pageOrOptions === "number") {
      page = pageOrOptions;
      safePageSize = pageSize;
      filterTopic = topic;
    }

    const safePage = Math.max(1, Math.trunc(page));
    safePageSize = Math.min(Math.max(1, Math.trunc(safePageSize)), 24);

    const conditions: Prisma.Sql[] = [
      Prisma.sql`r."listingId" = ${listingId}`,
      Prisma.sql`r."status" = 'PUBLISHED'`,
      Prisma.sql`r."direction" = 'GUEST_TO_PROPERTY'`,
    ];

    if (filterTopic) {
      const keywords = TOPIC_KEYWORDS[filterTopic] || [filterTopic.toLowerCase()];
      const topicConditions = [
        Prisma.sql`r."topics" @> ARRAY[${filterTopic}]::text[]`,
        ...keywords.map((keyword) => Prisma.sql`r."comment" ILIKE ${`%${keyword}%`}`),
      ];
      conditions.push(Prisma.sql`(${Prisma.join(topicConditions, " OR ")})`);
    }

    if (search && search.trim()) {
      const trimmed = search.trim();
      conditions.push(
        Prisma.sql`(r."comment" ILIKE ${`%${trimmed}%`} OR reviewer."name" ILIKE ${`%${trimmed}%`})`,
      );
    }

    if (rating !== undefined && Number.isInteger(rating) && rating >= 1 && rating <= 5) {
      conditions.push(Prisma.sql`r."rating" = ${rating}`);
    }

    let orderBy: Prisma.Sql;
    switch (sort) {
      case "highest":
        orderBy = Prisma.sql`r."rating" DESC, r."createdAt" DESC, r."id" DESC`;
        break;
      case "lowest":
        orderBy = Prisma.sql`r."rating" ASC, r."createdAt" DESC, r."id" DESC`;
        break;
      case "oldest":
        orderBy = Prisma.sql`r."createdAt" ASC, r."id" ASC`;
        break;
      case "recent":
      case "relevant":
      default:
        orderBy = Prisma.sql`r."createdAt" DESC, r."id" DESC`;
        break;
    }

    const version = await getCounter(CACHE_KEYS.LISTING_REVIEWS_VER(listingId));
    const cacheKey = CACHE_KEYS.LISTING_REVIEW_PAGE(
      listingId,
      version,
      hashFilters({ page: safePage, pageSize: safePageSize, filterTopic, search, sort, rating }),
    );

    return getOrSetCache<PublicListingReviewPage>(
      cacheKey,
      async () => {
        // A single joined query replaces the old count + Review + author +
        // response waterfall. `COUNT(*) OVER()` retains exact pagination
        // metadata without a second query for normal non-empty pages.
        const reviews = await prisma.$queryRaw(Prisma.sql`
          SELECT
            r."id", r."listingId", r."bookingId", r."direction", r."rating",
            r."comment", r."topics", r."createdAt", r."publishedAt",
            reviewer."id" AS "authorId", reviewer."name" AS "authorName",
            reviewer."image" AS "authorImage", reviewer."createdAt" AS "authorCreatedAt",
            response."comment" AS "responseComment", response."createdAt" AS "responseCreatedAt",
            responseAuthor."name" AS "responseAuthorName", responseAuthor."image" AS "responseAuthorImage",
            COUNT(*) OVER() AS "total"
          FROM "Review" r
          INNER JOIN "User" reviewer ON reviewer."id" = r."authorId"
          LEFT JOIN "ReviewResponse" response
            ON response."reviewId" = r."id" AND response."status" = 'PUBLISHED'
          LEFT JOIN "User" responseAuthor ON responseAuthor."id" = response."authorId"
          WHERE ${Prisma.join(conditions, " AND ")}
          ORDER BY ${orderBy}
          OFFSET ${(safePage - 1) * safePageSize}
          LIMIT ${safePageSize}
        `) as PublicListingReviewRow[];

        const total = reviews.length > 0
          ? Number(reviews[0].total)
          : safePage === 1
            ? 0
            : Number(((await prisma.$queryRaw(Prisma.sql`
                SELECT COUNT(*) AS "total"
                FROM "Review" r
                INNER JOIN "User" reviewer ON reviewer."id" = r."authorId"
                WHERE ${Prisma.join(conditions, " AND ")}
              `) as Array<{ total: bigint | number }>)[0]?.total ?? 0));

        const totalPages = Math.ceil(total / safePageSize);
        return {
          reviews: reviews.map(toPublicListingReviewRowDTO),
          total,
          page: safePage,
          totalPages,
          hasMore: safePage < totalPages,
        };
      },
      { ttl: PUBLIC_REVIEW_PAGE_CACHE_TTL_SECONDS, revive: revivePublicListingReviewPage },
    );
  },

  /** Rating stats aggregated exclusively from GUEST_TO_PROPERTY published reviews. */
  async getReviewStats(listingId: string): Promise<{
    averageRating: number | null;
    totalCount: number;
    ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
    categoryRatings: ReviewCategoryRatings;
    mentions: ReviewMention[];
  }> {
    const version = await getCounter(CACHE_KEYS.LISTING_REVIEWS_VER(listingId));
    return getOrSetCache(
      CACHE_KEYS.LISTING_REVIEW_STATS(listingId, version),
      async () => {
        // One filtered scan yields the summary, distribution, category scores,
        // and persisted mention tags. The old flow issued three queries and a
        // fourth 100-comment scan whenever legacy reviews lacked topic tags.
        const [row] = await prisma.$queryRaw(Prisma.sql`
          WITH filtered AS (
            SELECT "rating", "cleanlinessRating", "accuracyRating", "checkInRating",
              "communicationRating", "locationRating", "valueRating", "topics"
            FROM "Review"
            WHERE "listingId" = ${listingId}
              AND "status" = 'PUBLISHED'
              AND "direction" = 'GUEST_TO_PROPERTY'
          ),
          summary AS (
            SELECT
              COUNT(*)::int AS "totalCount",
              AVG("rating") AS "averageRating",
              AVG("cleanlinessRating") AS "cleanlinessRating",
              AVG("accuracyRating") AS "accuracyRating",
              AVG("checkInRating") AS "checkInRating",
              AVG("communicationRating") AS "communicationRating",
              AVG("locationRating") AS "locationRating",
              AVG("valueRating") AS "valueRating",
              COUNT(*) FILTER (WHERE "rating" = 1)::int AS "rating1",
              COUNT(*) FILTER (WHERE "rating" = 2)::int AS "rating2",
              COUNT(*) FILTER (WHERE "rating" = 3)::int AS "rating3",
              COUNT(*) FILTER (WHERE "rating" = 4)::int AS "rating4",
              COUNT(*) FILTER (WHERE "rating" = 5)::int AS "rating5"
            FROM filtered
          ),
          topicCounts AS (
            SELECT topic, COUNT(*)::int AS count
            FROM filtered, unnest("topics") AS topic
            GROUP BY topic
            ORDER BY count DESC, topic ASC
            LIMIT 12
          )
          SELECT summary.*, COALESCE((SELECT json_agg(topicCounts) FROM topicCounts), '[]'::json) AS "mentions"
          FROM summary
        `) as Array<{
          totalCount: number;
          averageRating: number | null;
          cleanlinessRating: number | null;
          accuracyRating: number | null;
          checkInRating: number | null;
          communicationRating: number | null;
          locationRating: number | null;
          valueRating: number | null;
          rating1: number;
          rating2: number;
          rating3: number;
          rating4: number;
          rating5: number;
          mentions: unknown;
        }>;

        const ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number> = {
          1: Number(row?.rating1 ?? 0),
          2: Number(row?.rating2 ?? 0),
          3: Number(row?.rating3 ?? 0),
          4: Number(row?.rating4 ?? 0),
          5: Number(row?.rating5 ?? 0),
        };
        const categoryRatings: ReviewCategoryRatings = {};
        const categoryAverageMap: Record<ReviewCategoryKey, number | null> = {
          cleanliness: row?.cleanlinessRating ?? null,
          accuracy: row?.accuracyRating ?? null,
          checkIn: row?.checkInRating ?? null,
          communication: row?.communicationRating ?? null,
          location: row?.locationRating ?? null,
          value: row?.valueRating ?? null,
        };
        for (const key of REVIEW_CATEGORY_KEYS) {
          const average = roundedAverage(categoryAverageMap[key]);
          if (average !== undefined) categoryRatings[key] = average;
        }
        const rawMentions = Array.isArray(row?.mentions)
          ? row.mentions
          : typeof row?.mentions === "string"
            ? JSON.parse(row.mentions) as unknown
            : [];
        const mentions: ReviewMention[] = Array.isArray(rawMentions)
          ? rawMentions.flatMap((mention) => {
              if (!mention || typeof mention !== "object") return [];
              const value = mention as { topic?: unknown; count?: unknown };
              return typeof value.topic === "string" && Number.isFinite(Number(value.count))
                ? [{ topic: value.topic, count: Number(value.count) }]
                : [];
            })
          : [];

        return {
          averageRating: row?.totalCount ? roundedAverage(row.averageRating) ?? null : null,
          totalCount: Number(row?.totalCount ?? 0),
          ratingDistribution,
          categoryRatings,
          mentions,
        };
      },
      { ttl: PUBLIC_REVIEW_STATS_CACHE_TTL_SECONDS },
    );
  },

  /**
   * Create a review with reciprocal blind review engine.
   * - If first party: saved with status PRIVATE and 14-day publication deadline.
   * - If second party (reciprocal exists): both reviews are published immediately.
   */
  async createReview(input: CreateReviewInput): Promise<PublicReviewDTO> {
    const { moderationService } = await import("./moderation.service");
    await moderationService.assertUserNotRestricted(input.authorId, "RESTRICT_REVIEWS");

    const direction = input.direction ?? ReviewDirection.GUEST_TO_PROPERTY;

    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw AppError.validation("Rating must be an integer between 1 and 5");
    }
    for (const value of Object.values(input.categoryRatings ?? {})) {
      if (!Number.isInteger(value) || value < 1 || value > 5) {
        throw AppError.validation("Category ratings must be integers between 1 and 5");
      }
    }
    if (
      input.houseRulesRating !== undefined &&
      (!Number.isInteger(input.houseRulesRating) ||
        input.houseRulesRating < 1 ||
        input.houseRulesRating > 5)
    ) {
      throw AppError.validation("House rules rating must be an integer between 1 and 5");
    }

    const comment = (input.comment || "").trim();
    if (comment.length > 5000) {
      throw AppError.validation("Review text cannot exceed 5000 characters");
    }
    const privateNoteToHost = (input.privateNoteToHost || "").trim();
    if (privateNoteToHost.length > 5000) {
      throw AppError.validation("Private note cannot exceed 5000 characters");
    }
    const privateNoteToGuest = (input.privateNoteToGuest || "").trim();
    if (privateNoteToGuest.length > 5000) {
      throw AppError.validation("Private note cannot exceed 5000 characters");
    }

    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      include: {
        listing: {
          select: { id: true, hostId: true, checkOutTime: true },
        },
      },
    });

    if (!booking) {
      throw AppError.notFound("Booking not found");
    }

    const now = new Date();
    const effectiveListingId = input.listingId || booking.listingId;
    const reviewDeadline = computeReviewDeadline(booking.endDate, booking.listing?.checkOutTime);

    // Existing review in this direction check
    const existing = await prisma.review.findFirst({
      where: {
        bookingId: input.bookingId,
        direction,
      },
    });

    let targetUserId: string;

    if (direction === ReviewDirection.GUEST_TO_PROPERTY) {
      const eligibility = evaluateGuestReviewEligibility({
        isGuest: booking.userId === input.authorId,
        bookingStatus: booking.status,
        endDate: booking.endDate,
        checkOutTime: booking.listing?.checkOutTime,
        hasGuestReview: Boolean(existing),
        now,
      });

      if (!eligibility.canReview) {
        throw AppError.forbidden(eligibility.reason || "You cannot review this property at this time");
      }
      targetUserId = booking.listing?.hostId ?? "";
    } else {
      const isHost = booking.listing?.hostId === input.authorId;
      const eligibility = evaluateHostReviewEligibility({
        isHost,
        bookingStatus: booking.status,
        endDate: booking.endDate,
        checkOutTime: booking.listing?.checkOutTime,
        hasHostReview: Boolean(existing),
        now,
      });

      if (!eligibility.canReview) {
        throw AppError.forbidden(eligibility.reason || "You cannot review this guest at this time");
      }
      targetUserId = booking.userId;
    }

    if (existing) {
      throw AppError.conflict("A review has already been submitted for this stay");
    }

    // Check reciprocal review for reciprocal blind publishing
    const reciprocalDirection =
      direction === ReviewDirection.GUEST_TO_PROPERTY
        ? ReviewDirection.HOST_TO_GUEST
        : ReviewDirection.GUEST_TO_PROPERTY;

    const reciprocalReview = await prisma.review.findFirst({
      where: {
        bookingId: input.bookingId,
        direction: reciprocalDirection,
      },
    });

    // Both parties submitted -> publish both immediately
    const shouldPublishImmediately = Boolean(reciprocalReview);
    const initialStatus = shouldPublishImmediately ? ReviewStatus.PUBLISHED : ReviewStatus.PRIVATE;
    const publishedAt = shouldPublishImmediately ? now : null;

    const review = await prisma.$transaction(async (tx: any) => {
      const created = await tx.review.create({
        data: {
          listingId: effectiveListingId,
          authorId: input.authorId,
          targetUserId,
          bookingId: input.bookingId,
          direction,
          rating: input.rating,
          comment,
          privateNoteToHost,
          privateNoteToGuest,
          topics: extractTopics(input.comment || ""),
          recommendGuest: input.recommendGuest,
          houseRulesRating: input.houseRulesRating,
          ...categoryData(input.categoryRatings),
          status: initialStatus,
          submittedAt: now,
          publishedAt,
          reviewDeadline,
          editDeadline: shouldPublishImmediately ? now : reviewDeadline,
        },
        include: {
          author: { select: { id: true, name: true, image: true, createdAt: true } },
          response: {
            include: {
              author: { select: { id: true, name: true, image: true } },
            },
          },
        },
      });

      if (shouldPublishImmediately && reciprocalReview && reciprocalReview.status === ReviewStatus.PRIVATE) {
        await tx.review.update({
          where: { id: reciprocalReview.id },
          data: {
            status: ReviewStatus.PUBLISHED,
            publishedAt: now,
            editDeadline: now,
          },
        });
      }

      return created;
    });

    // A host submission can publish an already-written guest review too, so
    // invalidate public review data for either reciprocal completion order.
    if (shouldPublishImmediately && effectiveListingId) {
      await invalidateListingCache(effectiveListingId);
      await triggerGuestFavoriteReevaluation(effectiveListingId);
    }

    return toPublicReviewDTO(review);
  },

  /** Edit a review prior to publication and within the 14-day window. */
  async updateReview(
    reviewId: string,
    actorId: string,
    input: UpdateReviewInput,
  ): Promise<ReviewDTO> {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: { author: true },
    });

    if (!review) throw AppError.notFound("Review not found");
    if (review.authorId !== actorId) {
      throw AppError.forbidden("You are not authorized to edit this review");
    }

    if (review.status !== ReviewStatus.PRIVATE) {
      throw AppError.forbidden("Published or moderated reviews cannot be edited");
    }

    const now = new Date();
    if (review.editDeadline && now.getTime() > review.editDeadline.getTime()) {
      throw AppError.forbidden("The review edit window has expired");
    }

    const data: Prisma.ReviewUpdateInput = {};
    if (input.rating !== undefined) {
      if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
        throw AppError.validation("Rating must be an integer between 1 and 5");
      }
      data.rating = input.rating;
    }
    if (input.comment !== undefined) {
      const comment = input.comment.trim();
      if (comment.length > 5000) throw AppError.validation("Review text cannot exceed 5000 characters");
      data.comment = comment;
      data.topics = extractTopics(comment);
    }
    if (input.privateNoteToHost !== undefined) {
      const note = input.privateNoteToHost.trim();
      if (note.length > 5000) throw AppError.validation("Private note cannot exceed 5000 characters");
      data.privateNoteToHost = note;
    }
    if (input.privateNoteToGuest !== undefined) {
      const note = input.privateNoteToGuest.trim();
      if (note.length > 5000) throw AppError.validation("Private note cannot exceed 5000 characters");
      data.privateNoteToGuest = note;
    }
    if (input.recommendGuest !== undefined) {
      data.recommendGuest = input.recommendGuest;
    }
    if (input.houseRulesRating !== undefined) {
      data.houseRulesRating = input.houseRulesRating;
    }
    if (input.categoryRatings) {
      Object.assign(data, categoryData(input.categoryRatings));
    }

    const updated = await prisma.review.update({
      where: { id: reviewId },
      data,
      include: {
        author: true,
        targetUser: true,
        response: { include: { author: true } },
      },
    });

    return toReviewDTO(updated);
  },

  /** Public response to a published review. */
  async createReviewResponse(input: {
    reviewId: string;
    authorId: string;
    comment: string;
  }) {
    const comment = (input.comment || "").trim();
    if (!comment) throw AppError.validation("Response comment cannot be empty");
    if (comment.length > 2000) throw AppError.validation("Response comment cannot exceed 2000 characters");

    const review = await prisma.review.findUnique({
      where: { id: input.reviewId },
      include: {
        listing: { select: { hostId: true } },
        response: true,
      },
    });

    if (!review) throw AppError.notFound("Review not found");
    if (review.status !== ReviewStatus.PUBLISHED) {
      throw AppError.forbidden("Responses can only be submitted for published reviews");
    }
    if (review.response) {
      throw AppError.conflict("A response has already been submitted for this review");
    }

    if (review.direction === ReviewDirection.GUEST_TO_PROPERTY) {
      const isHost = review.listing?.hostId === input.authorId || review.targetUserId === input.authorId;
      if (!isHost) throw AppError.forbidden("Only the host can respond to a guest review");
    } else {
      const isGuest = review.targetUserId === input.authorId;
      if (!isGuest) throw AppError.forbidden("Only the reviewed guest can respond to a host review");
    }

    const response = await prisma.reviewResponse.create({
      data: {
        reviewId: input.reviewId,
        authorId: input.authorId,
        comment,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
      },
    });

    // Responses are part of the public review card payload. Do not leave a
    // cached page serving an outdated response after the host posts one.
    if (review.listingId && review.direction === ReviewDirection.GUEST_TO_PROPERTY) {
      await invalidateListingCache(review.listingId);
    }

    return response;
  },

  /** Automatically publish private reviews whose 14-day window has expired. */
  async publishExpiredReviews(now = new Date()): Promise<number> {
    const expiredReviews = await prisma.review.findMany({
      where: {
        status: ReviewStatus.PRIVATE,
        reviewDeadline: { lte: now },
      },
      select: { id: true, listingId: true, direction: true },
    });

    if (expiredReviews.length === 0) return 0;

    await prisma.review.updateMany({
      where: {
        id: { in: expiredReviews.map((r: any) => r.id) },
      },
      data: {
        status: ReviewStatus.PUBLISHED,
        publishedAt: now,
      },
    });

    const affectedListingIds: string[] = Array.from(
      new Set(
        expiredReviews
          .filter((r: any) => r.direction === ReviewDirection.GUEST_TO_PROPERTY && Boolean(r.listingId))
          .map((r: any) => r.listingId as string),
      ),
    );

    for (const listingId of affectedListingIds) {
      await invalidateListingCache(listingId);
      await triggerGuestFavoriteReevaluation(listingId);
    }

    return expiredReviews.length;
  },

  async getReviewById(reviewId: string): Promise<ReviewDTO | null> {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        author: true,
        targetUser: true,
        response: { include: { author: true } },
      },
    });
    return review ? toReviewDTO(review) : null;
  },

  async deleteReview(reviewId: string): Promise<void> {
    const review = await prisma.review.update({
      where: { id: reviewId },
      data: { status: ReviewStatus.DELETED },
      select: { listingId: true, direction: true },
    });
    if (review.listingId && review.direction === ReviewDirection.GUEST_TO_PROPERTY) {
      await invalidateListingCache(review.listingId);
      await triggerGuestFavoriteReevaluation(review.listingId);
    }
  },

  async getUserReviews(userId: string): Promise<PublicReviewDTO[]> {
    const reviews = await prisma.review.findMany({
      where: {
        authorId: userId,
        status: ReviewStatus.PUBLISHED,
        direction: ReviewDirection.GUEST_TO_PROPERTY,
      },
      include: {
        author: { select: { id: true, name: true, image: true, createdAt: true } },
        response: { include: { author: { select: { id: true, name: true, image: true } } } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return reviews.map(toPublicReviewDTO);
  },

  /** Get host reviews received by a guest. */
  async getHostReviewsForGuest(guestId: string): Promise<Array<{
    id: string;
    rating: number;
    houseRulesRating: number | null;
    cleanlinessRating: number | null;
    communicationRating: number | null;
    comment: string;
    recommendGuest: boolean | null;
    createdAt: Date;
    author: { id: string; name: string | null; image: string | null };
    response: { comment: string; createdAt: Date; author: { name: string | null } } | null;
  }>> {
    const reviews = await prisma.review.findMany({
      where: {
        targetUserId: guestId,
        direction: ReviewDirection.HOST_TO_GUEST,
        status: ReviewStatus.PUBLISHED,
      },
      include: {
        author: { select: { id: true, name: true, image: true } },
        response: {
          include: {
            author: { select: { name: true } },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    return reviews.map((r: any) => ({
      id: r.id,
      rating: r.rating,
      houseRulesRating: r.houseRulesRating,
      cleanlinessRating: r.cleanlinessRating,
      communicationRating: r.communicationRating,
      comment: r.comment,
      recommendGuest: r.recommendGuest,
      createdAt: r.createdAt,
      author: r.author,
      response: r.response
        ? {
            comment: r.response.comment,
            createdAt: r.response.createdAt,
            author: { name: r.response.author.name },
          }
        : null,
    }));
  },

  async getGuestReviews(authorId: string) {
    const reviews = await prisma.review.findMany({
      where: {
        authorId,
        status: ReviewStatus.PUBLISHED,
        direction: ReviewDirection.GUEST_TO_PROPERTY,
        listingId: { not: null },
      },
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
      take: 24,
    });
    return (reviews as any[]).map((r) => ({
      id: r.id,
      listingId: (r.listingId || "") as string,
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

  /** Host-facing review listing (includes private notes, host response). */
  async getListingReviewsForHost(
    listingId: string,
    page = 1,
    pageSize = REVIEWS_PAGE_SIZE,
  ): Promise<{
    reviews: Array<{
      id: string;
      listingId: string | null;
      rating: number;
      comment: string;
      privateNoteToHost: string;
      topics: string[];
      author: { id: string; name: string | null; image: string | null };
      createdAt: Date;
      response: { id: string; comment: string; createdAt: Date } | null;
    }>;
    total: number;
    page: number;
    totalPages: number;
  }> {
    const safePage = Math.max(1, Math.trunc(page));
    const safePageSize = Math.min(Math.max(1, Math.trunc(pageSize)), 24);
    const where = {
      listingId,
      status: ReviewStatus.PUBLISHED,
      direction: ReviewDirection.GUEST_TO_PROPERTY,
    };

    const [total, reviews] = await prisma.$transaction([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, image: true } },
          response: { select: { id: true, comment: true, createdAt: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
    ]);

    return {
      reviews: reviews.map((r: any) => ({
        id: r.id,
        listingId: r.listingId,
        rating: r.rating,
        comment: r.comment,
        privateNoteToHost: r.privateNoteToHost,
        topics: r.topics,
        author: {
          id: r.author.id,
          name: r.author.name,
          image: r.author.image,
        },
        createdAt: r.createdAt,
        response: r.response,
      })),
      total,
      page: safePage,
      totalPages: Math.ceil(total / safePageSize),
    };
  },

  /** Admin review listing with filters, pagination, and moderation state. */
  async adminGetReviews(filters: AdminReviewFilters) {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(Math.max(1, filters.pageSize ?? 20), 50);

    const where: Prisma.ReviewWhereInput = {};
    if (filters.direction) where.direction = filters.direction;
    if (filters.status) where.status = filters.status;
    if (filters.rating && filters.rating >= 1 && filters.rating <= 5) where.rating = filters.rating;

    if (filters.flagged) {
      where.moderationCaseId = { not: null };
    }

    if (filters.search && filters.search.trim()) {
      const term = filters.search.trim();
      where.OR = [
        { comment: { contains: term, mode: "insensitive" } },
        { author: { name: { contains: term, mode: "insensitive" } } },
        { author: { email: { contains: term, mode: "insensitive" } } },
        { listing: { title: { contains: term, mode: "insensitive" } } },
      ];
    }

    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const [total, reviews] = await prisma.$transaction([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        include: {
          author: { select: { id: true, name: true, email: true, image: true, role: true } },
          targetUser: { select: { id: true, name: true, email: true, image: true, role: true } },
          listing: { select: { id: true, title: true, city: true, country: true } },
          booking: { select: { id: true, startDate: true, endDate: true, status: true } },
          response: { include: { author: { select: { id: true, name: true, image: true } } } },
          moderationCase: { select: { id: true, caseReference: true, status: true, severity: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      reviews,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },

  /** Central-case review enforcement: HIDE, RESTORE, DELETE. */
  async adminModerateReview(input: {
    reviewId: string;
    moderatorId: string;
    action: "HIDE" | "RESTORE" | "DELETE";
    reason?: string;
    notes?: string;
    caseId: string;
  }) {
    if (!input.caseId) throw AppError.badRequest("Review enforcement requires a moderation case.");
    const review = await prisma.review.findUnique({
      where: { id: input.reviewId },
      select: { id: true, status: true, listingId: true, direction: true },
    });

    if (!review) throw AppError.notFound("Review not found");

    let newStatus: ReviewStatus;
    switch (input.action) {
      case "HIDE":
        newStatus = ReviewStatus.HIDDEN;
        break;
      case "RESTORE":
        newStatus = ReviewStatus.PUBLISHED;
        break;
      case "DELETE":
        newStatus = ReviewStatus.DELETED;
        break;
      default:
        throw AppError.validation("Invalid moderation action");
    }

    const now = new Date();
    const updated = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const moderatedReview = await tx.review.update({
        where: { id: input.reviewId },
        data: {
          status: newStatus,
          moderatedAt: now,
          moderatedById: input.moderatorId,
          rejectionReason: input.reason,
          moderationNotes: input.notes,
          moderationCaseId: input.caseId,
        },
        include: {
          author: true,
          targetUser: true,
          listing: true,
          response: { include: { author: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: input.moderatorId,
          action: `REVIEW_${input.action}`,
          resourceType: "REVIEW",
          resourceId: input.reviewId,
          description: `Review status changed from ${review.status} to ${newStatus}. Reason: ${input.reason || "N/A"}`,
          metadata: {
            moderationCaseId: input.caseId,
            previousStatus: review.status,
            nextStatus: newStatus,
            enforcementResult: "SUCCESS",
          },
        },
      });

      return moderatedReview;
    });

    if (review.listingId && review.direction === ReviewDirection.GUEST_TO_PROPERTY) {
      await invalidateListingCache(review.listingId);
      await triggerGuestFavoriteReevaluation(review.listingId);
    }

    return updated;
  },
};
