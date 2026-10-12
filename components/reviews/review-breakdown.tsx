"use client";

import type { ReviewCategoryRatings } from "@/services/review.service";
import { ReviewIcon } from "./review-icon";
import { useLanguage } from "@/lib/i18n/language-context";

interface ReviewBreakdownProps {
  totalCount: number;
  ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number>;
  categoryRatings: ReviewCategoryRatings;
  className?: string;
  variant?: "horizontal" | "sidebar";
  selectedRating?: number | null;
  onSelectRating?: (rating: number | null) => void;
  averageRating?: number | null;
}

const CATEGORIES = [
  { key: "cleanliness" as const, labelKey: "reviews_category_cleanliness" as const, defaultLabel: "Cleanliness", icon: "cleanliness" as const },
  { key: "accuracy" as const, labelKey: "reviews_category_accuracy" as const, defaultLabel: "Accuracy", icon: "accuracy" as const },
  { key: "checkIn" as const, labelKey: "reviews_category_check_in" as const, defaultLabel: "Check-in", icon: "checkIn" as const },
  { key: "communication" as const, labelKey: "reviews_category_communication" as const, defaultLabel: "Communication", icon: "communication" as const },
  { key: "location" as const, labelKey: "reviews_category_location" as const, defaultLabel: "Location", icon: "location" as const },
  { key: "value" as const, labelKey: "reviews_category_value" as const, defaultLabel: "Value", icon: "value" as const },
] as const;

