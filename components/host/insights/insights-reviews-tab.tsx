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
      <div className="rounded-3xl border border-zinc-200 bg-white p-12 text-center shadow-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100 text-2xl">
          ★
        </div>
        <h3 className="mt-4 text-xl font-bold text-zinc-950">No reviews yet</h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-600">
          Once guests complete stays and submit reviews, your overall rating, category subratings, and guest comments
          will appear here.
        </p>
        <Link
          href="/host/today"
          className="mt-6 inline-flex rounded-full bg-zinc-950 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800"
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
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Overall Rating</p>
          <div className="mt-3 flex items-baseline gap-3">
            <span className="text-5xl font-bold tracking-tight text-zinc-950 sm:text-6xl">
              {overallRating !== null ? overallRating.toFixed(2) : "—"}
            </span>
            <span className="text-2xl text-amber-500">★</span>
            <span className="text-sm font-medium text-zinc-500">
              ({totalReviewsCount} {totalReviewsCount === 1 ? "review" : "reviews"})
            </span>
          </div>

          {/* Rating Distribution Bars */}
          <div className="mt-8 space-y-2.5 border-t border-zinc-100 pt-6">
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
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-1 text-xs transition-colors hover:bg-zinc-50 ${
                    selectedRating === stars ? "bg-zinc-100 font-semibold" : ""
                  }`}
                >
                  <span className="w-12 text-left text-zinc-600 font-medium">{stars} stars</span>
                  <div className="h-2 flex-1 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-zinc-900 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-zinc-500 font-mono">{count}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right: Category Ratings */}
        <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
          <div className="flex items-baseline justify-between border-b border-zinc-100 pb-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Category ratings</p>
              <h2 className="text-lg font-bold text-zinc-950">Guest feedback by category</h2>
            </div>
            <span className="text-xs text-zinc-400">Scale 1.0 – 5.0</span>
          </div>

          <div className="mt-6 divide-y divide-zinc-100">
            {categoryList.map((cat) => (
              <div key={cat.label} className="flex items-center justify-between py-3">
                <span className="text-sm font-medium text-zinc-700">{cat.label}</span>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-24 rounded-full bg-zinc-100 overflow-hidden sm:w-32">
                    <div
                      className="h-full rounded-full bg-zinc-900"
                      style={{ width: `${cat.rating ? (cat.rating / 5) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-bold text-zinc-950 font-mono">
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
          <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
            <h2 className="text-base font-bold text-zinc-950">Review Quality Summary</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Authoritative guest feedback signals across your listings</p>

            <div className="mt-6 space-y-4">
              {qualitySummary.strengths.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Strengths (4.8+ ★)</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {qualitySummary.strengths.map((str) => (
                      <span
                        key={str}
                        className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-600/20"
                      >
                        ✓ {str}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {qualitySummary.areasForImprovement.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-800">Areas for Improvement (&lt;4.5 ★)</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {qualitySummary.areasForImprovement.map((area) => (
                      <span
                        key={area}
                        className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20"
                      >
                        ! {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {qualitySummary.unansweredCount > 0 && (
                <div className="flex items-center justify-between rounded-2xl border border-blue-100 bg-blue-50/70 p-3.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 font-bold">💬</span>
                    <span className="font-semibold text-blue-950">
                      {qualitySummary.unansweredCount} review{qualitySummary.unansweredCount === 1 ? "" : "s"} waiting for your response
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRepliedStatus("unreplied");
                      setCurrentPage(1);
                    }}
                    className="font-bold text-blue-900 underline hover:text-blue-950"
                  >
                    View
                  </button>
                </div>
              )}
            </div>
          </section>

          {/* 12-Month Trends */}
          {trends && trends.length > 0 && (
            <section className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8">
              <h2 className="text-base font-bold text-zinc-950">12-Month Review Trends</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Average ratings and volume over the past year</p>

              <div className="mt-6 grid grid-cols-4 gap-2 sm:grid-cols-6">
                {trends.slice(-6).map((t) => (
                  <div key={t.monthKey} className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-3 text-center">
                    <p className="text-[10px] font-semibold uppercase text-zinc-500">{t.label.split(" ")[0]}</p>
                    <p className="mt-1 text-sm font-bold text-zinc-950 font-mono">
                      {t.averageRating !== null ? `${t.averageRating.toFixed(1)} ★` : "—"}
                    </p>
                    <p className="mt-0.5 text-[10px] text-zinc-400">
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
        className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-8"
      >
        <div className="flex flex-col gap-4 border-b border-zinc-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-zinc-950">All Guest Reviews</h2>
            <p className="text-xs text-zinc-500">Filter, search, and respond to verified guest feedback from {periodLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-zinc-500">
              {pagination.total} {pagination.total === 1 ? "review" : "reviews"} found
            </span>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search Box */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search comments or guests..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full rounded-2xl border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
            />
          </div>

          <div>
            <select
              aria-label="Review category filter"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value as typeof selectedCategory);
                setCurrentPage(1);
              }}
              className="w-full rounded-2xl border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
            >
              <option value="all">All Categories</option>
              <option value="cleanliness">Cleanliness</option>
              <option value="accuracy">Accuracy</option>
              <option value="checkIn">Check-in</option>
              <option value="communication">Communication</option>
              <option value="location">Location</option>
              <option value="value">Value</option>
            </select>
          </div>

          {/* Star Rating Filter */}
          <div>
            <select
              value={selectedRating}
              onChange={(e) => {
                setSelectedRating(e.target.value === "all" ? "all" : Number(e.target.value));
                setCurrentPage(1);
              }}
              className="w-full rounded-2xl border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
            >
              <option value="all">All Star Ratings</option>
              <option value="5">5 Stars only</option>
              <option value="4">4 Stars only</option>
              <option value="3">3 Stars only</option>
              <option value="2">2 Stars only</option>
              <option value="1">1 Star only</option>
            </select>
          </div>

          {/* Response Status Filter */}
          <div>
            <select
              value={selectedRepliedStatus}
              onChange={(e) => {
                setSelectedRepliedStatus(e.target.value as "all" | "replied" | "unreplied");
                setCurrentPage(1);
              }}
              className="w-full rounded-2xl border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
            >
              <option value="all">All Response Statuses</option>
              <option value="unreplied">Needs response (Unreplied)</option>
              <option value="replied">Responded</option>
            </select>
          </div>

          {/* Sort Control */}
          <div>
            <select
              value={selectedSort}
              onChange={(e) => {
                setSelectedSort(e.target.value as "recent" | "oldest" | "highest" | "lowest");
                setCurrentPage(1);
              }}
              className="w-full rounded-2xl border border-zinc-200 px-4 py-2.5 text-xs text-zinc-900 focus:border-zinc-900 focus:outline-hidden focus:ring-1 focus:ring-zinc-900"
            >
              <option value="recent">Most recent</option>
              <option value="oldest">Oldest first</option>
              <option value="highest">Highest rating</option>
              <option value="lowest">Lowest rating</option>
            </select>
          </div>
        </div>

        {/* Active Filters Pill Bar */}
        {(searchTerm || selectedRating !== "all" || selectedRepliedStatus !== "all" || selectedCategory !== "all" || selectedSort !== "recent") && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-zinc-50 px-3.5 py-2 text-xs">
            <span className="text-zinc-600 font-medium">Filters active</span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="font-bold text-zinc-900 underline hover:text-zinc-600"
            >
              Reset all filters
            </button>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            {error}
          </div>
        )}

        {/* Review Cards List */}
        <div className={`mt-6 divide-y divide-zinc-100 transition-opacity ${isLoading ? "opacity-50" : "opacity-100"}`}>
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
                          className="h-10 w-10 rounded-full object-cover ring-1 ring-zinc-200"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 font-bold text-white text-sm">
                          {rev.author.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-zinc-900">{rev.author.name}</p>
                        <p className="text-xs text-zinc-500">
                          {rev.listingTitle} · {reviewDate}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-500/20">
                        <span>{rev.rating}</span>
                        <span className="text-amber-500">★</span>
                      </div>
                      <Link
                        href={`/host/insights/reviews/${rev.id}?returnTo=${encodeURIComponent(`/host/insights?tab=reviews${selectedListingId ? `&propertyId=${selectedListingId}` : ""}${selectedPeriod ? `&period=${selectedPeriod}` : ""}${startDate ? `&startDate=${startDate}` : ""}${endDate ? `&endDate=${endDate}` : ""}`)}`}
                        className="inline-flex rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-semibold text-zinc-800 shadow-2xs hover:bg-zinc-50"
                      >
                        View Details →
                      </Link>
                    </div>
                  </div>

                  {/* Comment */}
                  <p className="mt-3 text-sm leading-relaxed text-zinc-700 whitespace-pre-line">
                    {rev.comment}
                  </p>

                  {/* Subrating chips */}
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-zinc-500">
                    {rev.cleanlinessRating && (
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium">
                        Cleanliness: {rev.cleanlinessRating} ★
                      </span>
                    )}
                    {rev.accuracyRating && (
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium">
                        Accuracy: {rev.accuracyRating} ★
                      </span>
                    )}
                    {rev.checkInRating && (
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium">
                        Check-in: {rev.checkInRating} ★
                      </span>
                    )}
                    {rev.communicationRating && (
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium">
                        Communication: {rev.communicationRating} ★
                      </span>
                    )}
                    {rev.locationRating && (
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium">
                        Location: {rev.locationRating} ★
                      </span>
                    )}
                    {rev.valueRating && (
                      <span className="rounded-md bg-zinc-100 px-2 py-0.5 font-medium">
                        Value: {rev.valueRating} ★
                      </span>
                    )}
                  </div>

                  {/* Host Response Preview or CTA */}
                  <div className="mt-4">
                    {rev.response ? (
                      <div className="rounded-2xl border border-zinc-100 bg-zinc-50/70 p-3.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-zinc-900">Your response</span>
                          <span className="text-[10px] text-zinc-400">
                            {new Date(rev.response.createdAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <p className="mt-1.5 text-zinc-700 line-clamp-2">{rev.response.comment}</p>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/40 p-3 text-xs">
                        <span className="text-zinc-500">No response posted yet</span>
                        <Link
                          href={`/host/insights/reviews/${rev.id}?returnTo=${encodeURIComponent(`/host/insights?tab=reviews${selectedListingId ? `&propertyId=${selectedListingId}` : ""}${selectedPeriod ? `&period=${selectedPeriod}` : ""}${startDate ? `&startDate=${startDate}` : ""}${endDate ? `&endDate=${endDate}` : ""}`)}`}
                          className="font-bold text-zinc-900 underline hover:text-zinc-600"
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
              <p className="text-sm font-semibold text-zinc-900">No reviews match your filters</p>
              <p className="mt-1 text-xs text-zinc-500">Try adjusting your search query, star rating, or response status.</p>
              <button
                type="button"
                onClick={handleClearFilters}
                className="mt-4 inline-flex rounded-full bg-zinc-950 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800"
              >
                Reset filters
              </button>
            </div>
          )}
        </div>

        {/* Pagination Row */}
        {pagination.totalPages > 1 && (
          <div className="mt-8 flex items-center justify-between border-t border-zinc-100 pt-6 text-xs">
            <button
              type="button"
              disabled={pagination.page <= 1 || isLoading}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="inline-flex rounded-full border border-zinc-200 px-4 py-2 font-semibold text-zinc-800 shadow-2xs hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ← Previous
            </button>
            <span className="font-mono text-zinc-500">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              type="button"
              disabled={pagination.page >= pagination.totalPages || isLoading}
              onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
              className="inline-flex rounded-full border border-zinc-200 px-4 py-2 font-semibold text-zinc-800 shadow-2xs hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
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
