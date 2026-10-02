import React from "react";

export default function BookingDetailsLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl pb-16 pt-4 text-[#1F1F1F] animate-pulse">
      {/* Back button skeleton */}
      <div className="h-5 w-32 rounded-lg bg-zinc-200" />

      {/* Main Grid Skeleton */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-14">
        {/* Left Column Skeleton */}
        <div className="min-w-0 space-y-7">
          {/* Header */}
          <div className="border-b border-zinc-200 pb-7">
            <div className="h-4 w-28 rounded bg-zinc-200" />
            <div className="mt-2 h-8 w-3/4 rounded-lg bg-zinc-200" />
            <div className="mt-2 h-4 w-48 rounded bg-zinc-200" />
          </div>

          {/* Banner Skeleton */}
          <div className="h-24 w-full rounded-2xl bg-zinc-100 border border-zinc-200" />

          {/* Stay Info Skeleton */}
          <div className="border-b border-zinc-200 pb-7 space-y-4">
            <div className="h-6 w-40 rounded bg-zinc-200" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="h-20 rounded-2xl bg-zinc-100" />
              <div className="h-20 rounded-2xl bg-zinc-100" />
              <div className="h-20 rounded-2xl bg-zinc-100" />
              <div className="h-20 rounded-2xl bg-zinc-100" />
            </div>
          </div>

          {/* Arrival Info Skeleton */}
          <div className="border-b border-zinc-200 pb-7 space-y-4">
            <div className="h-6 w-48 rounded bg-zinc-200" />
            <div className="h-24 rounded-2xl bg-zinc-100" />
            <div className="grid grid-cols-2 gap-4">
              <div className="h-16 rounded-2xl bg-zinc-100" />
              <div className="h-16 rounded-2xl bg-zinc-100" />
            </div>
          </div>

          {/* Guest Details Skeleton */}
          <div className="border-b border-zinc-200 pb-7 space-y-4">
            <div className="h-6 w-36 rounded bg-zinc-200" />
            <div className="h-24 rounded-2xl bg-zinc-100" />
          </div>

          {/* Host Card Skeleton */}
          <div className="border-b border-zinc-200 pb-7">
            <div className="h-28 rounded-3xl bg-zinc-100" />
          </div>
        </div>

        {/* Right Sticky Sidebar Skeleton */}
        <div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm space-y-4">
            <div className="aspect-[16/10] w-full rounded-2xl bg-zinc-200" />
            <div className="h-6 w-32 rounded bg-zinc-200" />
            <div className="space-y-3 pt-2">
              <div className="h-4 w-full rounded bg-zinc-100" />
              <div className="h-4 w-full rounded bg-zinc-100" />
              <div className="h-4 w-full rounded bg-zinc-100" />
              <div className="h-6 w-full rounded bg-zinc-200 pt-2" />
            </div>
            <div className="pt-4 space-y-2">
              <div className="h-11 w-full rounded-xl bg-zinc-200" />
              <div className="h-10 w-full rounded-xl bg-zinc-100" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