export function ReviewBreakdown({
  totalCount,
  ratingDistribution,
  categoryRatings,
  className = "",
  variant = "horizontal",
  selectedRating,
  onSelectRating,
  averageRating,
}: ReviewBreakdownProps) {
  const { t } = useLanguage();

  const computedAverage = (() => {
    if (typeof averageRating === "number" && !isNaN(averageRating)) {
      return averageRating;
    }
    let totalScore = 0;
    let totalRatings = 0;
    for (const [star, count] of Object.entries(ratingDistribution)) {
      totalScore += Number(star) * Number(count);
      totalRatings += Number(count);
    }
    if (totalRatings > 0) return totalScore / totalRatings;
    return null;
  })();
  const displayAverageRating = computedAverage !== null ? computedAverage.toFixed(2) : "—";

  if (variant === "sidebar") {
    return (
      <div className={`w-full space-y-6 ${className}`} aria-label="Rating breakdown">
        {/* Overall rating distribution (5 to 1) */}
        <div>
          <p className="text-sm font-semibold text-[#1f1f1f]">
            {t("reviews_overall_rating", "Overall rating")}
          </p>
          <div className="mt-3 space-y-2" aria-label="Rating star distribution">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = ratingDistribution[star] ?? 0;
              const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
              const isSelected = selectedRating === star;

              const content = (
                <div
                  className={`flex w-full items-center gap-3 rounded-lg px-2 py-1 text-xs transition-colors ${
                    onSelectRating ? "hover:bg-zinc-100 cursor-pointer" : ""
                  } ${
                    isSelected
                      ? "bg-zinc-100 font-semibold ring-1 ring-zinc-300"
                      : "text-zinc-600"
                  }`}
                >
                  <span className="w-3 text-right font-medium text-[#1f1f1f]">{star}</span>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full rounded-full bg-zinc-900 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs text-zinc-500 tabular-nums">
                    {count}
                  </span>
                </div>
              );

              if (onSelectRating) {
                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => onSelectRating(isSelected ? null : star)}
                    className="w-full text-left focus-visible:outline-2 focus-visible:outline-zinc-900 rounded-lg"
                    aria-label={`Filter by ${star} star reviews, ${count} reviews`}
                  >
                    {content}
                  </button>
                );
              }

              return <div key={star}>{content}</div>;
            })}
          </div>
        </div>

        {/* Category Ratings */}
        <div className="border-t border-zinc-200/80 pt-5">
          <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 lg:grid-cols-1">
            {CATEGORIES.map(({ key, labelKey, defaultLabel, icon }) => {
              const score = categoryRatings[key];
              const formattedScore = typeof score === "number" ? score.toFixed(1) : "—";
              return (
                <div
                  key={key}
                  className="flex items-center justify-between py-1 text-sm"
                >
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <div className="flex size-7 shrink-0 items-center justify-center text-zinc-700">
                      <ReviewIcon name={icon} className="size-5" />
                    </div>
                    <span className="truncate text-sm font-medium text-[#1f1f1f]">
                      {t(labelKey, defaultLabel)}
                    </span>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-[#1f1f1f]">
                    {formattedScore}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Horizontal variant (default, property details page responsive ratings breakdown)
  return (
    <div className={`w-full ${className}`} aria-label="Rating breakdown">
      {/* 1. Mobile Layout (320px–767px): Overall rating & count at top, histogram below, 2-column category grid */}
      <div className="block md:hidden space-y-6">
        {/* Overall Rating and Review Count header */}
        <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4 space-y-3.5">
          <div className="flex items-center gap-2">
            <ReviewIcon name="star" className="size-5 fill-zinc-900 text-zinc-900" />
            <span className="text-xl font-bold tracking-tight text-[#1f1f1f]">
              {displayAverageRating}
            </span>
            <span className="text-sm font-medium text-[#727272]">
              · {totalCount} {totalCount === 1 ? t("reviews_count_singular", "review") : t("reviews_count_plural", "reviews")}
            </span>
          </div>

          {/* Rating Distribution Bars below */}
          <div className="border-t border-zinc-200/70 pt-3 space-y-1.5" aria-label="Rating star distribution">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = ratingDistribution[star] ?? 0;
              const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-2.5 text-xs text-zinc-600">
                  <span className="w-2.5 text-right font-medium text-[#1f1f1f]">{star}</span>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full rounded-full bg-zinc-900 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs text-zinc-500 tabular-nums">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 6 Rating categories in a clean 2-column grid */}
        <div className="grid grid-cols-2 gap-3">
          {CATEGORIES.map(({ key, labelKey, defaultLabel, icon }) => {
            const score = categoryRatings[key];
            const formattedScore = typeof score === "number" ? score.toFixed(1) : "—";
            return (
              <div
                key={key}
                className="flex flex-col justify-between rounded-xl border border-zinc-200/80 bg-zinc-50/40 p-3 min-w-0"
              >
                <div className="min-w-0">
                  <p
                    className="truncate text-xs sm:text-sm font-medium text-[#1f1f1f]"
                    title={t(labelKey, defaultLabel)}
                  >
                    {t(labelKey, defaultLabel)}
                  </p>
                  <p className="mt-1 text-base font-semibold tracking-tight text-[#1f1f1f]">
                    {formattedScore}
                  </p>
                </div>
                <div className="mt-3 flex items-center text-zinc-800">
                  <ReviewIcon name={icon} className="size-5 text-zinc-700" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Tablet Layout (768px–1023px): Separated histogram + 3-column category grid */}
      <div className="hidden md:block lg:hidden space-y-6">
        {/* Separated Overall Rating Histogram */}
        <div className="max-w-sm rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-5">
          <p className="text-sm font-semibold text-[#1f1f1f]">
            {t("reviews_overall_rating", "Overall rating")}
          </p>
          <div className="mt-3 space-y-2" aria-label="Rating star distribution">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = ratingDistribution[star] ?? 0;
              const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-3 text-xs text-zinc-600">
                  <span className="w-3 text-right font-medium text-[#1f1f1f]">{star}</span>
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full rounded-full bg-zinc-900 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-xs text-zinc-500 tabular-nums">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3-Column Responsive Category Grid */}
        <div className="grid grid-cols-3 gap-4">
          {CATEGORIES.map(({ key, labelKey, defaultLabel, icon }) => {
            const score = categoryRatings[key];
            const formattedScore = typeof score === "number" ? score.toFixed(1) : "—";
            return (
              <div
                key={key}
                className="flex flex-col justify-between rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4 min-w-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#1f1f1f]" title={t(labelKey, defaultLabel)}>
                    {t(labelKey, defaultLabel)}
                  </p>
                  <p className="mt-1 text-xl font-semibold tracking-tight text-[#1f1f1f]">
                    {formattedScore}
                  </p>
                </div>
                <div className="mt-4 flex items-center text-zinc-800">
                  <ReviewIcon name={icon} className="size-6 text-zinc-700" />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Desktop Layout (1024px+): Existing 7-column horizontal layout with dividers */}
      <div className="hidden lg:grid lg:grid-cols-7 lg:items-stretch lg:divide-x lg:divide-zinc-200/80 py-4">
        {/* Column 1: Overall rating distribution (5 to 1) */}
        <div className="flex min-w-[150px] flex-col justify-between pr-6 lg:min-w-0">
          <p className="text-sm font-medium text-[#1f1f1f]">
            {t("reviews_overall_rating", "Overall rating")}
          </p>
          <div className="mt-3 space-y-1.5" aria-label="Rating star distribution">
            {([5, 4, 3, 2, 1] as const).map((star) => {
              const count = ratingDistribution[star] ?? 0;
              const pct = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs text-zinc-600">
                  <span className="w-2.5 text-right font-medium text-[#1f1f1f]">{star}</span>
                  <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-zinc-200">
                    <div
                      className="h-full rounded-full bg-zinc-900 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Columns 2-7: Category Ratings */}
        {CATEGORIES.map(({ key, labelKey, defaultLabel, icon }) => {
          const score = categoryRatings[key];
          const formattedScore = typeof score === "number" ? score.toFixed(1) : "—";
          return (
            <div
              key={key}
              className="flex min-w-[100px] flex-col justify-between px-6 lg:min-w-0"
            >
              <div>
                <p className="text-sm font-medium text-[#1f1f1f] truncate" title={t(labelKey, defaultLabel)}>
                  {t(labelKey, defaultLabel)}
                </p>
                <p className="mt-1 text-lg font-semibold tracking-tight text-[#1f1f1f]">
                  {formattedScore}
                </p>
              </div>
              <div className="mt-4 flex items-center text-zinc-800">
                <ReviewIcon name={icon} className="size-7" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
