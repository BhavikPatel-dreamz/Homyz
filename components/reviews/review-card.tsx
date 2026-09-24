"use client";

import { useState } from "react";
import Image from "next/image";

interface ReviewCardProps {
  id: string;
  rating: number;
  comment: string;
  author: { id: string; name: string | null; image: string | null } | null;
  createdAt: string | Date;
}

function relativeDate(dateValue: string | Date) {
  const date = new Date(dateValue);
  const elapsed = Date.now() - date.getTime();
  const days = Math.floor(elapsed / 86_400_000);
  if (days < 1) return "today";
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function previewText(text: string, maxLength = 260) {
  if (text.length <= maxLength) return text;
  const boundary = text.lastIndexOf(" ", maxLength);
  return `${text.slice(0, boundary > 0 ? boundary : maxLength)}…`;
}

export function ReviewCard({ id, rating, comment, author, createdAt }: ReviewCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const name = author?.name?.trim() || "Guest";
  const initial = name.charAt(0).toUpperCase();
  const isLongReview = comment.length > 260;
  const visibleComment = isExpanded ? comment : previewText(comment);

  return (
    <article className="min-w-0">
      <div className="flex size-12 items-center justify-center overflow-hidden rounded-full border-2 border-[#e9a400] bg-amber-100 text-sm font-semibold text-amber-950">
          {author?.image && !imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- reviewer avatars can be remote user media.
            <img src={author.image} alt="" className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
          ) : initial}
      </div>

      <div className="mt-3 flex items-center text-xs text-zinc-600">
        <span className="flex items-center gap-0.5 text-zinc-900" aria-label={`Rated ${rating} out of 5`}>
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
        <time className="sr-only" dateTime={new Date(createdAt).toISOString()}>{relativeDate(createdAt)}</time>
      </div>

      {comment ? (
        <p id={`review-${id}`} className="mt-3 whitespace-pre-wrap sm:text-base text-sm leading-6 text-[#727272]">
          {visibleComment}
          {isLongReview && <>{" "}<button
            type="button"
            className="font-medium text-[#727272] underline underline-offset-2 transition-colors hover:text-[#1f1f1f]"
            onClick={() => setIsExpanded((expanded) => !expanded)}
            aria-expanded={isExpanded}
            aria-controls={`review-${id}`}
          >
            {isExpanded ? "read less" : "read more"}
          </button></>}
        </p>
      ) : null}
      <p className="mt-3 min-w-0 truncate sm:text-base text-sm font-medium text-[#1f1f1f]">{name}</p>
    </article>
  );
}
