import React from "react";

export default function AdminReportsLoading() {
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
          <div className="h-9 w-32 bg-[var(--border)] rounded-xl" />
        </div>
      </div>

      {/* 8 Report Type Selector Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs h-24"
          >
            <div className="h-4 w-24 bg-[var(--border)] rounded mb-2" />
            <div className="h-3 w-32 bg-[var(--border)] rounded" />
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="h-14 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3" />

      {/* Preview Table */}
      <div className="h-72 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4" />
    </div>
  );
}

