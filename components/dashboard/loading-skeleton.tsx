"use client";

export function LoadingSkeleton({
  count = 4,
  wideGuestGrid = false,
}: {
  count?: number;
  wideGuestGrid?: boolean;
}) {
  return (
    <div
      aria-label="Loading reservations"
      role="status"
      className={wideGuestGrid
        ? "grid grid-cols-1 items-start gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
        : "grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-4"}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} aria-hidden="true" className="flex flex-col">
          <div className="h-[207px] w-full rounded-[18px] skeleton-shimmer" />
          <div className="mt-3 h-6 w-full rounded skeleton-shimmer" />
          <div className="mt-1 h-6 w-2/3 rounded skeleton-shimmer" />
          <div className="mt-1 h-4 w-4/5 rounded skeleton-shimmer" />
          <div className="mt-1 h-3 w-1/2 rounded skeleton-shimmer" />
        </div>
      ))}
    </div>
  );
}
