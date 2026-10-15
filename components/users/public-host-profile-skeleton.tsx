import React from "react";

export function PublicHostProfileSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1262px] animate-pulse">
      {/* Host identity & bio overview */}
      <section className="grid gap-8 border-b border-zinc-200/80 py-7.5 sm:py-12 md:grid-cols-[376px_minmax(0,1fr)] md:gap-16">
        {/* Identity Card Skeleton */}
        <div className="min-h-[260px] rounded-[10px] border border-[#dedede] bg-white px-7 py-7 shadow-[0_2px_5px_rgba(0,0,0,0.14)] sm:rounded-[30px]">
          <div className="grid grid-cols-2 gap-x-7 gap-y-4">
            {/* Left Column: Avatar & Name */}
            <div className="flex flex-col items-center justify-center text-center">
              <div className="size-[104px] shrink-0 rounded-full bg-zinc-200 skeleton-shimmer" />
              <div className="pt-4 flex flex-col items-center gap-2 w-full">
                <div className="h-5 w-28 rounded-md bg-zinc-200 skeleton-shimmer" />
                <div className="h-4 w-16 rounded-md bg-zinc-100 skeleton-shimmer" />
              </div>
            </div>
            {/* Right Column: Stats (Reviews, Rating, Tenure) */}
            <div className="min-w-0 divide-y divide-[#dedede]">
              <div className="pb-4 space-y-1.5">
                <div className="h-5 w-10 rounded bg-zinc-200 skeleton-shimmer" />
                <div className="h-3 w-14 rounded bg-zinc-100 skeleton-shimmer" />
              </div>
              <div className="py-4 space-y-1.5">
                <div className="h-5 w-14 rounded bg-zinc-200 skeleton-shimmer" />
                <div className="h-3 w-12 rounded bg-zinc-100 skeleton-shimmer" />
              </div>
              <div className="pt-4 space-y-1.5">
                <div className="h-5 w-16 rounded bg-zinc-200 skeleton-shimmer" />
                <div className="h-3 w-20 rounded bg-zinc-100 skeleton-shimmer" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: About Host & Bio */}
        <div className="min-w-0 pt-1 space-y-4">
          <div className="h-7 w-48 rounded-md bg-zinc-200 skeleton-shimmer" />
          <div className="h-4 w-28 rounded bg-zinc-100 skeleton-shimmer" />
          <div className="max-w-2xl space-y-2 pt-1">
            <div className="h-4 w-full rounded bg-zinc-100 skeleton-shimmer" />
            <div className="h-4 w-11/12 rounded bg-zinc-100 skeleton-shimmer" />
            <div className="h-4 w-4/5 rounded bg-zinc-100 skeleton-shimmer" />
          </div>
          <div className="pt-3 space-y-3">
            <div className="h-4 w-44 rounded bg-zinc-100 skeleton-shimmer" />
            <div className="h-4 w-52 rounded bg-zinc-100 skeleton-shimmer" />
          </div>
        </div>
      </section>

      {/* Host reviews */}
      <section className="border-b border-zinc-200/80 py-8 sm:py-12">
        <div className="h-7 w-44 rounded-md bg-zinc-200 skeleton-shimmer" />
        <div className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <article key={i} className="min-w-0 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="size-12 shrink-0 rounded-full border-2 border-zinc-200 bg-zinc-200 skeleton-shimmer" />
                <div className="space-y-1.5">
                  <div className="h-4 w-24 rounded bg-zinc-200 skeleton-shimmer" />
                  <div className="h-3 w-16 rounded bg-zinc-100 skeleton-shimmer" />
                </div>
              </div>
              <div className="h-3.5 w-20 rounded bg-zinc-100 skeleton-shimmer" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-full rounded bg-zinc-100 skeleton-shimmer" />
                <div className="h-3.5 w-5/6 rounded bg-zinc-100 skeleton-shimmer" />
                <div className="h-3.5 w-2/3 rounded bg-zinc-100 skeleton-shimmer" />
              </div>
            </article>
          ))}
        </div>
        <div className="mt-8 h-12 w-48 rounded-full border border-zinc-200 bg-zinc-50 skeleton-shimmer" />
      </section>

      {/* Host listings */}
      <section className="py-8 sm:py-12">
        <div className="h-7 w-52 rounded-md bg-zinc-200 skeleton-shimmer" />
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-[20px] border border-zinc-200 bg-white">
              <div className="aspect-[4/3] w-full bg-zinc-200 skeleton-shimmer" />
              <div className="space-y-2 p-3.5 sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="h-4 w-3/4 rounded bg-zinc-200 skeleton-shimmer" />
                  <div className="h-4 w-10 rounded bg-zinc-100 skeleton-shimmer" />
                </div>
                <div className="h-3 w-1/2 rounded bg-zinc-100 skeleton-shimmer" />
                <div className="h-3 w-2/3 rounded bg-zinc-100 skeleton-shimmer" />
                <div className="h-4 w-1/3 rounded bg-zinc-200 skeleton-shimmer pt-0.5" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
