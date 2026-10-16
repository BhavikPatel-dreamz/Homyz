import React from "react";

export default function AdminReviewsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading reviews" className="space-y-6 font-sans text-muted-foreground">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div className="space-y-2">
          <div className="h-3 w-44 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-8 w-80 max-w-full rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-4 w-[540px] max-w-full rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        </div>
        <div className="h-9 w-28 rounded-md bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer shrink-0 self-start sm:self-auto" />
      </div>

      {/* 5 Stats Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs flex flex-col justify-between h-24"
          >
            <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            <div className="h-7 w-12 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer mt-2" />
          </div>
        ))}
      </div>

      {/* Filter Toolbar Card */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              <div className="h-9 w-full rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            </div>
          ))}
        </div>
      </div>

      {/* Reviews Table Card */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        </div>
        <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="size-10 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer shrink-0" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                    <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  </div>
                  <div className="h-3 w-48 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  <div className="h-3 w-full max-w-md rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                </div>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <div className="h-6 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer hidden sm:block" />
                <div className="h-8 w-20 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
