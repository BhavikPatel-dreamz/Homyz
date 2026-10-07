"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/language-context";
import type { PublicHostProfile } from "@/services/user.service";

interface PublicHostReviewsViewProps {
  host: PublicHostProfile["host"];
  reviews: PublicHostProfile["reviews"];
  stats: PublicHostProfile["stats"];
}

export function PublicHostReviewsView({ host, reviews, stats }: PublicHostReviewsViewProps) {
  const { t } = useLanguage();
  const [mountedTime] = useState(() => Date.now());
  const hostName = host.name || t("public_host_default_name", "Homyz host");

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

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href={`/users/profile/${host.id}`}
        className="inline-flex text-sm font-medium underline underline-offset-4 hover:text-zinc-600"
      >
        {backText}
      </Link>
      <h1 className="mt-6 text-3xl font-semibold tracking-tight">{headingText}</h1>
      <p className="mt-2 text-sm text-zinc-600">
        {reviewsCountText}
        {avgRatingText}
      </p>

      {reviews.length > 0 ? (
        <div className="mt-9 divide-y divide-zinc-200 border-y border-zinc-200">
          {reviews.map((review) => {
            const authorName = review.author.name || t("public_host_review_author_guest", "Guest");
            const ratingAria = t("public_host_review_rating_aria", "{rating} out of 5 stars").replace(
              "{rating}",
              String(review.rating),
            );
            return (
              <article key={review.id} className="py-7 first:pt-0 last:pb-0">
                <div className="flex items-center gap-3">
                  {review.author.image ? (
                    <div className="relative size-11 overflow-hidden rounded-full">
                      <Image
                        src={review.author.image}
                        alt={authorName}
                        width={44}
                        height={44}
                        unoptimized
                        className="size-full object-cover"
                      />
                    </div>
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex size-11 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-600"
                    >
                      {(review.author.name || "G")[0]?.toUpperCase()}
                    </span>
                  )}
                  <div>
                    <p className="text-sm font-semibold">{authorName}</p>
                    <p className="text-xs text-[#727272]">
                      {formatRelativeDate(review.createdAt)}
                      {review.listing.title ? ` · ${review.listing.title}` : ""}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm" aria-label={ratingAria}>
                  {"★".repeat(review.rating)}
                  <span className="text-zinc-300">{"★".repeat(5 - review.rating)}</span>
                </p>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-700">
                  {review.comment}
                </p>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="mt-8 rounded-2xl border border-zinc-200 p-6 text-sm text-zinc-600">
          {t("public_reviews_none_yet", "This host does not have any published written reviews yet.")}
        </p>
      )}
    </div>
  );
}
