import React from "react";

export function PublicHostReviewsSkeleton() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse">
      <div className="h-4 w-36 rounded bg-zinc-200 skeleton-shimmer" />
      <div className="mt-6 h-9 w-64 rounded-md bg-zinc-200 skeleton-shimmer" />
      <div className="mt-2 h-4 w-44 rounded bg-zinc-100 skeleton-shimmer" />

      <div className="mt-9 divide-y divide-zinc-200 border-y border-zinc-200">
        {Array.from({ length: 5 }).map((_, i) => (
          <article key={i} className="py-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="size-12 shrink-0 rounded-full border-2 border-zinc-200 bg-zinc-200 skeleton-shimmer" />
              <div className="space-y-1.5">
                <div className="h-4 w-28 rounded bg-zinc-200 skeleton-shimmer" />
                <div className="h-3 w-16 rounded bg-zinc-100 skeleton-shimmer" />
              </div>
            </div>
            <div className="h-3.5 w-20 rounded bg-zinc-100 skeleton-shimmer" />
            <div className="space-y-1.5">
              <div className="h-3.5 w-full rounded bg-zinc-100 skeleton-shimmer" />
              <div className="h-3.5 w-5/6 rounded bg-zinc-100 skeleton-shimmer" />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
