"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useSession } from "next-auth/react";
import type { PublicReviewDTO } from "@/services/mappers";
import type { ReviewCategoryRatings, ReviewMention } from "@/services/review.service";
import { ModalOverlay } from "@/components/ui/modal-overlay";
import { ReviewCard } from "./review-card";
import { trackListingEvent } from "@/lib/analytics/listing-analytics";
import { useLanguage } from "@/lib/i18n/language-context";

const ReviewModal = dynamic(
  () => import("./review-modal").then((module) => module.ReviewModal),
  { ssr: false },
);

interface ReviewListProps {
  listingId: string;
  isGuestFavorite?: boolean;
  initialSummary: { averageRating: number | null; totalCount: number };
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

export function ReviewList({ listingId, isGuestFavorite = false, initialSummary, onStatsChange }: ReviewListProps) {
  const { t } = useLanguage();
  const { status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated";
  const callbackRef = useRef(onStatsChange);
  const [reviews, setReviews] = useState<PublicReviewDTO[]>([]);
  const [summary, setSummary] = useState(initialSummary);
  const [fullStats, setFullStats] = useState<StatsResponse["data"] | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(initialSummary.totalCount > 0);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryVersion, setRetryVersion] = useState(0);
  const [isReviewsModalOpen, setIsReviewsModalOpen] = useState(false);
  const [isReviewInfoOpen, setIsReviewInfoOpen] = useState(false);
  const reviewInfoCloseRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    callbackRef.current = onStatsChange;
  }, [onStatsChange]);

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
    const controller = new AbortController();
    async function fetchReviews() {
      setSummary(initialSummary);
      callbackRef.current?.({ rating: initialSummary.averageRating, count: initialSummary.totalCount });
      setFullStats(null);
      setReviews([]);
      setCurrentPage(1);
      setTotalPages(0);
      setIsReviewsModalOpen(false);
      if (initialSummary.totalCount === 0) {
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: "1", limit: "4" });
        const response = await fetch(`/api/v1/listings/${listingId}/reviews?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Unable to load reviews");
        const payload = (await response.json()) as ReviewsResponse;
        setReviews(payload.data);
        setCurrentPage(payload.pagination.page);
        setTotalPages(payload.pagination.totalPages);
        setSummary((current) => ({ ...current, totalCount: payload.pagination.total }));
      } catch (fetchError: unknown) {
        if (fetchError instanceof Error && fetchError.name === "AbortError") return;
        setError("Unable to load reviews right now.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    fetchReviews();
    return () => {
      controller.abort();
    };
  }, [listingId, initialSummary.averageRating, initialSummary.totalCount, retryVersion]);

  async function openAllReviews() {
    trackListingEvent({
      eventType: "reviews_opened",
      propertyId: listingId,
      metadata: { action: "show_all_reviews", totalReviews: summary.totalCount },
    });
    if (fullStats) {
      setIsReviewsModalOpen(true);
      return;
    }
    setIsStatsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/v1/listings/${listingId}/reviews/stats`);
      if (!response.ok) throw new Error("Unable to load review summary");
      const payload = (await response.json()) as StatsResponse;
      setFullStats(payload.data);
      setSummary({ averageRating: payload.data.averageRating, totalCount: payload.data.totalCount });
      callbackRef.current?.({ rating: payload.data.averageRating, count: payload.data.totalCount });
      setIsReviewsModalOpen(true);
    } catch {
      setError("Unable to load review details right now. Please try again.");
    } finally {
      setIsStatsLoading(false);
    }
  }

  if (summary.totalCount === 0) {
    return (
      <section className="border-b border-zinc-200/80 py-8" aria-labelledby="guest-reviews-heading">
        <h2 id="guest-reviews-heading" className="text-[20px] font-normal text-[#1f1f1f]">
          {t("reviews_guest_reviews", "Guest reviews")}
        </h2>
        <p className="mt-1 text-sm text-[#727272] font-normal">
          {t("reviews_no_reviews_yet", "No reviews yet. This property hasn't received any guest reviews yet.")}
        </p>
      </section>
    );
  }

  return (
    <section className="border-b border-zinc-200/80 py-8 sm:py-14" aria-labelledby="guest-reviews-heading">
      <div className="mx-auto max-w-[350px] text-center">
        <div className="flex items-center justify-center gap-4" aria-hidden="true">
          <Image
            src="/images/icons/filled-leaves-left.svg"
            alt=""
            width={70}
            height={127}
            className="h-[90px] w-[57px] sm:h-[127px] sm:w-[70px]"
          />
          <span className="text-5xl font-medium tracking-tight text-[#1f1f1f] sm:text-6xl">
            {summary.averageRating?.toFixed(2)}
          </span>
          <Image
            src="/images/icons/filled-leaves-right.svg"
            alt=""
            width={70}
            height={127}
            className="h-[90px] w-[57px] sm:h-[127px] sm:w-[70px]"
          />
        </div>
        <h2 id="guest-reviews-heading" className="mt-4 text-base font-normal text-[#1f1f1f]">
          {isGuestFavorite
            ? t("listing_detail_guest_favourite", "Guest favourite")
            : t("reviews_guest_reviews", "Guest reviews")}
        </h2>
        <p className="mt-1 text-base text-[#727272]">
          {isGuestFavorite
            ? t("listing_detail_guest_favourite_desc", "Highly rated by guests who have stayed here.")
          : summary.totalCount === 1
            ? t("reviews_one_guest_shared", "{count} guest has shared their stay.").replace("{count}", "1")
            : t("reviews_many_guests_shared", "{count} guests have shared their stay.").replace(
                "{count}",
                String(summary.totalCount),
              )}
        </p>
      </div>

      <div className="mt-10">
        {loading ? (
          <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-4 animate-pulse" aria-label={t("reviews_loading_aria", "Loading guest reviews")}>
            {Array.from({ length: 4 }, (_, index) => <div key={index} className="h-44 rounded-xl bg-zinc-100" />)}
          </div>
        ) : error && reviews.length === 0 ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
            {error}
            <button type="button" onClick={() => setRetryVersion((version) => version + 1)} className="ml-2 font-medium underline underline-offset-2">
              {t("reviews_try_again", "Try again")}
            </button>
          </p>
        ) : null}
        {!loading && <div className="grid gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              {...review}
              canReport={isAuthenticated}
            />
          ))}
        </div>}
        <div className="mt-8 flex flex-wrap items-center gap-5">
          {summary.totalCount > 0 ? (
            <button
              type="button"
              disabled={isStatsLoading}
              onClick={openAllReviews}
              className="rounded-full border border-[#1f1f1f] bg-white px-6 py-3 text-base font-normal text-[#1f1f1f] transition-colors duration-300 hover:bg-[#1f1f1f] hover:text-white disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            >
              {isStatsLoading
                ? t("host_loading", "Loading...")
                : t("reviews_show_all", "Show all {count} reviews").replace(
                    "{count}",
                    String(summary.totalCount),
                  )}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setIsReviewInfoOpen(true);
              trackListingEvent({
                eventType: "reviews_opened",
                propertyId: listingId,
                metadata: { action: "how_reviews_work", totalReviews: summary.totalCount },
              });
            }}
            className="text-base text-[#1F1F1F] underline underline-offset-4 transition-colors hover:text-[#727272] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 cursor-pointer"
          >
            {t("reviews_learn_how_work", "Learn how reviews work")}
          </button>
        </div>
        {error && reviews.length > 0 ? (
          <p className="mt-4 text-sm text-amber-800">{error}</p>
        ) : null}
      </div>

      {isReviewsModalOpen && fullStats ? (
        <ReviewModal
          isOpen={isReviewsModalOpen}
          onClose={() => setIsReviewsModalOpen(false)}
          listingId={listingId}
          isGuestFavorite={isGuestFavorite}
          stats={fullStats}
          initialReviews={reviews}
          initialPagination={{ page: currentPage, totalPages, total: summary.totalCount, limit: 4 }}
        />
      ) : null}

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

            <div className="mt-4 space-y-4 overflow-y-auto pr-1 leading-[1.45] text-[#727272] text-sm font-normal">
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
