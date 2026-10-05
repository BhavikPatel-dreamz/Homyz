import React from "react";
import { AppHeader } from "@/components/dashboard/app-header";
import { Container } from "@/components/ui";
import { HomepageLoadingState } from "@/components/home/home-section-skeleton";

export default function HomeLoading() {
  return (
    <div className="flex min-h-screen flex-col bg-white font-sans text-[#1f1f1f] antialiased">
      {/* Render actual AppHeader so header remains solid and doesn't flicker into a skeleton */}
      <AppHeader />

      {/* ── Main Content Skeleton ── */}
      <main className="homepage-main sm:mt-5 w-full flex-1 pb-16 sm:pb-[150px]">
        <Container>
          {/* Mobile Hero Section Skeleton */}
          <div className="block md:hidden animate-pulse">
            <div className="mt-6 h-8 w-64 rounded-xl bg-zinc-200" />
            <div className="mt-5 h-[56px] w-full rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-between pl-6 pr-2">
              <div className="h-4 w-32 rounded bg-zinc-200" />
              <div className="size-11 rounded-full bg-[#fcdf9c]/80" />
            </div>
          </div>

          {/* Desktop / Tablet Hero Section Skeleton */}
          <div className="relative z-20 hidden md:flex min-h-[410px] w-full items-center rounded-[32px] bg-zinc-200/70 sm:min-h-[460px] lg:min-h-[512px] lg:rounded-[60px] animate-pulse px-7 sm:px-12 lg:px-8 xl:px-8">
            <div className="w-full">
              {/* Hero Title Shimmer */}
              <div className="mb-11 space-y-3 max-w-[470px]">
                <div className="h-10 sm:h-12 w-full rounded-2xl bg-zinc-300/80" />
                <div className="h-10 sm:h-12 w-3/4 rounded-2xl bg-zinc-300/80" />
              </div>

              {/* Floating Search Bar Pill Shimmer */}
              <div className="flex h-[66px] w-full max-w-[820px] items-center rounded-full border border-zinc-200 bg-white/90 shadow-md px-6 justify-between">
                <div className="flex-1 space-y-1.5 px-3">
                  <div className="h-3.5 w-16 rounded bg-zinc-300" />
                  <div className="h-3 w-28 rounded bg-zinc-200" />
                </div>
                <div className="h-7 w-px bg-zinc-200" />
                <div className="flex-1 space-y-1.5 px-4">
                  <div className="h-3.5 w-16 rounded bg-zinc-300" />
                  <div className="h-3 w-20 rounded bg-zinc-200" />
                </div>
                <div className="h-7 w-px bg-zinc-200" />
                <div className="flex-1 space-y-1.5 px-4">
                  <div className="h-3.5 w-16 rounded bg-zinc-300" />
                  <div className="h-3 w-20 rounded bg-zinc-200" />
                </div>
                <div className="h-7 w-px bg-zinc-200" />
                <div className="flex items-center gap-3 pl-4">
                  <div className="space-y-1.5">
                    <div className="h-3.5 w-12 rounded bg-zinc-300" />
                    <div className="h-3 w-20 rounded bg-zinc-200" />
                  </div>
                  <div className="size-12 rounded-full bg-[#fcdf9c] shrink-0" />
                </div>
              </div>
            </div>
          </div>

          {/* Listing Sections Carousels Skeleton */}
          <HomepageLoadingState />
        </Container>
      </main>
    </div>
  );
}
