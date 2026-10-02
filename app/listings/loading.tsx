import React from "react";
import { AppHeader } from "@/components/dashboard/app-header";
import { Container } from "@/components/ui";

export default function ListingsSearchLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1f1f1f] antialiased">
      {/* Render actual AppHeader so header remains solid and doesn't flicker into a skeleton */}
      <AppHeader />

      {/* ── Main Listings Content Skeleton ── */}
      <main className="w-full flex-1 lg:py-16 py-8">
        <Container>
          {/* Top Search Controls Bar Skeleton */}
          <div className="mb-6 animate-pulse">
            <div className="flex h-14 w-full max-w-3xl items-center justify-between rounded-full border border-zinc-200 bg-zinc-50 px-6 shadow-xs">
              <div className="h-4 w-36 rounded bg-zinc-200" />
              <div className="h-4 w-px bg-zinc-200" />
              <div className="h-4 w-28 rounded bg-zinc-100 hidden sm:block" />
              <div className="h-4 w-px bg-zinc-200 hidden sm:block" />
              <div className="h-4 w-24 rounded bg-zinc-100 hidden sm:block" />
              <div className="size-9 rounded-full bg-[#fcdf9c]" />
            </div>
          </div>

          {/* Quick Filters Bar Skeleton */}
          <div className="mb-6 flex items-center justify-between gap-4 border-b border-zinc-200/80 pb-4 animate-pulse">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="h-9 w-24 rounded-full bg-zinc-200 shrink-0" />
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-9 w-28 rounded-full bg-zinc-100 shrink-0 hidden sm:block" />
              ))}
            </div>
            <div className="h-9 w-36 rounded-full bg-zinc-100 shrink-0" />
          </div>

          {/* Split Results Layout (Listings Grid + Sticky Map) */}
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Left Column: Listings Cards */}
            <div className="w-full lg:w-[58%] xl:w-[56%] min-w-0">
              {/* Header Titles */}
              <div className="mb-6 animate-pulse space-y-2">
                <div className="h-7 w-64 rounded-lg bg-zinc-200" />
                <div className="h-4 w-40 rounded bg-zinc-100" />
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="overflow-hidden rounded-[22px] border border-zinc-200 bg-white animate-pulse"
                  >
                    {/* Listing Image */}
                    <div className="aspect-[4/3] w-full bg-zinc-200" />
                    {/* Info */}
                    <div className="p-3.5 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div className="h-4 w-3/4 rounded bg-zinc-200" />
                        <div className="h-4 w-8 rounded bg-zinc-100" />
                      </div>
                      <div className="h-3 w-1/2 rounded bg-zinc-100" />
                      <div className="h-3.5 w-1/3 rounded bg-zinc-200 pt-1" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Sticky Map Skeleton (Desktop) */}
            <div className="hidden lg:block w-full lg:w-[42%] xl:w-[44%] shrink-0 h-[calc(100vh-140px)] rounded-[22px] border border-zinc-200 bg-zinc-100 animate-pulse sticky top-28 overflow-hidden relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex items-center gap-2 rounded-full bg-white/90 px-4 py-2 shadow-sm border border-zinc-200">
                  <div className="size-4 rounded-full border-2 border-zinc-300 border-t-zinc-800 animate-spin" />
                  <span className="text-xs font-semibold text-zinc-600">Loading map...</span>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}
