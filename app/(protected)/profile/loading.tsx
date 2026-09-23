export default function Loading() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading profile"
      className="min-h-[85vh] w-full animate-pulse bg-white pb-14 pt-0 sm:pt-5 lg:pb-28 xl:pt-[88px]"
    >
      <div className="grid grid-cols-1 gap-3 sm:gap-8 lg:grid-cols-[390px_minmax(0,1fr)] lg:gap-12 xl:grid-cols-[452px_minmax(0,1fr)]">
        <aside className="order-2 w-full shrink-0 lg:order-1">
          <div className="mb-7 hidden h-9 w-36 rounded-lg bg-zinc-200 lg:block xl:mb-10" />
          <div className="grid grid-cols-2 gap-1.5 lg:block lg:mt-3 lg:space-y-0">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="flex min-h-[142px] items-center justify-center gap-3 rounded-lg border border-zinc-100 p-4 lg:h-[72px] lg:min-h-0 lg:justify-start lg:rounded-none lg:border-x-0 lg:border-t-0 lg:py-0 xl:h-[88px]"
              >
                <div className="h-10 w-10 rounded-full bg-zinc-200 lg:h-12 lg:w-12 xl:h-16 xl:w-16" />
                <div className="h-4 w-20 rounded bg-zinc-200" />
              </div>
            ))}
          </div>
        </aside>

        <main className="order-1 flex min-w-0 flex-col lg:order-2">
          <div className="mb-8 h-10 w-36 rounded-lg bg-zinc-200" />
          <div className="mb-8 flex gap-6">
            <div className="h-[124px] w-[124px] shrink-0 rounded-xl bg-zinc-200 sm:h-[151px] sm:w-[233px] sm:rounded-2xl" />
            <div className="flex flex-1 flex-col justify-center gap-3">
              <div className="h-5 w-40 rounded bg-zinc-200" />
              <div className="h-4 w-28 rounded bg-zinc-100" />
              <div className="h-4 w-48 rounded bg-zinc-100" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="h-5 w-32 rounded bg-zinc-200" />
            <div className="h-4 w-full rounded bg-zinc-100" />
            <div className="h-4 w-5/6 rounded bg-zinc-100" />
          </div>
        </main>
      </div>
    </div>
  );
}
