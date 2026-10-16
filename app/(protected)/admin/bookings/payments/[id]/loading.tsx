import React from "react";

export default function AdminPaymentDetailsLoading() {
  return (
    <div className="flex flex-col gap-6 font-sans pb-20 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)] pb-5">
        <div>
          <div className="h-4 w-32 bg-zinc-200 dark:bg-zinc-800 rounded-md mb-2" />
          <div className="h-7 w-72 bg-zinc-200 dark:bg-zinc-800 rounded-lg mb-1" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
          <div className="h-9 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-xl" />
        </div>
      </div>

      {/* 2-Column Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 h-48" />
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 h-60" />
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 h-48" />
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 h-64" />
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 h-48" />
        </div>
      </div>
    </div>
  );
}

