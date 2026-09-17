"use client";

import React from "react";

export function HomeSectionSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="animate-pulse space-y-4 sm:space-y-6" aria-hidden="true">
      {/* Title skeleton */}
      <div className="flex items-center justify-between">
        <div className="h-7 sm:h-8 w-48 sm:w-64 rounded-lg bg-zinc-200" />
        <div className="hidden sm:flex gap-2">
          <div className="h-10 w-10 rounded-full bg-zinc-200" />
          <div className="h-10 w-10 rounded-full bg-zinc-200" />
        </div>
      </div>

      {/* Cards track skeleton matching CategoryCarousel layout */}
      <div className="no-scrollbar grid grid-flow-col gap-3 overflow-hidden auto-cols-[calc((100%-0.75rem)/2.16)] sm:gap-4 sm:auto-cols-[calc((100%-2rem)/3)] md:gap-4 md:auto-cols-[calc((100%-2rem)/3)] lg:gap-4 lg:auto-cols-[calc((100%-3rem)/4)] xl:gap-5 xl:auto-cols-[calc((100%-5rem)/5)] 2xl:gap-6 2xl:auto-cols-[calc((100%-7.5rem)/6)]">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="overflow-hidden rounded-[20px] sm:rounded-[22px] border border-zinc-200 bg-white"
          >
            {/* Image shimmer */}
            <div className="aspect-[233/246] w-full bg-zinc-200" />
            {/* Info shimmer */}
            <div className="p-3 sm:p-3.5 space-y-2">
              <div className="h-4 w-3/4 rounded bg-zinc-200" />
              <div className="h-3 w-1/2 rounded bg-zinc-200" />
              <div className="flex justify-between pt-1">
                <div className="h-3.5 w-1/3 rounded bg-zinc-200" />
                <div className="h-3.5 w-1/5 rounded bg-zinc-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HomepageLoadingState() {
  return (
    <div className="mt-8 sm:mt-[92px] space-y-10 sm:space-y-[78px]">
      <HomeSectionSkeleton />
      <HomeSectionSkeleton />
      <HomeSectionSkeleton />
    </div>
  );
}

