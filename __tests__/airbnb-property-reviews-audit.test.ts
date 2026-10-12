import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

const read = (relPath: string) =>
  fs.readFileSync(path.join(process.cwd(), relPath), "utf8");

describe("Airbnb-Style Property Reviews Audit Suite", () => {
  const reviewServiceCode = read("services/review.service.ts");
  const mappersCode = read("services/mappers.ts");
  const apiRouteCode = read("app/api/v1/listings/[id]/reviews/route.ts");
  const reviewListCode = read("components/reviews/review-list.tsx");
  const reviewCardCode = read("components/reviews/review-card.tsx");
  const reviewBreakdownCode = read("components/reviews/review-breakdown.tsx");
  const reviewMentionChipsCode = read("components/reviews/review-mention-chips.tsx");
  const reviewModalCode = read("components/reviews/review-modal.tsx");
  const reviewIconCode = read("components/reviews/review-icon.tsx");
  const enMessages = JSON.parse(read("messages/en.json"));

  describe("1. Audit & Data Layer Correctness", () => {
    it("preserves authoritative published-only filter and calculation contracts", () => {
      assert.match(reviewServiceCode, /status:\s*"PUBLISHED"/);
      assert.match(reviewServiceCode, /prisma\.review\.aggregate/);
      assert.match(reviewServiceCode, /cleanlinessRating:\s*true/);
      assert.match(reviewServiceCode, /accuracyRating:\s*true/);
      assert.match(reviewServiceCode, /checkInRating:\s*true/);
      assert.match(reviewServiceCode, /communicationRating:\s*true/);
      assert.match(reviewServiceCode, /locationRating:\s*true/);
      assert.match(reviewServiceCode, /valueRating:\s*true/);
      assert.match(reviewServiceCode, /ratingDistribution/);
    });

    it("extracts mentions including Condition, Family, Accuracy, and Pool without fabrication", () => {
      assert.match(reviewServiceCode, /Condition:\s*\["condition"/);
      assert.match(reviewServiceCode, /Family:\s*\["family"/);
      assert.match(reviewServiceCode, /Accuracy:\s*\["accurate"/);
      assert.match(reviewServiceCode, /Pool:\s*\["pool"/);
      assert.match(reviewServiceCode, /Cleanliness:\s*\["clean"/);
      assert.match(reviewServiceCode, /Hospitality:\s*\["hospitality"/);
      assert.match(reviewServiceCode, /Comfort:\s*\["comfortable"/);
      assert.match(reviewServiceCode, /extractTopics\(r\.comment\)/);
    });

    it("public review DTO provides reviewer createdAt for membership metadata and excludes private note", () => {
      assert.match(mappersCode, /export function toPublicReviewDTO/);
      assert.match(mappersCode, /createdAt:\s*r\.author\.createdAt/);
      assert.match(mappersCode, /hostResponse/);
      // Private note to host must NEVER be included in public DTO
      assert.doesNotMatch(mappersCode, /toPublicReviewDTO[\s\S]*?privateNoteToHost/);
      assert.doesNotMatch(mappersCode, /toPublicReviewDTO[\s\S]*?rejectionReason/);
    });
  });

  describe("2. API Capabilities: Pagination, Search, Sorting, Mentions", () => {
    it("API route accepts propertyId, page, limit, sort, search, mention, and topic", () => {
      assert.match(apiRouteCode, /req\.nextUrl\.searchParams\.get\("topic"\)/);
      assert.match(apiRouteCode, /req\.nextUrl\.searchParams\.get\("mention"\)/);
      assert.match(apiRouteCode, /req\.nextUrl\.searchParams\.get\("search"\)/);
      assert.match(apiRouteCode, /req\.nextUrl\.searchParams\.get\("sort"\)/);
      assert.match(apiRouteCode, /validSorts\s*=\s*\["relevant",\s*"recent",\s*"highest",\s*"lowest"\]/);
    });

    it("service enforces server-side sorting with deterministic tiebreaking", () => {
      assert.match(reviewServiceCode, /case "highest":[\s\S]*?rating:\s*"desc"[\s\S]*?id:\s*"desc"/);
      assert.match(reviewServiceCode, /case "lowest":[\s\S]*?rating:\s*"asc"[\s\S]*?id:\s*"desc"/);
      assert.match(reviewServiceCode, /case "recent":[\s\S]*?createdAt:\s*"desc"[\s\S]*?id:\s*"desc"/);
      assert.match(reviewServiceCode, /case "relevant":[\s\S]*?default:[\s\S]*?createdAt:\s*"desc"[\s\S]*?id:\s*"desc"/);
    });

    it("service handles combined search and mention filters on server before pagination", () => {
      assert.match(reviewServiceCode, /comment:\s*\{\s*contains:\s*search\.trim\(\)/);
      assert.match(reviewServiceCode, /where\.AND\s*=/);
      assert.match(reviewServiceCode, /skip:\s*\(safePage - 1\)\s*\*\s*safePageSize/);
      assert.match(reviewServiceCode, /take:\s*safePageSize/);
      assert.match(reviewServiceCode, /hasMore:\s*safePage < totalPages/);
    });
  });

  describe("3. Property Details Page — Airbnb-Style UI", () => {
    it("renders rating header with laurel leaves ONLY when listing is Guest Favourite", () => {
      assert.match(reviewListCode, /isGuestFavorite\s*\?/);
      assert.match(reviewListCode, /filled-leaves-left\.svg/);
      assert.match(reviewListCode, /filled-leaves-right\.svg/);
      assert.match(reviewListCode, /listing_detail_guest_favourite/);
      // When not guest favorite, laurels are not rendered
      assert.match(reviewListCode, /ReviewIcon name="star"/);
    });

    it("integrates ReviewBreakdown with 7 compact columns and 5-to-1 distribution", () => {
      assert.match(reviewListCode, /<ReviewBreakdown/);
      assert.match(reviewBreakdownCode, /reviews_overall_rating/);
      assert.match(reviewBreakdownCode, /\[5,\s*4,\s*3,\s*2,\s*1\]/);
      assert.match(reviewBreakdownCode, /Cleanliness/);
      assert.match(reviewBreakdownCode, /Accuracy/);
      assert.match(reviewBreakdownCode, /Check-in/);
      assert.match(reviewBreakdownCode, /Communication/);
      assert.match(reviewBreakdownCode, /Location/);
      assert.match(reviewBreakdownCode, /Value/);
    });

    it("renders horizontally scrollable Guest Mention chips that trigger full modal", () => {
      assert.match(reviewListCode, /<ReviewMentionChips/);
      assert.match(reviewMentionChipsCode, /overflow-x-auto/);
      assert.match(reviewMentionChipsCode, /getMentionIconName/);
      assert.match(reviewListCode, /handleOpenFullModal\(topic\)/);
    });

    it("renders responsive 2-column review grid on desktop and 1-column on mobile", () => {
      assert.match(reviewListCode, /grid gap-x-12 gap-y-10 sm:grid-cols-2/);
    });

    it("truncates lengthy preview text with Show more and opens modal focused on review", () => {
      assert.match(reviewCardCode, /previewText\(comment\)/);
      assert.match(reviewCardCode, /onShowMore/);
      assert.match(reviewListCode, /onShowMore=\{\(id\) => handleOpenFullModal\(null, id\)\}/);
      assert.match(reviewListCode, /reviews_show_all/);
    });

    it("displays reviewer avatar, name, and membership metadata when available", () => {
      assert.match(reviewCardCode, /formatMembership/);
      assert.match(reviewCardCode, /on Homyz/);
      assert.match(reviewCardCode, /membershipInfo/);
    });

    it("displays host response when present", () => {
      assert.match(reviewCardCode, /hostResponse/);
      assert.match(reviewCardCode, /reviews_response_from_host/);
    });

    it("handles zero-review properties with dedicated friendly state", () => {
      assert.match(reviewListCode, /if \(stats\.totalCount === 0\)/);
      assert.match(reviewListCode, /reviews_no_reviews_yet/);
    });
  });

  describe("4. Full Review Modal — Airbnb-Style Dialog", () => {
    it("locks body scroll using ModalOverlay contract", () => {
      assert.match(reviewModalCode, /<ModalOverlay/);
      assert.match(reviewModalCode, /role="dialog"/);
      assert.match(reviewModalCode, /aria-modal="true"/);
    });

    it("manages keyboard accessibility, Escape closing, and focus restoration", () => {
      assert.match(reviewModalCode, /event\.key === "Escape"/);
      assert.match(reviewModalCode, /previousFocusRef\.current\?\.focus\(\)/);
      assert.match(reviewModalCode, /closeButtonRef\.current\?\.focus\(\)/);
    });

    it("provides sticky review toolbar with search, sort, and total count", () => {
      assert.match(reviewModalCode, /reviews_search_placeholder/);
      assert.match(reviewModalCode, /reviews_clear_search/);
      assert.match(reviewModalCode, /reviews_sort_by/);
      assert.match(reviewModalCode, /handleSortChange/);
      assert.match(reviewModalCode, /handleClearSearch/);
      assert.match(reviewModalCode, /totalFilteredCount/);
    });

    it("debounces search input to prevent rapid server calls", () => {
      assert.match(reviewModalCode, /setTimeout\(\(\) => \{/);
      assert.match(reviewModalCode, /setDebouncedSearch/);
      assert.match(reviewModalCode, /300\);/);
    });

    it("fetches modal reviews in batches of 10 and supports Load More pagination", () => {
      assert.match(reviewModalCode, /limit:\s*"10"/);
      assert.match(reviewModalCode, /handleLoadMore/);
      assert.match(reviewModalCode, /reviews_load_more/);
      assert.match(reviewModalCode, /page < totalPages/);
      assert.match(reviewModalCode, /isFetchingRef\.current/);
    });

    it("scrolls smoothly to target review when opened from review preview Show More", () => {
      assert.match(reviewModalCode, /targetReviewId/);
      assert.match(reviewModalCode, /modal-review-\$\{targetReviewId\}/);
      assert.match(reviewModalCode, /scrollIntoView\(\{\s*behavior:\s*"smooth"/);
    });

    it("shows clean loading skeleton and empty state when search matches nothing", () => {
      assert.match(reviewModalCode, /reviews_no_match_search/);
      assert.match(reviewModalCode, /reviews_clear_filters/);
    });
  });

  describe("5. Localization & Translation Integrity", () => {
    it("has all review keys defined in messages/en.json", () => {
      const requiredKeys = [
        "reviews_guest_reviews",
        "reviews_no_reviews_yet",
        "reviews_show_all",
        "reviews_overall_rating",
        "reviews_category_cleanliness",
        "reviews_category_accuracy",
        "reviews_category_check_in",
        "reviews_category_communication",
        "reviews_category_location",
        "reviews_category_value",
        "reviews_mentions_title",
        "reviews_search_placeholder",
        "reviews_clear_search",
        "reviews_sort_by",
        "reviews_sort_relevant",
        "reviews_sort_recent",
        "reviews_sort_highest",
        "reviews_sort_lowest",
        "reviews_clear_filters",
        "reviews_load_more",
        "reviews_show_more",
        "reviews_show_less",
        "reviews_response_from_host",
        "reviews_close",
      ];
      for (const key of requiredKeys) {
        assert.ok(
          enMessages[key],
          `Expected key "${key}" to be defined in messages/en.json`,
        );
      }
    });
  });
});
