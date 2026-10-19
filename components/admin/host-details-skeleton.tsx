import React from "react";

/**
 * Dedicated skeleton loader for the Admin Host Detail page (/admin/hosts/[id]).
 * Accurately mirrors HostDetailsView structure:
 * - Header with host avatar, name, status badge, email/ID, and action buttons
 * - 3 Metric cards (Total Listings, Total Bookings, Total Earnings)
 * - Navigation tab bar
 * - 2-Column Overview grid (Host Profile & Recent Activity)
 */
export function HostDetailsSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading host details"
      className="flex w-full flex-col gap-6 font-sans text-muted-foreground"
    >
      {/* Header Skeleton */}
      <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-subtle)] pb-5 md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="size-14 shrink-0 rounded-2xl bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-7 w-48 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              <div className="h-5 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            </div>
            <div className="mt-2 h-3.5 w-64 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-8 w-28 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-8 w-24 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        </div>
      </div>

      {/* 3 Metric Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { labelWidth: "w-24", valWidth: "w-16", subWidth: "w-32" },
          { labelWidth: "w-24", valWidth: "w-16", subWidth: "w-36" },
          { labelWidth: "w-24", valWidth: "w-28", subWidth: "w-32" },
        ].map((metric, i) => (
          <div
            key={i}
            className="flex h-28 flex-col justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs"
          >
            <div className={`h-3 ${metric.labelWidth} rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer`} />
            <div className={`h-8 ${metric.valWidth} rounded-md bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer mt-2`} />
            <div className={`h-2.5 ${metric.subWidth} rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer mt-1`} />
          </div>
        ))}
      </div>

      {/* Tab Navigation Skeleton */}
      <div className="overflow-x-auto border-b border-[var(--border-subtle)]">
        <div className="flex min-w-max gap-3 pb-2 pt-1">
          {["w-20", "w-16", "w-20", "w-16", "w-16"].map((width, i) => (
            <div key={i} className={`h-8 ${width} rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer`} />
          ))}
        </div>
      </div>

      {/* Overview 2-Column Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left Card: Host Profile */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <div className="mb-5 h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-2.5 w-20 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              </div>
            ))}
          </div>
        </section>

        {/* Right Card: Recent Activity */}
        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs">
          <div className="mb-5 h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2 border-b border-[var(--border-subtle)] pb-3 last:border-0">
                <div className="h-4 w-52 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                <div className="h-3 w-40 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
