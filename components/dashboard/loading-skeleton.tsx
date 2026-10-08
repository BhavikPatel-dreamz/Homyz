"use client";

export function LoadingSkeleton({
  count = 4,
  tab = "upcoming",
  showFilterBar = true,
  wideGuestGrid = false,
  compactCards = false,
}: {
  count?: number;
  tab?: "today" | "upcoming" | "past" | "all" | string;
  showFilterBar?: boolean;
  wideGuestGrid?: boolean;
  /** Matches the compact card treatment used by profile trip lists. */
  compactCards?: boolean;
}) {
  const isPast = tab === "past";

  return (
    <div aria-label="Loading reservations" role="status" className="flex flex-col gap-8 sm:pb-12 pb-5 animate-pulse">
      {showFilterBar && (
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-2">
              <div className="h-8 w-64 rounded-lg bg-zinc-200 skeleton-shimmer" />
              <div className="h-4 w-80 rounded bg-zinc-100 skeleton-shimmer" />
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-100 p-1 w-fit">
              <div className="h-7 w-16 rounded-full bg-zinc-200 skeleton-shimmer" />
              <div className="h-7 w-20 rounded-full bg-zinc-200 skeleton-shimmer" />
              <div className="h-7 w-16 rounded-full bg-zinc-200 skeleton-shimmer" />
              <div className="h-7 w-14 rounded-full bg-zinc-200 skeleton-shimmer" />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <div className="h-[46px] flex-1 w-full rounded-[30px] bg-zinc-100 border border-zinc-200 skeleton-shimmer" />
            <div className="h-[46px] w-full sm:w-36 rounded-[30px] bg-zinc-100 border border-zinc-200 skeleton-shimmer" />
          </div>
        </div>
      )}

      {/* Main Grid Content Skeleton */}
      {isPast ? (
        <div className="flex flex-col gap-12 sm:gap-14">
          <div className="flex flex-col gap-5">
            {/* Year Header Skeleton */}
            <div className="h-7 w-20 rounded-lg bg-zinc-200 skeleton-shimmer mb-2" />
            <div className="grid max-w-[812px] grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: count }).map((_, i) => (
                <div key={i} className="min-h-[304px] rounded-[24px] border border-zinc-200 bg-white p-4 shadow-2xs">
                  <div className="aspect-[16/10] w-full rounded-[18px] bg-zinc-200 skeleton-shimmer" />
                  <div className="mt-3.5 h-3.5 w-1/2 rounded bg-zinc-200 skeleton-shimmer" />
                  <div className="mt-2 h-5 w-4/5 rounded bg-zinc-200 skeleton-shimmer" />
                  <div className="mt-1.5 h-4 w-3/5 rounded bg-zinc-100 skeleton-shimmer" />
                  <div className="mt-3 h-3 w-2/5 rounded bg-zinc-100 skeleton-shimmer" />
                </div>
              ))}
            </div>
          </div>

          {/* My Reviews Section Skeleton below Past Bookings */}
          <div className="pt-10 border-t border-zinc-200/80 space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-200/80 pb-4">
              <div className="space-y-2">
                <div className="h-7 w-36 rounded bg-zinc-200 skeleton-shimmer" />
                <div className="h-4 w-64 rounded bg-zinc-100 skeleton-shimmer" />
              </div>
              <div className="h-6 w-20 rounded-full bg-zinc-100 skeleton-shimmer" />
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 max-w-[812px]">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-zinc-200 bg-white p-5 space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b border-zinc-100">
                    <div className="h-12 w-12 rounded-xl bg-zinc-200 skeleton-shimmer shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-4 w-32 rounded bg-zinc-200 skeleton-shimmer" />
                      <div className="h-3 w-24 rounded bg-zinc-100 skeleton-shimmer" />
                    </div>
                  </div>
                  <div className="h-4 w-20 rounded bg-zinc-200 skeleton-shimmer" />
                  <div className="h-12 w-full rounded bg-zinc-100 skeleton-shimmer" />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className={wideGuestGrid
          ? "grid grid-cols-1 items-start gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
          : compactCards
            ? "grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4"
          : "grid max-w-[812px] grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3"}>
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className={compactCards ? "" : "min-h-[304px] rounded-[24px] border border-zinc-200 bg-white p-4 shadow-2xs"}>
              <div className={compactCards
                ? "h-[207px] w-full rounded-[18px] bg-zinc-200 skeleton-shimmer"
                : "aspect-[16/10] w-full rounded-[18px] bg-zinc-200 skeleton-shimmer"}
              />
              <div className={compactCards ? "mt-3 h-5 w-4/5 rounded bg-zinc-200 skeleton-shimmer" : "mt-3.5 h-3.5 w-1/2 rounded bg-zinc-200 skeleton-shimmer"} />
              <div className={compactCards ? "mt-1 h-4 w-3/5 rounded bg-zinc-100 skeleton-shimmer" : "mt-2 h-5 w-4/5 rounded bg-zinc-200 skeleton-shimmer"} />
              <div className={compactCards ? "mt-1 h-3 w-2/5 rounded bg-zinc-100 skeleton-shimmer" : "mt-1.5 h-4 w-3/5 rounded bg-zinc-100 skeleton-shimmer"} />
              {!compactCards && <div className="mt-3 h-3 w-2/5 rounded bg-zinc-100 skeleton-shimmer" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
