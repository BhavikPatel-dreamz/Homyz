"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/language-context";
import { PublicHostIdentityCard } from "@/components/users/public-host-identity-card";
import type { PublicHostProfile } from "@/services/user.service";

interface PublicHostReviewsViewProps {
  host: PublicHostProfile["host"];
  reviews: PublicHostProfile["reviews"];
  stats: PublicHostProfile["stats"];
}

type SortOption = "recent" | "oldest" | "highest" | "lowest";

function ReviewStarRating({ rating }: { rating: number }) {
  return (
    <span
      className="flex items-center gap-0.5 text-[#1F1F1F]"
      aria-label={`Rated ${rating} out of 5`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Image
          key={index}
          src="/images/icons/review-star.svg"
          alt=""
          width={15}
          height={15}
          className={`size-[15px] ${index < rating ? "opacity-100" : "opacity-20"}`}
        />
      ))}
      <span className="sr-only">Rated {rating} out of 5</span>
    </span>
  );
}

function ReviewCardItem({
  review,
  formatRelativeDate,
  defaultAuthorName,
}: {
  review: PublicHostProfile["reviews"][number];
  formatRelativeDate: (date: Date | string) => string;
  defaultAuthorName: string;
}) {
  const [imageError, setImageError] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const authorName = review.author.name || defaultAuthorName;
  const initial = (review.author.name || "G").charAt(0).toUpperCase();
  const listingHref = review.listing.customSlug || review.listing.id
    ? `/listings/${review.listing.customSlug || review.listing.id}`
    : undefined;

  const isLong = review.comment.length > 220;
  const displayComment = !isLong || isExpanded
    ? review.comment
    : `${review.comment.slice(0, 220).trim()}…`;

  return (
    <article className="flex flex-col justify-between rounded-[10px] sm:rounded-[20px] border border-zinc-200/80 bg-white p-5 sm:p-6 shadow-[0px_2px_8px_rgba(0,0,0,0.04)] transition-all hover:border-zinc-300 hover:shadow-[0px_4px_16px_rgba(0,0,0,0.06)]">
      <div>
        {/* Author header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {review.author.image && !imageError ? (
              <img
                src={review.author.image}
                alt={authorName}
                loading="lazy"
                onError={() => setImageError(true)}
                className="size-11 shrink-0 rounded-full border border-zinc-200 object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-100 text-sm font-bold text-amber-900"
              >
                {initial}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-base font-medium text-[#1F1F1F]">{authorName}</p>
              <p className="text-xs text-[#727272]">{formatRelativeDate(review.createdAt)}</p>
            </div>
          </div>

          {/* Star rating on top right */}
          <div className="shrink-0 pt-1">
            <ReviewStarRating rating={review.rating} />
          </div>
        </div>

        {/* Listing reference pill */}
        {review.listing.title && (
          <div className="mt-3.5">
            {listingHref ? (
              <Link
                href={listingHref}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#F3F4F5] px-3 py-1 text-xs font-medium text-[#1F1F1F] transition-colors hover:bg-zinc-200"
              >
                <svg className="size-3 shrink-0 text-[#727272]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span className="truncate">{review.listing.title}</span>
              </Link>
            ) : (
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#F3F4F5] px-3 py-1 text-xs font-medium text-[#1F1F1F]">
                <svg className="size-3 shrink-0 text-[#727272]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                <span className="truncate">{review.listing.title}</span>
              </span>
            )}
          </div>
        )}

        {/* Comment text */}
        <p className="mt-3.5 whitespace-pre-line text-sm leading-relaxed text-[#1F1F1F] sm:text-[15px]">
          {displayComment}
        </p>
      </div>

      {/* Show more toggle */}
      {isLong && (
        <div className="mt-3 pt-1">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="inline-flex cursor-pointer text-xs font-semibold text-[#1F1F1F] underline underline-offset-4 transition-colors hover:text-[#727272]"
          >
            {isExpanded ? "Show less" : "Show more"}
          </button>
        </div>
      )}
    </article>
  );
}

