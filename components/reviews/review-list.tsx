"use client";

import { useEffect, useRef, useState } from "react";
import type { PublicReviewDTO } from "@/services/mappers";
import type { ReviewCategoryRatings, ReviewMention } from "@/services/review.service";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { ReviewCard } from "./review-card";
import { trackListingEvent } from "@/lib/analytics/listing-analytics";

interface ReviewListProps {
  listingId: string;
  isGuestFavorite?: boolean;
  onStatsChange?: (stats: { rating: number | null; count: number }) => void;
}

interface ReviewsResponse {
  success: true;
  data: PublicReviewDTO[];
  pagination: { page: number; totalPages: number; total: number; limit: number };
}

interface StatsResponse {
  success: true;
  data: {
    averageRating: number | null;
    totalCount: number;
    ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
    categoryRatings: ReviewCategoryRatings;
    mentions: ReviewMention[];
  };
}

function ReviewSkeleton() {
  return (
    <section className="border-b border-zinc-200/80 py-8" aria-label="Loading guest reviews">
      <div className="h-7 w-48 animate-pulse rounded bg-zinc-200" />
      <div className="mt-6 grid animate-pulse gap-6 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.2fr)]">
        <div className="space-y-3">{Array.from({ length: 5 }, (_, index) => <div key={index} className="h-4 rounded bg-zinc-200" />)}</div>
        <div className="grid grid-cols-2 gap-4">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-20 rounded bg-zinc-100" />)}</div>
      </div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">{Array.from({ length: 2 }, (_, index) => <div key={index} className="h-36 rounded bg-zinc-100" />)}</div>
    </section>
  );
}

