import React from "react";

export default function AdminAllBookingsLoading() {
  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-12 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="h-7 w-48 bg-[var(--surface-secondary)] rounded-lg mb-2" />
          <div className="h-4 w-72 bg-[var(--surface-secondary)] rounded-md" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-24 bg-[var(--surface-secondary)] rounded-xl" />
          <div className="h-9 w-28 bg-[var(--surface-secondary)] rounded-xl" />
        </div>
      </div>

      {/* Status Tabs Skeleton */}
      <div className="flex items-center gap-1.5 pb-1 border-b border-[var(--border-subtle)]">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-[var(--surface-secondary)] rounded-xl" />
        ))}
      </div>

      {/* Toolbar Skeleton */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:p-4 shadow-2xs">
        <div className="h-9 flex-1 bg-[var(--surface-secondary)] rounded-xl" />
        <div className="flex items-center gap-2">
          <div className="h-9 w-36 bg-[var(--surface-secondary)] rounded-xl" />
          <div className="h-9 w-24 bg-[var(--surface-secondary)] rounded-xl" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="h-10 bg-[var(--surface-secondary)] border-b border-[var(--border-subtle)]" />
        <div className="divide-y divide-[var(--border-subtle)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 bg-[var(--surface-secondary)]/50 px-4 py-3 flex items-center justify-between">
              <div className="h-4 w-20 bg-[var(--surface-secondary)] rounded" />
              <div className="h-4 w-36 bg-[var(--surface-secondary)] rounded" />
              <div className="h-4 w-24 bg-[var(--surface-secondary)] rounded" />
              <div className="h-4 w-28 bg-[var(--surface-secondary)] rounded" />
              <div className="h-4 w-16 bg-[var(--surface-secondary)] rounded" />
            </div>
          ))}
        </div>
      </div>

      {/* Pagination Skeleton */}
      <div className="flex items-center justify-between pt-3 border-t border-[var(--border-subtle)]">
        <div className="h-4 w-40 bg-[var(--surface-secondary)] rounded" />
        <div className="h-8 w-48 bg-[var(--surface-secondary)] rounded-xl" />
      </div>
    </div>
  );
}

