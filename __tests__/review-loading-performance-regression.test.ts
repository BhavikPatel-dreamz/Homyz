import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

const reviewList = read("components/reviews/review-list.tsx");
const reviewModal = read("components/reviews/review-modal.tsx");
const reviewService = read("services/review.service.ts");
const cacheKeys = read("lib/redis/keys.ts");
const invalidation = read("lib/redis/invalidation.ts");
const reviewRoute = read("app/api/v1/reviews/[id]/route.ts");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20261016110000_optimize_public_review_queries/migration.sql");

assert.match(reviewList, /initialSummary/, "the public listing summary is available before the review API resolves");
assert.match(reviewList, /if \(initialSummary\.totalCount === 0\)/, "zero-review listings skip the initial review-list request");
assert.match(reviewList, /new AbortController\(\)/, "listing navigation cancels obsolete review requests");
assert.match(reviewList, /setRetryVersion/, "failed initial review requests offer a retry path");
assert.match(reviewList, /initialPagination=/, "the modal receives the already-fetched preview page");

assert.match(reviewModal, /reviewPageCache/, "opening the review modal reuses a short-lived client page cache");
assert.match(reviewModal, /usedInitialPageRef/, "opening the modal does not refetch the preview page");

assert.match(reviewService, /COUNT\(\*\) OVER\(\)/, "public review pages return exact pagination metadata without a separate count query");
assert.match(reviewService, /LEFT JOIN "ReviewResponse"/, "public review pages fetch only the displayed author and response fields in one query");
assert.match(reviewService, /LISTING_REVIEW_PAGE/, "paginated public review responses are cached");
assert.match(reviewService, /LISTING_REVIEW_STATS/, "review breakdown statistics are cached");
assert.match(reviewService, /Responses are part of the public review card payload/, "host responses invalidate public review pages");
assert.match(cacheKeys, /LISTING_REVIEWS_VER/, "review cache keys are versioned per listing");
assert.match(invalidation, /LISTING_REVIEWS_VER\(listingId\)/, "listing invalidation expires public review cache entries");
assert.match(reviewRoute, /await requireApiAuth\(req\)/, "the full review DTO is no longer anonymously exposed");
assert.match(schema, /@@index\(\[listingId, status, direction, createdAt\]\)/, "the schema declares the public review query index");
assert.match(migration, /Review_listingId_status_direction_createdAt_idx/, "the database migration creates the matching index");

console.log("Review loading performance regressions passed.");
