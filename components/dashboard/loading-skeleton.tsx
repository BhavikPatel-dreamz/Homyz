"use client";

import React from "react";

export function LoadingSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col items-center justify-between rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 text-center shadow-2xs"
        >
          <div className="w-full flex flex-col items-center gap-2 mb-3">
            <div className="h-4 w-24 rounded-full skeleton-shimmer" />
            <div className="h-3 w-32 rounded-full skeleton-shimmer" />
          </div>

          <div className="w-full max-w-[170px] aspect-4/3 rounded-2xl skeleton-shimmer my-2" />

          <div className="w-full flex flex-col items-center gap-1.5 mt-2">
            <div className="h-3.5 w-28 rounded-full skeleton-shimmer" />
            <div className="h-3 w-20 rounded-full skeleton-shimmer" />
          </div>

          <div className="mt-4 h-7 w-7 rounded-full skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}
