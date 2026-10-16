export default function ProfileReportsLoading() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8" aria-label="Loading reports">
      <div className="mb-6 h-4 w-28 animate-pulse rounded bg-slate-200" />
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
        <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </main>
  );
}

