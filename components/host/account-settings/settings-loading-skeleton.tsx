import React from "react";

export function SettingsLoadingSkeleton({
  cardsCount = 6,
  showSidebar = false,
}: {
  cardsCount?: number;
  showSidebar?: boolean;
}) {
  return (
    <div
      aria-busy="true"
      aria-label="Loading host account settings"
      className="w-full animate-pulse"
    >
      {/* Header Skeleton */}
      <div className="mb-8 border-b border-zinc-200/60 pb-6">
        <div className="h-3 w-40 rounded-full bg-zinc-200" />
        <div className="mt-4 h-8 w-64 rounded-xl bg-zinc-200 sm:w-80" />
        <div className="mt-2 h-4 w-full max-w-md rounded-lg bg-zinc-100" />
      </div>

      <div className={showSidebar ? "grid grid-cols-1 gap-8 lg:grid-cols-4" : ""}>
        {showSidebar && (
          <div className="hidden lg:block space-y-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-12 w-full rounded-2xl bg-zinc-100" />
            ))}
          </div>
        )}

        <div className={showSidebar ? "lg:col-span-3" : ""}>
          {/* Cards Grid Skeleton */}
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: cardsCount }).map((_, index) => (
              <div
                key={index}
                className="flex h-56 flex-col justify-between rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-2xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <div className="size-12 rounded-2xl bg-zinc-200" />
                    <div className="h-5 w-16 rounded-full bg-zinc-100" />
                  </div>
                  <div className="mt-5 space-y-2">
                    <div className="h-5 w-36 rounded-lg bg-zinc-200" />
                    <div className="h-3.5 w-full rounded-md bg-zinc-100" />
                    <div className="h-3.5 w-4/5 rounded-md bg-zinc-100" />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-zinc-100 pt-3">
                  <div className="h-3 w-20 rounded bg-zinc-100" />
                  <div className="size-4 rounded-full bg-zinc-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

