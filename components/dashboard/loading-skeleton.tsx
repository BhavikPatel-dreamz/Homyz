"use client";

export function LoadingSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-label="Loading reservations" role="status" className="grid max-w-[812px] grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} aria-hidden="true" className="min-h-[304px] rounded-[24px] border border-zinc-200 bg-white p-4 shadow-[0_2px_4px_rgba(0,0,0,0.08)]">
          <div className="aspect-[16/10] w-full rounded-[18px] skeleton-shimmer" />
          <div className="mt-3.5 h-3 w-2/3 rounded skeleton-shimmer" />
          <div className="mt-2 h-5 w-full rounded skeleton-shimmer" />
          <div className="mt-1 h-5 w-4/5 rounded skeleton-shimmer" />
          <div className="mt-2 h-4 w-3/5 rounded skeleton-shimmer" />
          <div className="mt-3 h-3 w-1/2 rounded skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}
