import React from "react";

/**
 * Dedicated skeleton loader for the Admin Guest Detail page (/admin/guests/[id]).
 * Mirrors GuestDetailsView structure:
 * - Back link
 * - Header card with guest avatar, name, status, email/ID, and actions
 * - 4 Metric cards (Total Bookings, Total Spending, Joined Date, Last Active)
 * - Tabs
 * - Overview content panel
 */
export function GuestDetailsSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading guest details"
      className="flex w-full flex-col gap-6 font-sans text-muted-foreground pb-12"
    >
      {/* Back Link Skeleton */}
      <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />

      {/* Guest Profile Header Card */}
      <div className="flex flex-col justify-between gap-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="size-16 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="h-7 w-48 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              <div className="h-5 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            </div>
            <div className="mt-2 h-3.5 w-60 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-8 w-32 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-8 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex h-24 flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs"
          >
            <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            <div className="h-7 w-20 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] pt-2 pb-2">
        {["w-20", "w-36", "w-28"].map((width, i) => (
          <div key={i} className={`h-8 ${width} rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer`} />
        ))}
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-4">
          <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xs space-y-4">
          <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
