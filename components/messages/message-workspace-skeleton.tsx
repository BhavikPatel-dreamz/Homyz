function ConversationRows() {
  return (
    <div className="divide-y divide-zinc-100">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex gap-3 p-3.5 sm:p-4">
          <div className="size-10 shrink-0 rounded-full skeleton-shimmer" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex justify-between items-center gap-2">
              <div className="h-4 w-28 rounded skeleton-shimmer" />
              <div className="h-3 w-10 rounded skeleton-shimmer shrink-0" />
            </div>
            <div className="h-3.5 w-3/4 rounded skeleton-shimmer" />
            <div className="flex justify-between items-center gap-2 pt-0.5">
              <div className="h-3 w-1/2 rounded skeleton-shimmer" />
              <div className="h-4 w-20 rounded-full skeleton-shimmer shrink-0" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HostConversationRowsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="divide-y divide-zinc-100">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex gap-3 p-3.5 sm:p-4">
          <div className="size-10 shrink-0 rounded-full skeleton-shimmer" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex justify-between items-center gap-2">
              <div className="h-4 w-28 rounded skeleton-shimmer" />
              <div className="h-3 w-10 rounded skeleton-shimmer shrink-0" />
            </div>
            <div className="h-3.5 w-3/4 rounded skeleton-shimmer" />
            <div className="flex justify-between items-center gap-2 pt-0.5">
              <div className="h-3 w-1/2 rounded skeleton-shimmer" />
              <div className="h-4 w-20 rounded-full skeleton-shimmer shrink-0" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function HostChatThreadSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading conversation messages"
      className="flex-1 flex flex-col min-h-0 bg-white"
    >
      {/* Mobile/Tablet Thread Header Skeleton */}
      <div className="flex items-center gap-3 border-b border-zinc-100 p-4 lg:hidden">
        <div className="size-10 rounded-full skeleton-shimmer shrink-0" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-4 w-32 rounded skeleton-shimmer" />
          <div className="h-3 w-24 rounded skeleton-shimmer" />
        </div>
        <div className="h-7 w-20 rounded-full skeleton-shimmer shrink-0" />
      </div>

      {/* Messages Bubbles Area */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-4">
        {/* Date / Status Pill Skeleton */}
        <div className="flex justify-center mb-6">
          <div className="h-4 w-24 rounded-full skeleton-shimmer" />
        </div>

        {/* 1. Guest Message Skeleton (Left-aligned) */}
        <div className="relative flex flex-col items-start pl-10">
          <div className="absolute left-0 top-3 size-8 rounded-full skeleton-shimmer" />
          <div className="order-1 mb-1.5 flex items-center gap-2 px-1">
            <div className="h-2.5 w-16 rounded skeleton-shimmer" />
            <div className="h-2.5 w-10 rounded skeleton-shimmer" />
          </div>
          <div className="order-2 w-64 max-w-[80%] sm:max-w-md rounded-2xl rounded-tl-none bg-zinc-100 p-4 space-y-2 skeleton-shimmer">
            <div className="h-3.5 w-full rounded bg-zinc-200/60" />
            <div className="h-3.5 w-4/5 rounded bg-zinc-200/60" />
            <div className="h-3.5 w-2/3 rounded bg-zinc-200/60" />
          </div>
        </div>

        {/* 2. Host Message Skeleton (Right-aligned) */}
        <div className="flex flex-col items-end ml-auto">
          <div className="order-1 mb-1.5 flex items-center gap-2 px-1">
            <div className="h-2.5 w-8 rounded skeleton-shimmer" />
            <div className="h-2.5 w-10 rounded skeleton-shimmer" />
          </div>
          <div className="order-2 w-56 max-w-[75%] sm:max-w-sm rounded-2xl rounded-tr-none bg-[#E9EBFF]/70 p-3.5 space-y-2 skeleton-shimmer">
            <div className="h-3.5 w-full rounded bg-indigo-200/50" />
            <div className="h-3.5 w-3/4 rounded bg-indigo-200/50" />
          </div>
        </div>

        {/* 3. System / Booking Status Message Skeleton (Center) */}
        <div className="flex justify-center my-2">
          <div className="h-6 w-48 rounded-full border border-zinc-200 bg-zinc-100 skeleton-shimmer" />
        </div>

        {/* 4. Guest Message Skeleton (Left-aligned) */}
        <div className="relative flex flex-col items-start pl-10">
          <div className="absolute left-0 top-3 size-8 rounded-full skeleton-shimmer" />
          <div className="order-1 mb-1.5 flex items-center gap-2 px-1">
            <div className="h-2.5 w-16 rounded skeleton-shimmer" />
            <div className="h-2.5 w-10 rounded skeleton-shimmer" />
          </div>
          <div className="order-2 w-72 max-w-[85%] sm:max-w-md rounded-2xl rounded-tl-none bg-zinc-100 p-4 space-y-2 skeleton-shimmer">
            <div className="h-3.5 w-full rounded bg-zinc-200/60" />
            <div className="h-3.5 w-5/6 rounded bg-zinc-200/60" />
          </div>
        </div>

        {/* 5. Host Message Skeleton (Right-aligned) */}
        <div className="flex flex-col items-end ml-auto">
          <div className="order-1 mb-1.5 flex items-center gap-2 px-1">
            <div className="h-2.5 w-8 rounded skeleton-shimmer" />
            <div className="h-2.5 w-10 rounded skeleton-shimmer" />
          </div>
          <div className="order-2 w-48 max-w-[65%] sm:max-w-xs rounded-2xl rounded-tr-none bg-[#E9EBFF]/70 p-3 space-y-1.5 skeleton-shimmer">
            <div className="h-3.5 w-full rounded bg-indigo-200/50" />
            <div className="h-3.5 w-1/2 rounded bg-indigo-200/50" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function HostRightSidebarSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Loading reservation details"
      className="flex h-full w-full flex-col gap-3 p-4 sm:p-5 overflow-y-auto bg-white"
    >
      {/* 1. Header Section */}
      <div className="border-b border-zinc-200 pb-3 space-y-1.5">
        <div className="h-3 w-12 rounded skeleton-shimmer" />
        <div className="h-4.5 w-48 rounded skeleton-shimmer" />
        <div className="h-3.5 w-32 rounded skeleton-shimmer mt-2" />
        <div className="h-3 w-28 rounded skeleton-shimmer" />
        <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3">
          <div className="h-8 rounded-lg skeleton-shimmer" />
          <div className="h-8 rounded-lg skeleton-shimmer" />
          <div className="col-span-2 sm:col-span-1 h-8 rounded-lg skeleton-shimmer" />
        </div>
      </div>

      {/* 2. Listing Card */}
      <div className="rounded-[10px] border border-zinc-200 bg-white p-3 shadow-xs space-y-2">
        <div className="h-3.5 w-14 rounded skeleton-shimmer" />
        <div className="flex gap-2.5 items-center">
          <div className="size-12 rounded-lg skeleton-shimmer shrink-0" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="h-3.5 w-3/4 rounded skeleton-shimmer" />
            <div className="h-3 w-1/2 rounded skeleton-shimmer" />
            <div className="h-3 w-20 rounded skeleton-shimmer" />
          </div>
        </div>
        <div className="h-7 w-full rounded-lg skeleton-shimmer" />
      </div>

      {/* 3. Guest Profile Card */}
      <div className="rounded-[10px] border border-zinc-200 bg-white p-3 shadow-xs space-y-2.5">
        <div className="h-3.5 w-32 rounded skeleton-shimmer" />
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="size-6 rounded-full skeleton-shimmer shrink-0" />
            <div className="h-3 w-28 rounded skeleton-shimmer" />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="size-6 rounded-full skeleton-shimmer shrink-0" />
            <div className="h-3 w-36 rounded skeleton-shimmer" />
          </div>
        </div>
        <div className="h-3 w-20 rounded skeleton-shimmer" />
      </div>

      {/* 4. Booking Details */}
      <div className="space-y-2.5 border-t border-zinc-200 pt-3">
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-24 rounded skeleton-shimmer" />
          <div className="h-4 w-16 rounded-full skeleton-shimmer" />
        </div>
        <div className="space-y-2">
          <div className="h-11 w-full rounded-[10px] border border-zinc-200 skeleton-shimmer" />
          <div className="h-11 w-full rounded-[10px] border border-zinc-200 skeleton-shimmer" />
          <div className="h-11 w-full rounded-[10px] border border-zinc-200 skeleton-shimmer" />
          <div className="h-11 w-full rounded-[10px] border border-zinc-200 skeleton-shimmer" />
        </div>
        <div className="h-3 w-24 rounded skeleton-shimmer" />
        <div className="h-8 w-full rounded-full skeleton-shimmer mt-2" />
      </div>
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
    <div aria-busy="true" aria-label="Loading host messages" className="messages-workspace mx-auto box-border flex w-full max-w-[1600px] min-w-0 flex-1 px-4 sm:px-6 lg:px-8">
      <div className="grid min-h-[680px] min-w-0 flex-1 grid-cols-1 overflow-hidden bg-white lg:h-[calc(100svh-132px)] lg:grid-cols-[300px_minmax(0,1fr)] lg:border lg:border-zinc-300 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        <section className="hidden min-h-0 flex-col overflow-hidden border-r border-zinc-300 lg:flex">
          <div className="space-y-3 border-b border-zinc-200 p-4 pb-4 pt-4 lg:pb-8 lg:pt-5 xl:pt-12">
            <div className="h-6 w-24 rounded skeleton-shimmer" />
            <div className="flex gap-2">
              <div className="h-8 w-16 rounded-full skeleton-shimmer" />
              <div className="h-8 w-20 rounded-full skeleton-shimmer" />
            </div>
          </div>
          <ConversationRows />
        </section>
        <section className="flex min-h-0 flex-col">
          <HostChatThreadSkeleton />
          <div className="border-t border-zinc-200 p-4"><div className="h-11 w-full rounded-xl skeleton-shimmer" /></div>
        </section>
        <aside className="hidden border-l border-zinc-300 xl:block overflow-hidden">
          <HostRightSidebarSkeleton />
        </aside>
      </div>
    </div>
  );
}
