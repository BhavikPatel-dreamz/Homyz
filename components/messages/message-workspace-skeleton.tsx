function ConversationRows() {
  return (
    <div className="divide-y divide-zinc-100">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex gap-3 p-4">
          <div className="size-11 shrink-0 rounded-full skeleton-shimmer" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex justify-between gap-3">
              <div className="h-4 w-28 rounded skeleton-shimmer" />
              <div className="h-3 w-10 rounded skeleton-shimmer" />
            </div>
            <div className="h-3.5 w-3/4 rounded skeleton-shimmer" />
            <div className="h-3 w-1/2 rounded skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Mirrors the inbox-and-thread geometry used by the guest messages workspace. */
export function GuestMessagesSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading messages" className="grid h-[calc(100vh-190px)] min-h-[600px] grid-cols-1 gap-6 md:grid-cols-[340px_minmax(0,1fr)] lg:grid-cols-[380px_minmax(0,1fr)]">
      <section className="flex min-h-0 flex-col overflow-hidden border border-zinc-300 bg-white shadow-xs">
        <div className="space-y-3 border-b border-zinc-100 p-4">
          <div className="flex items-center justify-between">
            <div className="h-6 w-24 rounded skeleton-shimmer" />
            <div className="h-5 w-10 rounded-full skeleton-shimmer" />
          </div>
          <div className="flex gap-2"><div className="h-8 w-16 rounded-full skeleton-shimmer" /><div className="h-8 w-20 rounded-full skeleton-shimmer" /></div>
          <div className="h-9 w-full rounded-full skeleton-shimmer" />
        </div>
        <ConversationRows />
      </section>
      <section className="hidden min-h-0 flex-col overflow-hidden border border-zinc-300 bg-white shadow-xs md:flex">
        <div className="flex items-center gap-3 border-b border-zinc-100 bg-zinc-50/50 p-4"><div className="size-11 rounded-full skeleton-shimmer" /><div className="space-y-2"><div className="h-4 w-36 rounded skeleton-shimmer" /><div className="h-3 w-24 rounded skeleton-shimmer" /></div></div>
        <div className="flex flex-1 flex-col justify-end gap-4 bg-zinc-50/20 p-6"><div className="h-16 w-3/5 rounded-2xl rounded-bl-none skeleton-shimmer" /><div className="ml-auto h-12 w-2/5 rounded-2xl rounded-br-none skeleton-shimmer" /><div className="h-14 w-1/2 rounded-2xl rounded-bl-none skeleton-shimmer" /></div>
        <div className="border-t border-zinc-100 p-4"><div className="h-11 w-full rounded-xl skeleton-shimmer" /></div>
      </section>
    </div>
  );
}

/** Mirrors the host three-column inbox while preserving its desktop breakpoints. */
export function HostMessagesSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading host messages" className="messages-workspace mx-auto w-full max-w-[1520px] flex-1 px-0 sm:px-6">
      <div className="grid min-h-[680px] grid-cols-1 overflow-hidden bg-white lg:h-[calc(100svh-132px)] lg:grid-cols-[280px_minmax(0,1fr)] lg:border lg:border-zinc-300 xl:grid-cols-[320px_minmax(0,1fr)_362px]">
        <section className="hidden min-h-0 flex-col overflow-hidden border-r border-zinc-300 lg:flex"><div className="space-y-3 border-b border-zinc-200 p-5 xl:pt-12"><div className="h-6 w-24 rounded skeleton-shimmer" /><div className="flex gap-2"><div className="h-8 w-16 rounded-full skeleton-shimmer" /><div className="h-8 w-20 rounded-full skeleton-shimmer" /></div></div><ConversationRows /></section>
        <section className="flex min-h-0 flex-col"><div className="flex items-center gap-3 border-b border-zinc-200 p-5"><div className="size-11 rounded-full skeleton-shimmer" /><div className="space-y-2"><div className="h-4 w-40 rounded skeleton-shimmer" /><div className="h-3 w-28 rounded skeleton-shimmer" /></div></div><div className="flex flex-1 flex-col justify-end gap-4 p-6"><div className="h-16 w-3/5 rounded-2xl skeleton-shimmer" /><div className="ml-auto h-12 w-2/5 rounded-2xl skeleton-shimmer" /></div><div className="border-t border-zinc-200 p-4"><div className="h-11 w-full rounded-xl skeleton-shimmer" /></div></section>
        <aside className="hidden border-l border-zinc-300 p-5 xl:block"><div className="h-5 w-32 rounded skeleton-shimmer" /><div className="mt-6 aspect-square rounded-2xl skeleton-shimmer" /><div className="mt-5 space-y-3"><div className="h-4 w-full rounded skeleton-shimmer" /><div className="h-4 w-3/4 rounded skeleton-shimmer" /></div></aside>
      </div>
    </div>
  );
}
