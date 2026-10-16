import React from "react";

export default function AdminGuestsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading guests" className="flex flex-col gap-6 font-sans text-muted-foreground w-full">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-60 max-w-full rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-4 w-96 max-w-full rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        </div>
        <div className="h-9 w-32 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer shrink-0 self-start sm:self-auto" />
      </div>

      {/* 6 KPI Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-2xs flex flex-col justify-between h-28"
          >
            <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            <div className="h-7 w-12 rounded-md bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer mt-2" />
            <div className="h-2.5 w-24 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer mt-1" />
          </div>
        ))}
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
        <div className="h-10 w-full md:w-80 rounded-xl bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer shrink-0" />
          ))}
        </div>
      </div>

      {/* Guests Table */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        </div>
        <div className="divide-y divide-[var(--border-subtle)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer shrink-0" />
                <div className="space-y-1.5">
                  <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  <div className="h-3 w-48 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-6">
                <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                <div className="h-6 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              </div>
              <div className="h-8 w-20 rounded-xl bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
