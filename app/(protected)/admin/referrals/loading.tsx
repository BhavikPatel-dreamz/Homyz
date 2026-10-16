import React from "react";

export default function AdminReferralsLoading() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading referral credits"
      className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs sm:p-6 font-sans text-muted-foreground"
    >
      {/* Top Header & Filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between border-b border-[var(--border)] pb-5">
        <div className="space-y-2">
          <div className="h-8 w-56 max-w-full rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-4 w-96 max-w-full rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        </div>
        <div className="h-9 w-40 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer shrink-0" />
      </div>

      {/* Table Skeleton */}
      <div className="mt-5 overflow-x-auto">
        <div className="min-w-[780px]">
          <div className="flex gap-4 border-b border-[var(--border)] pb-3 text-xs uppercase tracking-wide">
            <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer ml-auto" />
          </div>

          <div className="divide-y divide-[var(--border-subtle)]">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="py-4 flex items-center justify-between gap-4">
                <div className="w-40 space-y-1.5">
                  <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  <div className="h-3 w-36 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                </div>
                <div className="w-40 space-y-1.5">
                  <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  <div className="h-3 w-36 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                </div>
                <div className="w-28">
                  <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                </div>
                <div className="w-20">
                  <div className="h-4 w-14 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                </div>
                <div className="w-24">
                  <div className="h-6 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                </div>
                <div className="w-24 flex justify-end">
                  <div className="h-7 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pagination Skeleton */}
      <div className="mt-5 border-t border-[var(--border)] pt-4 flex items-center justify-between">
        <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        <div className="h-8 w-48 rounded-xl bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
      </div>
    </section>
  );
}
