export default function AdminModerationLoading() {
  return (
    <main aria-busy="true" aria-label="Loading moderation overview" className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 font-sans text-muted-foreground">
      {/* Header & Navigation */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-slate-200 dark:border-zinc-800 pb-5">
        <div className="space-y-2">
          <div className="h-3 w-48 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-8 w-80 max-w-full rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-4 w-full max-w-2xl rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="h-8 w-28 rounded-md bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-8 w-28 rounded-md bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-8 w-36 rounded-md bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          <div className="h-8 w-24 rounded-md bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="h-14 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 flex items-center gap-3">
        <div className="h-9 w-32 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        <div className="h-9 w-40 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        <div className="h-9 w-32 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
        <div className="h-9 w-24 rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer ml-auto" />
      </div>

      {/* 6 KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-2xs flex flex-col justify-between h-28"
          >
            <div className="h-3 w-20 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            <div className="h-8 w-14 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer mt-2" />
            <div className="h-2.5 w-16 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer mt-1" />
          </div>
        ))}
      </div>

      {/* 3 Analytics Panels Grid */}
      <div className="grid gap-5 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 shadow-2xs flex flex-col justify-between min-h-[300px]"
          >
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-800 pb-3">
              <div className="h-4 w-36 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            </div>
            <div className="space-y-3 my-4">
              <div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              <div className="h-4 w-5/6 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
              <div className="h-4 w-4/6 rounded bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
            </div>
            <div className="h-8 w-full rounded-lg bg-zinc-200 dark:bg-zinc-800 skeleton-shimmer" />
          </div>
        ))}
      </div>
    </main>
  );
}
