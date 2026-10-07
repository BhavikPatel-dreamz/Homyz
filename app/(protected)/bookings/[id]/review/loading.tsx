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
      className="mx-auto grid w-full max-w-6xl animate-pulse gap-8 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-14"
    >
      {/* Mirrors BookingReviewWizard's property summary card. */}
      <aside className="h-fit rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm lg:sticky lg:top-28">
        <div className="aspect-[4/3] w-full rounded-2xl bg-zinc-200" />
        <div className="mt-4 h-6 w-4/5 rounded bg-zinc-200" />
        <div className="mt-2 h-4 w-full rounded bg-zinc-100" />
        <div className="mt-2 h-4 w-3/4 rounded bg-zinc-100" />
        <div className="mt-4 border-t border-zinc-200 pt-4">
          <div className="h-5 w-24 rounded bg-zinc-200" />
        </div>
      </aside>

      {/* Mirrors the initial intro step: it has no rating/input control. */}
      <section className="flex min-h-[560px] flex-col rounded-3xl bg-white px-2 py-3 sm:px-8 sm:py-8">
        <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center text-center">
          <div className="mx-auto h-3 w-20 rounded bg-zinc-100" />
          <div className="mx-auto mt-5 h-10 w-[min(32rem,92%)] rounded-lg bg-zinc-200 sm:h-12" />
          <div className="mx-auto mt-3 h-10 w-[min(27rem,82%)] rounded-lg bg-zinc-200 sm:h-12" />
          <div className="mx-auto mt-4 h-4 w-[min(25rem,80%)] rounded bg-zinc-100" />
          <div className="mx-auto mt-2 h-4 w-[min(20rem,68%)] rounded bg-zinc-100" />
        </div>

        <div className="mx-auto mt-8 w-full max-w-xl">
          <div className="h-1 overflow-hidden rounded-full bg-zinc-200" />
          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="h-11 w-20 rounded-xl bg-zinc-100" />
            <div className="h-11 w-28 rounded-xl bg-zinc-200" />
          </div>
        </div>
      </section>
    </div>
  );
}
