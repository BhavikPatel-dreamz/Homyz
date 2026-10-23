"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import type { HostInsightsData } from "@/services/host-insights.service";
import type { HostReviewItemDTO } from "@/services/host-reviews-insights.service";

interface InsightsReviewsTabProps {
  data: HostInsightsData["reviews"];
  periodLabel: string;
  selectedListingId?: string | null;
  selectedPeriod?: string;
  startDate?: string;
  endDate?: string;
}

export function InsightsReviewsTab({
  data,
  periodLabel,
  selectedListingId,
  selectedPeriod,
  startDate,
  endDate,
}: InsightsReviewsTabProps) {
  const { overallRating, totalReviewsCount, ratingDistribution, categoryRatings, qualitySummary, trends } = data;

  const [reviewsList, setReviewsList] = useState<HostReviewItemDTO[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRating, setSelectedRating] = useState<number | "all">("all");
  const [selectedRepliedStatus, setSelectedRepliedStatus] = useState<"all" | "replied" | "unreplied">("all");
  const [selectedCategory, setSelectedCategory] = useState<"all" | "cleanliness" | "accuracy" | "checkIn" | "communication" | "location" | "value">("all");
  const [selectedSort, setSelectedSort] = useState<"recent" | "oldest" | "highest" | "lowest">("recent");
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (selectedListingId) params.set("propertyId", selectedListingId);
      if (selectedPeriod) params.set("period", selectedPeriod);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      if (selectedRating !== "all") params.set("rating", String(selectedRating));
      if (selectedRepliedStatus !== "all") params.set("repliedStatus", selectedRepliedStatus);
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      if (selectedSort !== "recent") params.set("sort", selectedSort);
      params.set("page", String(currentPage));
      params.set("limit", "10");

      const res = await fetch(`/api/v1/host/insights/reviews?${params.toString()}`);
      const payload = await res.json();
      if (!res.ok) throw new Error(payload?.error?.message || "Failed to load reviews.");

      if (payload.data?.items) {
        setReviewsList(payload.data.items);
        if (payload.data.pagination) {
          setPagination(payload.data.pagination);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reviews.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedListingId, selectedPeriod, startDate, endDate, searchTerm, selectedRating, selectedRepliedStatus, selectedCategory, selectedSort, currentPage]);

  useEffect(() => {
    // Loading begins after mount and updates state only from the asynchronous request lifecycle.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchReviews();
  }, [fetchReviews]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setSelectedRating("all");
    setSelectedRepliedStatus("all");
    setSelectedCategory("all");
    setSelectedSort("recent");
    setCurrentPage(1);
  };

  if (totalReviewsCount === 0) {
    return (
      <div className="rounded-3xl border border-[#E5E5E5] bg-white p-12 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#FEF9EE] border border-[#FCDF9C] text-2xl text-amber-500">
          ★
        </div>
        <h3 className="mt-4 text-xl font-bold text-[#1F1F1F]">No reviews yet</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#727272]">
          Once guests complete stays and submit reviews, your overall rating, category subratings, and guest comments
          will appear here.
        </p>
        <Link
          href="/host/today"
          className="mt-6 inline-flex rounded-full bg-[#1F1F1F] px-6 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#FCDF9C] hover:text-[#1F1F1F]"
        >
          View upcoming reservations
        </Link>
      </div>
    );
  }

  const categoryList = [
    { label: "Cleanliness", rating: categoryRatings.cleanliness },
    { label: "Accuracy", rating: categoryRatings.accuracy },
    { label: "Check-in", rating: categoryRatings.checkIn },
    { label: "Communication", rating: categoryRatings.communication },
    { label: "Location", rating: categoryRatings.location },
    { label: "Value", rating: categoryRatings.value },
  ];

  return (
    <div className="space-y-10">
      {/* Overview Cards Row */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left: Overall Rating & Distribution */}
        <section className="rounded-3xl border border-[#E5E5E5] bg-white p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-[#727272]">Overall Rating</p>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-5xl font-bold tracking-tight text-[#1F1F1F] sm:text-6xl">
              {overallRating !== null ? overallRating.toFixed(2) : "—"}
            </span>
            <span className="text-2xl text-amber-500">★</span>
            <span className="text-sm font-medium text-[#727272]">
              ({totalReviewsCount} {totalReviewsCount === 1 ? "review" : "reviews"})
            </span>
          </div>

          {/* Rating Distribution Bars */}
          <div className="mt-8 space-y-2.5 border-t border-[#EDEDED] pt-6">
            {([5, 4, 3, 2, 1] as const).map((stars) => {
              const count = ratingDistribution[stars] || 0;
              const pct = totalReviewsCount > 0 ? Math.round((count / totalReviewsCount) * 100) : 0;

              return (
                <button
                  key={stars}
                  type="button"
                  onClick={() => {
                    setSelectedRating(selectedRating === stars ? "all" : stars);
                    setCurrentPage(1);
                  }}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-1.5 text-xs transition-colors hover:bg-[#F9F9F9] ${
                    selectedRating === stars ? "bg-[#F3F4F5] font-semibold text-[#1F1F1F]" : ""
                  }`}
                >
                  <span className="w-12 text-left text-[#727272] font-medium">{stars} stars</span>
                  <div className="h-2 flex-1 rounded-full bg-[#F3F4F5] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#1F1F1F] transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-[#727272] font-mono">{count}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right: Category Ratings */}
        <section className="rounded-3xl border border-[#E5E5E5] bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-baseline justify-between border-b border-[#EDEDED] pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#727272]">Category ratings</p>
              <h2 className="text-lg font-bold text-[#1F1F1F]">Guest feedback by category</h2>
            </div>
            <span className="text-xs text-[#727272]">Scale 1.0 – 5.0</span>
          </div>

          <div className="mt-6 divide-y divide-[#EDEDED]">
            {categoryList.map((cat) => (
              <div key={cat.label} className="flex items-center justify-between py-3">
                <span className="text-sm font-medium text-[#1F1F1F]">{cat.label}</span>
                <div className="flex items-center gap-2.5">
                  <div className="h-2 w-24 rounded-full bg-[#F3F4F5] overflow-hidden sm:w-32">
                    <div
                      className="h-full rounded-full bg-[#1F1F1F]"
                      style={{ width: `${cat.rating ? (cat.rating / 5) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-bold text-[#1F1F1F] font-mono">
                    {cat.rating !== null ? cat.rating.toFixed(1) : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Quality Insights & 12-Month Trends Row */}
      {qualitySummary && (
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Quality Strengths & Improvements */}
          <section className="rounded-3xl border border-[#E5E5E5] bg-white p-6 shadow-sm sm:p-8">
            <h2 className="text-base font-bold text-[#1F1F1F]">Review Quality Summary</h2>
            <p className="text-xs text-[#727272] mt-0.5">Authoritative guest feedback signals across your listings</p>

            <div className="mt-6 space-y-4">
              {qualitySummary.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Strengths (4.8+ ★)</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {qualitySummary.strengths.map((str) => (
                      <span
                        key={str}
                        className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200"
                      >
                        ✓ {str}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {qualitySummary.areasForImprovement.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-900">Areas for Improvement (&lt;4.5 ★)</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {qualitySummary.areasForImprovement.map((area) => (
                      <span
                        key={area}
                        className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 border border-amber-200"
                      >
                        ! {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {qualitySummary.unansweredCount > 0 && (
                <div className="flex items-center justify-between rounded-2xl border border-[#FCDF9C] bg-[#FEF9EE] p-4 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="text-amber-600 font-bold text-sm">💬</span>
                    <span className="font-semibold text-[#1F1F1F]">
                      {qualitySummary.unansweredCount} review{qualitySummary.unansweredCount === 1 ? "" : "s"} waiting for your response
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRepliedStatus("unreplied");
                      setCurrentPage(1);
                    }}
                    className="font-bold text-[#1F1F1F] underline hover:text-[#D97706] cursor-pointer"
                  >
                    View
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* 12-Month Trends */}
          {trends && trends.length > 0 && (
            <section className="rounded-3xl border border-[#E5E5E5] bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-base font-bold text-[#1F1F1F]">12-Month Review Trends</h2>
              <p className="text-xs text-[#727272] mt-0.5">Average ratings and volume over the past year</p>

              <div className="mt-6 grid grid-cols-3 gap-2.5 sm:grid-cols-6">
                {trends.slice(-6).map((t) => (
                  <div key={t.monthKey} className="rounded-2xl border border-[#E5E5E5] bg-[#F9F9F9] p-3 text-center transition hover:border-[#1F1F1F]">
                    <p className="text-[10px] font-semibold uppercase text-[#727272]">{t.label.split(" ")[0]}</p>
                    <p className="mt-1 text-sm font-bold text-[#1F1F1F] font-mono">
                      {t.averageRating !== null ? `${t.averageRating.toFixed(1)} ★` : "—"}
                    </p>
                    <p className="mt-0.5 text-[10px] text-[#727272]">
                      {t.reviewCount} {t.reviewCount === 1 ? "rev" : "revs"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Comprehensive Reviews List Section */}
      <section
        aria-busy={isLoading}
        aria-live="polite"
        className="rounded-3xl border border-[#E5E5E5] bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="flex flex-col gap-4 border-b border-[#EDEDED] pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#1F1F1F]">All Guest Reviews</h2>
            <p className="text-xs text-[#727272]">Filter, search, and respond to verified guest feedback from {periodLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#727272]">
              {pagination.total} {pagination.total === 1 ? "review" : "reviews"} found
            </span>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search Box */}
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#727272]">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Search comments or guests..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-full border border-[#D7D7D7] bg-[#F9F9F9] pl-10 pr-4 py-2 text-xs text-[#1F1F1F] placeholder:text-[#A0A0A0] transition hover:border-[#1F1F1F] focus:border-[#1F1F1F] focus:bg-white focus:outline-none"
            />
          </div>

          {/* Category Filter */}
          <div className="group relative inline-flex items-center w-full">
            <select
              aria-label="Review category filter"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value as typeof selectedCategory);
                setCurrentPage(1);
              }}
              className="w-full appearance-none cursor-pointer rounded-full border border-[#D7D7D7] bg-white pl-3.5 pr-8.5 py-2 text-xs font-normal text-[#1F1F1F] transition hover:border-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-none"
            >
              <option value="all">All Categories</option>
              <option value="cleanliness">Cleanliness</option>
              <option value="accuracy">Accuracy</option>
              <option value="checkIn">Check-in</option>
              <option value="communication">Communication</option>
              <option value="location">Location</option>
              <option value="value">Value</option>
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#727272] transition-colors group-hover:text-[#1F1F1F]">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>

          {/* Star Rating Filter */}
          <div className="group relative inline-flex items-center w-full">
            <select
              aria-label="Filter by star rating"
              value={selectedRating}
              onChange={(e) => {
                setSelectedRating(e.target.value === "all" ? "all" : Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full appearance-none cursor-pointer rounded-full border border-[#D7D7D7] bg-white pl-3.5 pr-8.5 py-2 text-xs font-normal text-[#1F1F1F] transition hover:border-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-none"
            >
              <option value="all">All Star Ratings</option>
              <option value="5">5 Stars only</option>
              <option value="4">4 Stars only</option>
              <option value="3">3 Stars only</option>
              <option value="2">2 Stars only</option>
              <option value="1">1 Star only</option>
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#727272] transition-colors group-hover:text-[#1F1F1F]">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>

          {/* Response Status Filter */}
          <div className="group relative inline-flex items-center w-full">
            <select
              aria-label="Filter by response status"
              value={selectedRepliedStatus}
              onChange={(e) => {
                setSelectedRepliedStatus(e.target.value as "all" | "replied" | "unreplied");
                setCurrentPage(1);
              }}
              className="w-full appearance-none cursor-pointer rounded-full border border-[#D7D7D7] bg-white pl-3.5 pr-8.5 py-2 text-xs font-normal text-[#1F1F1F] transition hover:border-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-none"
            >
              <option value="all">All Response Statuses</option>
              <option value="unreplied">Needs response (Unreplied)</option>
              <option value="replied">Responded</option>
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#727272] transition-colors group-hover:text-[#1F1F1F]">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>

          {/* Sort Control */}
          <div className="group relative inline-flex items-center w-full">
            <select
              aria-label="Sort reviews"
              value={selectedSort}
              onChange={(e) => {
                setSelectedSort(e.target.value as "recent" | "oldest" | "highest" | "lowest");
                setCurrentPage(1);
              }}
              className="w-full appearance-none cursor-pointer rounded-full border border-[#D7D7D7] bg-white pl-3.5 pr-8.5 py-2 text-xs font-normal text-[#1F1F1F] transition hover:border-[#1F1F1F] focus:border-[#1F1F1F] focus:outline-none"
            >
              <option value="recent">Most recent</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest rating</option>
              <option value="lowest">Lowest rating</option>
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#727272] transition-colors group-hover:text-[#1F1F1F]">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
          </div>
        </div>

        {/* Active Filters Pill Bar */}
        {(searchTerm || selectedRating !== "all" || selectedRepliedStatus !== "all" || selectedCategory !== "all" || selectedSort !== "recent") && (
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-[#F3F4F5] px-4 py-2.5 text-xs text-[#1F1F1F]">
            <span className="text-[#1F1F1F] font-medium">Filters active</span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="font-bold text-[#1F1F1F] underline hover:text-[#727272] cursor-pointer"
            >
              Reset all filters
            </button>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
            {error}
          </div>
        )}

        {/* Review Cards List */}
        <div className={`mt-6 divide-y divide-[#EDEDED] transition-opacity ${isLoading ? "opacity-50" : "opacity-100"}`}>
          {isLoading && reviewsList.length === 0 ? (
            <ReviewCardsSkeleton />
          ) : reviewsList.length > 0 ? (
            reviewsList.map((rev) => {
              const reviewDate = new Date(rev.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });

              return (
                <article key={rev.id} className="py-6 first:pt-0 last:pb-0">
                  {/* Top card row: Author, Rating, Date */}
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      {rev.author.image ? (
                        <Image
                          src={rev.author.image}
                          alt={rev.author.name}
                          width={40}
                          height={40}
                          className="h-10 w-10 rounded-full object-cover ring-1 ring-[#EDEDED]"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1F1F1F] font-bold text-white text-sm">
                          {rev.author.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-[#1F1F1F]">{rev.author.name}</p>
                        <p className="text-xs text-[#727272]">
                          {rev.listingTitle} · {reviewDate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 rounded-full bg-[#FEF9EE] border border-[#FCDF9C] px-3 py-1 text-xs font-bold text-[#1F1F1F]">
                        <span>{rev.rating}</span>
                        <span className="text-amber-500">★</span>
                      </div>
                      <Link
                        href={`/host/insights/reviews/${rev.id}?returnTo=${encodeURIComponent(`/host/insights?tab=reviews${selectedListingId ? `&propertyId=${selectedListingId}` : ""}${selectedPeriod ? `&period=${selectedPeriod}` : ""}${startDate ? `&startDate=${startDate}` : ""}${endDate ? `&endDate=${endDate}` : ""}`)}`}
                        className="inline-flex rounded-full border border-[#D7D7D7] bg-white px-3.5 py-1 text-xs font-semibold text-[#1F1F1F] shadow-2xs transition hover:border-[#1F1F1F] hover:bg-[#F3F4F5]"
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>

                  {/* Comment */}
                  <p className="mt-3 text-sm leading-relaxed text-[#1F1F1F] whitespace-pre-line">
                    {rev.comment}
                  </p>

                  {/* Subrating chips */}
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[#727272]">
                    {rev.cleanlinessRating && (
                      <span className="rounded-full bg-[#F3F4F5] border border-[#EDEDED] px-2.5 py-0.5 font-medium">
                        Cleanliness: {rev.cleanlinessRating} ★
                      </span>
                    )}
                    {rev.accuracyRating && (
                      <span className="rounded-full bg-[#F3F4F5] border border-[#EDEDED] px-2.5 py-0.5 font-medium">
                        Accuracy: {rev.accuracyRating} ★
                      </span>
                    )}
                    {rev.checkInRating && (
                      <span className="rounded-full bg-[#F3F4F5] border border-[#EDEDED] px-2.5 py-0.5 font-medium">
                        Check-in: {rev.checkInRating} ★
                      </span>
                    )}
                    {rev.communicationRating && (
                      <span className="rounded-full bg-[#F3F4F5] border border-[#EDEDED] px-2.5 py-0.5 font-medium">
                        Communication: {rev.communicationRating} ★
                      </span>
                    )}
                    {rev.locationRating && (
                      <span className="rounded-full bg-[#F3F4F5] border border-[#EDEDED] px-2.5 py-0.5 font-medium">
                        Location: {rev.locationRating} ★
                      </span>
                    )}
                    {rev.valueRating && (
                      <span className="rounded-full bg-[#F3F4F5] border border-[#EDEDED] px-2.5 py-0.5 font-medium">
                        Value: {rev.valueRating} ★
                      </span>
                    )}
                  </div>

                  {/* Host Response Preview or CTA */}
                  <div className="mt-4">
                    {rev.response ? (
                      <div className="rounded-2xl border border-[#E5E5E5] bg-[#F9F9F9] p-4 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#1F1F1F]">Your response</span>
                          <span className="text-[10px] text-[#727272]">
                            {new Date(rev.response.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <p className="mt-1.5 text-[#1F1F1F] leading-relaxed line-clamp-2">{rev.response.comment}</p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-2xl border border-dashed border-[#D7D7D7] bg-[#FAFAFA] p-3.5 text-xs">
                        <span className="text-[#727272]">No response posted yet</span>
                        <Link
                          href={`/host/insights/reviews/${rev.id}?returnTo=${encodeURIComponent(`/host/insights?tab=reviews${selectedListingId ? `&propertyId=${selectedListingId}` : ""}${selectedPeriod ? `&period=${selectedPeriod}` : ""}${startDate ? `&startDate=${startDate}` : ""}${endDate ? `&endDate=${endDate}` : ""}`)}`}
                          className="font-bold text-[#1F1F1F] underline hover:text-[#727272]"
                        >
                          Write a response
                        </Link>
                      </div>
                    )}
                  </div>
                </article>
              );
            })
          ) : (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold text-[#1F1F1F]">No reviews match your filters</p>
              <p className="mt-1 text-xs text-[#727272]">Try adjusting your search query, star rating, or response status.</p>
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-4 inline-flex rounded-full bg-[#1F1F1F] px-5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#FCDF9C] hover:text-[#1F1F1F] cursor-pointer"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>

        {/* Pagination Row */}
        {pagination.totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between border-t border-[#EDEDED] pt-6 text-xs">
            <button
              type="button"
              disabled={pagination.page <= 1 || isLoading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex rounded-full border border-[#D7D7D7] bg-white px-4 py-2 font-semibold text-[#1F1F1F] shadow-2xs transition hover:border-[#1F1F1F] disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="font-mono text-[#727272]">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages || isLoading}
              onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              className="inline-flex rounded-full border border-[#D7D7D7] bg-white px-4 py-2 font-semibold text-[#1F1F1F] shadow-2xs transition hover:border-[#1F1F1F] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function ReviewCardsSkeleton() {
  return (
    <div aria-label="Loading guest reviews" className="animate-pulse" role="status">
      <span className="sr-only">Loading guest reviews</span>
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="space-y-4 py-6 first:pt-0 last:pb-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-zinc-200" />
              <div className="space-y-2">
                <div className="h-3.5 w-28 rounded bg-zinc-200" />
                <div className="h-3 w-48 rounded bg-zinc-100" />
              </div>
            </div>
            <div className="h-7 w-24 rounded-full bg-zinc-100" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-full rounded bg-zinc-100" />
            <div className="h-3 w-4/5 rounded bg-zinc-100" />
          </div>
          <div className="flex gap-2">
            <div className="h-5 w-20 rounded-md bg-zinc-100" />
            <div className="h-5 w-16 rounded-md bg-zinc-100" />
            <div className="h-5 w-24 rounded-md bg-zinc-100" />
          </div>
          <div className="h-10 rounded-2xl bg-zinc-100" />
        </div>
      ))}
    </div>
  );
}
