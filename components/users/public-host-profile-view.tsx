"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/language-context";
import { ListingCard } from "@/components/listings/listing-card";
import { PublicHostIdentityCard } from "@/components/users/public-host-identity-card";
import { ReportContentModal } from "@/components/moderation/report-content-modal";
import type { PublicHostProfile } from "@/services/user.service";

interface PublicHostProfileViewProps {
  host: PublicHostProfile["host"];
  stats: PublicHostProfile["stats"];
  reviews: PublicHostProfile["reviews"];
  guestStats: PublicHostProfile["guestStats"];
  guestReviews: PublicHostProfile["guestReviews"];
  listings: PublicHostProfile["listings"];
}

function publicText(profile: Record<string, unknown>, key: string): string {
  const value = profile[key];
  return typeof value === "string" ? value.trim() : "";
}

function publicList(profile: Record<string, unknown>, key: string): string[] {
  const value = profile[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : typeof value === "string" && value.trim() ? [value.trim()] : [];
}

export function PublicHostProfileView({ host, stats, reviews, guestStats, guestReviews, listings }: PublicHostProfileViewProps) {
  const { t } = useLanguage();
  const { data: session, status: sessionStatus } = useSession();
  const [mountedTime] = useState(() => Date.now());
  const [isReportHostOpen, setIsReportHostOpen] = useState(false);

  const isAuthenticated = sessionStatus === "authenticated";
  const canReportHost = isAuthenticated && session?.user?.id !== host.id;
  const hostName = host.name || (host.isHost ? t("public_host_default_name", "Homyz host") : "Homyz traveler");
  const profileData = host.publicProfile || {};
  const hostBio = publicText(profileData, "bio");
  const bioTitle = publicText(profileData, "bioTitle");
  const location = publicText(profileData, "whereILive");
  const work = publicText(profileData, "myWork");
  const school = publicText(profileData, "school");
  const funFact = publicText(profileData, "funFact");
  const pets = publicText(profileData, "pets");
  const decadeBorn = publicText(profileData, "decadeBorn");
  const uselessSkill = publicText(profileData, "uselessSkill");
  const favoriteSong = publicText(profileData, "favoriteSong");
  const obsessedWith = publicText(profileData, "obsessedWith");
  const languages = publicList(profileData, "languages");
  const interests = publicList(profileData, "interests");
  const prompts = profileData.prompts && typeof profileData.prompts === "object" && !Array.isArray(profileData.prompts)
    ? profileData.prompts as Record<string, unknown>
    : {};
  const hobbies = publicText(prompts, "hobbies") || publicText(profileData, "spendTooMuchTime");
  const education = publicText(prompts, "education") || school;
  const homeUnique = publicText(prompts, "homeUnique");
  const guestsShouldKnow = publicText(prompts, "guestsShouldKnow");
  const perfectGuest = publicText(prompts, "perfectGuest");
  const hasPublicDetails = Boolean(hostBio || bioTitle || location || work || education || funFact || hobbies || pets || decadeBorn || uselessSkill || favoriteSong || obsessedWith || homeUnique || guestsShouldKnow || perfectGuest || languages.length || interests.length);
  const hasOverviewDetails = hasPublicDetails || Boolean(host.publicTravelProfileId);
  const shownReviewStats = host.isHost ? stats : guestStats;

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
        {host.isHost
          ? t("public_host_profile_sr_title", "{name}’s host profile").replace("{name}", hostName)
          : `${hostName}'s profile`}
      </h1>

      {/* Public identity & optional public profile details */}
      <section
        className={`grid gap-8 border-b border-zinc-200/80 py-7.5 sm:py-12 ${hasOverviewDetails ? "md:grid-cols-[376px_minmax(0,1fr)] md:gap-16" : "max-w-[376px]"}`}
        aria-label="Profile overview"
      >
        <PublicHostIdentityCard
          name={hostName}
          image={host.image}
          isSuperhost={host.isSuperhost}
          reviewCount={shownReviewStats.reviewCount}
          averageRating={shownReviewStats.averageRating}
          tenure={formatTenure(host.createdAt)}
          roleLabel={host.isHost ? "Host" : "Guest"}
          tenureLabel={host.isHost ? "time hosting" : "on Homyz"}
        />
        {hasOverviewDetails && <div className="min-w-0 pt-1">
          {hasPublicDetails && <>
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
          <div className="mt-6 grid max-w-2xl gap-3 text-sm text-[#1f1f1f] sm:grid-cols-2">
            {bioTitle && <p><span className="font-medium">About:</span> {bioTitle}</p>}
            {location && <p><span className="font-medium">Lives in:</span> {location}</p>}
            {work && <p>{t("public_host_my_work", "My work: {work}").replace("{work}", work)}</p>}
            {education && <p><span className="font-medium">Education:</span> {education}</p>}
            {hobbies && <p><span className="font-medium">Interests:</span> {hobbies}</p>}
            {funFact && <p><span className="font-medium">Fun fact:</span> {funFact}</p>}
            {pets && <p><span className="font-medium">Pets:</span> {pets}</p>}
            {decadeBorn && <p><span className="font-medium">Born in:</span> {decadeBorn}</p>}
            {uselessSkill && <p><span className="font-medium">Hidden talent:</span> {uselessSkill}</p>}
            {favoriteSong && <p><span className="font-medium">Favorite song:</span> {favoriteSong}</p>}
            {obsessedWith && <p><span className="font-medium">Currently into:</span> {obsessedWith}</p>}
            {homeUnique && <p><span className="font-medium">What makes my home special:</span> {homeUnique}</p>}
            {guestsShouldKnow && <p><span className="font-medium">Good to know:</span> {guestsShouldKnow}</p>}
            {perfectGuest && <p><span className="font-medium">A great guest:</span> {perfectGuest}</p>}
          </div>
          {(languages.length > 0 || interests.length > 0) && (
            <div className="mt-5 space-y-3 text-base text-[#1f1f1f]">
              {languages.length > 0 && (
                <p>
                  {t("public_host_speaks", "Speaks {languages}").replace("{languages}", languages.join(", "))}
                </p>
              )}
              {interests.length > 0 && <p><span className="font-medium">Enjoys:</span> {interests.join(", ")}</p>}
            </div>
          )}
          </>}
          {host.publicTravelProfileId && (
            <Link
              href={`/travelers/${encodeURIComponent(host.publicTravelProfileId)}`}
              className={`${hasPublicDetails ? "mt-7" : "mt-1"} inline-flex min-h-10 items-center rounded-full border border-[#1f1f1f] px-4 text-sm font-medium text-[#1f1f1f] transition-colors hover:bg-[#1f1f1f] hover:text-white`}
            >
              View travel profile
            </Link>
          )}
        </div>}
      </section>

      {canReportHost && (
        <div className="flex justify-end pb-2 pt-1">
          <button
            type="button"
            onClick={() => setIsReportHostOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs text-[#727272] underline underline-offset-4 transition-colors hover:text-red-600"
          >
            <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l1.664 9.526A2 2 0 006.644 14H17m0 0l1 5H6M17 14l1-7H7.5" />
            </svg>
            Report this host
          </button>
        </div>
      )}

      {/* Reviews received as a host are scoped to active public listings. */}
      {host.isHost && <section className="border-b border-zinc-200/80 py-8 sm:py-12" aria-labelledby="host-reviews-heading">
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
                    <div className="mt-3 flex items-center text-xs text-zinc-600">
                      <span
                        className="flex items-center gap-0.5 text-[#1F1F1F]"
                        aria-label={ratingAria}
                      >
                        {Array.from({ length: 5 }, (_, index) => (
                          <Image
                            key={index}
                            src="/images/icons/review-star.svg"
                            alt=""
                            width={15}
                            height={15}
                            className={`size-[15px] ${index < review.rating ? "opacity-100" : "opacity-20"}`}
                          />
                        ))}
                        <span className="sr-only">{ratingAria}</span>
                      </span>
                    </div>
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
                className="mt-8 inline-flex min-h-12 items-center rounded-full border border-[#1f1f1f] bg-white px-6 text-base font-normal text-[#1f1f1f] hover:text-white transition-colors hover:bg-[#1f1f1f] focus-visible:outline-none"
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
      </section>}

      {guestReviews.length > 0 && (
        <section className="border-b border-zinc-200/80 py-8 sm:py-12" aria-labelledby="guest-reviews-heading">
          <h2 id="guest-reviews-heading" className="text-[20px] font-normal text-[#1f1f1f]">Guest feedback</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {guestReviews.map((review) => (
              <article key={review.id} className="rounded-2xl border border-zinc-200 p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[#1f1f1f]">{review.author.name || "Host"}</p>
                  <span className="text-sm text-[#1f1f1f]" aria-label={`${review.rating} out of 5 stars`}>{review.rating.toFixed(1)} <span className="text-[#e9a400]">★</span></span>
                </div>
                <p className="mt-1 text-xs text-[#727272]">{formatRelativeDate(review.createdAt)}</p>
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[#727272]">{review.comment}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Only active, public listings are returned by the server. */}
      {host.isHost && (
        <section className="py-8 sm:py-12" aria-labelledby="host-listings-heading">
          <h2 id="host-listings-heading" className="text-[20px] font-normal text-[#1f1f1f]">
            {t("public_host_listings_heading", "{name}’s listings").replace("{name}", hostName)}
          </h2>
          {listings.length > 0 ? <>
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
            {stats.listingCount > listings.length && <p className="mt-5 text-sm text-[#727272]">Showing the latest {listings.length} of {stats.listingCount} public listings.</p>}
          </> : <p className="mt-3 text-sm text-[#727272]">No public listings currently.</p>}
        </section>
      )}

      {isReportHostOpen && (
        <ReportContentModal
          isOpen={isReportHostOpen}
          onClose={() => setIsReportHostOpen(false)}
          targetType="USER"
          targetId={host.id}
          targetTitle={hostName}
        />
      )}
    </div>
  );
}
