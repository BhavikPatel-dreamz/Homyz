export default function AdminModerationLoading() {
  return (
    <main aria-label="Loading moderation overview" className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="border-b border-slate-200 pb-5">
        <div className="h-3 w-48 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-8 w-80 animate-pulse rounded bg-slate-200" />
        <div className="mt-2 h-4 w-full max-w-2xl animate-pulse rounded bg-slate-200" />
      </div>
      <div className="h-12 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-slate-200" />)}
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => <div key={index} className="h-64 animate-pulse rounded-xl bg-slate-200" />)}
      </div>
    </main>
  );
}
