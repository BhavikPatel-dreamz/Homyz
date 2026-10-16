export default function AdminReportedListingsLoading() {
  return (
    <main aria-busy="true" aria-label="Loading reported listings" className="space-y-5 px-4 py-6 sm:px-6 lg:px-8 font-sans text-muted-foreground">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div className="space-y-2">
          <div className="h-3 w-48 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-8 w-56 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        </div>
        <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
      </div>

      {/* Status Tabs Navigation */}
      <div className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-9 w-24 rounded-md bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer shrink-0" />
        ))}
      </div>

      {/* Filter Section */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="h-9 w-full rounded-md bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer xl:col-span-2" />
          <div className="h-9 w-full rounded-md bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-9 w-full rounded-md bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-9 w-full rounded-md bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex gap-4">
          <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer ml-auto" />
        </div>
        <div className="divide-y divide-slate-100 dark:divide-zinc-800/60">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="p-4 flex items-center justify-between gap-4">
              <div className="space-y-1 w-32">
                <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              </div>
              <div className="flex items-center gap-2.5 flex-1 max-w-xs">
                <div className="size-8 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer shrink-0" />
                <div className="space-y-1 flex-1">
                  <div className="h-4 w-28 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                  <div className="h-3 w-36 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
                </div>
              </div>
              <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              <div className="h-6 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              <div className="h-6 w-20 rounded-full bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              <div className="h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer hidden md:block" />
              <div className="h-4 w-12 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}


