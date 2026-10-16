import React from "react";

export default function AdminCmsSectionsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading homepage section templates" className="space-y-6 font-sans">
      {/* Header */}
      <div className="border-b border-[var(--border)] pb-5">
        <div className="h-7 w-72 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        <div className="mt-2 h-4 w-[480px] max-w-full rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
      </div>

      {/* Sub-bar */}
      <div className="flex items-center justify-between">
        <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="h-5 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                <div className="h-3.5 w-24 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              </div>
              <div className="h-5 w-44 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              <div className="space-y-1.5">
                <div className="h-3.5 w-full rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                <div className="h-3.5 w-4/5 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              </div>
            </div>

            <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="h-3 w-28 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              </div>
              <div className="flex items-center justify-between">
                <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              </div>
              <div className="flex items-center justify-between">
                <div className="h-3 w-32 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              </div>
            </div>

            {/* Code preview block placeholder */}
            <div className="h-28 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 skeleton-shimmer" />
          </div>
        ))}
      </div>
    </div>
  );
}
