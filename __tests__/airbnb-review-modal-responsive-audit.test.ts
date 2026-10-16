import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";

function readFile(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf-8");
}

describe("Airbnb Review Modal Responsive UI and Functionality Audit", () => {
  const reviewModalCode = readFile("components/reviews/review-modal.tsx");
  const reviewBreakdownCode = readFile("components/reviews/review-breakdown.tsx");
  const reviewCardCode = readFile("components/reviews/review-card.tsx");
  const reviewServiceCode = readFile("services/review.service.ts");
  const reviewsApiRouteCode = readFile("app/api/v1/listings/[id]/reviews/route.ts");
  const enMessages = JSON.parse(readFile("messages/en.json"));

  describe("1. Audit & Fix Existing UI / Overlapping Labels", () => {
    it("ReviewBreakdown supports variant='sidebar' to eliminate horizontal squishing and overlapping labels", () => {
      assert.match(reviewBreakdownCode, /variant\?: "horizontal" \| "sidebar"/);
      assert.match(reviewBreakdownCode, /if \(variant === "sidebar"\)/);
      // Ensures vertical layout with icon, label, and score on their own row
      assert.match(reviewBreakdownCode, /flex items-center justify-between/);
      assert.match(reviewBreakdownCode, /grid grid-cols-1 gap-y-3 sm:grid-cols-2 lg:grid-cols-1/);
    });

    it("ReviewModal passes variant='sidebar' to ReviewBreakdown in the left column", () => {
      assert.match(reviewModalCode, /<ReviewBreakdown[\s\S]*?variant="sidebar"/);
    });

    it("prevents long guest names, review text, and host responses from breaking layout", () => {
      assert.match(reviewCardCode, /break-words/);
      assert.match(reviewCardCode, /whitespace-pre-wrap break-words/);
      assert.match(reviewCardCode, /min-w-0 break-words/);
    });
  });

  describe("2. Full Responsiveness Across Breakpoints", () => {
    it("Desktop: implements two-column layout with ample left column width", () => {
      assert.match(reviewModalCode, /lg:grid lg:grid-cols-\[380px_1fr\]/);
      assert.match(reviewModalCode, /lg:overflow-hidden/);
      assert.match(reviewModalCode, /lg:border-r/);
    });

    it("Mobile & Tablet: stacks ratings summary above reviews without horizontal overflow", () => {
      assert.match(reviewModalCode, /flex-1 overflow-y-auto lg:overflow-hidden/);
      assert.match(reviewModalCode, /min-w-0/);
    });

    it("Mobile: supports full-screen or near-full-screen responsive modal dialog", () => {
      assert.match(reviewModalCode, /h-full max-h-full w-full/);
      assert.match(reviewModalCode, /sm:h-\[90vh\] sm:max-h-\[920px\]/);
      assert.match(reviewModalCode, /sm:rounded-3xl/);
    });
  });

  describe("3. Functional Review Search", () => {
    it("review service searches both review comment and guest author name", () => {
      assert.match(reviewServiceCode, /comment:\s*\{\s*contains:\s*search\.trim\(\),\s*mode:\s*"insensitive"/);
      assert.match(reviewServiceCode, /author:\s*\{\s*name:\s*\{\s*contains:\s*trimmed,\s*mode:\s*"insensitive"/);
    });

    it("debounces search input by ~300ms and trims whitespace", () => {
      assert.match(reviewModalCode, /setDebouncedSearch\(searchTerm\.trim\(\)\)/);
      assert.match(reviewModalCode, /300\);/);
    });

    it("provides clear search button and displays empty state when nothing matches", () => {
      assert.match(reviewModalCode, /reviews_clear_search/);
      assert.match(reviewModalCode, /reviews_no_match_search/);
      assert.match(reviewModalCode, /handleClearAllFilters/);
    });
  });

  describe("4. Sorting and Rating Filters", () => {
    it("defaults sort to 'recent' (Most recent) and supports oldest, highest, lowest", () => {
      assert.match(reviewModalCode, /useState<ReviewSortOption>\("recent"\)/);
      assert.match(reviewModalCode, /reviews_sort_recent/);
      assert.match(reviewModalCode, /reviews_sort_oldest/);
      assert.match(reviewModalCode, /reviews_sort_highest/);
      assert.match(reviewModalCode, /reviews_sort_lowest/);
    });

    it("backend supports 'oldest' sort by ascending timestamp", () => {
      assert.match(reviewServiceCode, /case "oldest":[\s\S]*?createdAt:\s*"asc"[\s\S]*?id:\s*"asc"/);
      assert.match(reviewsApiRouteCode, /allValidSorts\s*=\s*\[\.\.\.validSorts,\s*"oldest"\]/);
    });

    it("implements rating filters (All reviews, 5 to 1 stars) in toolbar and interactive star distribution", () => {
      assert.match(reviewModalCode, /selectedRating/);
      assert.match(reviewModalCode, /reviews_filter_all_ratings/);
      assert.match(reviewModalCode, /reviews_filter_5_stars/);
      assert.match(reviewModalCode, /reviews_filter_4_stars/);
      assert.match(reviewModalCode, /reviews_filter_3_stars/);
      assert.match(reviewModalCode, /reviews_filter_2_stars/);
      assert.match(reviewModalCode, /reviews_filter_1_star/);
      assert.match(reviewBreakdownCode, /onSelectRating/);
      assert.match(reviewBreakdownCode, /selectedRating/);
    });

    it("API route and service accept and apply rating filter", () => {
      assert.match(reviewsApiRouteCode, /req\.nextUrl\.searchParams\.get\("rating"\)/);
      assert.match(reviewServiceCode, /rating !== undefined && Number\.isInteger\(rating\)/);
    });
  });

  describe("5. Loading, Pagination, and Accessibility", () => {
    it("locks body scroll through ModalOverlay without manual window scroll mutations", () => {
      assert.match(reviewModalCode, /<ModalOverlay/);
      assert.doesNotMatch(reviewModalCode, /document\.body\.style\.overflow/);
    });

    it("manages Escape key and restores keyboard focus on modal close", () => {
      assert.match(reviewModalCode, /event\.key === "Escape"/);
      assert.match(reviewModalCode, /previousFocusRef\.current\?\.focus\(\)/);
    });

    it("fetches reviews with server-side pagination limit=10 and load more deduplication", () => {
      assert.match(reviewModalCode, /limit:\s*"10"/);
      assert.match(reviewModalCode, /handleLoadMore/);
      assert.match(reviewModalCode, /new Set\(prev\.map\(\(r\) => r\.id\)\)/);
    });

    it("has all newly introduced sort and filter translation keys defined in messages/en.json", () => {
      const keys = [
        "reviews_sort_oldest",
        "reviews_filter_rating",
        "reviews_filter_all_ratings",
        "reviews_filter_5_stars",
        "reviews_filter_4_stars",
        "reviews_filter_3_stars",
        "reviews_filter_2_stars",
        "reviews_filter_1_star",
        "reviews_no_match_rating",
      ];
      for (const k of keys) {
        assert.ok(enMessages[k], `Missing translation key: ${k}`);
      }
    });
  });
});
