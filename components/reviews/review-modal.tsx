"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import type { PublicReviewDTO } from "@/services/mappers";
import type { ReviewCategoryRatings, ReviewMention, ReviewSortOption } from "@/services/review.service";
import { ReviewCard } from "./review-card";
import { ReviewBreakdown } from "./review-breakdown";
import { ReviewMentionChips } from "./review-mention-chips";
import { ReviewIcon } from "./review-icon";
import { useLanguage } from "@/lib/i18n/language-context";

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  listingId: string;
  isGuestFavorite?: boolean;
  stats: {
    averageRating: number | null;
    totalCount: number;
    ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
    categoryRatings: ReviewCategoryRatings;
    mentions: ReviewMention[];
  };
  initialReviews?: PublicReviewDTO[];
  initialMention?: string | null;
  targetReviewId?: string | null;
}

interface ReviewsApiResponse {
  success: boolean;
  data: PublicReviewDTO[];
  pagination: { page: number; totalPages: number; total: number; limit: number };
}

export function ReviewModal({
  isOpen,
  onClose,
  listingId,
  isGuestFavorite = false,
  stats,
  initialReviews = [],
  initialMention = null,
  targetReviewId = null,
}: ReviewModalProps) {
  const { t } = useLanguage();
  const [reviews, setReviews] = useState<PublicReviewDTO[]>(() => initialReviews ?? []);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalFilteredCount, setTotalFilteredCount] = useState<number>(stats.totalCount);
  const [sort, setSort] = useState<ReviewSortOption>("recent");
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedMention, setSelectedMention] = useState<string | null>(initialMention);

  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const reviewsContainerRef = useRef<HTMLDivElement>(null);
  const isFetchingRef = useRef(false);
  const targetScrolledRef = useRef(false);

  // Focus management & Escape key handling
  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;
    targetScrolledRef.current = false;

    // Small delay to ensure focus lands on the close button smoothly
    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  // Debounce search input (approx 300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleSortChange = (newSort: ReviewSortOption) => {
    setSort(newSort);
  };

  const handleRatingChange = (newRating: number | null) => {
    setSelectedRating(newRating);
  };

  const handleMentionChange = (newMention: string | null) => {
    setSelectedMention(newMention);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setDebouncedSearch("");
  };

  const handleClearAllFilters = () => {
    handleClearSearch();
    setSelectedMention(null);
    setSelectedRating(null);
  };

  const [retryCount, setRetryCount] = useState(0);

  // Fetch first page of reviews when filters change, modal opens, or retry requested
  useEffect(() => {
    if (!isOpen) return;

    let ignore = false;
    const controller = new AbortController();

    async function loadFirstPage() {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          page: "1",
          limit: "10",
          sort,
        });

        if (debouncedSearch) {
          params.set("search", debouncedSearch);
        }
        if (selectedMention) {
          params.set("mention", selectedMention);
        }
        if (selectedRating !== null) {
          params.set("rating", String(selectedRating));
        }

        const res = await fetch(`/api/v1/listings/${listingId}/reviews?${params}`, {
          signal: controller.signal,
        });

        if (!res.ok) throw new Error("Failed to load reviews");
        const json = (await res.json()) as ReviewsApiResponse;

        if (ignore) return;
        setReviews(json.data);
        setPage(json.pagination.page);
        setTotalPages(json.pagination.totalPages);
        setTotalFilteredCount(json.pagination.total);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!ignore) setError("Unable to load reviews right now. Please try again.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadFirstPage();

    return () => {
      ignore = true;
      controller.abort();
    };
  }, [isOpen, listingId, debouncedSearch, selectedMention, selectedRating, sort, retryCount]);

  // Load next page of reviews
  const handleLoadMore = async () => {
    if (loadingMore || isFetchingRef.current || page >= totalPages) return;
    const nextPage = page + 1;
    isFetchingRef.current = true;
    setLoadingMore(true);

    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: "10",
        sort,
      });

      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }
      if (selectedMention) {
        params.set("mention", selectedMention);
      }
      if (selectedRating !== null) {
        params.set("rating", String(selectedRating));
      }

      const res = await fetch(`/api/v1/listings/${listingId}/reviews?${params}`);
      if (!res.ok) throw new Error("Failed to load more reviews");
      const json = (await res.json()) as ReviewsApiResponse;

      setReviews((prev) => {
        const existingIds = new Set(prev.map((r) => r.id));
        const newUnique = json.data.filter((r) => !existingIds.has(r.id));
        return [...prev, ...newUnique];
      });

      setPage(json.pagination.page);
      setTotalPages(json.pagination.totalPages);
      setTotalFilteredCount(json.pagination.total);
    } catch {
      setError("Unable to load more reviews right now.");
    } finally {
      isFetchingRef.current = false;
      setLoadingMore(false);
    }
  };

  // Scroll to target review once loaded
  useEffect(() => {
    if (!targetReviewId || targetScrolledRef.current || reviews.length === 0) return;

    const targetEl = document.getElementById(`modal-review-${targetReviewId}`);
    if (targetEl) {
      targetScrolledRef.current = true;
      setTimeout(() => {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
        targetEl.classList.add("ring-2", "ring-zinc-900", "rounded-xl", "p-2");
      }, 100);
    }
  }, [targetReviewId, reviews]);

  if (!isOpen) return null;

  return (
    <ModalOverlay
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-review-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 sm:p-4 md:p-6 backdrop-blur-xs"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex h-full max-h-full w-full flex-col bg-white sm:h-[90vh] sm:max-h-[920px] sm:max-w-4xl md:max-w-5xl lg:max-w-6xl sm:rounded-3xl shadow-2xl overflow-hidden">
        {/* Modal Top Bar (Mobile & Desktop Close) */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200/80 px-4 sm:px-6 bg-white z-20">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t("reviews_close", "Close reviews")}
            className="flex size-9 items-center justify-center rounded-full text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-zinc-900 cursor-pointer"
          >
            <ReviewIcon name="close" className="size-5" />
          </button>
          <h2 id="modal-review-title" className="text-base font-semibold text-[#1f1f1f] sm:hidden truncate px-2">
            {t("reviews_guest_reviews", "Guest reviews")}
          </h2>
          <div className="w-9 sm:hidden" />
        </div>

        {/* Modal Main Body: Responsive stacked on mobile/tablet, 2-column on desktop (lg: 1024px+) */}
        <div className="flex-1 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[380px_1fr] xl:grid-cols-[400px_1fr]">
          {/* Left Column (Desktop) / Top Section (Mobile & Tablet): Rating Summary */}
          <div className="border-b border-zinc-200/80 p-6 sm:p-8 lg:border-b-0 lg:border-r lg:overflow-y-auto space-y-6">
            {/* Rating Header */}
            <div>
              {isGuestFavorite ? (
                <div className="text-center sm:text-left">
                  <div className="flex items-center justify-center sm:justify-start gap-3">
                    <Image
                      src="/images/icons/filled-leaves-left.svg"
                      alt=""
                      width={48}
                      height={80}
                      className="h-16 w-10 shrink-0"
                    />
                    <span className="text-5xl font-semibold tracking-tight text-[#1f1f1f]">
                      {stats.averageRating?.toFixed(2) ?? "—"}
                    </span>
                    <Image
                      src="/images/icons/filled-leaves-right.svg"
                      alt=""
                      width={48}
                      height={80}
                      className="h-16 w-10 shrink-0"
                    />
                  </div>
                  <h3 className="mt-3 text-xl font-semibold text-[#1f1f1f]">
                    {t("listing_detail_guest_favourite", "Guest favourite")}
                  </h3>
                  <p className="mt-1 text-sm text-[#727272]">
                    {t(
                      "listing_detail_guest_favourite_desc",
                      "One of the most loved homes on Homyz based on ratings, reviews, and reliability.",
                    )}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <ReviewIcon name="star" className="size-8 fill-zinc-900 text-zinc-900" />
                  <span className="text-4xl font-semibold tracking-tight text-[#1f1f1f]">
                    {stats.averageRating?.toFixed(2) ?? "—"}
                  </span>
                  <span className="text-xl font-normal text-[#727272]">
                    · {stats.totalCount} {stats.totalCount === 1 ? t("reviews_count_singular", "review") : t("reviews_count_plural", "reviews")}
                  </span>
                </div>
              )}
            </div>

            {/* Rating Breakdown Bars & Scores (Sidebar variant) */}
            <div className="border-t border-zinc-200/80 pt-6">
              <ReviewBreakdown
                totalCount={stats.totalCount}
                ratingDistribution={stats.ratingDistribution}
                categoryRatings={stats.categoryRatings}
                variant="sidebar"
                selectedRating={selectedRating}
                onSelectRating={handleRatingChange}
              />
            </div>

            {/* Mention Chips */}
            {stats.mentions && stats.mentions.length > 0 && (
              <div className="border-t border-zinc-200/80 pt-6">
                <p className="mb-3 text-sm font-semibold text-[#1f1f1f]">
                  {t("reviews_mentions_title", "Guests frequently mention")}
                </p>
                <ReviewMentionChips
                  mentions={stats.mentions}
                  selectedMention={selectedMention}
                  onSelectMention={handleMentionChange}
                />
              </div>
            )}
          </div>

          {/* Right Column: Search Toolbar, Review Count, Filters, Sorting & Reviews */}
          <div className="flex flex-col min-w-0 bg-white lg:h-full lg:overflow-hidden">
            {/* Sticky Review Toolbar */}
            <div className="sticky top-0 z-10 border-b border-zinc-200/80 bg-white px-4 py-3 sm:px-6 sm:py-4 space-y-3">
              {/* Search Bar */}
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-zinc-500">
                  <ReviewIcon name="search" className="size-4" />
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={t("reviews_search_placeholder", "Search reviews")}
                  className="w-full rounded-full border border-zinc-300 bg-white py-2.5 pl-10 pr-10 text-sm text-[#1f1f1f] placeholder:text-zinc-500 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    aria-label={t("reviews_clear_search", "Clear search")}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  >
                    <ReviewIcon name="close" className="size-4" />
                  </button>
                )}
              </div>

              {/* Toolbar Controls: Count, Badges, Sort & Rating Filter */}
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[#1f1f1f]">
                    {totalFilteredCount}{" "}
                    {totalFilteredCount === 1
                      ? t("reviews_count_singular", "review")
                      : t("reviews_count_plural", "reviews")}
                  </span>
                  {selectedMention && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-800">
                      <span>{selectedMention}</span>
                      <button
                        type="button"
                        onClick={() => handleMentionChange(null)}
                        aria-label={`Remove ${selectedMention} filter`}
                        className="cursor-pointer hover:text-zinc-950"
                      >
                        <ReviewIcon name="close" className="size-3" />
                      </button>
                    </span>
                  )}
                  {selectedRating !== null && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-zinc-900 text-white px-2.5 py-0.5 text-xs font-medium">
                      <span>
                        {selectedRating === 1
                          ? t("reviews_filter_1_star", "1 star")
                          : `${selectedRating} ${t("reviews_stars", "stars")}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRatingChange(null)}
                        aria-label="Remove star rating filter"
                        className="cursor-pointer hover:text-zinc-300"
                      >
                        <ReviewIcon name="close" className="size-3" />
                      </button>
                    </span>
                  )}
                </div>

                {/* Filter and Sort Dropdowns */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Rating Filter Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="review-rating-select" className="text-xs text-[#727272]">
                      {t("reviews_filter_rating", "Rating:")}
                    </label>
                    <select
                      id="review-rating-select"
                      value={selectedRating !== null ? String(selectedRating) : "all"}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleRatingChange(val === "all" ? null : Number(val));
                      }}
                      className="rounded-lg border border-zinc-300 bg-white py-1.5 pl-2.5 pr-8 text-xs font-semibold text-[#1f1f1f] focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 cursor-pointer"
                    >
                      <option value="all">{t("reviews_filter_all_ratings", "All reviews")}</option>
                      <option value="5">{t("reviews_filter_5_stars", "5 stars")}</option>
                      <option value="4">{t("reviews_filter_4_stars", "4 stars")}</option>
                      <option value="3">{t("reviews_filter_3_stars", "3 stars")}</option>
                      <option value="2">{t("reviews_filter_2_stars", "2 stars")}</option>
                      <option value="1">{t("reviews_filter_1_star", "1 star")}</option>
                    </select>
                  </div>

                  {/* Sort Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <label htmlFor="review-sort-select" className="text-xs text-[#727272]">
                      {t("reviews_sort_by", "Sort by:")}
                    </label>
                    <select
                      id="review-sort-select"
                      value={sort}
                      onChange={(e) => handleSortChange(e.target.value as ReviewSortOption)}
                      className="rounded-lg border border-zinc-300 bg-white py-1.5 pl-2.5 pr-8 text-xs font-semibold text-[#1f1f1f] focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 cursor-pointer"
                    >
                      <option value="recent">{t("reviews_sort_recent", "Most recent")}</option>
                      <option value="oldest">{t("reviews_sort_oldest", "Oldest first")}</option>
                      <option value="highest">{t("reviews_sort_highest", "Highest rated")}</option>
                      <option value="lowest">{t("reviews_sort_lowest", "Lowest rated")}</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Scrollable Review Content Area */}
            <div
              ref={reviewsContainerRef}
              className="lg:flex-1 lg:overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-8 space-y-8"
              aria-live="polite"
            >
              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={() => setRetryCount((c) => c + 1)}
                    className="mt-2 font-semibold underline hover:text-red-950 cursor-pointer"
                  >
                    {t("reviews_try_again", "Try again")}
                  </button>
                </div>
              )}

              {loading && reviews.length === 0 ? (
                // Skeletons for first page load
                <div className="space-y-8 animate-pulse" aria-label="Loading reviews">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-3 pb-6 border-b border-zinc-100">
                      <div className="flex items-center gap-3">
                        <div className="size-11 rounded-full bg-zinc-200" />
                        <div className="space-y-1.5 flex-1">
                          <div className="h-4 w-32 rounded bg-zinc-200" />
                          <div className="h-3 w-20 rounded bg-zinc-100" />
                        </div>
                      </div>
                      <div className="h-4 w-24 rounded bg-zinc-200" />
                      <div className="h-16 w-full rounded bg-zinc-100" />
                    </div>
                  ))}
                </div>
              ) : reviews.length === 0 ? (
                // Empty State
                <div className="py-12 text-center space-y-3">
                  <p className="text-base font-semibold text-[#1f1f1f]">
                    {debouncedSearch
                      ? t("reviews_no_match_search", "No reviews matching '{query}'").replace(
                          "{query}",
                          debouncedSearch,
                        )
                      : selectedRating !== null
                      ? t("reviews_no_match_rating", "No {rating}-star reviews found.").replace(
                          "{rating}",
                          String(selectedRating),
                        )
                      : selectedMention
                      ? t("reviews_no_match_mention", "No reviews found for this topic.")
                      : t("reviews_no_reviews_yet", "No reviews yet.")}
                  </p>
                  {(debouncedSearch || selectedMention || selectedRating !== null) && (
                    <button
                      type="button"
                      onClick={handleClearAllFilters}
                      className="rounded-full border border-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-100 cursor-pointer"
                    >
                      {t("reviews_clear_filters", "Clear all filters")}
                    </button>
                  )}
                </div>
              ) : (
                // Review List
                <div className="divide-y divide-zinc-200/80">
                  {reviews.map((review) => (
                    <div
                      key={review.id}
                      id={`modal-review-${review.id}`}
                      className="py-6 first:pt-0 last:pb-0"
                    >
                      <ReviewCard
                        {...review}
                        isModalView={true}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Load More Button & Inline Spinner */}
              {page < totalPages && !loading && (
                <div className="pt-4 text-center">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="rounded-full border border-zinc-900 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                  >
                    {loadingMore
                      ? t("reviews_loading_more", "Loading more reviews...")
                      : t("reviews_load_more", "Load more reviews")}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
}
