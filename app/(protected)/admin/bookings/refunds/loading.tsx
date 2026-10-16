import React from "react";

export default function AdminRefundsLoading() {
  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-12 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-20 bg-[var(--surface-secondary)] rounded-md" />
            <span className="text-zinc-400">/</span>
            <div className="h-7 w-56 bg-[var(--surface-secondary)] rounded-md" />
          </div>
          <div className="h-4 w-96 bg-[var(--surface-secondary)] rounded-md mt-2" />
        </div>

        <div className="flex items-center gap-2.5">
          <div className="h-9 w-24 bg-[var(--surface-secondary)] rounded-xl" />
          <div className="h-9 w-32 bg-[var(--surface-secondary)] rounded-xl" />
        </div>
      </div>

      {/* 8 KPI Metric Cards Skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 bg-[var(--surface-secondary)] rounded" />
              <div className="w-7 h-7 bg-[var(--surface-secondary)] rounded-xl" />
            </div>
            <div className="mt-3">
              <div className="h-7 w-16 bg-[var(--surface-secondary)] rounded" />
              <div className="h-3 w-28 bg-[var(--surface-secondary)] rounded mt-1.5" />
            </div>
          </div>
        ))}
      </div>

      {/* Status Filter Tabs Skeleton */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[var(--border)]">
        {["All Refunds", "Pending Review", "Approved", "Processing", "Completed", "Failed", "Rejected"].map(
          (tab) => (
            <div key={tab} className="h-9 w-28 bg-[var(--surface-secondary)] rounded-xl shrink-0" />
          ),
        )}
      </div>

      {/* Search & Action Bar Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="h-10 w-full max-w-md bg-[var(--surface-secondary)] rounded-xl" />
        <div className="flex items-center gap-2">
          <div className="h-10 w-28 bg-[var(--surface-secondary)] rounded-xl" />
          <div className="h-10 w-28 bg-[var(--surface-secondary)] rounded-xl" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="h-12 border-b border-[var(--border)] bg-[var(--surface-secondary)]/30" />
        <div className="divide-y divide-[var(--border)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--surface-secondary)]" />
                <div className="space-y-1.5">
                  <div className="h-3 w-36 bg-[var(--surface-secondary)] rounded" />
                  <div className="h-2.5 w-24 bg-[var(--surface-secondary)] rounded" />
                </div>
              </div>
              <div className="h-4 w-28 bg-[var(--surface-secondary)] rounded" />
              <div className="h-4 w-20 bg-[var(--surface-secondary)] rounded" />
              <div className="h-8 w-24 bg-[var(--surface-secondary)] rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
