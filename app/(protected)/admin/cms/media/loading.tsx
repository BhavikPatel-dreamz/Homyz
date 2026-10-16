import React from "react";

export default function AdminCmsMediaLoading() {
  return (
    <div aria-busy="true" aria-label="Loading media library" className="space-y-6 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-7 w-48 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            <div className="h-5 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          </div>
          <div className="h-4 w-96 max-w-full rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        </div>

        <div className="h-10 w-40 rounded-xl bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer shrink-0" />
      </div>

      {/* Top Controls & Filters */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-white dark:bg-zinc-900 p-3 sm:p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div className="h-9 w-full md:w-80 rounded-xl bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-7 w-20 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer shrink-0" />
          ))}
        </div>
      </div>

      {/* Media Grid Canvas */}
      <div className="bg-white dark:bg-zinc-900 p-4 sm:p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
        {/* Selection / Count bar */}
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-4 w-48 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        </div>

        {/* Media Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden flex flex-col bg-white dark:bg-zinc-900 shadow-2xs"
            >
              {/* Thumbnail Container */}
              <div className="relative aspect-square w-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer">
                <div className="absolute top-2 left-2 size-5 rounded-md bg-white/50 dark:bg-zinc-700/50" />
                <div className="absolute top-2 right-2 h-4 w-12 rounded-md bg-white/50 dark:bg-zinc-700/50" />
              </div>

              {/* Card Info */}
              <div className="p-3 text-xs flex flex-col justify-between flex-1 gap-2 border-t border-zinc-100 dark:border-zinc-800">
                <div className="space-y-1.5">
                  <div className="h-3.5 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  <div className="h-2.5 w-1/2 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
