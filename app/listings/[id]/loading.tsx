import React from "react";
import { AppHeader } from "@/components/dashboard/app-header";
import { Container } from "@/components/ui";

export default function ListingDetailLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1f1f1f] antialiased">
      {/* Render actual AppHeader so header remains solid and doesn't flicker into a skeleton */}
      <AppHeader />

      {/* ── Main Detail Content Skeleton ── */}
      <main className="w-full flex-1">
        <Container className="py-6 sm:py-8">
          {/* Title & Action Bar Skeleton */}
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between animate-pulse">
            <div className="space-y-2">
              <div className="h-8 w-72 sm:w-96 rounded-xl bg-zinc-200" />
              <div className="h-4 w-48 rounded-lg bg-zinc-100" />
            </div>
            <div className="flex items-center gap-3">
              <div className="h-9 w-20 rounded-full bg-zinc-100" />
              <div className="h-9 w-20 rounded-full bg-zinc-100" />
            </div>
          </div>

          {/* Hero Gallery Skeleton */}
          <div className="overflow-hidden rounded-[24px] sm:rounded-[32px] bg-zinc-100 border border-zinc-200 aspect-[16/10] sm:aspect-[2/1] w-full mb-8 animate-pulse">
            <div className="grid h-full w-full grid-cols-1 md:grid-cols-4 gap-2 p-2">
              <div className="h-full md:col-span-2 rounded-2xl bg-zinc-200" />
              <div className="hidden md:grid grid-rows-2 gap-2 h-full">
                <div className="rounded-2xl bg-zinc-200/80" />
                <div className="rounded-2xl bg-zinc-200/80" />
              </div>
              <div className="hidden md:grid grid-rows-2 gap-2 h-full">
                <div className="rounded-2xl bg-zinc-200/80" />
                <div className="rounded-2xl bg-zinc-200/80" />
              </div>
            </div>
          </div>

          {/* Main Content Grid (Left details 7 cols + Right widget 5 cols) */}
          <div className="grid grid-cols-1 gap-9 lg:grid-cols-12 lg:gap-10">
            {/* Left Column */}
            <div className="lg:col-span-7 space-y-8 animate-pulse">
              {/* Host Header */}
              <div className="flex items-center justify-between border-b border-zinc-200/80 pb-6">
                <div className="space-y-2">
                  <div className="h-6 w-48 rounded-lg bg-zinc-200" />
                  <div className="h-4 w-64 rounded-md bg-zinc-100" />
                </div>
                <div className="size-14 rounded-full bg-zinc-200 shrink-0" />
              </div>

              {/* Highlights */}
              <div className="space-y-4 border-b border-zinc-200/80 pb-6">
                <div className="flex items-center gap-4">
                  <div className="size-8 rounded-full bg-zinc-200 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-40 rounded bg-zinc-200" />
                    <div className="h-3 w-60 rounded bg-zinc-100" />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="size-8 rounded-full bg-zinc-200 shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-4 w-36 rounded bg-zinc-200" />
                    <div className="h-3 w-52 rounded bg-zinc-100" />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-3 border-b border-zinc-200/80 pb-6">
                <div className="h-6 w-36 rounded-lg bg-zinc-200" />
                <div className="h-4 w-full rounded bg-zinc-100" />
                <div className="h-4 w-5/6 rounded bg-zinc-100" />
                <div className="h-4 w-4/6 rounded bg-zinc-100" />
              </div>

              {/* Amenities Grid */}
              <div className="space-y-4 border-b border-zinc-200/80 pb-6">
                <div className="h-6 w-44 rounded-lg bg-zinc-200" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="h-10 rounded-xl bg-zinc-100" />
                  <div className="h-10 rounded-xl bg-zinc-100" />
                  <div className="h-10 rounded-xl bg-zinc-100" />
                  <div className="h-10 rounded-xl bg-zinc-100" />
                </div>
              </div>
            </div>

            {/* Right Booking Sidebar */}
            <div className="lg:col-span-5 animate-pulse">
              <div className="rounded-[30px] border border-zinc-200 bg-white p-6 shadow-md space-y-6 sticky top-28">
                <div className="flex items-baseline justify-between border-b border-zinc-100 pb-4">
                  <div className="h-7 w-32 rounded-lg bg-zinc-200" />
                  <div className="h-5 w-24 rounded-full bg-emerald-50" />
                </div>
                <div className="h-28 rounded-2xl bg-zinc-100 border border-zinc-200" />
                <div className="h-12 w-full rounded-full bg-zinc-200" />
                <div className="h-4 w-3/4 mx-auto rounded bg-zinc-100" />
              </div>
            </div>
          </div>
        </Container>
      </main>
    </div>
  );
}
