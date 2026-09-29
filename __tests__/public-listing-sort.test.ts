import assert from "node:assert/strict";

import {
  compareReviewSortCandidates,
  parsePublicListingSort,
  type ReviewSortCandidate,
} from "../lib/listings/public-sort";

const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

const candidates: ReviewSortCandidate[] = [
  { id: "new", isFeatured: true, createdAt: date("2026-04-01"), averageRating: null, reviewsCount: 0 },
  { id: "popular", isFeatured: false, createdAt: date("2026-01-01"), averageRating: 4.8, reviewsCount: 40 },
  { id: "highest", isFeatured: false, createdAt: date("2026-02-01"), averageRating: 5, reviewsCount: 3 },
  { id: "trusted", isFeatured: false, createdAt: date("2026-03-01"), averageRating: 4.9, reviewsCount: 12 },
];

assert.equal(parsePublicListingSort("price_low"), "price_low");
assert.equal(parsePublicListingSort("most_reviewed"), "most_reviewed");
assert.equal(parsePublicListingSort("unknown"), undefined);
assert.equal(parsePublicListingSort(null), undefined);

assert.deepEqual(
  [...candidates].sort((a, b) => compareReviewSortCandidates(a, b, "top_rated")).map((item) => item.id),
  ["highest", "trusted", "popular", "new"],
);

assert.deepEqual(
  [...candidates].sort((a, b) => compareReviewSortCandidates(a, b, "most_reviewed")).map((item) => item.id),
  ["popular", "trusted", "highest", "new"],
);

console.log("✓ Public listing sort parsing and review ranking verified");
