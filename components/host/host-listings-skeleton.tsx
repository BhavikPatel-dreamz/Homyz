"use client";

import { HostHeader } from "./host-header";

export function HostListingCardsSkeleton({
  cardCount = 12,
}: {
  cardCount?: number;
}) {
  return (
    <div className="host-listing-workspace grid min-w-0 grid-cols-[repeat(auto-fill,minmax(min(100%,260px),min(100%,298px)))] gap-x-5 gap-y-6 max-sm:justify-center sm:gap-y-8">
      {Array.from({ length: cardCount }).map((_, i) => (
        <div key={i} className="group relative w-full min-w-0 max-w-full text-left sm:max-w-[298px]">
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[14px] border border-zinc-200/80 bg-zinc-100 skeleton-shimmer">
            <div className="absolute left-3 top-3 h-6 w-20 rounded-full bg-white/80 backdrop-blur-xs skeleton-shimmer" />
          </div>
          <div className="min-w-0 px-0 pt-3">
            <div className="mb-2 h-4 w-3/4 rounded-md skeleton-shimmer" />
            <div className="h-3 w-1/2 rounded-md skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HostListingsSkeleton({ cardCount = 12 }: { cardCount?: number }) {
  return (
    <div className="min-h-screen bg-white text-[#1F1F1F] font-sans flex flex-col selection:bg-[#FCDF9C]">
      {/* 1. TOP HEADER & SUBNAV */}
      <HostHeader />

      {/* 2. MAIN CONTENT AREA */}
      <main className="listing-main min-w-0 flex-1 pt-7.5 pb-[calc(128px+env(safe-area-inset-bottom))] sm:pt-12 sm:pb-14 lg:pt-16 lg:pb-16">
        <div className="mx-auto box-border w-full min-w-0 max-w-[1600px] px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex min-w-0 flex-col gap-4 sm:mb-8 min-[900px]:flex-row min-[900px]:items-center min-[900px]:justify-between">
            <div className="h-7 w-40 rounded-lg skeleton-shimmer" />
            <div className="flex w-full min-w-0 items-center gap-2 sm:gap-3 min-[900px]:w-auto">
              <div className="h-10 min-w-0 flex-1 rounded-full skeleton-shimmer sm:max-w-[288px] min-[900px]:w-[288px] min-[900px]:flex-none" />
              <div className="size-10 shrink-0 rounded-full skeleton-shimmer" />
            </div>
          </div>

          {/* Status Tabs Pill Skeleton */}
          <div className="mb-6 min-w-0 border-b border-[#727272]/20 pb-4 sm:mb-8 sm:pb-5">
            <div className="flex min-w-0 flex-wrap items-center gap-2 max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:overscroll-x-contain max-sm:pb-1 no-scrollbar">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-9 w-24 shrink-0 rounded-full skeleton-shimmer" />
            ))}
            </div>
          </div>

          <HostListingCardsSkeleton cardCount={cardCount} />
        </div>
      </main>

    </div>
  );
}
