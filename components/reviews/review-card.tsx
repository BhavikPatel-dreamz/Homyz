"use client";

import { useState } from "react";
import { ReviewIcon } from "./review-icon";

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
    <article className="border-t border-zinc-200/80 pt-6 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-amber-100 text-sm font-semibold text-amber-950">
          {author?.image && !imageFailed ? (
            // eslint-disable-next-line @next/next/no-img-element -- reviewer avatars can be remote user media.
            <img src={author.image} alt="" className="h-full w-full object-cover" onError={() => setImageFailed(true)} />
          ) : initial}
        </div>
        <p className="min-w-0 truncate text-sm font-semibold text-zinc-900">{name}</p>
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-zinc-600">
        <span className="flex items-center gap-0.5 text-zinc-900" aria-label={`Rated ${rating} out of 5`}>
          {Array.from({ length: 5 }, (_, index) => (
            <ReviewIcon
              key={index}
              name="star"
              className={`h-3.5 w-3.5 ${index < rating ? "fill-zinc-900 text-zinc-900" : "fill-transparent text-zinc-300"}`}
            />
          ))}
          <span className="sr-only">Rated {rating} out of 5</span>
        </span>
        <span aria-hidden="true">·</span>
        <time dateTime={new Date(createdAt).toISOString()}>{relativeDate(createdAt)}</time>
      </div>

      {comment ? <p id={`review-${id}`} className="mt-3 whitespace-pre-wrap text-sm leading-6 text-zinc-700">{visibleComment}</p> : null}
      {isLongReview ? (
        <button
          type="button"
          className="mt-2 text-sm font-semibold underline underline-offset-4 hover:text-zinc-600"
          onClick={() => setIsExpanded((expanded) => !expanded)}
          aria-expanded={isExpanded}
          aria-controls={`review-${id}`}
        >
          {isExpanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </article>
  );
}
