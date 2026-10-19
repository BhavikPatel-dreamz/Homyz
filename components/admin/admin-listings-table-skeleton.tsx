import React from "react";

/**
 * Dedicated skeleton loader for the Admin Manage Listings index page (/admin/listings).
 * Adheres to the exact layout contract of AdminListingsClient:
 * Header + 5 summary metric cards + search/filter bar + listings table.
 */
export function AdminListingsTableSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading manage listings"
      className="space-y-6 font-sans max-w-full"
    >
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <div className="h-7 w-64 rounded-lg bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer" />
          <div className="h-4 w-96 max-w-full rounded bg-zinc-200/60 dark:bg-zinc-700/60 skeleton-shimmer" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-10 w-32 rounded-full bg-amber-500/30 skeleton-shimmer" />
        </div>
      </div>

      {/* 5 Metric Summary Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-2 shadow-2xs"
          >
            <div className="h-3.5 w-20 rounded bg-zinc-200/70 dark:bg-zinc-700/70 skeleton-shimmer" />
            <div className="h-7 w-12 rounded bg-zinc-200/90 dark:bg-zinc-700/90 skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* Filter and Search Bar Controls */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div className="h-10 w-full sm:w-72 rounded-xl bg-zinc-100 dark:bg-zinc-800 skeleton-shimmer" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 rounded-xl bg-zinc-100 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-9 w-24 rounded-xl bg-zinc-100 dark:bg-zinc-800 skeleton-shimmer" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="hidden md:block rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        {/* Table Head */}
        <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-secondary)] p-3.5 flex items-center gap-4">
          <div className="size-4 rounded bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer shrink-0" />
          <div className="h-3.5 w-16 rounded bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer shrink-0" />
          <div className="h-3.5 w-44 rounded bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer flex-1" />
          <div className="h-3.5 w-28 rounded bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer shrink-0" />
          <div className="h-3.5 w-24 rounded bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer shrink-0" />
          <div className="h-3.5 w-20 rounded bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer shrink-0" />
          <div className="h-3.5 w-16 rounded bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer shrink-0" />
        </div>

        {/* Table Rows */}
        <div className="divide-y divide-[var(--border-subtle)]">
          {Array.from({ length: 8 }).map((_, rIdx) => (
            <div key={rIdx} className="p-3.5 flex items-center gap-4">
              <div className="size-4 rounded bg-zinc-100 dark:bg-zinc-800 skeleton-shimmer shrink-0" />
              <div className="h-3.5 w-16 rounded bg-zinc-100 dark:bg-zinc-800 skeleton-shimmer shrink-0 font-mono" />
              <div className="flex items-center gap-3 flex-1">
                <div className="size-10 rounded-lg bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 w-48 rounded bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer" />
                  <div className="h-2.5 w-32 rounded bg-zinc-100 dark:bg-zinc-800 skeleton-shimmer" />
                </div>
              </div>
              <div className="space-y-1.5 w-28 shrink-0">
                <div className="h-3.5 w-24 rounded bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer" />
                <div className="h-2.5 w-20 rounded bg-zinc-100 dark:bg-zinc-800 skeleton-shimmer" />
              </div>
              <div className="h-4 w-16 rounded bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer shrink-0" />
              <div className="h-5 w-20 rounded-full bg-zinc-200/80 dark:bg-zinc-700/80 skeleton-shimmer shrink-0" />
              <div className="h-7 w-16 rounded-xl bg-amber-500/20 skeleton-shimmer shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
