import React from "react";

export default function AdminRefundDetailsLoading() {
  return (
    <div className="flex flex-col gap-6 font-sans text-muted-foreground pb-12 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-20 bg-[var(--surface-secondary)] rounded-md" />
            <span className="text-zinc-400">/</span>
            <div className="h-7 w-64 bg-[var(--surface-secondary)] rounded-md" />
          </div>
          <div className="h-4 w-80 bg-[var(--surface-secondary)] rounded-md mt-2" />
        </div>
        <div className="h-9 w-24 bg-[var(--surface-secondary)] rounded-xl" />
      </div>

      {/* 2-Column Content Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="h-48 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6" />
          <div className="h-48 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6" />
          <div className="h-64 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6" />
        </div>
        <div className="space-y-6">
          <div className="h-80 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6" />
        </div>
      </div>
    </div>
  );
}
