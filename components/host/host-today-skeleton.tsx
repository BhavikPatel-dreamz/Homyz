"use client";

import { HostHeader } from "./host-header";
import { Container } from "../ui";
import { Footer } from "@/components/dashboard/footer";
import { useLanguage } from "@/lib/i18n/language-context";

export function HostTodaySkeleton({ cardCount = 4 }: { cardCount?: number }) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-white text-[#1F1F1F] font-sans flex flex-col selection:bg-[#FCDF9C]">
      {/* 1. TOP HEADER */}
      <HostHeader />

      {/* 2. MAIN CONTENT AREA */}
      <main aria-busy="true" aria-label={t("host_today_loading_aria", "Loading reservations")} className="w-full min-w-0 flex-1 pb-12 pt-6 sm:pb-24 sm:pt-8">
        <Container>
          {/* Mirrors the centered Today/Upcoming controls and right Filters button. */}
          <div className="mb-6 grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 pb-5 sm:mb-8 sm:pb-6">
            <div className="col-start-2 flex items-center gap-2 py-1">
              <div className="h-10 w-20 rounded-full skeleton-shimmer" />
              <div className="h-10 w-24 rounded-full skeleton-shimmer" />
            </div>
            <div className="col-start-3 justify-self-end h-10 w-24 rounded-full skeleton-shimmer" />
          </div>

          {/* Section Headline Skeleton */}
          <div className="mb-6">
            <div className="h-9 w-72 max-w-full rounded-md skeleton-shimmer" />
          </div>

          {/* Reservation Cards Grid Skeleton */}
          <div className="grid grid-cols-1 items-stretch gap-5 pb-2 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: cardCount }).map((_, i) => (
              <div
                key={i}
                className="relative flex min-h-[386px] w-full min-w-0 flex-col items-center justify-center rounded-[12px] border border-zinc-100 px-4 py-7 sm:min-h-[416px] sm:rounded-[20px] bg-white shadow-[0_1px_5px_rgba(0,0,0,0.1)]"
              >
                <div className="relative flex w-[min(100%,190px)] flex-col items-center gap-5 sm:gap-6">
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
                  <div className="h-10 w-full rounded-xl skeleton-shimmer" />
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
