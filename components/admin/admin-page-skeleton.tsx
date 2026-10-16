/** Content-only fallback: the persistent AdminShell continues to render around it. */
export function AdminPageSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading admin content" className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="h-8 w-56 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-4 w-80 max-w-full rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        </div>
        <div className="h-10 w-28 rounded-xl bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-2xs"
          >
            <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            <div className="mt-4 h-8 w-16 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xs">
        <div className="flex gap-5 border-b border-[var(--border)] p-4">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-4 flex-1 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer"
            />
          ))}
        </div>
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className="flex gap-5 border-b border-[var(--border-subtle)] p-4 last:border-0"
          >
            {Array.from({ length: 5 }).map((_, cellIndex) => (
              <div
                key={cellIndex}
                className="h-4 flex-1 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