export function PublicHostReviewsView({ host, reviews, stats }: PublicHostReviewsViewProps) {
  const { t } = useLanguage();
  const [mountedTime] = useState(() => Date.now());
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStar, setSelectedStar] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("recent");

  const hostName = host.name || t("public_host_default_name", "Homyz host");
  const nowYear = new Date(mountedTime).getFullYear();
  const nowMonth = new Date(mountedTime).getMonth();

  function formatTenure(createdAtVal: Date | string): string {
    const createdAt = typeof createdAtVal === "string" ? new Date(createdAtVal) : createdAtVal;
    const years = Math.max(0, nowYear - createdAt.getFullYear() - (nowMonth < createdAt.getMonth() ? 1 : 0));
    if (years === 0) {
      return t("public_host_card_tenure_less_than_year", "Less than a year");
    }
    if (years === 1) {
      return t("public_host_card_tenure_one_year", "1 year");
    }
    return t("public_host_card_tenure_years", "{years} years").replace("{years}", String(years));
  }

  function formatRelativeDate(dateVal: string | Date): string {
    const date = typeof dateVal === "string" ? new Date(dateVal) : dateVal;
    const days = Math.max(0, Math.floor((mountedTime - date.getTime()) / 86_400_000));
    if (days === 0) return t("public_host_date_today", "Today");
    if (days === 1) return t("public_host_date_one_day_ago", "1 day ago");
    if (days < 30) return t("public_host_date_days_ago", "{days} days ago").replace("{days}", String(days));
    const months = Math.floor(days / 30);
    if (months === 1) return t("public_host_date_one_month_ago", "1 month ago");
    return t("public_host_date_months_ago", "{months} months ago").replace("{months}", String(months));
  }

  const backText = t("public_reviews_back_link", "Back to {name}'s profile").replace("{name}", hostName);
  const headingText = t("public_reviews_page_heading", "{name}'s reviews").replace("{name}", hostName);
  const reviewsCountText = t("public_reviews_count_label", "{count} reviews").replace("{count}", String(stats.reviewCount));
  const avgRatingText = stats.averageRating !== null
    ? t("public_reviews_avg_rating_label", " · {rating} ★ average rating").replace("{rating}", stats.averageRating.toFixed(2))
    : "";

  // Compute rating distribution
  const ratingDistribution = useMemo(() => {
    const dist: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) {
      const star = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
      dist[star] = (dist[star] || 0) + 1;
    }
    return dist;
  }, [reviews]);

  // Filtered and sorted reviews
  const filteredReviews = useMemo(() => {
    let result = [...reviews];

    if (selectedStar !== null) {
      result = result.filter((r) => Math.round(r.rating) === selectedStar);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((r) => {
        const commentMatch = r.comment.toLowerCase().includes(q);
        const authorMatch = (r.author.name || "").toLowerCase().includes(q);
        const listingMatch = (r.listing.title || "").toLowerCase().includes(q);
        return commentMatch || authorMatch || listingMatch;
      });
    }

    result.sort((a, b) => {
      if (sortBy === "recent") {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === "oldest") {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      if (sortBy === "highest") {
        return b.rating - a.rating;
      }
      if (sortBy === "lowest") {
        return a.rating - b.rating;
      }
      return 0;
    });

    return result;
  }, [reviews, selectedStar, searchQuery, sortBy]);

  const hasActiveFilters = selectedStar !== null || searchQuery.trim().length > 0;

  return (
    <div className="mx-auto w-full max-w-[1262px]">
      {/* Back to Host Profile Navigation */}
      <nav aria-label="Breadcrumb">
        <Link
          href={`/users/profile/${host.id}`}
          className="group inline-flex items-center gap-3 text-sm font-medium text-[#1F1F1F] transition-colors hover:text-zinc-600"
        >
          <span className="flex size-7.5 shrink-0 items-center justify-center rounded-full border border-[#1F1F1F] bg-[#F3F4F5] text-[#1F1F1F] transition-all group-hover:bg-[#1F1F1F] group-hover:text-white">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4">
              <path d="m15 18-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span>{backText}</span>
        </Link>
      </nav>

      {/* Main Page Layout */}
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[380px_minmax(0,1fr)] xl:gap-14">
        {/* Left Column / Sidebar: Host Identity Card & Ratings Summary */}
        <aside className="space-y-6 lg:sticky lg:top-8 lg:self-start">
          {/* Host Summary Card */}
          <PublicHostIdentityCard
            name={hostName}
            image={host.image}
            isSuperhost={host.isSuperhost}
            reviewCount={stats.reviewCount}
            averageRating={stats.averageRating}
            tenure={formatTenure(host.createdAt)}
          />

          {/* Rating Breakdown & Filter Histogram Card */}
          <div className="rounded-[10px] sm:rounded-[24px] border border-[#dedede] bg-white p-6 shadow-[0_2px_5px_rgba(0,0,0,0.08)]">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs font-semibold tracking-wider text-[#727272] uppercase">
                  Rating Overview
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl sm:text-4xl font-medium tracking-tight text-[#1F1F1F]">
                    {stats.averageRating !== null ? stats.averageRating.toFixed(2) : "—"}
                  </span>
                  <Image
                    src="/images/icons/star-fill.svg"
                    alt=""
                    width={22}
                    height={22}
                    className="size-5 sm:size-5.5 self-center"
                  />
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-[#1F1F1F]">{reviewsCountText}</p>
                <p className="text-xs text-[#727272]">from verified guests</p>
              </div>
            </div>

            {/* Star Distribution Histogram */}
            <div className="mt-5 border-t border-zinc-100 pt-4 space-y-2">
              {([5, 4, 3, 2, 1] as const).map((star) => {
                const count = ratingDistribution[star] || 0;
                const total = reviews.length;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const isSelected = selectedStar === star;

                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setSelectedStar(isSelected ? null : star)}
                    className={`group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-zinc-100 font-semibold ring-1 ring-zinc-300"
                        : "text-[#727272] hover:bg-zinc-50 hover:text-[#1F1F1F]"
                    }`}
                    aria-label={`Filter by ${star} star reviews (${count})`}
                  >
                    <span className="flex w-6 items-center gap-1 font-medium text-[#1F1F1F]">
                      <span>{star}</span>
                      <Image
                        src="/images/icons/star-fill.svg"
                        alt=""
                        width={12}
                        height={12}
                        className="size-3"
                      />
                    </span>
                    <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-[#EBA900] transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-8 text-right tabular-nums text-xs text-[#727272] group-hover:text-[#1F1F1F]">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedStar !== null && (
              <div className="mt-4 border-t border-zinc-100 pt-3">
                <button
                  type="button"
                  onClick={() => setSelectedStar(null)}
                  className="w-full text-center text-xs font-medium text-[#727272] hover:text-[#1F1F1F] underline underline-offset-4 cursor-pointer"
                >
                  Clear star filter
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Right Column: Reviews Content Area */}
        <section className="min-w-0" aria-labelledby="reviews-section-heading">
          {/* Section Header */}
          <div className="border-b border-zinc-200/80 pb-5">
            <h1 id="reviews-section-heading">
              {headingText}
            </h1>
            <p className="mt-1.5 text-sm text-[#727272]">
              {reviewsCountText}
              {avgRatingText}
            </p>
          </div>

          {/* Interactive Search & Filter Toolbar */}
          {reviews.length > 0 && (
            <div className="mt-6 space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#727272]">
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search reviews by keyword, guest, or stay…"
                  className="w-full rounded-full border border-zinc-200 bg-[#F3F4F5] py-2.5 pl-10 pr-10 text-sm text-[#1F1F1F] placeholder:text-[#727272] focus:border-[#1F1F1F] focus:bg-white focus:outline-none transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-zinc-400 hover:text-zinc-700 cursor-pointer"
                  >
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Filter Pills and Sort Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {/* Star Filter Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStar(null)}
                    className={`rounded-full px-3.5 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                      selectedStar === null
                        ? "bg-[#1F1F1F] text-white"
                        : "bg-white text-[#1F1F1F] border border-zinc-200 hover:border-zinc-400"
                    }`}
                  >
                    All ({reviews.length})
                  </button>
                  {([5, 4, 3, 2, 1] as const).map((star) => {
                    const count = ratingDistribution[star] || 0;
                    if (count === 0 && selectedStar !== star) return null;
                    const isSelected = selectedStar === star;
                    return (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setSelectedStar(isSelected ? null : star)}
                        className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-[#1F1F1F] text-white"
                            : "bg-white text-[#1F1F1F] border border-zinc-200 hover:border-zinc-400"
                        }`}
                      >
                        <span>{star}</span>
                        <Image
                          src="/images/icons/star-fill.svg"
                          alt=""
                          width={11}
                          height={11}
                          className={`size-2.5 ${isSelected ? "brightness-0 invert" : ""}`}
                        />
                        <span>({count})</span>
                      </button>
                    );
                  })}
                </div>

                {/* Sort Dropdown */}
                <div className="flex items-center gap-2">
                  <label htmlFor="reviews-sort" className="text-xs text-[#727272]">
                    Sort:
                  </label>
                  <select
                    id="reviews-sort"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="rounded-full border border-zinc-200 bg-white py-1.5 pl-3 pr-8 text-xs font-medium text-[#1F1F1F] focus:border-zinc-900 focus:outline-none cursor-pointer"
                  >
                    <option value="recent">Most recent</option>
                    <option value="oldest">Oldest first</option>
                    <option value="highest">Highest rating</option>
                    <option value="lowest">Lowest rating</option>
                  </select>
                </div>
              </div>

              {/* Active Filter Indicators */}
              {hasActiveFilters && (
                <div className="flex items-center justify-between rounded-xl bg-[#F3F4F5] px-4 py-2.5 text-xs text-[#1F1F1F]">
                  <span>
                    Showing {filteredReviews.length} of {reviews.length} reviews
                    {selectedStar !== null ? ` · ${selectedStar} stars` : ""}
                    {searchQuery.trim() ? ` · matching "${searchQuery}"` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStar(null);
                      setSearchQuery("");
                    }}
                    className="font-medium text-[#727272] hover:text-[#1F1F1F] underline underline-offset-2 cursor-pointer"
                  >
                    Clear all filters
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Reviews List */}
          {filteredReviews.length > 0 ? (
            <div className="mt-6 space-y-4">
              {filteredReviews.map((review) => (
                <ReviewCardItem
                  key={review.id}
                  review={review}
                  formatRelativeDate={formatRelativeDate}
                  defaultAuthorName={t("public_host_review_author_guest", "Guest")}
                />
              ))}
            </div>
          ) : reviews.length > 0 ? (
            // No matches found for current filter/search
            <div className="mt-8 rounded-[20px] border border-dashed border-zinc-300 bg-[#F3F4F5]/50 p-8 text-center sm:p-12">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-zinc-200 text-[#727272]">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="mt-3 text-base font-medium text-[#1F1F1F]">No reviews match your filters</h3>
              <p className="mt-1 text-xs sm:text-sm text-[#727272]">
                Try adjusting your search terms or clearing your star rating filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSelectedStar(null);
                  setSearchQuery("");
                }}
                className="mt-4 inline-flex items-center rounded-full bg-[#1F1F1F] px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-black cursor-pointer"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            // Host has 0 reviews at all
            <div className="mt-8 rounded-[20px] border border-zinc-200 bg-white p-8 text-center sm:p-12 shadow-[0_2px_5px_rgba(0,0,0,0.04)]">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#F3F4F5] text-[#727272]">
                <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </div>
              <h3 className="mt-3 text-base font-medium text-[#1F1F1F]">No reviews published yet</h3>
              <p className="mt-1 text-xs sm:text-sm text-[#727272] max-w-sm mx-auto">
                {t("public_reviews_none_yet", "This host does not have any published written reviews yet.")}
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
