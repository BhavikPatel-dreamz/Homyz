"use client";

import { useState } from "react";
import Image from "next/image";
import { useLanguage } from "@/lib/i18n/language-context";

export interface ReviewCardProps {
  id: string;
  rating: number;
  comment: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
    createdAt?: string | Date;
  } | null;
  createdAt: string | Date;
  hostResponse?: {
    comment: string;
    createdAt: string | Date;
    hostName?: string | null;
    hostImage?: string | null;
  } | null;
  onShowMore?: (id: string) => void;
  isModalView?: boolean;
}

function useRelativeDate() {
  const { t, language } = useLanguage();
  return (dateValue: string | Date) => {
    const date = new Date(dateValue);
    const elapsed = Date.now() - date.getTime();
    const days = Math.floor(elapsed / 86_400_000);
    if (days < 1) return t("reviews_date_today", "today");
    if (days < 7) {
      return days === 1
        ? t("reviews_day_ago", "1 day ago")
        : t("reviews_days_ago", "{count} days ago").replace("{count}", String(days));
    }
    if (days < 30) {
      const weeks = Math.floor(days / 7);
      return weeks === 1
        ? t("reviews_week_ago", "1 week ago")
        : t("reviews_weeks_ago", "{count} weeks ago").replace("{count}", String(weeks));
    }
    if (days < 365) {
      const months = Math.floor(days / 30);
      return months === 1
        ? t("reviews_month_ago", "1 month ago")
        : t("reviews_months_ago", "{count} months ago").replace("{count}", String(months));
    }
    return date.toLocaleDateString(language, { month: "short", year: "numeric" });
  };
}

function formatMembership(joinedAt?: string | Date) {
  if (!joinedAt) return null;
  const date = new Date(joinedAt);
  if (isNaN(date.getTime())) return null;
  const elapsedMs = Date.now() - date.getTime();
  const years = Math.floor(elapsedMs / (365.25 * 86_400_000));
  if (years >= 1) {
    return `${years} ${years === 1 ? "year" : "years"} on Homyz`;
  }
  const months = Math.floor(elapsedMs / (30.44 * 86_400_000));
  if (months >= 1) {
    return `${months} ${months === 1 ? "month" : "months"} on Homyz`;
  }
  return "New to Homyz";
}

function previewText(text: string, maxLength = 180) {
  if (text.length <= maxLength) return text;
  const boundary = text.lastIndexOf(" ", maxLength);
  return `${text.slice(0, boundary > 0 ? boundary : maxLength)}…`;
}

export function ReviewCard({
  id,
  rating,
  comment,
  author,
  createdAt,
  hostResponse,
  onShowMore,
  isModalView = false,
}: ReviewCardProps) {
  const { t } = useLanguage();
  const formatRelativeDate = useRelativeDate();
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const name = author?.name?.trim() || "Guest";
  const initial = name.charAt(0).toUpperCase();
  const membershipInfo = formatMembership(author?.createdAt);

  const isLongReview = !isModalView && comment.length > 180;
  const visibleComment = isModalView || isExpanded ? comment : previewText(comment);

  return (
    <article id={`review-${id}`} className="min-w-0 break-words">
      {/* Reviewer Header: Avatar + Name + Membership metadata */}
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-sm font-semibold text-zinc-800">
          {author?.image && !imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- reviewer avatars can be remote user media.
            <img
              src={author.image}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            initial
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-[#1f1f1f]">{name}</p>
          {membershipInfo && (
            <p className="truncate text-xs text-[#727272]">{membershipInfo}</p>
          )}
        </div>
      </div>

      {/* Star Rating & Review Date */}
      <div className="mt-2.5 flex items-center gap-2 text-xs text-[#1f1f1f]">
        <span className="flex items-center gap-0.5" aria-label={`Rated ${rating} out of 5 stars`}>
          {Array.from({ length: 5 }, (_, index) => (
            <Image
              key={index}
              src="/images/icons/review-star.svg"
              alt=""
              width={14}
              height={14}
              className={`size-[13px] ${index < rating ? "opacity-100" : "opacity-20"}`}
            />
          ))}
        </span>
        <span aria-hidden="true" className="text-zinc-400">·</span>
        <time dateTime={new Date(createdAt).toISOString()} className="font-medium text-[#1f1f1f]">
          {formatRelativeDate(createdAt)}
        </time>
      </div>

      {/* Review Comment */}
      {comment ? (
        <div className="mt-3 text-sm leading-6 text-[#1f1f1f] sm:text-base">
          <p className="whitespace-pre-wrap break-words">
            {visibleComment}
            {isLongReview && !isExpanded && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => {
                    if (onShowMore) {
                      onShowMore(id);
                    } else {
                      setIsExpanded(true);
                    }
                  }}
                  className="inline-flex cursor-pointer items-center font-semibold text-[#1f1f1f] underline underline-offset-2 transition-colors hover:text-[#727272]"
                  aria-controls={`review-${id}`}
                >
                  {t("reviews_show_more", "Show more")}
                </button>
              </>
            )}
            {isLongReview && isExpanded && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => setIsExpanded(false)}
                  className="inline-flex cursor-pointer items-center font-semibold text-[#1f1f1f] underline underline-offset-2 transition-colors hover:text-[#727272]"
                  aria-controls={`review-${id}`}
                >
                  {t("reviews_show_less", "Show less")}
                </button>
              </>
            )}
          </p>
        </div>
      ) : null}

      {/* Host Response (if available) */}
      {hostResponse && (
        <div className="mt-4 rounded-xl border border-zinc-200/80 bg-zinc-50 p-4 pl-4 sm:pl-5">
          <div className="flex items-center gap-2.5">
            <div className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 text-xs font-semibold text-zinc-800">
              {hostResponse.hostImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={hostResponse.hostImage}
                  alt=""
                  className="size-full object-cover"
                />
              ) : (
                (hostResponse.hostName || "H").charAt(0).toUpperCase()
              )}
            </div>
            <div>
              <p className="text-sm font-semibold text-[#1f1f1f]">
                {t("reviews_response_from_host", "Response from {host}").replace(
                  "{host}",
                  hostResponse.hostName || "Host",
                )}
              </p>
              <p className="text-xs text-[#727272]">
                {formatRelativeDate(hostResponse.createdAt)}
              </p>
            </div>
          </div>
          <p className="mt-2.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-[#1f1f1f]">
            {hostResponse.comment}
          </p>
        </div>
      )}
    </article>
  );
}
