"use client";

import { useState } from "react";
import Link from "next/link";
import { useLanguage } from "@/lib/i18n/language-context";
import { ListingCard } from "@/components/listings/listing-card";
import { PublicHostIdentityCard } from "@/components/users/public-host-identity-card";
import type { PublicHostProfile } from "@/services/user.service";

interface PublicHostProfileViewProps {
  host: PublicHostProfile["host"];
  stats: PublicHostProfile["stats"];
  reviews: PublicHostProfile["reviews"];
  listings: PublicHostProfile["listings"];
}

export function PublicHostProfileView({ host, stats, reviews, listings }: PublicHostProfileViewProps) {
  const { t } = useLanguage();
  const [mountedTime] = useState(() => Date.now());

  const hostName = host.name || t("public_host_default_name", "Homyz host");
  const profileData = host.publicProfile || {};
  const hostBio = typeof profileData.bio === "string" ? profileData.bio.trim() : "";
  const work = typeof profileData.myWork === "string" ? profileData.myWork.trim() : "";
  const languages = Array.isArray(profileData.languages)
    ? profileData.languages.filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    : typeof profileData.languages === "string" && profileData.languages.trim()
      ? [profileData.languages.trim()]
      : [];

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

  function formatRelativeDate(dateVal: Date | string): string {
    const date = typeof dateVal === "string" ? new Date(dateVal) : dateVal;
    const days = Math.max(0, Math.floor((mountedTime - date.getTime()) / 86_400_000));
    if (days === 0) return t("public_host_date_today", "Today");
    if (days === 1) return t("public_host_date_one_day_ago", "1 day ago");
    if (days < 30) return t("public_host_date_days_ago", "{days} days ago").replace("{days}", String(days));
    const months = Math.floor(days / 30);
    if (months === 1) return t("public_host_date_one_month_ago", "1 month ago");
    return t("public_host_date_months_ago", "{months} months ago").replace("{months}", String(months));
  }

  return (
    <div className="mx-auto w-full max-w-[1262px]">
      <h1 className="sr-only">
        {t("public_host_profile_sr_title", "{name}’s host profile").replace("{name}", hostName)}
      </h1>

      {/* Host identity & bio overview */}
      <section
        className="grid gap-8 border-b border-zinc-200/80 py-7.5 sm:py-12 md:grid-cols-[376px_minmax(0,1fr)] md:gap-16"
        aria-labelledby="about-host-heading"
      >
        <PublicHostIdentityCard
          name={hostName}
          image={host.image}
          isSuperhost={host.isSuperhost}
          reviewCount={stats.reviewCount}
          averageRating={stats.averageRating}
          tenure={formatTenure(host.createdAt)}
        />
        <div className="min-w-0 pt-1">
          <h2 id="about-host-heading" className="text-[20px] font-normal text-[#1f1f1f]">
            {t("public_host_about_heading", "About {name}").replace("{name}", hostName)}
          </h2>
          {host.isSuperhost && (
            <p className="mt-2 flex items-center gap-1.5 text-base text-[#727272]">
              <span aria-hidden="true">★</span> {t("public_host_superhost_label", "Superhost")}
            </p>
          )}
          {hostBio && (
            <p className="mt-2 max-w-2xl whitespace-pre-line text-base font-normal leading-6 text-[#727272]">
              {hostBio}
            </p>
          )}
          {(work || languages.length > 0) && (
            <div className="mt-7 space-y-4 text-base text-[#1f1f1f]">
              {work && (
                <p>
                  {t("public_host_my_work", "My work: {work}").replace("{work}", work)}
                </p>
              )}
              {languages.length > 0 && (
                <p>
                  {t("public_host_speaks", "Speaks {languages}").replace("{languages}", languages.join(", "))}
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Host reviews */}
      <section className="border-b border-zinc-200/80 py-8 sm:py-12" aria-labelledby="host-reviews-heading">
        <h2 id="host-reviews-heading" className="text-[20px] font-normal text-[#1f1f1f]">
          {t("public_host_reviews_heading", "{name}’s reviews").replace("{name}", hostName)}
        </h2>
        {reviews.length > 0 ? (
          <>
            <div className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
              {reviews.map((review) => {
                const authorName = review.author.name || t("public_host_review_author_guest", "Guest");
                const ratingAria = t("public_host_review_rating_aria", "{rating} out of 5 stars").replace(
                  "{rating}",
                  String(review.rating),
                );
                return (
                  <article key={review.id} className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      {review.author.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- remote review author avatar
                        <img
                          src={review.author.image}
                          alt=""
                          loading="lazy"
                          className="size-12 rounded-full border-2 border-[#e9a400] object-cover"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className="flex size-12 items-center justify-center rounded-full border-2 border-[#e9a400] bg-amber-100 text-sm font-semibold text-amber-950"
                        >
                          {(review.author.name || "G")[0]?.toUpperCase()}
                        </span>
                      )}
                      <div>
                        <p className="text-sm font-medium text-[#1f1f1f]">{authorName}</p>
                        <p className="text-xs text-[#727272]">{formatRelativeDate(review.createdAt)}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-[#1f1f1f]">
                      <span aria-label={ratingAria}>
                        {"★".repeat(review.rating)}
                        <span className="text-zinc-300">{"★".repeat(5 - review.rating)}</span>
                      </span>
                    </p>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-[#727272] sm:text-base">
                      {review.comment}
                    </p>
                  </article>
                );
              })}
            </div>
            {stats.reviewCount > reviews.length && (
              <Link
                href={`/users/profile/${host.id}/reviews`}
                className="mt-8 inline-flex min-h-12 items-center rounded-full border border-[#1f1f1f] bg-white px-6 text-base font-normal text-[#1f1f1f] transition-colors hover:bg-zinc-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              >
                {t("public_host_show_all_reviews", "Show all {count} reviews").replace(
                  "{count}",
                  String(stats.reviewCount),
                )}
              </Link>
            )}
          </>
        ) : (
          <p className="mt-3 text-sm font-normal text-[#727272]">
            {t("public_host_no_reviews", "No published reviews yet.")}
          </p>
        )}
      </section>

      {/* Host listings */}
      {listings.length > 0 && (
        <section className="py-8 sm:py-12" aria-labelledby="host-listings-heading">
          <h2 id="host-listings-heading" className="text-[20px] font-normal text-[#1f1f1f]">
            {t("public_host_listings_heading", "{name}’s listings").replace("{name}", hostName)}
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {listings.map((listing, index) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                showFavorite={false}
                priority={index < 4}
                variant="search-grid"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