export function ReviewList({ listingId, isGuestFavorite = false, onStatsChange }: ReviewListProps) {
  const callbackRef = useRef(onStatsChange);
  const [reviews, setReviews] = useState<PublicReviewDTO[]>([]);
  const [stats, setStats] = useState<StatsResponse["data"] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReviewInfoOpen, setIsReviewInfoOpen] = useState(false);
  const reviewInfoCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { callbackRef.current = onStatsChange; }, [onStatsChange]);

  useEffect(() => {
    let ignore = false;
    async function fetchStats() {
      try {
        const response = await fetch(`/api/v1/listings/${listingId}/reviews/stats`);
        if (!response.ok) throw new Error("Unable to load review summary");
        const payload = await response.json() as StatsResponse;
        if (ignore) return;
        setStats(payload.data);
        callbackRef.current?.({ rating: payload.data.averageRating, count: payload.data.totalCount });
      } catch {
        if (!ignore) setError("Unable to load reviews right now.");
      }
    }
    fetchStats();
    return () => { ignore = true; };
  }, [listingId]);

  useEffect(() => {
    if (!isReviewInfoOpen) return;

    reviewInfoCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsReviewInfoOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isReviewInfoOpen]);

  useEffect(() => {
    let ignore = false;
    async function fetchReviews() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: "1", limit: "6" });
        const response = await fetch(`/api/v1/listings/${listingId}/reviews?${params}`);
        if (!response.ok) throw new Error("Unable to load reviews");
        const payload = await response.json() as ReviewsResponse;
        if (ignore) return;
        setReviews(payload.data);
        setCurrentPage(payload.pagination.page);
        setTotalPages(payload.pagination.totalPages);
      } catch {
        if (!ignore) setError("Unable to load reviews right now.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchReviews();
    return () => { ignore = true; };
  }, [listingId]);

  async function showMore() {
    const nextPage = currentPage + 1;
    setLoadingMore(true);
    trackListingEvent({
      eventType: "reviews_opened",
      propertyId: listingId,
      metadata: { action: "show_more_reviews", nextPage, totalReviews: stats?.totalCount },
    });
    try {
      const params = new URLSearchParams({ page: String(nextPage), limit: "6" });
      const response = await fetch(`/api/v1/listings/${listingId}/reviews?${params}`);
      if (!response.ok) throw new Error("Unable to load more reviews");
      const payload = await response.json() as ReviewsResponse;
      setReviews((current) => [...current, ...payload.data]);
      setCurrentPage(payload.pagination.page);
      setTotalPages(payload.pagination.totalPages);
    } catch {
      setError("Unable to load more reviews right now.");
    } finally {
      setLoadingMore(false);
    }
  }

  if (loading && !stats) return <ReviewSkeleton />;

  if (!stats) {
    return (
      <section className="border-b border-zinc-200/80 py-8" aria-labelledby="guest-reviews-heading">
        <h2 id="guest-reviews-heading" className="text-[20px] font-normal text-[#1f1f1f]">Guest reviews</h2>
        <p className="mt-1 text-sm text-[#727272] font-normal">{error ?? "Unable to load reviews right now."}</p>
      </section>
    );
  }

  if (stats.totalCount === 0) {
    return (
      <section className="border-b border-zinc-200/80 py-8" aria-labelledby="guest-reviews-heading">
        <h2 id="guest-reviews-heading" className="text-[20px] font-normal text-[#1f1f1f]">Guest reviews</h2>
        <p className="mt-1 text-sm text-[#727272] font-normal">No reviews yet. This property hasn&apos;t received any guest reviews yet.</p>
      </section>
    );
  }

  return (
    <section className="border-b border-zinc-200/80 py-10 sm:py-14" aria-labelledby="guest-reviews-heading">
      <div className="mx-auto max-w-lg text-center">
        <div className="flex items-center justify-center gap-3" aria-hidden="true">
          <span className="text-4xl text-[#d9ad4d]">❦</span>
          <span className="text-5xl font-semibold tracking-tight text-zinc-900 sm:text-6xl">{stats.averageRating?.toFixed(2)}</span>
          <span className="-scale-x-100 text-4xl text-[#d9ad4d]">❦</span>
        </div>
        <h2 id="guest-reviews-heading" className="mt-4 text-sm font-semibold text-zinc-900">{isGuestFavorite ? "Guest favourite" : "Guest reviews"}</h2>
        <p className="mt-1 text-xs leading-5 text-zinc-500">{isGuestFavorite ? "This home is highly rated by guests based on reviews and reliability." : `${stats.totalCount} ${stats.totalCount === 1 ? "guest has" : "guests have"} shared their stay.`}</p>
      </div>

      <div className="mt-10">
        {error && reviews.length === 0 ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{error}</p> : null}
        <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
          {reviews.map((review) => <ReviewCard key={review.id} {...review} />)}
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-5">
          {currentPage < totalPages ? <button type="button" disabled={loadingMore} onClick={showMore} className="rounded-full border border-zinc-400 px-5 py-2.5 text-sm font-semibold transition-colors hover:border-zinc-900 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50">{loadingMore ? "Loading…" : `Show all ${stats.totalCount} reviews`}</button> : null}
          <button
            type="button"
            onClick={() => {
              setIsReviewInfoOpen(true);
              trackListingEvent({
                eventType: "reviews_opened",
                propertyId: listingId,
                metadata: { action: "how_reviews_work", totalReviews: stats.totalCount },
              });
            }}
            className="text-xs text-zinc-600 underline underline-offset-4 transition-colors hover:text-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 cursor-pointer"
          >
            How reviews work
          </button>
        </div>
        {error && reviews.length > 0 ? <p className="mt-4 text-sm text-amber-800">{error}</p> : null}
      </div>

      {isReviewInfoOpen && (
        <ModalOverlay
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-info-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/35 p-4 backdrop-blur-xs"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsReviewInfoOpen(false);
          }}
        >
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-[360px] flex-col rounded-[26px] bg-white px-4 py-5 shadow-2xl sm:max-w-[430px] sm:px-6 sm:py-7">
            <div className="flex items-start justify-between gap-4">
              <h3 id="review-info-modal-title" className="pt-0.5 text-lg font-semibold tracking-tight text-zinc-900">How reviews work</h3>
              <button
                ref={reviewInfoCloseRef}
                type="button"
                onClick={() => setIsReviewInfoOpen(false)}
                aria-label="Close review information"
                className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-xl font-light leading-none text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-4 overflow-y-auto pr-1 text-[13px] leading-[1.45] text-zinc-800">
              <p>Reviews from past guests help our community learn more about each home. By default, reviews are sorted by relevance. Relevance is based on recency, length and information that you provided to us, such as your booking search, your country and your language preferences.</p>
              <p>Only the guest who made the reservation can leave a review, and Homyz only moderates reviews flagged for not following our policies.</p>
              <p>To be eligible for a percentile ranking or guest favourite label, listings need at least 5 reviews in the last 4 years. Criteria are subject to change.</p>
              <a href="/help" className="inline-block font-medium underline underline-offset-2 hover:text-zinc-950">Learn more in our Help Centre</a>
            </div>
          </div>
        </ModalOverlay>
      )}
    </section>
  );
}
