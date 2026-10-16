import React from "react";

export default function AdminBookingsDashboardLoading() {
  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-12 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="h-7 w-52 bg-[var(--surface-secondary)] rounded-lg mb-2" />
          <div className="h-4 w-72 bg-[var(--surface-secondary)] rounded-md" />
        </div>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-32 bg-[var(--surface-secondary)] rounded-xl" />
          <div className="h-9 w-24 bg-[var(--surface-secondary)] rounded-xl" />
          <div className="h-9 w-36 bg-[var(--surface-secondary)] rounded-xl" />
        </div>
      </div>

      {/* 8 KPI Cards Grid Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-2xs flex flex-col justify-between h-[120px]"
          >
            <div className="flex items-center justify-between">
              <div className="h-3.5 w-24 bg-[var(--surface-secondary)] rounded" />
              <div className="h-7 w-7 bg-[var(--surface-secondary)] rounded-xl" />
            </div>
            <div>
              <div className="h-8 w-16 bg-[var(--surface-secondary)] rounded-md mb-1.5" />
              <div className="h-3 w-32 bg-[var(--surface-secondary)] rounded" />
            </div>
          </div>
        ))}
      </div>

      {/* Pending Requests Section Skeleton */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 shadow-2xs">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4 mb-4">
          <div>
            <div className="h-5 w-44 bg-[var(--surface-secondary)] rounded-md mb-1.5" />
            <div className="h-3.5 w-80 bg-[var(--surface-secondary)] rounded" />
          </div>
          <div className="h-4 w-28 bg-[var(--surface-secondary)] rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-10 bg-[var(--surface-secondary)] rounded-xl" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 bg-[var(--surface-secondary)]/60 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Recent Bookings Section Skeleton */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 shadow-2xs">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4 mb-4">
          <div>
            <div className="h-5 w-36 bg-[var(--surface-secondary)] rounded-md mb-1.5" />
            <div className="h-3.5 w-64 bg-[var(--surface-secondary)] rounded" />
          </div>
          <div className="h-4 w-28 bg-[var(--surface-secondary)] rounded" />
        </div>
        <div className="space-y-3">
          <div className="h-10 bg-[var(--surface-secondary)] rounded-xl" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-[var(--surface-secondary)]/60 rounded-xl" />
          ))}
        </div>
      </div>

      {/* Activity Timeline Skeleton */}
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-6 shadow-2xs">
        <div className="border-b border-[var(--border-subtle)] pb-4 mb-4">
          <div className="h-5 w-48 bg-[var(--surface-secondary)] rounded-md mb-1.5" />
          <div className="h-3.5 w-72 bg-[var(--surface-secondary)] rounded" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-[var(--surface-secondary)] shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-3.5 w-48 bg-[var(--surface-secondary)] rounded" />
                <div className="h-3 w-64 bg-[var(--surface-secondary)]/60 rounded" />
              </div>
              <div className="h-3 w-20 bg-[var(--surface-secondary)] rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

