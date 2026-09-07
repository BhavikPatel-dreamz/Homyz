"use client";

export function LoadingSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div aria-label="Loading reservations" role="status" className="grid grid-cols-1 gap-x-7 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} aria-hidden="true" className="min-w-0">
          <div className="aspect-[288/256] w-full rounded-[24px] skeleton-shimmer" />
          <div className="mt-7 h-7 w-3/4 rounded skeleton-shimmer" />
          <div className="mt-2 h-6 w-2/3 rounded skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}
