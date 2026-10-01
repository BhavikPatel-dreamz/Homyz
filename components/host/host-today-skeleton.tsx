"use client";

import { HostHeader } from "./host-header";
import { HostSubNav } from "./host-sub-nav";
import { Container } from "../ui";
import { Footer } from "@/components/dashboard/footer";

export function HostTodaySkeleton({ cardCount = 4 }: { cardCount?: number }) {
  return (
    <div className="min-h-screen bg-white text-[#1F1F1F] font-sans flex flex-col selection:bg-[#FEE08B]">
      {/* 1. TOP HEADER & SUBNAV */}
      <HostHeader />
      <HostSubNav activeTab="today" />

      {/* 2. MAIN CONTENT AREA */}
      <main className="w-full min-w-0 flex-1 pb-12 pt-10 sm:pb-24 sm:pt-10">
        <Container>
          {/* Toggle & Filter Bar Skeleton */}
          <div className="mb-6 flex w-full items-center justify-between gap-3 border-b border-[#727272] pb-5 sm:mb-10 sm:w-fit sm:pb-7">
            <div className="flex items-center gap-2">
              <div className="h-11 w-20 rounded-full skeleton-shimmer" />
              <div className="h-11 w-24 rounded-full skeleton-shimmer" />
            </div>
            <div className="size-12 rounded-full sm:hidden skeleton-shimmer" />
          </div>

          {/* Section Headline Skeleton */}
          <div className="mb-6 sm:mb-8">
            <div className="h-9 w-64 sm:w-80 rounded-lg skeleton-shimmer" />
          </div>

          {/* Reservation Cards Grid Skeleton */}
          <div className="grid grid-cols-1 items-stretch gap-5 pb-2 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: cardCount }).map((_, i) => (
              <div
                key={i}
                className="relative flex min-h-[330px] w-full min-w-0 flex-col items-center justify-center rounded-[12px] border border-zinc-100 px-4 py-8 sm:min-h-[362px] sm:rounded-[20px] bg-white shadow-[0_1px_5px_rgba(0,0,0,0.1)]"
              >
                <div className="relative flex w-[170px] flex-col items-center gap-[28px] sm:gap-[32px]">
                  {/* Time + Subtitle Skeleton */}
                  <div className="flex flex-col items-center gap-2">
                    <div className="h-5 w-24 rounded-md skeleton-shimmer" />
                    <div className="h-4 w-32 rounded-md skeleton-shimmer" />
                  </div>

                  {/* Thumbnail + Badge Skeleton */}
                  <div className="relative flex flex-col items-center">
                    <div className="h-[110px] w-[149.79px] rounded-[23px] skeleton-shimmer" />
                    <div className="absolute -top-[20px] left-1/2 -translate-x-1/2 size-10 rounded-full skeleton-shimmer border border-zinc-200" />
                  </div>

                  {/* Property Name + Details Skeleton */}
                  <div className="flex flex-col items-center gap-1.5 w-full">
                    <div className="h-3.5 w-3/4 rounded-md skeleton-shimmer" />
                    <div className="h-3 w-1/2 rounded-md skeleton-shimmer" />
                  </div>

                  {/* Action Button Skeleton */}
                  <div className="size-8 rounded-full skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        </Container>
      </main>

      <Footer />
    </div>
  );
}

