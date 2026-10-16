/**
 * This child route needs its own boundary. Without it, Next.js falls back to
 * ../loading.tsx, which represents the very different reservation-details
 * page and produces a visible layout shift before the review wizard streams.
 */
export default function BookingReviewLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading review form"
      className="mx-auto flex min-h-[calc(100vh-220px)] w-full max-w-6xl animate-pulse items-center justify-center py-4 sm:py-8 lg:py-12"
    >
      {/* Desktop Skeleton */}
      <div className="hidden w-full items-center gap-12 lg:grid lg:grid-cols-[440px_1fr] lg:gap-16 xl:gap-20">
        <aside className="w-full max-w-[450px] rounded-[30px] border border-zinc-200/90 bg-white p-7 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <div className="h-7 w-3/4 rounded-lg bg-zinc-200" />
          <div className="mt-3 flex items-center gap-2">
            <div className="h-4 w-28 rounded bg-zinc-100" />
            <div className="h-4 w-24 rounded bg-zinc-100" />
          </div>
          <div className="mt-5 aspect-[4/3] w-full rounded-2xl bg-zinc-200" />
          <div className="mt-5 space-y-2">
            <div className="h-5 w-16 rounded bg-zinc-200" />
            <div className="h-4 w-36 rounded bg-zinc-100" />
          </div>
          <div className="my-5 border-t border-zinc-200" />
          <div className="flex items-center justify-between">
            <div className="h-5 w-20 rounded bg-zinc-200" />
            <div className="h-5 w-24 rounded bg-zinc-200" />
          </div>
        </aside>

        <div className="flex max-w-xl flex-col">
          <div className="h-7 w-28 rounded-full bg-zinc-200" />
          <div className="mt-6 h-11 w-4/5 rounded-lg bg-zinc-200" />
          <div className="mt-4 space-y-2">
            <div className="h-4 w-full rounded bg-zinc-100" />
            <div className="h-4 w-5/6 rounded bg-zinc-100" />
            <div className="h-4 w-3/4 rounded bg-zinc-100" />
          </div>
          <div className="mt-8 h-12 w-36 rounded-full bg-zinc-300" />
        </div>
      </div>

      {/* Mobile Skeleton */}
      <div className="block w-full max-w-lg lg:hidden">
        <div className="mb-4 h-7.5 w-7.5 rounded-full border border-zinc-200 bg-zinc-100" />
        <div className="w-full rounded-2xl border border-zinc-200/90 bg-white p-4 sm:p-5 shadow-[0_4px_20px_rgba(0,0,0,0.06)]">
          <div className="flex items-start gap-3.5 sm:gap-4">
            <div className="size-24 sm:size-28 shrink-0 rounded-2xl bg-zinc-200" />
            <div className="flex flex-1 flex-col pt-0.5 space-y-2">
              <div className="h-6 w-3/4 rounded bg-zinc-200" />
              <div className="h-4 w-24 rounded bg-zinc-100" />
              <div className="h-4 w-28 rounded bg-zinc-100" />
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between pt-1">
            <div className="h-4 w-12 rounded bg-zinc-200" />
            <div className="h-4 w-28 rounded bg-zinc-100" />
          </div>
          <div className="my-3.5 border-t border-zinc-200" />
          <div className="flex items-center justify-between">
            <div className="h-5 w-16 rounded bg-zinc-200" />
            <div className="h-5 w-20 rounded bg-zinc-200" />
          </div>
        </div>
        <div className="mt-7 flex flex-col">
          <div className="h-7 w-28 rounded-full bg-zinc-200" />
          <div className="mt-5 h-9 w-4/5 rounded-lg bg-zinc-200" />
          <div className="mt-4 space-y-2">
            <div className="h-4 w-full rounded bg-zinc-100" />
            <div className="h-4 w-5/6 rounded bg-zinc-100" />
          </div>
          <div className="mt-10 h-14 w-full rounded-full bg-zinc-300" />
        </div>
      </div>
    </div>
  );
}
