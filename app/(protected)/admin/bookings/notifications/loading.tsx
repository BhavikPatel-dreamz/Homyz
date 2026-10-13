import React from "react";

export default function AdminNotificationsLoading() {
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
          <div className="h-9 w-24 bg-[var(--border)] rounded-xl" />
        </div>
      </div>

      {/* 7 KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xs flex flex-col justify-between h-20"
          >
            <div className="h-3 w-16 bg-[var(--border)] rounded" />
            <div className="h-5 w-10 bg-[var(--border)] rounded mt-2" />
          </div>
        ))}
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-20 bg-[var(--border)] rounded-full shrink-0" />
          ))}
        </div>
        <div className="h-9 w-full md:w-64 bg-[var(--border)] rounded-xl shrink-0" />
      </div>

      {/* Table Skeleton */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-2xs">
        <div className="divide-y divide-[var(--border)]">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--border)] shrink-0" />
                <div className="flex flex-col gap-1.5">
                  <div className="h-4 w-48 bg-[var(--border)] rounded" />
                  <div className="h-3 w-32 bg-[var(--border)] rounded" />
                </div>
              </div>
              <div className="h-6 w-20 bg-[var(--border)] rounded-full hidden sm:block" />
              <div className="h-8 w-20 bg-[var(--border)] rounded-xl" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

