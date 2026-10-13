import React from "react";

export default function AdminAnalyticsLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse font-sans text-muted-foreground pb-20">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="h-4 w-36 bg-[var(--border)] rounded mb-2" />
          <div className="h-8 w-64 bg-[var(--border)] rounded mb-1" />
          <div className="h-3.5 w-80 bg-[var(--border)] rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 bg-[var(--border)] rounded-xl" />
          <div className="h-9 w-28 bg-[var(--border)] rounded-xl" />
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto p-1 bg-[var(--surface-secondary)] rounded-2xl border border-[var(--border)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-[var(--border)] rounded-xl shrink-0" />
        ))}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs flex flex-col justify-between h-24"
          >
            <div className="h-3 w-16 bg-[var(--border)] rounded" />
            <div className="h-6 w-12 bg-[var(--border)] rounded mt-2" />
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-72 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5" />
        <div className="h-72 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5" />
      </div>

      {/* Tables Skeleton */}
      <div className="h-64 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5" />
    </div>
  );
}

