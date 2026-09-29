export const PUBLIC_LISTING_SORT_VALUES = [
  "recommended",
  "price_low",
  "price_high",
  "top_rated",
  "most_reviewed",
] as const;

export type PublicListingSort = (typeof PUBLIC_LISTING_SORT_VALUES)[number];

const PUBLIC_LISTING_SORT_SET = new Set<string>(PUBLIC_LISTING_SORT_VALUES);

export function parsePublicListingSort(value: string | null | undefined): PublicListingSort | undefined {
  return value && PUBLIC_LISTING_SORT_SET.has(value)
    ? (value as PublicListingSort)
    : undefined;
}

export type ReviewSortCandidate = {
  id: string;
  isFeatured: boolean;
  createdAt: Date;
  averageRating: number | null;
  reviewsCount: number;
};

/**
 * Review aggregates are not stored on Listing, so Prisma cannot order listings
 * by their published-review average. Keep this comparison pure so both review
 * sort modes have explicit, deterministic tie-breakers before pagination.
 */
export function compareReviewSortCandidates(
  left: ReviewSortCandidate,
  right: ReviewSortCandidate,
  sortBy: Extract<PublicListingSort, "top_rated" | "most_reviewed">,
): number {
  const leftHasRating = left.averageRating !== null;
  const rightHasRating = right.averageRating !== null;

  if (sortBy === "top_rated") {
    if (leftHasRating !== rightHasRating) return leftHasRating ? -1 : 1;
    if (leftHasRating && rightHasRating && left.averageRating !== right.averageRating) {
      return right.averageRating! - left.averageRating!;
    }
    if (left.reviewsCount !== right.reviewsCount) {
      return right.reviewsCount - left.reviewsCount;
    }
  } else {
    if (left.reviewsCount !== right.reviewsCount) {
      return right.reviewsCount - left.reviewsCount;
    }
    if (leftHasRating !== rightHasRating) return leftHasRating ? -1 : 1;
    if (leftHasRating && rightHasRating && left.averageRating !== right.averageRating) {
      return right.averageRating! - left.averageRating!;
    }
  }

  if (left.isFeatured !== right.isFeatured) return left.isFeatured ? -1 : 1;

  const createdAtDifference = right.createdAt.getTime() - left.createdAt.getTime();
  if (createdAtDifference !== 0) return createdAtDifference;

  return left.id.localeCompare(right.id);
}
