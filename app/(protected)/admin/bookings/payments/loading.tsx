import React from "react";

export default function AdminPaymentsLoading() {
  return (
    <div className="flex flex-col gap-6 font-sans pb-16 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-md mb-2" />
          <div className="h-7 w-64 bg-zinc-200 dark:bg-zinc-800 rounded-lg mb-1.5" />
          <div className="h-4 w-96 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
          <div className="h-9 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
        </div>
      </div>

      {/* 8 KPI Cards Skeleton Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 flex flex-col justify-between h-24"
          >
            <div className="h-3 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
            <div className="h-6 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-md mt-2" />
            <div className="h-2 w-12 bg-zinc-200 dark:bg-zinc-800 rounded-md mt-1" />
          </div>
        ))}
      </div>

      {/* Tabs Skeleton */}
      <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2 overflow-x-auto">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-8 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-xl shrink-0" />
        ))}
      </div>

      {/* Search and Filters Toolbar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="h-10 w-full max-w-md bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
        <div className="flex items-center gap-2">
          <div className="h-10 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
          <div className="h-10 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="h-12 border-b border-[var(--border)] bg-[var(--surface-secondary)]/50" />
        <div className="divide-y divide-[var(--border)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 flex items-center px-4 gap-4">
              <div className="h-4 w-28 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
              <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
              <div className="h-4 w-36 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
              <div className="h-4 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-md ml-auto" />
              <div className="h-4 w-16 bg-zinc-200 dark:bg-zinc-800 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

