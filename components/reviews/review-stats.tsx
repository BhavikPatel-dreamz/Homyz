"use client";

import { ReviewIcon } from "./review-icon";

interface ReviewStatsProps {
  averageRating: number | null;
  totalReviews: number;
  className?: string;
  layout?: "horizontal" | "vertical";
}

/** A compact, consistent summary for the listing title area. */
export function ReviewStats({ averageRating, totalReviews, className = "", layout = "horizontal" }: ReviewStatsProps) {
  if (averageRating === null || totalReviews === 0) {
    return <span className={`${className} text-sm text-zinc-600`}>No reviews yet</span>;
  }

  const summary = (
    <>
      <ReviewIcon name="star" className="h-4 w-4 fill-zinc-900 text-zinc-900" />
      <span>{averageRating.toFixed(1)}</span>
      <span aria-hidden="true">·</span>
      <span>{totalReviews} {totalReviews === 1 ? "review" : "reviews"}</span>
    </>
  );

  return layout === "vertical" ? (
    <div className={`${className} flex flex-col items-center gap-1 text-sm font-semibold text-zinc-900`}>
      <div className="flex items-center gap-1.5">{summary}</div>
    </div>
  ) : (
    <span className={`${className} inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-900`}>{summary}</span>
  );
}
