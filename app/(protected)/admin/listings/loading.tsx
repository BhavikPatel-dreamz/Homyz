import React from "react";

export default function AdminListingsLoading() {
  return (
    <div aria-busy="true" aria-label="Loading listings" className="flex flex-col gap-6 font-sans text-muted-foreground">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div className="space-y-2">
          <div className="h-8 w-80 max-w-full rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-4 w-[500px] max-w-full rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        </div>
        <div className="h-9 w-32 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer shrink-0 self-start sm:self-auto" />
      </div>

      {/* 5 Summary Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col justify-between h-24"
          >
            <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            <div className="h-7 w-14 rounded-md bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer mt-2" />
          </div>
        ))}
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs">
        <div className="h-10 w-full md:w-80 rounded-xl bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto">
          <div className="h-9 w-28 rounded-xl bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer shrink-0" />
          <div className="h-9 w-28 rounded-xl bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer shrink-0" />
          <div className="h-9 w-28 rounded-xl bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer shrink-0" />
        </div>
      </div>

      {/* Listings Table Card */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
          <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        </div>
        <div className="divide-y divide-[var(--border-subtle)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 flex-1 min-w-0">
                <div className="size-14 rounded-xl bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer shrink-0" />
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="h-4 w-48 max-w-full rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  <div className="h-3 w-32 max-w-full rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                </div>
              </div>
              <div className="flex items-center gap-6 shrink-0">
                <div className="flex items-center gap-2 hidden md:flex">
                  <div className="size-8 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  <div className="space-y-1">
                    <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                    <div className="h-2.5 w-16 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  </div>
                </div>
                <div className="h-6 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                <div className="h-5 w-16 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer hidden sm:block" />
                <div className="h-8 w-20 rounded-xl bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
