"use client";

import { HostHeader } from "./host-header";
import { HostSubNav } from "./host-sub-nav";
import { Container } from "../ui";
import { Footer } from "@/components/dashboard/footer";

export function HostListingCardsSkeleton({
  cardCount = 12,
  compact = false,
}: {
  cardCount?: number;
  compact?: boolean;
}) {
  return (
    <div className={`host-listing-workspace grid ${compact ? "grid-cols-2" : "grid-cols-1"} gap-x-4 gap-y-8 sm:grid-cols-2 sm:gap-x-5 sm:gap-y-8 lg:grid-cols-3 xl:grid-cols-4 xl:gap-x-6 xl:gap-y-8`}>
      {Array.from({ length: cardCount }).map((_, i) => (
        <div key={i} className="group relative min-w-0 text-left">
          <div className="relative aspect-[375/352] sm:aspect-[490/514] w-full overflow-hidden rounded-xl sm:rounded-[22px] border border-zinc-200/80 bg-zinc-100 skeleton-shimmer">
            <div className="absolute top-4 left-4 h-7 w-20 rounded-full bg-white/70 backdrop-blur-xs skeleton-shimmer" />
          </div>
          <div className="px-0 pt-3 sm:px-3 lg:pt-6">
            <div className="mb-2 h-5 w-3/4 rounded-md skeleton-shimmer" />
            <div className="h-4 w-1/2 rounded-md skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function HostListingsSkeleton({ cardCount = 12 }: { cardCount?: number }) {
  return (
    <div className="min-h-screen bg-white text-[#1F1F1F] font-sans flex flex-col selection:bg-[#FEE08B]">
      {/* 1. TOP HEADER & SUBNAV */}
      <HostHeader />
      <HostSubNav activeTab="listing" />

      {/* 2. MAIN CONTENT AREA */}
      <main className="listing-main min-w-0 flex-1 pt-7.5 pb-[calc(128px+env(safe-area-inset-bottom))] sm:pt-12 sm:pb-14 lg:pt-16 lg:pb-16">
        <Container className="max-sm:px-6">
          {/* Mobile Title Skeleton */}
          <div className="mb-8 flex items-center justify-between gap-3 sm:hidden">
            <div className="h-7 w-36 rounded-lg skeleton-shimmer" />
            <div className="flex shrink-0 items-center gap-2">
              <div className="size-11 rounded-full skeleton-shimmer" />
              <div className="size-11 rounded-full skeleton-shimmer" />
              <div className="size-11 rounded-full skeleton-shimmer" />
            </div>
          </div>

          {/* Desktop Title & Action Skeleton */}
          <div className="mb-8 hidden items-center justify-between gap-3 sm:mb-9 sm:flex lg:mb-12">
            <div className="h-9 w-48 rounded-lg skeleton-shimmer" />
            <div className="flex items-center gap-3">
              <div className="h-11 w-64 lg:w-80 rounded-full skeleton-shimmer" />
              <div className="h-11 w-44 rounded-full skeleton-shimmer" />
            </div>
          </div>

          {/* Status Tabs Pill Skeleton */}
          <div className="mb-6 flex w-full items-center gap-2 border-b border-[#727272] pb-5 sm:mb-8 sm:w-fit sm:pb-6 overflow-x-auto no-scrollbar py-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-10 w-24 rounded-full skeleton-shimmer shrink-0" />
            ))}
          </div>

          <HostListingCardsSkeleton cardCount={cardCount} />
        </Container>
      </main>

      <Footer />
    </div>
  );
}
