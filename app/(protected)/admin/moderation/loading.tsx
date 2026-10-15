export default function AdminModerationLoading() {
  return <main className="space-y-6 px-4 py-6 sm:px-6 lg:px-8" aria-label="Loading moderation overview"><div className="h-8 w-56 animate-pulse rounded bg-slate-200" /><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-slate-200" />)}</div><div className="grid gap-5 xl:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="h-64 animate-pulse rounded-xl bg-slate-200" />)}</div></main>;
}
