"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import type { PublicReviewDTO } from "@/services/mappers";
import type { ReviewCategoryRatings, ReviewMention } from "@/services/review.service";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { ReviewCard } from "./review-card";
import { ReviewBreakdown } from "./review-breakdown";
import { ReviewMentionChips } from "./review-mention-chips";
import { ReviewModal } from "./review-modal";
import { ReviewIcon } from "./review-icon";
import { trackListingEvent } from "@/lib/analytics/listing-analytics";
import { useLanguage } from "@/lib/i18n/language-context";

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
  const { t } = useLanguage();
  return (
    <section
      className="border-b border-zinc-200/80 py-8 sm:py-12"
      aria-label={t("reviews_loading_aria", "Loading guest reviews")}
    >
      {/* Header Skeleton */}
      <div className="mx-auto max-w-[360px] text-center space-y-3 animate-pulse">
        <div className="mx-auto h-16 w-36 rounded-xl bg-zinc-200" />
        <div className="mx-auto h-5 w-44 rounded bg-zinc-200" />
        <div className="mx-auto h-4 w-64 rounded bg-zinc-100" />
      </div>

      {/* Breakdown Skeleton */}
      <div className="mt-8 overflow-hidden animate-pulse">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {Array.from({ length: 7 }, (_, index) => (
            <div key={index} className="h-24 rounded-xl bg-zinc-100" />
          ))}
        </div>
      </div>

      {/* Chips Skeleton */}
      <div className="mt-6 flex gap-2 animate-pulse overflow-hidden">
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="h-9 w-28 rounded-full bg-zinc-100 shrink-0" />
        ))}
      </div>

      {/* 2-Column Review Cards Skeleton */}
      <div className="mt-8 grid gap-8 sm:grid-cols-2">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-3 rounded-xl p-2 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="size-11 rounded-full bg-zinc-200" />
              <div className="space-y-1.5 flex-1">
                <div className="h-4 w-32 rounded bg-zinc-200" />
                <div className="h-3 w-20 rounded bg-zinc-100" />
              </div>
            </div>
            <div className="h-3.5 w-24 rounded bg-zinc-200" />
            <div className="h-16 rounded bg-zinc-100" />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ReviewList({
  listingId,
  isGuestFavorite = false,
  onStatsChange,
}: ReviewListProps) {
  const { t } = useLanguage();
  const callbackRef = useRef(onStatsChange);
  const [reviews, setReviews] = useState<PublicReviewDTO[]>([]);
  const [stats, setStats] = useState<StatsResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [isReviewInfoOpen, setIsReviewInfoOpen] = useState(false);
  const [isFullModalOpen, setIsFullModalOpen] = useState(false);
  const [modalMention, setModalMention] = useState<string | null>(null);
  const [modalTargetReviewId, setModalTargetReviewId] = useState<string | null>(null);

  const reviewInfoCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    callbackRef.current = onStatsChange;
  }, [onStatsChange]);

  // Fetch summary stats
  useEffect(() => {
    let ignore = false;
    async function fetchStats() {
      try {
        const response = await fetch(`/api/v1/listings/${listingId}/reviews/stats`);
        if (!response.ok) throw new Error("Unable to load review summary");
        const payload = (await response.json()) as StatsResponse;
        if (ignore) return;
        setStats(payload.data);
        callbackRef.current?.({
          rating: payload.data.averageRating,
          count: payload.data.totalCount,
        });
      } catch {
        if (!ignore) setError("Unable to load reviews right now.");
      }
    }
    fetchStats();
    return () => {
      ignore = true;
    };
  }, [listingId]);

  // Fetch preview reviews (batch of 6)
  useEffect(() => {
    let ignore = false;
    async function fetchPreviewReviews() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: "1", limit: "6", sort: "relevant" });
        const response = await fetch(`/api/v1/listings/${listingId}/reviews?${params}`);
        if (!response.ok) throw new Error("Unable to load reviews");
        const payload = (await response.json()) as ReviewsResponse;
        if (ignore) return;
        setReviews(payload.data);
      } catch {
        if (!ignore) setError("Unable to load reviews right now.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    fetchPreviewReviews();
    return () => {
      ignore = true;
    };
  }, [listingId]);

  // Keyboard Escape for "How reviews work" modal
  useEffect(() => {
    if (!isReviewInfoOpen) return;

    reviewInfoCloseRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsReviewInfoOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [isReviewInfoOpen]);

  const handleOpenFullModal = useCallback((mention: string | null = null, targetId: string | null = null) => {
    setModalMention(mention);
    setModalTargetReviewId(targetId);
    setIsFullModalOpen(true);
    trackListingEvent({
      eventType: "reviews_opened",
      propertyId: listingId,
      metadata: { action: "open_full_review_modal", mention, targetId },
    });
  }, [listingId]);

  if (loading && !stats) return <ReviewSkeleton />;

  if (!stats) {
    return (
      <section className="border-b border-zinc-200/80 py-8" aria-labelledby="guest-reviews-heading">
        <h2 id="guest-reviews-heading" className="text-[20px] font-normal text-[#1f1f1f]">
          {t("reviews_guest_reviews", "Guest reviews")}
        </h2>
        <p className="mt-1 text-sm font-normal text-[#727272]">
          {error ?? "Unable to load reviews right now."}
        </p>
      </section>
    );
  }

  if (stats.totalCount === 0) {
    return (
      <section className="border-b border-zinc-200/80 py-8" aria-labelledby="guest-reviews-heading">
        <h2 id="guest-reviews-heading" className="text-[20px] font-normal text-[#1f1f1f]">
          {t("reviews_guest_reviews", "Guest reviews")}
        </h2>
        <p className="mt-1 text-sm font-normal text-[#727272]">
          {t(
            "reviews_no_reviews_yet",
            "No reviews yet. This property hasn't received any guest reviews yet.",
          )}
        </p>
      </section>
    );
  }

  return (
    <section
      className="border-b border-zinc-200/80 py-8 sm:py-14"
      aria-labelledby="guest-reviews-heading"
    >
      {/* 1. Rating Header */}
      <div className="mx-auto max-w-[420px] text-center">
        {isGuestFavorite ? (
          <>
            <div className="flex items-center justify-center gap-4" aria-hidden="true">
              <Image
                src="/images/icons/filled-leaves-left.svg"
                alt=""
                width={70}
                height={127}
                className="h-[90px] w-[57px] sm:h-[127px] sm:w-[70px]"
              />
              <span className="text-5xl font-medium tracking-tight text-[#1f1f1f] sm:text-6xl">
                {stats.averageRating?.toFixed(2)}
              </span>
              <Image
                src="/images/icons/filled-leaves-right.svg"
                alt=""
                width={70}
                height={127}
                className="h-[90px] w-[57px] sm:h-[127px] sm:w-[70px]"
              />
            </div>
            <h2 id="guest-reviews-heading" className="mt-4 text-xl sm:text-2xl font-semibold text-[#1f1f1f]">
              {t("listing_detail_guest_favourite", "Guest favourite")}
            </h2>
            <p className="mt-1.5 text-sm sm:text-base text-[#727272]">
              {t(
                "listing_detail_guest_favourite_desc",
                "One of the most loved homes on Homyz, according to guests.",
              )}
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-3">
              <Image
                src="/images/icons/filled-leaves-left.svg"
                alt=""
                width={70}
                height={127}
                className="h-[90px] w-[57px] sm:h-[127px] sm:w-[70px]"
              />
              <span className="text-5xl font-medium tracking-tight text-[#1f1f1f] sm:text-6xl">
                {stats.averageRating?.toFixed(2)}
              </span>
              <Image
                src="/images/icons/filled-leaves-right.svg"
                alt=""
                width={70}
                height={127}
                className="h-[90px] w-[57px] sm:h-[127px] sm:w-[70px]"
              />
            </div>
            <h2 id="guest-reviews-heading" className="mt-4 text-xl sm:text-2xl font-semibold text-[#1f1f1f]">
              {t("reviews_guest_reviews", "Guest reviews")}
            </h2>
            <p className="mt-1.5 text-sm sm:text-base text-[#727272]">
              {stats.totalCount === 1
                ? t("reviews_one_guest_shared", "{count} guest has shared their stay.").replace(
                    "{count}",
                    "1",
                  )
                : t("reviews_many_guests_shared", "{count} guests have shared their stay.").replace(
                    "{count}",
                    String(stats.totalCount),
                  )}
            </p>
          </>
        )}

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
          className="mt-3 inline-block text-xs font-normal text-[#727272] underline underline-offset-4 transition-colors hover:text-[#1f1f1f] cursor-pointer"
        >
          {t("reviews_learn_how_work", "Learn how reviews work")}
        </button>
      </div>

      {/* 2. Rating Breakdown */}
      <div className="mt-10 border-t border-zinc-200/80 pt-6">
        <ReviewBreakdown
          totalCount={stats.totalCount}
          ratingDistribution={stats.ratingDistribution}
          categoryRatings={stats.categoryRatings}
          averageRating={stats.averageRating}
        />
      </div>

      {/* 3. Guests Mention (Horizontally scrollable mention chips) */}
      {/* {stats.mentions && stats.mentions.length > 0 && (
        <div className="mt-6 border-t border-zinc-200/80 pt-6">
          <p className="mb-3 text-sm font-semibold text-[#1f1f1f]">
            {t("reviews_mentions_title", "Guests frequently mention")}
          </p>
          <ReviewMentionChips
            mentions={stats.mentions}
            onSelectMention={(topic) => handleOpenFullModal(topic)}
          />
        </div>
      )} */}

      {/* 4. Review Preview (Responsive two-column grid on desktop, single column on mobile) */}
      <div className="mt-10 border-t border-zinc-200/80 pt-8">
        {error && reviews.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            {error}
          </p>
        ) : null}

        <div className="grid gap-x-12 gap-y-10 sm:grid-cols-2">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              {...review}
              onShowMore={(id) => handleOpenFullModal(null, id)}
            />
          ))}
        </div>

        {/* Actions under preview */}
        <div className="mt-10 flex flex-wrap items-center gap-5">
          <button
            type="button"
            onClick={() => handleOpenFullModal(null)}
            className="rounded-lg border border-[#1f1f1f] bg-white px-6 py-3.5 text-base font-semibold text-[#1f1f1f] transition-colors hover:bg-zinc-50 cursor-pointer"
          >
            {t("reviews_show_all", "Show all {count} reviews").replace(
              "{count}",
              String(stats.totalCount),
            )}
          </button>
        </div>
      </div>

      {/* Full Review Modal (Airbnb-inspired) */}
      {isFullModalOpen && (
        <ReviewModal
          isOpen={isFullModalOpen}
          onClose={() => setIsFullModalOpen(false)}
          listingId={listingId}
          isGuestFavorite={isGuestFavorite}
          stats={stats}
          initialReviews={reviews}
          initialMention={modalMention}
          targetReviewId={modalTargetReviewId}
        />
      )}

      {/* How Reviews Work Informational Dialog */}
      {isReviewInfoOpen && (
        <ModalOverlay
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-info-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-xs"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsReviewInfoOpen(false);
          }}
        >
          <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-[360px] flex-col rounded-2xl bg-white px-4 py-5 shadow-2xl sm:max-w-[430px] sm:px-6 sm:py-7">
            <div className="flex items-start justify-between gap-4">
              <h3 id="review-info-modal-title" className="pt-0.5 text-xl font-medium text-[#1f1f1f]">
                {t("reviews_how_reviews_work", "How reviews work")}
              </h3>
              <button
                ref={reviewInfoCloseRef}
                type="button"
                onClick={() => setIsReviewInfoOpen(false)}
                aria-label="Close review information"
                className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-2xl font-medium leading-none text-[#1f1f1f] hover:text-[#727272] transition-colors hover:bg-zinc-100 duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="mt-4 space-y-4 overflow-y-auto pr-1 leading-[1.45] text-[#1f1f1f] text-sm font-normal">
              <p>
                {t(
                  "reviews_explainer_1",
                  "Reviews from past guests help our community learn more about each home. By default, reviews are sorted by relevance. Relevance is based on recency, length and information that you provided to us, such as your booking search, your country and your language preferences.",
                )}
              </p>
              <p>
                {t(
                  "reviews_explainer_2",
                  "Only the guest who made the reservation can leave a review, and Homyz only moderates reviews flagged for not following our policies.",
                )}
              </p>
              <p>
                {t(
                  "reviews_explainer_3",
                  "To be eligible for a percentile ranking or guest favourite label, listings need at least 5 reviews in the last 4 years. Criteria are subject to change.",
                )}
              </p>
              <a
                href="/help"
                className="inline-block font-medium underline underline-offset-2 hover:text-zinc-950"
              >
                {t("reviews_help_centre_link", "Learn more in our Help Centre")}
              </a>
            </div>
          </div>
        </ModalOverlay>
      )}
    </section>
  );
}
